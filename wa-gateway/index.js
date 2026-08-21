import express from "express";
import QRCode from "qrcode";
import pino from "pino";
import cron from "node-cron";
import PDFDocument from "pdfkit";
import { createClient } from "@supabase/supabase-js";
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import { makeSupabaseAuthState } from "./auth-state.js";

const PORT = process.env.PORT || 8080;
const TOKEN = process.env.WA_SERVICE_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Relatório mensal (automação): consome o app, gera PDF e envia no WhatsApp.
const REPORT = {
  appUrl: (process.env.APP_REPORT_URL || "").replace(/\/$/, ""), // ex.: https://www.barberagencia.com
  token: process.env.REPORT_TOKEN || "",
  senderSession: process.env.REPORT_SENDER_SESSION || "", // tenant_id da sessão remetente (Barber Agência)
  recipients: (process.env.REPORT_RECIPIENTS || "").split(",").map((s) => s.trim()).filter(Boolean),
};

if (!TOKEN || !SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltam envs: WA_SERVICE_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const log = pino({ level: process.env.LOG_LEVEL || "info" });

// Rede/Baileys geram rejeições/erros esporádicos. No Node 22 isso encerra o processo
// (crash-loop no Render). Mantemos o gateway VIVO e logamos — o estado vive no Supabase,
// então watchdogs/re-hidratação recuperam a sessão sem derrubar o serviço.
process.on("unhandledRejection", (e) => log.error({ err: e?.message ?? String(e) }, "unhandledRejection"));
process.on("uncaughtException", (e) => log.error({ err: e?.message ?? String(e) }, "uncaughtException"));
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const app = express();
app.use(express.json());

/** sessions: tenantId -> { sock, status, qr, number, attempts, connectingSince, starting } */
const sessions = new Map();

const MAX_ATTEMPTS = 8; // reconexões seguidas antes de desistir (até novo /connect ou watchdog)
const CONNECTING_TIMEOUT_MS = 60_000; // preso em "connecting" além disso → reinicia
const WATCHDOG_MS = 3 * 60_000; // varredura periódica de auto-cura
let waVersion; // versão web do WhatsApp (fetchLatestBaileysVersion)

function toWhatsPhone(phone) {
  let n = String(phone).replace(/\D/g, "");
  if (n.length <= 11) n = `55${n}`;
  return n;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const backoffMs = (attempts) => Math.min(30_000, 2000 * 2 ** Math.max(0, attempts - 1));

async function startSession(tenantId, prev, force = false) {
  const existing = sessions.get(tenantId);
  // Single-flight: uma sessão já iniciando impede abrir outra em paralelo.
  // Dois sockets no mesmo tenant disputam as MESMAS chaves Signal no banco e as
  // corrompem → o WhatsApp do destinatário não decifra ("Aguardando a mensagem").
  if (existing?.starting) return existing;
  // Sem force: se já há socket vivo, reutiliza (não reinicia à toa). Os caminhos que
  // QUEREM reiniciar (close/watchdog) passam force=true e caem fora deste atalho.
  if (!force && existing?.sock && (existing.status === "connecting" || existing.status === "qr" || existing.status === "connected")) {
    return existing;
  }

  // Trava SÍNCRONA antes de qualquer await (fecha a janela de corrida entre os
  // vários caminhos que chamam startSession: reconexão, watchdogs, /status, /send).
  const lock = {
    sock: null,
    status: existing?.status === "connected" ? "connecting" : (existing?.status ?? "connecting"),
    qr: null,
    number: prev?.number ?? existing?.number ?? null,
    attempts: (prev?.attempts ?? existing?.attempts ?? 0) + 1,
    connectingSince: Date.now(),
    starting: true,
  };
  sessions.set(tenantId, lock);

  // Encerra qualquer socket anterior para nunca deixar dois vivos ao mesmo tempo.
  try { prev?.sock?.end?.(undefined); } catch {}
  try { if (existing?.sock && existing.sock !== prev?.sock) existing.sock.end?.(undefined); } catch {}
  await sleep(300); // deixa a persistência pendente do socket antigo assentar antes de recarregar as chaves

  const { state, saveCreds } = await makeSupabaseAuthState(supabase, tenantId);
  const sock = makeWASocket({
    version: waVersion,
    auth: state,
    printQRInTerminal: false,
    browser: ["Barber Agencia", "Chrome", "1.0"],
    logger: log.child({ tenant: tenantId }),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    connectTimeoutMs: 60_000,
    keepAliveIntervalMs: 15_000,
    retryRequestDelayMs: 2000,
  });
  const s = {
    sock,
    status: "connecting",
    qr: null,
    number: lock.number,
    attempts: lock.attempts,
    connectingSince: Date.now(),
    starting: false,
  };
  sessions.set(tenantId, s);

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", async (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      s.status = "qr";
      s.qr = await QRCode.toDataURL(qr);
      s.connectingSince = Date.now(); // aguardando o scan
    }
    if (connection === "open") {
      s.status = "connected";
      s.qr = null;
      s.attempts = 0;
      s.number = sock.user?.id ? sock.user.id.split(":")[0].split("@")[0] : s.number;
      try {
        await supabase
          .from("wa_sessions")
          .update({ number: s.number, updated_at: new Date().toISOString() })
          .eq("tenant_id", tenantId);
      } catch {}
      log.info({ tenant: tenantId, number: s.number }, "conectado");
    }
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      const cur = sessions.get(tenantId);
      // Só age se ainda for esta sessão (evita corrida com um restart mais novo).
      if (cur && cur.sock !== sock) return;

      if (code === DisconnectReason.loggedOut) {
        sessions.set(tenantId, { ...s, sock: null, status: "disconnected", qr: null });
        await supabase.from("wa_sessions").delete().eq("tenant_id", tenantId).catch(() => {});
        log.warn({ tenant: tenantId }, "logout — sessão removida (precisa novo QR)");
        return;
      }
      if (code === DisconnectReason.connectionReplaced) {
        // Outra conexão assumiu (ex.: mesmo número em 2 lugares). Não brigar.
        sessions.set(tenantId, { ...s, sock: null, status: "disconnected", qr: null });
        log.warn({ tenant: tenantId }, "conexão substituída — parando (número em uso em outro lugar?)");
        return;
      }
      if (s.attempts >= MAX_ATTEMPTS) {
        sessions.set(tenantId, { ...s, sock: null, status: "disconnected", qr: null });
        log.error({ tenant: tenantId, code }, "máx. tentativas — desistindo até novo connect/watchdog");
        return;
      }
      const wait = code === DisconnectReason.restartRequired ? 0 : backoffMs(s.attempts);
      log.warn({ tenant: tenantId, code, wait }, "conexão caiu — reconectando");
      await sleep(wait);
      startSession(tenantId, s, true).catch((e) => log.error(e, "falha ao reconectar"));
    }
  });

  return s;
}

