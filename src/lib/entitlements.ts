import type { SaasPlanKey } from "@/lib/tenant/types";

/**
 * Camada 2 — Entitlements por PLANO SaaS do tenant (feature gating).
 * Fonte única de verdade do que cada plano habilita. Checar SEMPRE no servidor;
 * a UI usa <Gate> só para esconder/upsell.
 */
export type FeatureKey =
  | "site.subdomain"
  | "site.customDomain"
  | "support.desk"
  | "whatsapp.manual"
  | "whatsapp.automation"
  | "whatsapp.chatbot"
  | "marketing.basic"
  | "marketing.segmented"
  | "network.multiUnit";

export type NumericLimitKey = "clients.limit" | "reports.retentionDays";

interface PlanConfig {
  label: string;
  priceBRL: number; // mensalidade
  setupBRL: number; // adesão
  features: Record<FeatureKey, boolean>;
  limits: Record<NumericLimitKey, number>; // -1 = ilimitado
}

const UNLIMITED = -1;

export const PLANS: Record<SaasPlanKey, PlanConfig> = {
  essencial: {
    label: "Essencial",
    priceBRL: 65,
    setupBRL: 139.9,
    features: {
      "site.subdomain": false,
      "site.customDomain": false,
      "support.desk": false,
      "whatsapp.manual": true,
      "whatsapp.automation": false,
      "whatsapp.chatbot": false,
      "marketing.basic": false,
      "marketing.segmented": false,
      "network.multiUnit": false,
    },
    limits: { "clients.limit": 100, "reports.retentionDays": 30 },
  },
  profissional: {
    label: "Profissional",
    priceBRL: 85,
    setupBRL: 199,
    features: {
      "site.subdomain": true,
      "site.customDomain": false,
      "support.desk": true,
      "whatsapp.manual": true,
      "whatsapp.automation": true,
      "whatsapp.chatbot": false,
      "marketing.basic": true,
      "marketing.segmented": false,
      "network.multiUnit": false,
    },
    limits: { "clients.limit": 500, "reports.retentionDays": 365 },
  },
  advanced: {
    label: "Advanced",
    priceBRL: 99,
    setupBRL: 259,
    features: {
      "site.subdomain": true,
      "site.customDomain": true,
      "support.desk": true,
      "whatsapp.manual": true,
      "whatsapp.automation": true,
      "whatsapp.chatbot": true,
      "marketing.basic": true,
      "marketing.segmented": true,
      "network.multiUnit": true,
    },
    limits: { "clients.limit": UNLIMITED, "reports.retentionDays": UNLIMITED },
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
