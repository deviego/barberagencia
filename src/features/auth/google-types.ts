/**
 * Contrato do "Entrar com Google" (story #167, ADR 0005) entre o back (#170/#171) e as telas
 * (#172). Referência pública: comentário do contrato na issue #170.
 *
 * Ações ("use server", ./google-actions.ts):
 *   confirmWhatsapp({ phone })                 → ConfirmWhatsappResult        (#170)
 *   proveAccountAndLink({ phone, password })   → ProveAccountAndLinkResult    (#171)
 * Leituras (server-only, ./google-data.ts):
 *   getPendingAccount()                        → PendingAccount               (#170)
 *   getMyLoginMethods()                        → LoginMethods                 (#171)
 * Flag: isGoogleLoginEnabled() em src/lib/auth/google-flag.ts (da tela).
 *
 * Códigos em MAIÚSCULAS; `error` sempre traz o texto pronto, sem dado pessoal.
 */

/** Marca da barbearia para a tela de confirmar WhatsApp. */
export type PendingShop = {
  name: string;
  logoText: string;
  logoUrl: string | null;
  accent: string | null;
};

/**
 * PENDING: logado pelo Google, ainda sem cliente; barbearia do bb_tenant válida.
 * PENDING_NO_SHOP: logado sem cliente e sem barbearia válida (abrir o link da barbearia).
 * ACTIVE: já tem vínculo; a tela manda para /client.
 * SIGNED_OUT: sem sessão; a tela manda para /client/login.
 */
export type PendingAccount =
  | { status: "PENDING"; shop: PendingShop }
  | { status: "PENDING_NO_SHOP" }
  | { status: "ACTIVE" }
  | { status: "SIGNED_OUT" };

export type ConfirmWhatsappInput = { phone: string };

/**
 * ok: cliente criado na barbearia do bb_tenant; ir para `next`.
 * INVALID_PHONE: destacar o campo. NEEDS_PROOF: telefone já tem conta → tela de prova (#171).
 * NO_SHOP: sem barbearia válida, nada criado. NOT_SIGNED_IN: sessão acabou → login.
 */
export type ConfirmWhatsappResult =
  | { ok: true; next: string }
  | { ok: false; code: "INVALID_PHONE" | "NEEDS_PROOF" | "NO_SHOP" | "NOT_SIGNED_IN" | "LIMIT" | "GENERIC"; error: string };

export type ProveAccountAndLinkInput = { phone: string; password: string };

/**
 * ok: posse provada; a sessão já é da conta existente. O NAVEGADOR chama
 * supabase.auth.linkIdentity({ provider: "google", options: { redirectTo: origin +
 * "/client/auth/callback?next=/client" } }).
 * NOT_ELIGIBLE: a conta provisória não pode ser trocada.
 */
export type ProveAccountAndLinkResult =
  | { ok: true; next: "LINK_GOOGLE" }
  | { ok: false; code: "WRONG_CREDENTIALS" | "NOT_ELIGIBLE" | "LIMIT" | "NOT_SIGNED_IN" | "GENERIC"; error: string };

/** Perfil: mostrar "Conectar com Google" só se google = false (e a flag ligada). */
export type LoginMethods = { google: boolean };

/** Códigos de erro do callback em /client/login?error= (conta_vinculada_outra vai para /client/perfil). */
export type GoogleCallbackError = "auth" | "google_cancelado" | "google_sem_barbearia" | "conta_vinculada_outra";

/** Redação final da PO (Regua, #179). Nenhum traz dado da conta. */
export const GOOGLE_LOGIN_MESSAGES = {
  invalidPhone: "Confira o número do WhatsApp com DDD.",
  needsProof: "Esse número já tem conta. Digite a senha dela para juntar com o seu Google.",
  noShop: "Abra o link da sua barbearia para continuar.",
  notSignedIn: "Sua sessão acabou. Entre de novo.",
  wrongCredentials: "Telefone ou senha incorretos.",
  notEligible: "Não deu para juntar as contas. Fale com a barbearia.",
  limited: "Muitas tentativas. Espere alguns minutos e tente de novo.",
  failed: "Não deu certo agora. Tente de novo.",
} as const;
