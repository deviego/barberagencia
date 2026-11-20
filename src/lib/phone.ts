/**
 * Regra ÚNICA de telefone (Brasil). Mesma regra da função public.br_phone_key (schema-52):
 * os dois lados precisam dar o mesmo resultado para o mesmo texto (o teste confere).
 *
 * Chave = DDD + número, só dígitos, 10 (fixo) ou 11 (celular) dígitos, sem o 55.
 *   - aceita máscara, espaços, "+55" e o 0 de discagem na frente ("021 ...");
 *   - celular: 11 dígitos começando com 9 depois do DDD; fixo: 10 dígitos começando de 2 a 8;
 *   - qualquer outra coisa → null (inválido).
 * Comparação sempre por igualdade da chave, nunca pelo final do número.
 */
export function phoneKey(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 40) return null;
  let d = raw.replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if ((d.length === 11 || d.length === 12) && d.startsWith("0")) d = d.slice(1);
  return PHONE_KEY_RE.test(d) ? d : null;
}

/** Chave válida: DDD sem zero + celular (9 + 8 dígitos) ou fixo (2–8 + 7 dígitos). */
export const PHONE_KEY_RE = /^[1-9][1-9](?:9\d{8}|[2-8]\d{7})$/;

/** Texto para exibir/gravar em clients.phone a partir da chave: "(21) 99999-0000" ou "(21) 3333-0000". */
export function formatPhoneKey(key: string): string {
  if (key.length === 11) return `(${key.slice(0, 2)}) ${key.slice(2, 7)}-${key.slice(7)}`;
  return `(${key.slice(0, 2)}) ${key.slice(2, 6)}-${key.slice(6)}`;
}
