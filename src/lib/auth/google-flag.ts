/**
 * Liga/desliga do "Entrar com Google" (ADR 0005, item 9). Lê só a variável pública:
 * serve no servidor e no navegador. Produção fica desligada até o QA + ok do Diego.
 */
export function isGoogleLoginEnabled(): boolean {
  return process.env.NEXT_PUBLIC_LOGIN_GOOGLE === "on";
}
