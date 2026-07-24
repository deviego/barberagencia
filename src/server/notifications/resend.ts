import "server-only";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Envia e-mail via Resend (HTTPS). Sem RESEND_API_KEY/NOTIFICATIONS_FROM configurados,
 * apenas ignora (retorna skipped) — não quebra o fluxo de negócio.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: SendEmailInput): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATIONS_FROM;
  if (!key || !from) return { ok: false, skipped: true };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) return { ok: false, error: `Resend ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "erro de rede" };
  }
}
