/** Máscaras de input (client-side). */

/** Data DD/MM/AAAA a partir de dígitos digitados. */
export function maskDate(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 8);
  let out = d.slice(0, 2);
  if (d.length > 2) out += "/" + d.slice(2, 4);
  if (d.length > 4) out += "/" + d.slice(4, 8);
  return out;
}

/** Telefone brasileiro: +55 (XX) XXXXX-XXXX (aceita fixo de 10 dígitos também). */
export function maskPhoneBR(value: string): string {
  let d = value.replace(/\D/g, "");
  // remove código do país se colado junto (+55...)
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  d = d.slice(0, 11);
  if (!d) return "";

  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  let out = `(${ddd}`;
  if (d.length > 2) out += ") ";
  if (rest) {
    if (rest.length <= 4) out += rest;
    else out += rest.slice(0, rest.length - 4) + "-" + rest.slice(rest.length - 4);
  }
  return `+55 ${out}`;
}
