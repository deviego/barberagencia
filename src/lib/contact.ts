/** Contato de suporte da barbearia (centro de comunicação). */
export const SUPPORT_WHATSAPP = "5521983120628";
export const SUPPORT_WHATSAPP_DISPLAY = "(21) 98312-0628";

/** Monta um link wa.me para um telefone (só dígitos) com texto opcional. */
export function waLink(phone: string, text?: string) {
  const num = String(phone).replace(/\D/g, "");
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${num}${q}`;
}
