"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";

interface CrudSchema {
  fields: string[];
  numeric: string[];
  path: string;
}

/** Whitelist de tabelas/campos permitidos no CRUD do admin. */
const SCHEMAS: Record<string, CrudSchema> = {
  services: {
    fields: ["name", "duration_min", "price_brl", "category", "active"],
    numeric: ["duration_min", "price_brl"],
    path: "/admin/servicos",
  },
  products: {
    fields: ["name", "sku", "price_brl", "cost_brl", "stock", "active"],
    numeric: ["price_brl", "cost_brl", "stock"],
    path: "/admin/produtos",
  },
  combo_plans: {
    fields: ["name", "cuts", "scope", "price_brl", "active"],
    numeric: ["cuts", "price_brl"],
    path: "/admin/servicos",
  },
  barbers: { fields: ["name", "active"], numeric: [], path: "/admin/barbeiros" },
  clients: { fields: ["name", "email", "phone", "active"], numeric: [], path: "/admin/clientes" },
};

export async function saveRow(table: string, id: string | null, values: Record<string, unknown>) {
  const schema = SCHEMAS[table];
  if (!schema) return { ok: false as const, error: "Tabela inválida" };
  const supabase = await createSupabaseServerClient();

  const payload: Record<string, unknown> = {};
  for (const f of schema.fields) {
    if (!(f in values)) continue;
    let v = values[f];
    if (schema.numeric.includes(f)) v = v === "" || v == null ? null : Number(v);
    payload[f] = v;
  }

  let error;
  if (id) {
    ({ error } = await supabase.from(table).update(payload).eq("id", id));
  } else {
    const user = await getSessionUser();
    if (!user?.tenantId) return { ok: false as const, error: "Sem tenant" };
    ({ error } = await supabase.from(table).insert({ ...payload, tenant_id: user.tenantId }));
  }
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(schema.path);
  return { ok: true as const };
}

/** Soft delete (inativar) — preserva histórico. */
export async function deleteRow(table: string, id: string) {
  const schema = SCHEMAS[table];
  if (!schema) return { ok: false as const, error: "Tabela inválida" };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from(table).update({ active: false }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(schema.path);
  return { ok: true as const };
}
