import express from "express";
import QRCode from "qrcode";
import pino from "pino";
import { createClient } from "@supabase/supabase-js";
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import { makeSupabaseAuthState } from "./auth-state.js";

const PORT = process.env.PORT || 8080;
const TOKEN = process.env.WA_SERVICE_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!TOKEN || !SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltam envs: WA_SERVICE_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const log = pino({ level: process.env.LOG_LEVEL || "info" });
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

async function startSession(tenantId, prev) {
  // Evita iniciar duas vezes em paralelo o mesmo tenant.
  const existing = sessions.get(tenantId);
  if (existing?.starting) return existing;

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
    number: prev?.number ?? null,
    attempts: (prev?.attempts ?? 0) + 1,
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
      startSession(tenantId, s).catch((e) => log.error(e, "falha ao reconectar"));
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
      try { s.sock?.end?.(new Error("stuck")); } catch {}
      startSession(tenantId, s).catch((e) => log.error(e, "watchdog restart"));
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

app.get("/health", (_req, res) => res.json({ ok: true, sessions: sessions.size }));

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
    const jid = `${toWhatsPhone(phone)}@s.whatsapp.net`;
    await s.sock.sendMessage(jid, { text: message });
    res.json({ ok: true });
  } catch (e) {
    log.error(e, "send");
    res.status(500).json({ error: "send_failed" });
  }
});

app.post("/sessions/:tenantId/logout", async (req, res) => {
  const s = sessions.get(req.params.tenantId);
  try {
    if (s?.sock) await s.sock.logout().catch(() => {});
  } catch {}
  sessions.set(req.params.tenantId, { sock: null, status: "disconnected", qr: null, number: null, attempts: 0 });
  await supabase.from("wa_sessions").delete().eq("tenant_id", req.params.tenantId).catch(() => {});
  res.json({ ok: true });
});

app.listen(PORT, () => {
  log.info(`wa-gateway ouvindo na porta ${PORT}`);
  rehydrate().catch((e) => log.error(e, "rehydrate"));
  setInterval(tickWatchdog, 20_000).unref();
  setInterval(() => tickReconnectDown().catch(() => {}), WATCHDOG_MS).unref();
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
