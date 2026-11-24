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

/** Redação final da PO (Regua, #186). */
export const CONTACT_EMAIL_MESSAGES = {
  invalidEmail: "Confira o e-mail digitado.",
  noEmail: "Você ainda não tem e-mail. Cadastre um para poder recuperar a senha.",
  limited: "Muitas tentativas. Espere alguns minutos e tente de novo.",
  notSignedIn: "Sua sessão acabou. Entre de novo.",
  failed: "Não deu certo agora. Tente de novo.",
  sent: "Link enviado. Confira seu e-mail (e o spam).",
  pending: "Até você confirmar, esse e-mail não serve para entrar nem para recuperar a senha.",
  confirmed: "E-mail confirmado. Agora ele serve para entrar e recuperar a senha.",
  invalidLink: "Esse link venceu ou já foi usado. Toque em \"Reenviar confirmação\" para receber outro.",
} as const;