async function ensureSession(tenantId) {
  const s = sessions.get(tenantId);
  if (s && (s.status === "connected" || s.status === "connecting" || s.status === "qr") && s.sock) return s;
  return startSession(tenantId, s);
}

// Aguarda a sessão conectar (usado no /send).
async function waitConnected(tenantId, timeoutMs = 15_000) {
  const step = 400;
  for (let waited = 0; waited < timeoutMs; waited += step) {
    const s = sessions.get(tenantId);
    if (s?.status === "connected") return s;
    if (s?.status === "disconnected") return s; // não adianta esperar (logout/replaced)
    await sleep(step);
  }
  return sessions.get(tenantId);
}

// --- Re-hidratação no boot: religa todas as sessões salvas ---
async function rehydrate() {
  try {
    waVersion = (await fetchLatestBaileysVersion()).version;
    log.info({ waVersion }, "versão WhatsApp");
  } catch (e) {
    log.warn({ err: e?.message }, "não obteve a versão do WhatsApp (usa a padrão do Baileys)");
  }
  const { data } = await supabase.from("wa_sessions").select("tenant_id");
  const ids = (data ?? []).map((r) => r.tenant_id);
  log.info({ n: ids.length }, "re-hidratando sessões salvas");
  for (const id of ids) startSession(id).catch((e) => log.error(e, "falha ao re-hidratar"));
}

