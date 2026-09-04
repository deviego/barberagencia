/**
 * Identidade por telefone: o cliente pode se cadastrar/logar sem e-mail.
 * Por baixo, geramos um e-mail técnico determinístico a partir do telefone
 * (o Supabase Auth exige um e-mail). O e-mail real, se informado, é só contato.
 */

/** Domínio interno não roteável (nenhum e-mail é enviado — contas são auto-confirmadas). */
const SYNTHETIC_DOMAIN = "cliente.barberagencia.app";

/** Só os dígitos do telefone, tirando o DDI 55 colado e limitando a 11 (igual maskPhoneBR). */
export function phoneDigits(raw: string): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  return d.slice(0, 11);
}

/** E-mail técnico a partir dos dígitos do telefone. */
export function syntheticEmail(digits: string): string {
  return `c${digits}@${SYNTHETIC_DOMAIN}`;
}

export function isEmail(s: string): boolean {
  return /.+@.+\..+/.test(s.trim());
}

/**
 * Dado o que o usuário digitou no login ("e-mail ou telefone"), devolve o
 * e-mail a usar no signInWithPassword: e-mail real como está, ou o técnico.
 */
export function resolveLoginEmail(idOrPhone: string): string {
  const v = idOrPhone.trim();
  if (isEmail(v)) return v.toLowerCase();
  const digits = phoneDigits(v);
  return digits ? syntheticEmail(digits) : v;
}
