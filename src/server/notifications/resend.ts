import "server-only";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Nome de exibição do remetente (ex.: o nome da barbearia). O endereço segue o do Resend. */
  fromName?: string;
}

/** Sandbox do Resend: só entrega para o e-mail do dono da conta Resend. Nunca usar em produção. */
const RESEND_SANDBOX_FROM = "Barbearia <onboarding@resend.dev>";

/**
 * Nome de exibição seguro para o cabeçalho From: tira quebras de linha e caracteres que
 * quebram o formato `Nome <email>` e põe entre aspas (RFC 5322), para nomes com vírgula,
 * ponto, parênteses etc. não fazerem o Resend recusar o envio (422).
 */
function displayName(name: string): string {
  const clean = name.replace(/[\r\n"<>\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 64);
  return clean ? `"${clean}"` : "";
}

/**
 * Envia e-mail via Resend (HTTPS). Sem RESEND_API_KEY, ou em produção sem NOTIFICATIONS_FROM
 * (remetente de domínio verificado), apenas ignora (retorna skipped) — não quebra o fluxo.
 */
export async function sendEmail({
  to,
  subject,
  html,
  fromName,
}: SendEmailInput): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true, error: "RESEND_API_KEY ausente" };

  const configured = process.env.NOTIFICATIONS_FROM?.trim();
  // Em produção não caímos no sandbox: ele recusa qualquer destinatário que não seja o dono
  // da conta Resend, e cada envio vira FAILED. Sem remetente verificado, é SKIPPED (config).
  if (!configured && process.env.NODE_ENV === "production") {
    console.error("[email] NOTIFICATIONS_FROM ausente em produção — e-mail não enviado");
    return { ok: false, skipped: true, error: "NOTIFICATIONS_FROM ausente" };
  }
  const base = configured || RESEND_SANDBOX_FROM;
  // Cada barbearia aparece com o PRÓPRIO nome no remetente (o endereço permanece o do Resend).
  const address = base.match(/<([^>]+)>/)?.[1] ?? base;
  const name = fromName ? displayName(fromName) : "";
  const from = name ? `${name} <${address}>` : base;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      // Motivo do Resend (ex.: domínio não verificado, remetente inválido) nos logs da Vercel.
      // Sem destinatário no log (LGPD).
      const body = (await res.json().catch(() => null)) as { name?: string; message?: string } | null;
      const reason = [body?.name, body?.message].filter(Boolean).join(": ") || res.statusText;
      console.error(`[email] Resend ${res.status} — ${reason} (from: ${address})`);
      return { ok: false, error: `Resend ${res.status}: ${reason}` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro de rede";
    console.error(`[email] falha de rede no Resend — ${msg}`);
    return { ok: false, error: msg };
  }
}