// --- Watchdogs: connecting preso + auto-cura periódica ---
function tickWatchdog() {
  const now = Date.now();
  for (const [tenantId, s] of sessions) {
    const stuck =
      (s.status === "connecting" || s.status === "qr") &&
      s.connectingSince &&
      now - s.connectingSince > CONNECTING_TIMEOUT_MS &&
      s.attempts < MAX_ATTEMPTS;
    if (stuck) {
      log.warn({ tenant: tenantId, status: s.status }, "preso conectando — reiniciando");
      startSession(tenantId, s, true).catch((e) => log.error(e, "watchdog restart"));
    }
  }
}
async function tickReconnectDown() {
  // Religa tenants que têm creds salvas mas estão sem sessão viva.
  const { data } = await supabase.from("wa_sessions").select("tenant_id").catch(() => ({ data: [] }));
  for (const r of data ?? []) {
    const s = sessions.get(r.tenant_id);
    if (!s || (!s.sock && s.status === "disconnected" && (s.attempts ?? 0) < MAX_ATTEMPTS)) {
      startSession(r.tenant_id, s).catch(() => {});
    }
  }
}

// --- auth middleware ---
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  if (req.get("x-wa-token") !== TOKEN) return res.status(401).json({ error: "unauthorized" });
  next();
});

const BUILD = "report-v6";
app.get("/health", (_req, res) => res.json({ ok: true, sessions: sessions.size, build: BUILD }));

app.post("/sessions/:tenantId/connect", async (req, res) => {
  try {
    const cur = sessions.get(req.params.tenantId);
    if (cur) cur.attempts = 0; // reset ao pedir conexão manual
    const s = await ensureSession(req.params.tenantId);
    res.json({ status: s.status, qr: s.qr, number: s.number });
  } catch (e) {
    log.error(e, "connect");
    res.status(500).json({ error: "connect_failed" });
  }
});

app.get("/sessions/:tenantId/status", async (req, res) => {
  let s = sessions.get(req.params.tenantId);
  // Lazy-restore: sem sessão viva mas com creds salvas → tenta religar.
  if (!s || (!s.sock && s.status !== "connected")) {
    const { data } = await supabase.from("wa_sessions").select("tenant_id").eq("tenant_id", req.params.tenantId).maybeSingle();
    if (data) {
      if (s) s.attempts = 0;
      s = await ensureSession(req.params.tenantId).catch(() => s);
    }
  }
  if (!s) return res.json({ status: "disconnected" });
  res.json({ status: s.status, qr: s.qr, number: s.number });
});

/**
 * Resolve o JID REAL de um número no WhatsApp. Números do Brasil têm a ambiguidade
 * do "9º dígito": o JID interno pode ou não conter o 9 após o DDD. Enviar para o JID
 * montado "na mão" faz o sendMessage resolver localmente (ok) mas nunca entregar.
 * onWhatsApp() devolve o jid correto (e diz se o número existe no WhatsApp).
 */
async function resolveJid(sock, phone) {
  const num = toWhatsPhone(phone); // ex.: 5547996595755
  try {
    const results = await sock.onWhatsApp(`${num}@s.whatsapp.net`);
    const hit = Array.isArray(results) ? results.find((r) => r?.exists && r?.jid) : null;
    if (hit) return { jid: hit.jid, exists: true };
  } catch (e) {
    log.warn({ err: e?.message, num }, "onWhatsApp falhou — usando jid montado");
    // Se a checagem falhar (rede/rate), cai no jid montado como último recurso.
    return { jid: `${num}@s.whatsapp.net`, exists: null };
  }
  return { jid: `${num}@s.whatsapp.net`, exists: false };
}

app.post("/sessions/:tenantId/send", async (req, res) => {
  const { phone, message } = req.body || {};
  if (!phone || !message) return res.status(400).json({ error: "phone/message obrigatórios" });
  try {
    const cur = sessions.get(req.params.tenantId);
    if (cur && cur.status === "disconnected") cur.attempts = 0; // dá nova chance
    await ensureSession(req.params.tenantId);
    const s = await waitConnected(req.params.tenantId, 15_000);
    if (s?.status !== "connected" || !s.sock) {
      return res.status(409).json({ error: s?.status === "disconnected" ? "needs_reconnect" : "not_connected", status: s?.status ?? "disconnected" });
    }
    const { jid, exists } = await resolveJid(s.sock, phone);
    if (exists === false) {
      log.warn({ tenant: req.params.tenantId, phone }, "número não está no WhatsApp");
      return res.status(422).json({ error: "not_on_whatsapp" });
    }
    const result = await s.sock.sendMessage(jid, { text: message });
    res.json({ ok: true, jid, id: result?.key?.id ?? null });
  } catch (e) {
    log.error(e, "send");
    res.status(500).json({ error: "send_failed" });
  }
});

