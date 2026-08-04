/** Contato oficial da plataforma Barber Agência (suporte + LP). */
export const BARBERAGENCIA_WHATSAPP = "5547988660506"; // (47) 98866-0506
export const BARBERAGENCIA_WHATSAPP_DISPLAY = "(47) 98866-0506";
export const BARBERAGENCIA_EMAIL = "barberagencia@gmail.com";

/** Monta um link wa.me. Adiciona o DDI 55 (Brasil) quando o número vem só com DDD+telefone. */
export function waLink(phone: string, text?: string) {
  let num = String(phone).replace(/\D/g, "");
  if (num.length <= 11) num = `55${num}`; // sem código do país → assume Brasil
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${num}${q}`;
}
