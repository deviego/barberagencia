/**
 * Contrato da fila rápida (front ↔ back). Módulo separado do totem: nada aqui importa de
 * src/features/queue/totem-*.
 */

/** OPEN: a jornada pode começar. UNAVAILABLE: sem fila no plano, fila rápida desligada ou fila
 * sem receber senhas. NOT_FOUND: endereço que não é de uma barbearia. */
export type QuickQueueStatus = "OPEN" | "UNAVAILABLE" | "NOT_FOUND";

/**
 * Quem abriu o link, visto pelo servidor.
 * VISITOR: ninguém logado, ou logado como cliente de OUTRA barbearia (tratado como visitante).
 * CLIENT: logado como cliente DESTA barbearia (pula o telefone).
 * HAS_TICKET: tem senha ativa criada neste aparelho (vai para "Minha senha"). Ainda não é
 * devolvido: depende da credencial do aparelho (#99).
 */
export type QuickQueueViewer = "VISITOR" | "CLIENT" | "HAS_TICKET";

/** Só o que a tela precisa para mostrar a marca. Nada de cliente, fila ou configuração interna. */
export type QuickQueueBrand = {
  name: string;
  logoText: string;
  logoUrl: string | null;
  accent: string | null;
  accentHover: string | null;
  accentDown: string | null;
  accentWash: string | null;
  focus: string | null;
};

/**
 * Retorno de getQuickQueueEntry(slug). A marca só vem com OPEN; fora disso a resposta não
 * traz dado nenhum da barbearia e o viewer é sempre VISITOR.
 */
export type QuickQueueEntry =
  | { status: "OPEN"; brand: QuickQueueBrand; viewer: QuickQueueViewer }
  | { status: "UNAVAILABLE" | "NOT_FOUND"; brand?: undefined; viewer: "VISITOR" };

/**
 * Para o despachante de /b/<slug>/fila. LEGACY: segue exatamente o fluxo de hoje (fila com
 * login). QUICK: leva para /b/<slug>/fila/rapida. Só é QUICK quando a fila rápida está ligada.
 */
export type QuickQueueRoute = "QUICK" | "LEGACY";

/** Textos fixos da story #95 para os estados sem formulário. */
export const QUICK_QUEUE_MESSAGES = {
  notFound: "Barbearia não encontrada.",
  unavailable: "A fila não está disponível agora. Fale no balcão.",
  /** "Continuar" tocado sem a entrada pelo telefone ligada (antes da #96). O botão nunca falha calado. */
  entryNotReady: "A entrada pela fila rápida ainda não está disponível nesta barbearia. Fale com a equipe no balcão.",
} as const;

/*
 * #96 — identificação por telefone e nome.
 * Ações em ./actions.ts (server actions):
 *   identifyPhone(slug, phone) → IdentifyPhoneResult
 *   registerName(slug, name)   → RegisterNameResult
 * O navegador manda só o endereço da barbearia e o que o cliente digitou. Nunca recebe nem envia
 * identificador de cliente: o vínculo entre os passos fica no servidor, preso à credencial do
 * aparelho (cookie HttpOnly gravado pela própria ação).
 */

/** Próximo passo da jornada. NAME: telefone novo nesta barbearia, pedir o nome. SERVICE: seguir. */
export type QuickQueueNext = "NAME" | "SERVICE";

/** Campo a destacar no erro (o texto já vem pronto para o cliente). */
export type QuickQueueErrorField = "phone" | "name";

export type QuickQueueActionError = { ok: false; error: string; field?: QuickQueueErrorField };

export type IdentifyPhoneResult = { ok: true; next: QuickQueueNext } | QuickQueueActionError;

/** Depois do nome, sempre SERVICE. Sem telefone pendente (passo vencido ou pulado): erro e volta ao telefone. */
export type RegisterNameResult = { ok: true; next: "SERVICE" } | (QuickQueueActionError & { restart?: true });

/** Textos fixos da #96 (e o aviso de limite da #99). */
export const QUICK_QUEUE_IDENTIFY_MESSAGES = {
  invalidPhone: "Confira o telefone com DDD.",
  invalidName: "Digite seu nome.",
  nameLettersOnly: "Use só letras no nome.",
  failed: "Não deu certo. Tente de novo.",
  limited: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  restart: "Comece de novo pelo telefone.",
} as const;
