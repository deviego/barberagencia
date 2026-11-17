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
} as const;
