"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { isMaster } from "@/lib/rbac";
import { isUuid } from "@/lib/auth/acting";
import { listPartnersForSelect, type CommissionKind, type PartnerType } from "./data";

/** Server action para telas client (ex.: onboarding) listarem parceiros ativos. */
export async function listPartnersAction() {
  return listPartnersForSelect();
}

export type PartnerInput = {
  name: string;
  type: PartnerType;
  isBarbershop: boolean;
  tenantId?: string | null;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  instagram?: string;
  commissionKind: CommissionKind;
  commissionValue: number;
  notes?: string;
  active?: boolean;
};

const clean = (s?: string | null) => (s && s.trim() ? s.trim() : null);

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 24);
}

async function uniqueRefCode(admin: ReturnType<typeof createSupabaseAdminClient>, name: string): Promise<string> {
  const base = slugify(name) || "parceiro";
  for (let i = 0; i < 6; i++) {
    const code = `${base}-${randomBytes(2).toString("hex")}`;
    const { data } = await admin.from("partners").select("id").eq("ref_code", code).maybeSingle();
    if (!data) return code;
  }
  return `${base}-${randomBytes(4).toString("hex")}`;
}

function row(input: PartnerInput) {
  return {
    name: input.name.trim(),
    type: input.type,
    is_barbershop: !!input.isBarbershop,
    tenant_id: input.isBarbershop && input.tenantId && isUuid(input.tenantId) ? input.tenantId : null,
    contact_name: clean(input.contactName),
    contact_phone: clean(input.contactPhone),
    contact_email: clean(input.contactEmail),
    instagram: clean(input.instagram),
    commission_kind: input.commissionKind,
    commission_value: Number(input.commissionValue) || 0,
    notes: clean(input.notes),
    active: input.active !== false,
  };
}

/** MASTER cria um parceiro (gera ref_code único). */
export async function createPartner(input: PartnerInput) {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return { ok: false as const, error: "Acesso negado." };
  if (!input.name?.trim()) return { ok: false as const, error: "Informe o nome do parceiro." };

  const admin = createSupabaseAdminClient();
  const ref_code = await uniqueRefCode(admin, input.name);
  const { data, error } = await admin.from("partners").insert({ ...row(input), ref_code }).select("id").single();
  if (error) return { ok: false as const, error: `Falha ao criar (aplique schema-24?): ${error.message}` };
  revalidatePath("/master/parceiros");
  return { ok: true as const, id: data.id as string, refCode: ref_code };
}

/** MASTER edita um parceiro (não altera o ref_code). */
export async function updatePartner(id: string, input: PartnerInput) {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return { ok: false as const, error: "Acesso negado." };
  if (!isUuid(id)) return { ok: false as const, error: "Parceiro inválido." };

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("partners").update(row(input)).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/master/parceiros");
  revalidatePath(`/master/parceiros/${id}`);
  return { ok: true as const };
}

export async function setPartnerActive(id: string, active: boolean) {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return { ok: false as const, error: "Acesso negado." };
  if (!isUuid(id)) return { ok: false as const, error: "Parceiro inválido." };
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("partners").update({ active }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/master/parceiros");
  return { ok: true as const };
}

export async function deletePartner(id: string) {
  const user = await getSessionUser();
  if (!user?.role || !isMaster(user.role)) return { ok: false as const, error: "Acesso negado." };
  if (!isUuid(id)) return { ok: false as const, error: "Parceiro inválido." };
  const admin = createSupabaseAdminClient();
  // Solta a atribuição das barbearias antes de remover (FK).
  await admin.from("tenants").update({ referred_by_partner_id: null }).eq("referred_by_partner_id", id);
  const { error } = await admin.from("partners").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/master/parceiros");
  return { ok: true as const };
}
