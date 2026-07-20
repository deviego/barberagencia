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
