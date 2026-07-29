import express from "express";
import QRCode from "qrcode";
import pino from "pino";
import { createClient } from "@supabase/supabase-js";
import makeWASocket, { DisconnectReason } from "@whiskeysockets/baileys";
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

/** sessions: tenantId -> { sock, status, qr, number } */
const sessions = new Map();

function toWhatsPhone(phone) {
  let n = String(phone).replace(/\D/g, "");
  if (n.length <= 11) n = `55${n}`;
  return n;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startSession(tenantId) {
  const { state, saveCreds } = await makeSupabaseAuthState(supabase, tenantId);
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ["Barbearia", "Chrome", "1.0"],
    logger: log.child({ tenant: tenantId }),
    syncFullHistory: false,
  });
  const s = { sock, status: "connecting", qr: null, number: null };
  sessions.set(tenantId, s);

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", async (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      s.status = "qr";
      s.qr = await QRCode.toDataURL(qr);
    }
    if (connection === "open") {
      s.status = "connected";
      s.qr = null;
      s.number = sock.user?.id ? sock.user.id.split(":")[0].split("@")[0] : null;
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
      sessions.delete(tenantId);
      if (code === DisconnectReason.loggedOut) {
        s.status = "disconnected";
        await supabase.from("wa_sessions").delete().eq("tenant_id", tenantId);
        log.warn({ tenant: tenantId }, "logout — sessão removida");
      } else {
        log.warn({ tenant: tenantId, code }, "conexão caiu — reconectando");
        startSession(tenantId).catch((e) => log.error(e, "falha ao reconectar"));
      }
    }
  });

  return s;
}

async function ensureSession(tenantId) {
  const s = sessions.get(tenantId);
  if (s) return s;
  return startSession(tenantId);
}

// --- auth middleware ---
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  if (req.get("x-wa-token") !== TOKEN) return res.status(401).json({ error: "unauthorized" });
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/sessions/:tenantId/connect", async (req, res) => {
  try {
    const s = await ensureSession(req.params.tenantId);
    res.json({ status: s.status, qr: s.qr, number: s.number });
  } catch (e) {
    log.error(e, "connect");
    res.status(500).json({ error: "connect_failed" });
  }
});

app.get("/sessions/:tenantId/status", (req, res) => {
  const s = sessions.get(req.params.tenantId);
  if (!s) return res.json({ status: "disconnected" });
  res.json({ status: s.status, qr: s.qr, number: s.number });
});

app.post("/sessions/:tenantId/send", async (req, res) => {
  const { phone, message } = req.body || {};
  if (!phone || !message) return res.status(400).json({ error: "phone/message obrigatórios" });
  try {
    let s = await ensureSession(req.params.tenantId);
    for (let i = 0; i < 20 && s.status !== "connected"; i++) {
      await sleep(500);
      s = sessions.get(req.params.tenantId) || s;
    }
    if (s.status !== "connected") return res.status(409).json({ error: "not_connected", status: s.status });
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
  sessions.delete(req.params.tenantId);
  await supabase.from("wa_sessions").delete().eq("tenant_id", req.params.tenantId).catch(() => {});
  res.json({ ok: true });
});

app.listen(PORT, () => log.info(`wa-gateway ouvindo na porta ${PORT}`));
