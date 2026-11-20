/**
 * Limites da identificação (#96, preparação da #99). Conferidos DENTRO da função de banco, com
 * trava por barbearia, então valem também para pedido feito direto ao servidor.
 * Valores provisórios dos tetos por barbearia: revistos com a linha de base da #105.
 * Nenhum limite usa telefone ou rede como chave: telefone conhecido conta pelo cliente já
 * resolvido; telefone novo conta só nos tetos por barbearia.
 */
export const QUICK_QUEUE_IDENTIFY_LIMITS = {
  /** Janela das contagens de tentativa. */
  windowSeconds: 10 * 60,
  /** Tentativas por aparelho (credencial) na janela. */
  perDevice: 5,
  /** Tentativas por cliente já cadastrado (telefone conhecido) na janela. */
  perClient: 5,
  /** Teto de tentativas por barbearia na janela (provisório). */
  perTenant: 200,
  /** Teto de credenciais novas por barbearia por hora (provisório). */
  newDevicesPerTenantHour: 60,
  /** Teto de contas novas pela fila rápida por barbearia por dia (provisório). */
  newClientsPerTenantDay: 100,
} as const;

/** Validade da credencial do aparelho, renovada a cada uso. */
export const QUICK_QUEUE_DEVICE_TTL_DAYS = 30;
/** Quanto tempo o passo "nome" espera depois do telefone. */
export const QUICK_QUEUE_PENDING_MINUTES = 10;

/**
 * Travas de "Entrar na fila" (#99). Conferidas DENTRO de quick_queue_join (schema-54), na mesma
 * transação que cria a senha. O teto por barbearia é provisório (revisto com a #105).
 */
export const QUICK_QUEUE_JOIN_LIMITS = {
  /** Janela da contagem de pedidos. */
  windowSeconds: 10 * 60,
  /** Pedidos de "Entrar na fila" por aparelho na janela. */
  perDevice: 10,
  /** Senhas ativas ao mesmo tempo por aparelho, por barbearia. */
  activePerDevice: 2,
  /** Senhas ativas da fila rápida por barbearia hoje (totem e balcão não contam). Provisório. */
  tenantActiveCap: 40,
} as const;

/** Tela "Minha senha" (#98). */
export const QUICK_QUEUE_STATUS_LIMITS = {
  /** Uma consulta a cada 2 s por aparelho (a tela consulta a cada 5 s). */
  minIntervalMs: 2_000,
  /** Retrato da fila da barbearia guardado por 2 s. */
  snapshotMs: 2_000,
  /** "Sair da fila": pedidos por aparelho na janela. */
  leavePerDevice: 10,
  leaveWindowSeconds: 10 * 60,
} as const;

/**
 * Alerta ao dono no painel (#145): total do dia de limites estourados a partir do qual o alerta
 * aparece (além de tenantCapHit). Provisório: o valor final sai da linha de base da #105.
 */
export const QUICK_QUEUE_ALERT_MIN_TOTAL = 20;
