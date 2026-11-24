import { GOOGLE_LOGIN_MESSAGES, type GoogleCallbackError } from "@/features/auth/google-types";

/**
 * Mensagens dos erros que o callback devolve em `?error=<código>` (contrato do #170).
 * Código desconhecido cai na mensagem genérica: nunca mostramos texto vindo da URL.
 */
const CALLBACK_ERRORS: Record<GoogleCallbackError, string> = {
  auth: "Não deu para entrar agora. Tente de novo.",
  google_cancelado: "Você não terminou de entrar com o Google. Tente de novo ou entre com telefone e senha.",
  google_sem_barbearia: "Não achamos de qual barbearia você veio. Abra o link da sua barbearia e entre com o Google por lá.",
  conta_vinculada_outra: "Essa conta do Google já está ligada a outro cadastro. Escolha outra conta do Google.",
  email_ja_tem_conta: GOOGLE_LOGIN_MESSAGES.emailHasAccount,
};

export function callbackErrorMessage(code: string | string[] | undefined): string | null {
  if (!code || Array.isArray(code)) return null;
  // Só chave própria: "__proto__"/"constructor" na URL não podem pegar nada do protótipo.
  return Object.hasOwn(CALLBACK_ERRORS, code) ? CALLBACK_ERRORS[code as GoogleCallbackError] : CALLBACK_ERRORS.auth;
}

/** Para onde o callback manda quem acabou de entrar com Google. */
export const GOOGLE_CONFIRM_PATH = "/client/confirmar-whatsapp";
