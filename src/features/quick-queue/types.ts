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

/*
 * #97 — escolher serviço com preço e entrar na fila.
 * Ações em ./actions.ts (server actions):
 *   loadQuickQueueOptions(slug)                                  → QuickQueueOptionsResult
 *   joinQuickQueue(slug, { serviceId, priceCents, barberId? })    → JoinQuickQueueResult
 * O cliente é sempre o que o servidor ligou à credencial do aparelho no passo do telefone (#96).
 * Nenhuma das duas recebe ou devolve identificador de cliente, número de senha ou preço a gravar.
 */

/** Serviço oferecido na fila. Preço normal do serviço, igual para todos (plano é da #100). */
export type QuickQueueServiceOption = {
  id: string;
  name: string;
  /** Preço em centavos, só para devolver em joinQuickQueue (conferência de "mudou de preço"). */
  priceCents: number;
  /** Pronto para mostrar: "R$ 35,00". */
  priceLabel: string;
};

export type QuickQueueBarberOption = { id: string; name: string };

/**
 * Opções da tela "O que vai ser hoje?".
 * pickBarber=false: não mostrar "Com quem?" (barbers vem vazio).
 * services vazio: mostrar QUICK_QUEUE_JOIN_MESSAGES.noServices e nenhum botão de entrar.
 */
export type QuickQueueOptions = {
  services: QuickQueueServiceOption[];
  pickBarber: boolean;
  barbers: QuickQueueBarberOption[];
};

/**
 * restart: o aparelho não tem telefone identificado (passo pulado ou credencial vencida):
 * voltar ao passo do telefone.
 */
export type QuickQueueOptionsResult =
  | { ok: true; options: QuickQueueOptions }
  | { ok: false; error: string; restart?: true };

/** Pedido de "Entrar na fila". barberId ausente ou null = "Sem preferência". */
export type JoinQuickQueueInput = {
  serviceId: string;
  /** O priceCents da opção mostrada. Só confere; o preço gravado vem do servidor. */
  priceCents: number;
  barberId?: string | null;
};

/**
 * ok: senha criada (ou o cliente já tinha senha ativa hoje nesta barbearia): ir para "Minha senha"
 *     (#98). O número é lido lá, não vem aqui.
 * SERVICE_CHANGED: serviço/barbeiro saiu da lista, foi desativado ou o preço mudou. Mostrar
 *     QUICK_QUEUE_JOIN_MESSAGES.serviceChanged e trocar a lista por `options` (já atualizada).
 * RESTART: sem telefone identificado neste aparelho: voltar ao passo do telefone.
 * LIMIT: limites da #99. CLOSED: fila fechou/desligou (mensagem de indisponível).
 * GENERIC: falha sem detalhe ("Não deu certo. Tente de novo.").
 * `error` sempre traz o texto pronto para o cliente.
 */
export type JoinQuickQueueResult =
  | { ok: true }
  | { ok: false; code: "SERVICE_CHANGED"; error: string; options: QuickQueueOptions }
  | { ok: false; code: "RESTART" | "LIMIT" | "CLOSED" | "GENERIC"; error: string };

/** Textos fixos da #97. */
export const QUICK_QUEUE_JOIN_MESSAGES = {
  title: "O que vai ser hoje?",
  barberLabel: "Com quem?",
  noPreference: "Sem preferência",
  join: "Entrar na fila",
  noServices: "Nenhum serviço disponível na fila agora. Fale no balcão.",
  serviceChanged: "Esse serviço mudou. Escolha de novo.",
  /** Botão quando loadQuickQueueOptions falha sem restart (leitura indisponível). */
  retry: "Tentar de novo",
  /** Anunciado pelo leitor de tela quando joinQuickQueue responde ok (antes de ir para "Minha senha"). */
  joined: "Você entrou na fila.",
} as const;

/*
 * #99 — travas. Avisos neutros: nunca dizem de quem é o telefone, o número da senha nem a
 * posição. joinQuickQueue devolve code "LIMIT" com um destes textos em `error`.
 */
export const QUICK_QUEUE_LIMIT_MESSAGES = {
  /** Telefone com senha ativa tirada em outro aparelho, no totem ou no balcão. */
  phoneBusy: "Este telefone já tem uma senha na fila. Fale no balcão.",
  /** Aparelho com 2 senhas ativas nesta barbearia. */
  deviceLimit: "Limite de senhas neste celular. Fale no balcão.",
  /** Pedidos em série acima do limite. */
  tooMany: "Muitas tentativas. Aguarde um pouco e tente de novo.",
  /** Teto de senhas da fila rápida da barbearia atingido. */
  tenantCap: "A fila pelo celular está cheia agora. Fale no balcão.",
} as const;

/** Contagem do dia de limites estourados (alerta ao dono no painel; leitura com RLS de admin). */
export type QuickQueueLimitKind = "IDENTIFY" | "JOIN_RATE" | "PHONE_BUSY" | "DEVICE_ACTIVE" | "TENANT_ACTIVE";
export type QuickQueueLimitSummary = {
  /** Soma do dia (America/Sao_Paulo). */
  total: number;
  byKind: Partial<Record<QuickQueueLimitKind, number>>;
  /** true quando o teto de senhas da fila rápida foi atingido hoje: mostrar alerta com "Desligar". */
  tenantCapHit: boolean;
};
