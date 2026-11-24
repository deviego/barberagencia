/**
 * Mensagens dos erros que o callback devolve em `?error=<código>` (contrato do #170).
 * Código desconhecido cai na mensagem genérica: nunca mostramos texto vindo da URL.
 */
const CALLBACK_ERRORS: Record<string, string> = {
  auth: "Não deu para entrar agora. Tente de novo.",
  google_cancelado: "Você cancelou a entrada com o Google. Tente de novo ou entre com telefone e senha.",
  google_sem_barbearia: "Abra o link da sua barbearia e entre com o Google por lá.",
  conta_vinculada_outra: "Essa conta do Google já está ligada a outro cadastro. Use outra conta do Google.",
};

export function callbackErrorMessage(code: string | string[] | undefined): string | null {
  if (!code || Array.isArray(code)) return null;
  return CALLBACK_ERRORS[code] ?? CALLBACK_ERRORS.auth;
}

/** Para onde o callback manda quem acabou de entrar com Google. */
export const GOOGLE_CONFIRM_PATH = "/client/confirmar-whatsapp";
