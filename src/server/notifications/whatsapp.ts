import "server-only";

/** Normaliza telefone BR para o formato do WhatsApp (só dígitos, com DDI 55). */
function toWhatsPhone(phone: string) {
  let n = String(phone).replace(/\D/g, "");
  if (n.length <= 11) n = `55${n}`;
  return n;
}

/**
 * Envia mensagem de WhatsApp via Z-API (não-oficial). Ativa quando ZAPI_INSTANCE +
 * ZAPI_TOKEN estão setados; sem eles, apenas ignora (não quebra o fluxo).
 * Docs: POST {base}/instances/{instance}/token/{token}/send-text  { phone, message }
 */
export async function sendWhatsApp(
  phone: string,
  message: string
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const instance = process.env.ZAPI_INSTANCE;
  const token = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  const base = process.env.ZAPI_BASE_URL || "https://api.z-api.io";
  if (!instance || !token) return { ok: false, skipped: true };
  if (!phone) return { ok: false, skipped: true };
  try {
    const res = await fetch(`${base}/instances/${instance}/token/${token}/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(clientToken ? { "Client-Token": clientToken } : {}),
      },
      body: JSON.stringify({ phone: toWhatsPhone(phone), message }),
    });
    if (!res.ok) return { ok: false, error: `Z-API ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "erro de rede" };
  }
}
