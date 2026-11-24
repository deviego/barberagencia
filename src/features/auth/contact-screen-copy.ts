/** Textos das telas do e-mail de contato e da recuperação de senha (#177). Provisórios até a redação da PO. */
export const CONTACT_SCREEN_COPY = {
  signupHint: "Vamos mandar um link para você confirmar. Confirmado, ele serve para entrar e recuperar a senha.",
  signupNotice: "Mandamos um link para o seu e-mail. Abra e toque nele para poder entrar com o e-mail e recuperar a senha.",
  resetLinkInvalid: "Esse link não vale mais. Peça um novo abaixo.",
  resetSubtitle: "Informe o e-mail ou o telefone da sua conta. Mandamos o link para o e-mail confirmado.",
  resetLabel: "E-mail ou telefone",
} as const;

export type ContactLinkResult = "confirmado" | "link-invalido" | null;

/** Lê `?contato=` (volta do link do e-mail). Qualquer outro valor é ignorado. */
export function contactLinkResult(value: string | string[] | undefined): ContactLinkResult {
  return value === "confirmado" || value === "link-invalido" ? value : null;
}