/** Diagnóstico: confere se um número existe no WhatsApp e qual o JID real. */
app.get("/sessions/:tenantId/check", async (req, res) => {
  const phone = req.query.phone;
  if (!phone) return res.status(400).json({ error: "phone obrigatório" });
  try {
    await ensureSession(req.params.tenantId);
    const s = await waitConnected(req.params.tenantId, 15_000);
    if (s?.status !== "connected" || !s.sock) return res.status(409).json({ error: "not_connected", status: s?.status });
    const { jid, exists } = await resolveJid(s.sock, String(phone));
    res.json({ input: String(phone), normalized: toWhatsPhone(String(phone)), jid, exists });
  } catch (e) {
    log.error(e, "check");
    res.status(500).json({ error: "check_failed" });
  }
});

app.post("/sessions/:tenantId/logout", async (req, res) => {
  const tenantId = req.params.tenantId;
  const s = sessions.get(tenantId);
  // O essencial é limpar creds+keys (para re-parear limpo). O unlink no WhatsApp
  // é best-effort: sock.logout() pode TRAVAR num socket em estado ruim (gera 502),
  // então corre contra um timeout curto e, de qualquer forma, encerra o socket.
  if (s?.sock) {
    try { await Promise.race([Promise.resolve(s.sock.logout()).catch(() => {}), sleep(4000)]); } catch {}
    try { s.sock.end?.(undefined); } catch {}
  }
  sessions.set(tenantId, { sock: null, status: "disconnected", qr: null, number: null, attempts: 0, starting: false });
  await supabase.from("wa_sessions").delete().eq("tenant_id", tenantId).catch(() => {});
  res.json({ ok: true });
});

// ============================ Relatório mensal (PDF + WhatsApp) =============
const brl = (n) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);

/** Gera o PDF do relatório a partir do JSON do app. Retorna um Buffer. */
function buildReportPdf(rep) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 42 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const p = rep.platform || {};
    doc.fillColor("#111").fontSize(20).text("Barber Agência — Relatório mensal");
    doc.moveDown(0.2).fillColor("#666").fontSize(11).text(`Período: ${rep.period?.label ?? ""}`);
    doc.moveDown().fillColor("#111").fontSize(13).text("Consolidado da plataforma");
    doc.moveDown(0.3).fontSize(11);
    const line = (k, v) => doc.text(`${k}: ${v}`);
    line("Entradas", brl(p.entradas));
    line("Saídas", brl(p.saidas));
    line("Resultado (líquido)", brl(p.liquido));
    line("Barbearias", `${p.barbershops ?? 0} (${p.activeBarbershops ?? 0} ativas)`);
    line("Clientes", `${p.clients ?? 0} (+${p.newClients ?? 0} no mês)`);
    line("Assinantes ativos", `${p.subscribers ?? 0}`);

    doc.moveDown().fontSize(13).text("Entradas por método").moveDown(0.3).fontSize(11);
    (p.byMethod || []).forEach((m) => line(m.method, brl(m.total)));
    if (!(p.byMethod || []).length) doc.fillColor("#666").text("—").fillColor("#111");

    doc.moveDown().fontSize(13).text("Receita por cliente (top 15)").moveDown(0.3).fontSize(11);
    (p.topClients || []).forEach((c, i) => line(`${i + 1}. ${c.name} — ${c.tenantName}`, brl(c.total)));
    if (!(p.topClients || []).length) doc.fillColor("#666").text("—").fillColor("#111");

    doc.addPage().fontSize(13).text("Por barbearia").moveDown(0.4).fontSize(10);
    (rep.perBarbershop || []).forEach((b) => {
      doc.text(
        `${b.name}  ·  ${b.plan}  ·  clientes ${b.clients} (+${b.newClients})  ·  assinantes ${b.subscribers}  ·  entradas ${brl(b.entradas)}  ·  saídas ${brl(b.saidas)}`
      );
      doc.moveDown(0.2);
    });
    doc.end();
  });
}

