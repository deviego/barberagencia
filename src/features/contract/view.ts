import type { ContractFields } from "./template";
import type { SignatureInfo } from "./components/contract-document";

/** Linha do banco tenant_contracts (tipo compartilhado servidor/cliente). */
export type TenantContract = {
  tenant_id: string;
  legal_name: string | null;
  trade_name: string | null;
  doc_type: string | null;
  doc_number: string | null;
  responsible_name: string | null;
  responsible_cpf: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  plan: string | null;
  contract_version: string;
  trial_enabled: boolean;
  trial_started_at: string;
  trial_ends_at: string;
  status: "PENDING" | "SIGNED";
  signed_at: string | null;
  signed_ip: string | null;
  signed_by_user_id: string | null;
  signed_name: string | null;
  signature_hash: string | null;
  contract_snapshot: string | null;
  created_at: string;
  updated_at: string;
};

/** Objeto serializável entregue aos componentes (seção/modal). */
export type ContractView = {
  fields: ContractFields;
  signature: SignatureInfo;
  trialEndsAt: string;
  trialEnabled: boolean;
  dataComplete: boolean;
};

export const PLAN_LABEL: Record<string, string> = {
  personal: "Personal",
  essencial: "Essencial",
  advance: "Advance",
};

export const CONTRACT_COLS =
  "tenant_id, legal_name, trade_name, doc_type, doc_number, responsible_name, responsible_cpf, address_street, address_city, address_state, address_zip, contact_email, contact_phone, plan, contract_version, trial_enabled, trial_started_at, trial_ends_at, status, signed_at, signed_ip, signed_by_user_id, signed_name, signature_hash, contract_snapshot, created_at, updated_at";

export function contractToFields(c: TenantContract | null): ContractFields {
  return {
    tradeName: c?.trade_name ?? null,
    legalName: c?.legal_name ?? null,
    docType: c?.doc_type ?? null,
    docNumber: c?.doc_number ?? null,
    responsibleName: c?.responsible_name ?? null,
    responsibleCpf: c?.responsible_cpf ?? null,
    addressStreet: c?.address_street ?? null,
    addressCity: c?.address_city ?? null,
    addressState: c?.address_state ?? null,
    addressZip: c?.address_zip ?? null,
    planLabel: c?.plan ? PLAN_LABEL[c.plan] ?? c.plan : null,
  };
}

/** Dados legais mínimos exigidos para assinar. */
export function contractDataComplete(c: TenantContract | null): boolean {
  if (!c) return false;
  return Boolean(
    (c.trade_name || c.legal_name) &&
      c.doc_type &&
      c.doc_number &&
      c.responsible_name &&
      c.responsible_cpf &&
      c.address_city &&
      c.address_state
  );
}

/** Monta o objeto de exibição a partir da linha do banco. */
export function buildContractView(c: TenantContract | null): ContractView | null {
  if (!c) return null;
  return {
    fields: contractToFields(c),
    signature: {
      status: c.status,
      signedAt: c.signed_at,
      signedName: c.signed_name,
      signedIp: c.signed_ip,
      signatureHash: c.signature_hash,
      contractVersion: c.contract_version,
    },
    trialEndsAt: c.trial_ends_at,
    trialEnabled: c.trial_enabled,
    dataComplete: contractDataComplete(c),
  };
}
