"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { isMaster, isUnitAdmin } from "@/lib/rbac";
import { ACCEPT_TEXT, CONTRACT_VERSION } from "./parties";
import { contractPlainText } from "./template";
import { CONTRACT_COLS as COLS, contractToFields, contractDataComplete, type TenantContract } from "./view";

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : h.get("x-real-ip");
}

/** O admin da barbearia assina o contrato (aceite eletrônico — MP 2.200-2/2001). */
export async function signContract() {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Sessão inválida." };

  const supabase = await createSupabaseServerClient();
  const { data: c } = await supabase.from("tenant_contracts").select(COLS).maybeSingle();
  const contract = c as TenantContract | null;
  if (!contract) return { ok: false as const, error: "Contrato não encontrado." };
  if (contract.status === "SIGNED") return { ok: true as const, alreadySigned: true };
  if (!contractDataComplete(contract))
    return { ok: false as const, error: "Os dados da barbearia ainda não foram preenchidos. Fale com o suporte." };

  const snapshot = contractPlainText(contractToFields(contract));
  const hash = createHash("sha256").update(snapshot).digest("hex");
  const ip = await clientIp();

  const { error } = await supabase
    .from("tenant_contracts")
    .update({
      status: "SIGNED",
      signed_at: new Date().toISOString(),
      signed_ip: ip,
      signed_by_user_id: user.id,
      signed_name: user.name ?? user.email ?? null,
      accepted_text: ACCEPT_TEXT,
      contract_version: CONTRACT_VERSION,
      signature_hash: hash,
      contract_snapshot: snapshot,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", contract.tenant_id);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/config");
  return { ok: true as const };
}

export type ContractDataInput = {
  tenantId: string;
  legalName?: string;
  tradeName?: string;
  docType?: string;
  docNumber?: string;
  responsibleName?: string;
  responsibleCpf?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  contactEmail?: string;
  contactPhone?: string;
};

/** MASTER edita/preenche os dados legais do contrato de uma barbearia (service-role). */
export async function updateContractData(input: ContractDataInput) {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return { ok: false as const, error: "Acesso negado." };
  if (!input.tenantId) return { ok: false as const, error: "Barbearia inválida." };

  const admin = createSupabaseAdminClient();
  const t = (s?: string) => (s && s.trim() ? s.trim() : null);
  const { error } = await admin
    .from("tenant_contracts")
    .update({
      legal_name: t(input.legalName),
      trade_name: t(input.tradeName),
      doc_type: t(input.docType),
      doc_number: t(input.docNumber),
      responsible_name: t(input.responsibleName),
      responsible_cpf: t(input.responsibleCpf),
      address_street: t(input.addressStreet),
      address_city: t(input.addressCity),
      address_state: t(input.addressState),
      address_zip: t(input.addressZip),
      contact_email: t(input.contactEmail),
      contact_phone: t(input.contactPhone),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", input.tenantId);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/master/barbearias/${input.tenantId}`);
  return { ok: true as const };
}

export type OwnContractDataInput = Omit<ContractDataInput, "tenantId">;

/** ADMIN da barbearia preenche/edita os dados legais do PRÓPRIO contrato (antes de assinar). */
export async function updateOwnContractData(input: OwnContractDataInput) {
  const user = await getSessionUser();
  if (!user?.role || !isUnitAdmin(user.role) || !user.tenantId)
    return { ok: false as const, error: "Acesso negado." };

  const admin = createSupabaseAdminClient();
  // Não permite editar dados após assinar (integridade do documento).
  const { data: c } = await admin
    .from("tenant_contracts")
    .select("status")
    .eq("tenant_id", user.tenantId)
    .maybeSingle();
  if ((c as { status?: string } | null)?.status === "SIGNED")
    return { ok: false as const, error: "Contrato já assinado — os dados não podem ser alterados." };

  const t = (s?: string) => (s && s.trim() ? s.trim() : null);
  const { error } = await admin
    .from("tenant_contracts")
    .update({
      legal_name: t(input.legalName),
      trade_name: t(input.tradeName),
      doc_type: t(input.docType),
      doc_number: t(input.docNumber),
      responsible_name: t(input.responsibleName),
      responsible_cpf: t(input.responsibleCpf),
      address_street: t(input.addressStreet),
      address_city: t(input.addressCity),
      address_state: t(input.addressState),
      address_zip: t(input.addressZip),
      contact_email: t(input.contactEmail),
      contact_phone: t(input.contactPhone),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", user.tenantId);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/config");
  return { ok: true as const };
}
