/**
 * Contrato do e-mail de contato do cliente (#177). Referência pública: comentário na issue #177.
 *   getContactEmailState()                → ContactEmailState        (leitura, ./contact-data.ts)
 *   resendContactEmailConfirmation()      → ContactEmailActionResult (ação, ./contact-actions.ts)
 *   updateContactEmail(email)             → ContactEmailActionResult (ação, ./contact-actions.ts)
 * Link do e-mail: /client/auth/confirmar-contato?token=… → /client/perfil?contato=confirmado
 * ou /client/perfil?contato=link-invalido.
 */

/** email null = conta sem e-mail de contato. verified = pode entrar e recuperar a senha por ele. */
export type ContactEmailState = { email: string | null; verified: boolean };

export type ContactEmailActionResult =
  | { ok: true }
  | { ok: false; code: "INVALID_EMAIL" | "NO_EMAIL" | "LIMIT" | "NOT_SIGNED_IN" | "GENERIC"; error: string };

/** Textos provisórios (redação final da PO). */
export const CONTACT_EMAIL_MESSAGES = {
  invalidEmail: "Confira o e-mail.",
  noEmail: "Cadastre um e-mail no seu perfil.",
  limited: "Muitas tentativas. Espere alguns minutos e tente de novo.",
  notSignedIn: "Sua sessão acabou. Entre de novo.",
  failed: "Não deu certo agora. Tente de novo.",
  sent: "Enviamos um link para confirmar o seu e-mail.",
  pending: "Confirme seu e-mail para poder entrar com ele e recuperar a senha.",
  confirmed: "E-mail confirmado.",
  invalidLink: "Este link não vale mais. Peça um novo no seu perfil.",
} as const;
