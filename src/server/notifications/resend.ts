import "server-only";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Nome de exibição do remetente (ex.: o nome da barbearia). O endereço segue o do Resend. */
  fromName?: string;
}

/**
 * Envia e-mail via Resend (HTTPS). Sem RESEND_API_KEY/NOTIFICATIONS_FROM configurados,
 * apenas ignora (retorna skipped) — não quebra o fluxo de negócio.
 */
export async function sendEmail({
  to,
  subject,
  html,
  fromName,
}: SendEmailInput): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  // Sem remetente configurado, usa o sandbox do Resend (entrega só para o dono da conta).
  const base = process.env.NOTIFICATIONS_FROM || "Barbearia <onboarding@resend.dev>";
  // Cada barbearia aparece com o PRÓPRIO nome no remetente (o endereço permanece o do Resend).
  const address = base.match(/<([^>]+)>/)?.[1] ?? base;
  const from = fromName ? `${fromName} <${address}>` : base;
  if (!key) return { ok: false, skipped: true };
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
