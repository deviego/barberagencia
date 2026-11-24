/** Textos das telas do e-mail de contato, da recuperação de senha e do convite (#177). Redação final da PO (Regua, #186). */
export const CONTACT_SCREEN_COPY = {
  signupHint: "Vamos mandar um link para você confirmar. Depois de confirmar, dá para entrar e recuperar a senha por ele.",
  signupNotice: "Mandamos um link para o seu e-mail. Toque nele para confirmar. Sem isso, o e-mail não serve para entrar nem para recuperar a senha.",
  resetLinkInvalid: "Esse link venceu ou já foi usado. Peça um novo aqui embaixo.",
  resetSubtitle: "Digite seu e-mail ou telefone. Se a conta tiver e-mail confirmado, o link para criar uma senha nova vai para lá.",
  resetLabel: "E-mail ou telefone",
  resetSent: "Se esse e-mail ou telefone tiver uma conta com e-mail confirmado, o link chega em alguns minutos. Confira também o spam.",
  resetNoEmail: "Não tem e-mail confirmado na conta? Fale com a barbearia.",
  resetAgain: "Tentar outro e-mail ou telefone",
  resetBack: "← Voltar para entrar",
  failed: "Não deu certo agora. Tente de novo.",
  changeVerifiedHint: "O e-mail novo só vale depois que você confirmar pelo link.",
  // Concluir convite
  inviteStep: (shop: string) => `Falta só um passo para ligar sua conta à ${shop}.`,
  inviteButton: "Concluir convite",
  inviteDone: "Pronto, convite concluído.",
  inviteInvalid: "Este convite é inválido ou expirou.",
  inviteResume: "Já criou sua conta por este convite?",
  // Form do convite
  invitePhone: "Confira o telefone com DDD.",
  invitePassword: "A senha precisa ter pelo menos 8 caracteres.",
} as const;

export type ContactLinkResult = "confirmado" | "link-invalido" | null;

/** Lê `?contato=` (volta do link do e-mail). Qualquer outro valor é ignorado. */
export function contactLinkResult(value: string | string[] | undefined): ContactLinkResult {
  return value === "confirmado" || value === "link-invalido" ? value : null;
}
