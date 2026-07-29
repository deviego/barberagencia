import "server-only";

/**
 * Envia WhatsApp pelo gateway próprio (Baileys/Render), pelo número da própria
 * barbearia. Requer WA_SERVICE_URL + WA_SERVICE_TOKEN e o tenantId (sessão da
 * barbearia). Sem isso, apenas ignora (não quebra o fluxo).
 */
export async function sendWhatsApp(
  phone: string,
  message: string,
  tenantId?: string | null
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const base = process.env.WA_SERVICE_URL;
  const token = process.env.WA_SERVICE_TOKEN;
  if (!base || !token || !tenantId || !phone) return { ok: false, skipped: true };
  try {
    const res = await fetch(`${base}/sessions/${tenantId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-wa-token": token },
      body: JSON.stringify({ phone, message }),
    });
    if (res.status === 409) return { ok: false, skipped: true }; // barbearia não conectada
    if (!res.ok) return { ok: false, error: `WA ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "erro de rede" };
  }
}
