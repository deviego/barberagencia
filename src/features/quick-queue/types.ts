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
 * Exceção (#102): fila rápida desligada ou fechada com senha ativa criada neste aparelho vem
 * como OPEN + HAS_TICKET, para a página abrir só "Minha senha" (entrar segue recusado).
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
 * #98 — tela "Minha senha".
 *   GET /b/<slug>/fila/rapida/status → QuickQueueStatusResponse (JSON). A tela consulta a cada
 *       QUICK_QUEUE_STATUS_POLL.everyMs com a aba visível; pausa em segundo plano.
 *   leaveQuickQueue(slug)            → LeaveQuickQueueResult (server action, em ./actions.ts)
 * O endereço é o mesmo para todos e não leva identificador de senha: quem dá acesso é a
 * credencial do aparelho (cookie HttpOnly) que criou a senha. A resposta traz só a senha deste
 * aparelho, a senha em atendimento e a contagem na frente: nada de nome, telefone ou serviço.
 */

/**
 * Estado da minha senha (só a de hoje, criada neste aparelho):
 *   WAITING   em espera, com gente na frente (ahead > 0)
 *   NEXT      em espera e ninguém na frente: "Você é o próximo"
 *   CALLED    chamada ou em atendimento: "É a sua vez!"
 *   DONE      atendimento concluído
 *   SKIPPED   pulada ou removida pela barbearia no painel
 *   CANCELLED cancelada pelo cliente em "Sair da fila" (queue_entries.left_by_client, schema-54)
 * DONE, SKIPPED e CANCELLED são finais: mostrar o texto e "Pegar nova senha".
 */
export type QuickQueueTicketState = "WAITING" | "NEXT" | "CALLED" | "DONE" | "SKIPPED" | "CANCELLED";

export type QuickQueueMyTicket = {
  /** Número da senha deste aparelho. */
  number: number;
  state: QuickQueueTicketState;
  /** Senha chamada por último na barbearia hoje; null se ninguém foi chamado ainda. */
  nowServing: number | null;
  /** Quantas senhas em espera estão na frente (0 em NEXT, CALLED e nos finais). */
  ahead: number;
};

/**
 * ticket null: este aparelho não tem senha hoje (resposta igual para qualquer aparelho sem senha).
 * LIMIT: consultas em série acima do limite (HTTP 429; 1 consulta a cada 2 s por aparelho):
 *   esperar 2 s e tentar de novo, sem aviso de erro. Acontece também logo depois de entrar na fila.
 * Aparelho com 2 senhas ativas (pai e filho): vem a de número menor ainda ativa.
 * CLOSED: fila indisponível nesta barbearia. GENERIC: falha; tratar como sem conexão.
 */
export type QuickQueueStatusResponse =
  | { ok: true; ticket: QuickQueueMyTicket | null }
  | { ok: false; code: "LIMIT" | "CLOSED" | "GENERIC" };

/**
 * "Sair da fila". Só cancela senha em espera (WAITING/NEXT) criada neste aparelho.
 * Repetir o pedido depois de cancelada responde ok de novo, sem efeito novo.
 * NOT_WAITING: a senha já foi chamada, atendida ou não existe: atualizar o estado pela consulta.
 */
export type LeaveQuickQueueResult =
  | { ok: true }
  | { ok: false; code: "NOT_WAITING" | "LIMIT" | "CLOSED" | "GENERIC"; error: string };

/** Ritmo da consulta (decisão do Alicerce na #98). */
export const QUICK_QUEUE_STATUS_POLL = {
  everyMs: 5_000,
  /** Sem conexão: 5 s, 10 s, 20 s, até 30 s; volta a everyMs quando conectar. */
  backoffMs: [5_000, 10_000, 20_000, 30_000],
} as const;

/** Textos fixos da #98. {senha} e {n} são trocados pela tela. */
export const QUICK_QUEUE_TICKET_MESSAGES = {
  title: "Sua senha",
  nowServing: "Atendendo agora: {senha}",
  ahead: "{n} na sua frente",
  next: "Você é o próximo",
  called: "É a sua vez!",
  leave: "Sair da fila",
  leaveConfirm: "Sair da fila? Você perde a sua vez.",
  leaveYes: "Sair",
  leaveNo: "Ficar na fila",
  done: "Atendimento concluído. Valeu!",
  skipped: "Sua senha foi pulada. Fale no balcão ou pegue outra.",
  cancelled: "Sua senha foi cancelada.",
  newTicket: "Pegar nova senha",
  offline: "Sem conexão. Tentando de novo…",
  failed: "Não deu certo. Tente de novo.",
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
export type QuickQueueLimitKind =
  | "IDENTIFY"
  | "JOIN_RATE"
  | "PHONE_BUSY"
  | "DEVICE_ACTIVE"
  | "TENANT_ACTIVE"
  // #148 (schema-64): tetos por barbearia da identificação.
  | "IDENTIFY_TENANT"
  | "NEW_DEVICES_TENANT"
  | "NEW_CLIENTS_TENANT";

/** Tipos que são TETO DA BARBEARIA: qualquer um deles hoje liga o alerta ao dono (tenantCapHit). */
export const QUICK_QUEUE_TENANT_CAP_KINDS: readonly QuickQueueLimitKind[] = [
  "TENANT_ACTIVE",
  "IDENTIFY_TENANT",
  "NEW_DEVICES_TENANT",
  "NEW_CLIENTS_TENANT",
];
export type QuickQueueLimitSummary = {
  /** Soma do dia (America/Sao_Paulo). */
  total: number;
  byKind: Partial<Record<QuickQueueLimitKind, number>>;
  /** true quando algum teto da barbearia foi atingido hoje (senhas ativas da fila rápida,
   * tentativas, credenciais novas ou contas novas): mostrar alerta com "Desligar". */
  tenantCapHit: boolean;
};

/*
 * #102 — interruptor "Fila rápida" no painel (dono/gerente da própria barbearia).
 *   setQuickQueueEnabled(enabled) → SetQuickQueueEnabledResult (server action, ./admin-actions.ts)
 * A barbearia vem só da sessão do painel; o navegador manda só true/false.
 * Ligar exige plano com fila e a fila da barbearia ativada; desligar é sempre permitido.
 * Cada mudança fica registrada em audit_log (quem e quando). Depois de salvar, a página de
 * configurações é revalidada: o cartaz A some ou aparece na hora.
 */
export type SetQuickQueueEnabledResult =
  | { ok: true; enabled: boolean }
  | {
      ok: false;
      /** FORBIDDEN: sem permissão de administrar a barbearia. PLAN: plano sem fila.
       * QUEUE_OFF: a fila da barbearia está desativada. ROTATE_FIRST (#103): renovar a chave do
       * totem antes (mostrar "Antes de começar"; a fila rápida segue desligada). GENERIC: falha. */
      code: "FORBIDDEN" | "PLAN" | "QUEUE_OFF" | "ROTATE_FIRST" | "GENERIC";
      error: string;
    };

/** Textos fixos da #102 (chave e avisos). */
export const QUICK_QUEUE_ADMIN_MESSAGES = {
  label: "Fila rápida",
  on: "Ligada: o cliente entra na fila só com o telefone.",
  off: "Desligada: o cliente precisa entrar na conta para pegar senha.",
  posterHint: "O cartaz da fila aparece quando a fila rápida estiver ligada.",
  whatsappOff: "WhatsApp desconectado. A fila funciona normal, só a mensagem de acesso não sai.",
  forbidden: "Você não tem permissão para mudar isso.",
  plan: "A fila não faz parte do seu plano.",
  queueOff: "Ative a fila da barbearia antes de ligar a fila rápida.",
  failed: "Não deu certo. Tente de novo.",
  /** #103 */
  rotateFirst: "Para ligar a fila rápida, renove a chave do totem.",
  /*
   * Alerta ao dono (#99/#145, copy da PO em 20/11). Aparece com tenantCapHit ou com o total do
   * dia >= QUICK_QUEUE_ALERT_MIN_TOTAL, só com a fila no plano e a fila rápida ligada. Só o total,
   * sem detalhe por tipo. Com tenantCapHit usa alertBodyCap; só com o total alto, alertBodyHigh.
   */
  alertTitle: (n: number) =>
    n === 1 ? "A fila rápida barrou 1 tentativa hoje" : `A fila rápida barrou ${n} tentativas hoje`,
  alertBodyCap:
    "A fila pelo celular encheu e parou de aceitar senhas novas. Se achar que tem alguém abusando, desligue a fila rápida. O balcão e o totem continuam funcionando.",
  alertBodyHigh:
    "Pode ser só movimento, mas também pode ser alguém abusando. Se achar estranho, desligue a fila rápida. O balcão e o totem continuam funcionando.",
  alertAction: "Desligar fila rápida",
  confirmTitle: "Desligar a fila rápida?",
  confirmBody:
    "Os clientes param de pegar senha só com o telefone. Quem já está na fila continua, e o balcão e o totem não mudam. Você pode ligar de novo quando quiser.",
  confirmYes: "Desligar",
  confirmNo: "Voltar",
  turnedOff: "Fila rápida desligada.",
} as const;

/** #103 — passo a passo "Antes de começar" (renovar a chave do totem antes de ligar). */
export const QUICK_QUEUE_ONBOARDING_MESSAGES = {
  title: "Antes de começar",
  steps: [
    "1. Renove a chave do totem.",
    "2. Abra o totem de novo no tablet.",
    "3. Imprima o QR do cliente e troque qualquer QR antigo.",
  ],
  rotate: "Renovar chave",
  later: "Fazer depois",
  /** Confirmação da renovação (copy da PO, #157/#103). */
  confirmTitle: "Renovar a chave do totem?",
  confirm: "O totem do balcão para de funcionar até você abrir o novo acesso no tablet.",
  confirmYes: "Renovar chave",
  confirmNo: "Voltar",
  reminder: "Para ligar a fila rápida, renove a chave do totem.",
  oldAccess: "Este acesso não vale mais. Peça ajuda no balcão.",
} as const;

/** Estado do interruptor para o painel (#102/#103). */
export type QuickQueueAdminState = {
  enabled: boolean;
  /** Adoção começou e a chave do totem ainda não foi renovada depois: mostrar o lembrete. */
  needsKeyRotation: boolean;
};

