import type { SaasPlanKey } from "@/lib/tenant/types";

/**
 * Camada 2 — Entitlements por PLANO SaaS do tenant (feature gating).
 * Planos: Personal / Essencial / Advance (conforme docx). Checar SEMPRE no servidor;
 * a UI usa <Gate> só para esconder/upsell.
 */
export type FeatureKey =
  | "site.subdomain"
  | "site.customDomain"
  | "support.desk"
  | "whatsapp.manual"
  | "whatsapp.automation"
  | "whatsapp.chatbot" // bot IA
  | "marketing.basic"
  | "marketing.segmented"
  | "recovery.abandoned"
  | "products.display"
  | "invoice.nfe"
  | "sales.direct"
  | "payments.gateway"
  | "queue" // fila por QR/totem
  | "network.multiUnit";

export type NumericLimitKey =
  | "clients.limit"
  | "professionals.limit"
  | "appointments.monthly"
  | "admins.limit";

interface PlanConfig {
  label: string;
  priceBRL: number; // mensalidade
  features: Record<FeatureKey, boolean>;
  limits: Record<NumericLimitKey, number>; // -1 = ilimitado
}

const UNLIMITED = -1;

export const PLANS: Record<SaasPlanKey, PlanConfig> = {
  personal: {
    label: "Personal",
    priceBRL: 69.9,
    features: {
      "site.subdomain": false,
      "site.customDomain": false,
      "support.desk": false,
      "whatsapp.manual": true,
      "whatsapp.automation": false,
      "whatsapp.chatbot": false,
      "marketing.basic": false,
      "marketing.segmented": false,
      "recovery.abandoned": false,
      "products.display": false,
      "invoice.nfe": false,
      "sales.direct": false,
      "payments.gateway": false,
      "queue": false,
      "network.multiUnit": false,
    },
    limits: {
      "clients.limit": 20,
      "professionals.limit": 3,
      "appointments.monthly": 300,
      "admins.limit": 1,
    },
  },
  essencial: {
    label: "Essencial",
    priceBRL: 189.9,
    features: {
      "site.subdomain": true,
      "site.customDomain": false,
      "support.desk": true,
      "whatsapp.manual": true,
      "whatsapp.automation": true,
      "whatsapp.chatbot": true,
      "marketing.basic": true,
      "marketing.segmented": false,
      "recovery.abandoned": true,
      "products.display": true,
      "invoice.nfe": false,
      "sales.direct": false,
      "payments.gateway": false,
      "queue": true,
      "network.multiUnit": false,
    },
    limits: {
      "clients.limit": 90,
      "professionals.limit": 5,
      "appointments.monthly": 1500,
      "admins.limit": 3,
    },
  },
  advance: {
    label: "Advance",
    priceBRL: 249.9,
    features: {
      "site.subdomain": true,
      "site.customDomain": true,
      "support.desk": true,
      "whatsapp.manual": true,
      "whatsapp.automation": true,
      "whatsapp.chatbot": true,
      "marketing.basic": true,
      "marketing.segmented": true,
      "recovery.abandoned": true,
      "products.display": true,
      "invoice.nfe": true,
      "sales.direct": true,
      "payments.gateway": true,
      "queue": true,
      "network.multiUnit": true,
    },
    limits: {
      "clients.limit": UNLIMITED,
      "professionals.limit": 8,
      "appointments.monthly": 3000,
      "admins.limit": 4,
    },
  },
};

export function hasEntitlement(plan: SaasPlanKey, feature: FeatureKey): boolean {
  return PLANS[plan].features[feature] === true;
}

export function getLimit(plan: SaasPlanKey, key: NumericLimitKey): number {
  return PLANS[plan].limits[key];
}

export function isUnlimited(plan: SaasPlanKey, key: NumericLimitKey): boolean {
  return PLANS[plan].limits[key] === UNLIMITED;
}

/** Erro de plano insuficiente (para bloquear no servidor com upsell). */
export class EntitlementError extends Error {
  constructor(public feature: FeatureKey) {
    super(`Recurso indisponível no plano atual: ${feature}`);
    this.name = "EntitlementError";
  }
}

export function assertEntitlement(plan: SaasPlanKey, feature: FeatureKey): void {
  if (!hasEntitlement(plan, feature)) throw new EntitlementError(feature);
}

// ---- Helpers para gating/upsell (ordem, rótulos, plano mínimo) --------------

export const PLAN_ORDER: SaasPlanKey[] = ["personal", "essencial", "advance"];

export function planLabel(plan: SaasPlanKey): string {
  return PLANS[plan].label;
}

export function normalizeSaasPlan(p: string | null | undefined): SaasPlanKey {
  return p === "personal" || p === "essencial" || p === "advance" ? p : "advance";
}

/** Plano mais barato que desbloqueia um recurso (para o CTA "disponível no plano X"). */
export function minPlanForFeature(feature: FeatureKey): SaasPlanKey | null {
  for (const p of PLAN_ORDER) if (PLANS[p].features[feature]) return p;
  return null;
}

/** Plano mais barato cujo limite atende a quantidade desejada (-1 = ilimitado). */
export function minPlanForLimit(key: NumericLimitKey, needed: number): SaasPlanKey | null {
  for (const p of PLAN_ORDER) {
    const lim = PLANS[p].limits[key];
    if (lim === UNLIMITED || lim >= needed) return p;
  }
  return null;
}

/** Rótulos amigáveis dos limites (para a seção "Meu plano"). */
export const LIMIT_LABEL: Record<NumericLimitKey, string> = {
  "professionals.limit": "Profissionais",
  "clients.limit": "Clientes mensalistas",
  "appointments.monthly": "Agendamentos por mês",
  "admins.limit": "Administradores",
};

/** Recursos exibidos ao usuário (subconjunto amigável) + rótulos. */
export const DISPLAY_FEATURES: { key: FeatureKey; label: string }[] = [
  { key: "marketing.basic", label: "Campanhas de marketing" },
  { key: "queue", label: "Fila (senha por QR/totem)" },
  { key: "whatsapp.chatbot", label: "Atendimento com bot IA" },
  { key: "recovery.abandoned", label: "Recuperação de cadastros" },
  { key: "products.display", label: "Display virtual de produtos" },
  { key: "invoice.nfe", label: "Emissão de nota fiscal" },
  { key: "sales.direct", label: "Venda direta pela plataforma" },
  { key: "payments.gateway", label: "Gateway de pagamento (API/Webhooks)" },
];