/** Envia um documento (PDF) por WhatsApp a partir de uma sessão conectada. */
async function sendDocument(tenantId, phone, buffer, fileName, caption) {
  await ensureSession(tenantId);
  const s = await waitConnected(tenantId, 15_000);
  if (s?.status !== "connected" || !s.sock) return { ok: false, error: "sessão remetente não conectada" };
  const { jid, exists } = await resolveJid(s.sock, phone);
  if (exists === false) return { ok: false, error: "número não está no WhatsApp" };
  await s.sock.sendMessage(jid, { document: buffer, fileName, mimetype: "application/pdf", caption });
  return { ok: true };
}

/** Busca o relatório no app, gera o PDF e envia para os destinatários configurados. */
async function runMonthlyReport(ym) {
  if (!REPORT.appUrl || !REPORT.token) throw new Error("APP_REPORT_URL / REPORT_TOKEN ausentes");
  if (!REPORT.senderSession) throw new Error("REPORT_SENDER_SESSION ausente (sessão remetente)");
  if (!REPORT.recipients.length) throw new Error("REPORT_RECIPIENTS ausente");

  const qs = new URLSearchParams({ token: REPORT.token });
  if (ym) qs.set("ym", ym);
  const res = await fetch(`${REPORT.appUrl}/api/master/report?${qs.toString()}`, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`app respondeu ${res.status}`);
  const rep = await res.json();

  const pdf = await buildReportPdf(rep);
  const fileName = `relatorio-${(rep.period?.label || "mensal").replace(/\s+/g, "-")}.pdf`;
  const caption = `📊 Barber Agência — Relatório mensal (${rep.period?.label ?? ""})`;

  const out = [];
  for (const phone of REPORT.recipients) {
    try {
      const r = await sendDocument(REPORT.senderSession, phone, pdf, fileName, caption);
      out.push({ phone, ...r });
    } catch (e) {
      out.push({ phone, ok: false, error: e?.message });
    }
  }
  log.info({ out }, "relatório mensal enviado");
  return out;
}

// Disparo manual do relatório (para testar): POST /report/run  (?ym=YYYY-MM opcional)
app.post("/report/run", async (req, res) => {
  try {
    const out = await runMonthlyReport(req.query.ym);
    res.json({ ok: true, out });
  } catch (e) {
    log.error(e, "report/run");
    res.status(500).json({ ok: false, error: e?.message });
  }
});

app.listen(PORT, () => {
  log.info(`wa-gateway ouvindo na porta ${PORT}`);
  rehydrate().catch((e) => log.error(e, "rehydrate"));
  setInterval(tickWatchdog, 20_000).unref();
  setInterval(() => tickReconnectDown().catch(() => {}), WATCHDOG_MS).unref();

  // Cron mensal: dia 21, 09:00 (America/Sao_Paulo) → gera e envia o relatório.
  if (REPORT.appUrl && REPORT.token && REPORT.senderSession && REPORT.recipients.length) {
    cron.schedule("0 9 21 * *", () => runMonthlyReport().catch((e) => log.error(e, "cron report")), {
      timezone: "America/Sao_Paulo",
    });
    log.info({ recipients: REPORT.recipients.length }, "cron do relatório mensal ativo (dia 21, 09:00 BRT)");
  } else {
    log.info("relatório mensal inativo (defina APP_REPORT_URL, REPORT_TOKEN, REPORT_SENDER_SESSION, REPORT_RECIPIENTS)");
  }
});

// --- Keep-alive: o próprio serviço bate na sua URL pública a cada 10 min ---
// O Render hiberna serviços free após 15 min SEM tráfego de entrada. Como este processo
// fica sempre rodando (Baileys), ele mesmo gera tráfego pingando a própria URL pública
// (RENDER_EXTERNAL_URL é preenchida automaticamente pelo Render). Sem GitHub/serviço externo.
const SELF_URL = process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL;
if (SELF_URL) {
  const KEEP_ALIVE_MS = 10 * 60 * 1000; // 10 min (< 15 min do spin down)
  setInterval(async () => {
    try {
      const r = await fetch(`${SELF_URL.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(30000) });
      log.debug({ status: r.status }, "keep-alive");
    } catch (e) {
      log.warn({ err: e?.message }, "keep-alive falhou");
    }
  }, KEEP_ALIVE_MS).unref();
  log.info({ url: SELF_URL }, "keep-alive ativo (auto-ping a cada 10 min)");
}
