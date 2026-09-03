"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { ROLES } from "@/lib/rbac";
import { isUuid } from "@/lib/auth/acting";
import { FIELD_MAP, normalizeRow, dedupKeys, type Entity, type NormalizedRow } from "./normalize";

const TABLE: Record<Entity, string> = { clients: "clients", products: "products", services: "services" };
const BATCH = 500;

export type DuplicatePolicy = "skip" | "update" | "create";

export interface ImportResult {
  ok: true;
  inserted: number;
  updated: number;
  skipped: number;
  errors: { line: number; reason: string }[];
}
type ImportInput = {
  tenantId: string;
  entity: Entity;
  rows: Record<string, unknown>[];
  mapping: Record<string, string>;
  duplicatePolicy: DuplicatePolicy;
};

/** [Master] Importa clientes/produtos/serviços para uma barbearia (bulk, service-role). */
export async function importRows(input: ImportInput): Promise<ImportResult | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (user?.role !== ROLES.MASTER) return { ok: false, error: "Apenas o Master pode importar dados." };
  if (!isUuid(input.tenantId)) return { ok: false, error: "Barbearia inválida." };
  const entity = input.entity;
  if (!FIELD_MAP[entity]) return { ok: false, error: "Tipo de importação inválido." };
  if (!Array.isArray(input.rows) || input.rows.length === 0) return { ok: false, error: "Nenhuma linha para importar." };
  if (input.rows.length > 10000) return { ok: false, error: "Limite de 10.000 linhas por importação." };

  const table = TABLE[entity];
  const admin = createSupabaseAdminClient();

  // Índice do que já existe na barbearia (para dedup) → mesma forma de chave do dedupKeys.
  const existing = new Set<string>();
  if (entity === "clients") {
    const { data } = await admin.from("clients").select("id, phone, email").eq("tenant_id", input.tenantId);
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      const digits = String(r.phone ?? "").replace(/\D/g, "");
      if (digits) existing.add("p:" + digits);
      const email = String(r.email ?? "").toLowerCase().trim();
      if (email) existing.add("e:" + email);
    }
  } else if (entity === "products") {
    const { data } = await admin.from("products").select("id, sku, name").eq("tenant_id", input.tenantId);
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      const sku = String(r.sku ?? "").toLowerCase().trim();
      if (sku) existing.add("s:" + sku);
      const name = String(r.name ?? "").toLowerCase().trim();
      if (name) existing.add("n:" + name);
    }
  } else {
    const { data } = await admin.from("services").select("id, name").eq("tenant_id", input.tenantId);
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      const name = String(r.name ?? "").toLowerCase().trim();
      if (name) existing.add("n:" + name);
    }
  }
  // Para "update" precisamos do id do registro existente; indexamos separado.
  const idByKey = new Map<string, string>();
  if (input.duplicatePolicy === "update") {
    const cols = entity === "clients" ? "id, phone, email" : entity === "products" ? "id, sku, name" : "id, name";
    const { data } = await admin.from(table).select(cols).eq("tenant_id", input.tenantId);
    for (const r of (data ?? []) as unknown as Record<string, unknown>[]) {
      for (const k of existingKeysOf(entity, r)) if (!idByKey.has(k)) idByKey.set(k, r.id as string);
    }
  }

  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: { id: string; values: Record<string, unknown> }[] = [];
  const errors: { line: number; reason: string }[] = [];
  let skipped = 0;
  const seen = new Set<string>(); // dedup dentro do próprio arquivo

  input.rows.forEach((raw, i) => {
    const n = normalizeRow(raw, input.mapping, entity);
    if (n.errors.length) {
      errors.push({ line: i + 2, reason: n.errors.join(", ") }); // +2: cabeçalho + base 1
      return;
    }
    const keys = dedupKeys(entity, n);
    const dupExisting = keys.find((k) => existing.has(k));
    const dupInFile = keys.find((k) => seen.has(k));

    if (dupExisting || dupInFile) {
      if (input.duplicatePolicy === "skip") {
        skipped++;
        return;
      }
      if (input.duplicatePolicy === "update" && dupExisting) {
        const id = idByKey.get(dupExisting);
        if (id) {
          toUpdate.push({ id, values: n.values });
          return;
        }
        // sem id → cai para insert
      }
      // "create" (ou update sem id) → insere assim mesmo
    }
    keys.forEach((k) => seen.add(k));
    toInsert.push({ ...n.values, tenant_id: input.tenantId });
  });

  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const chunk = toInsert.slice(i, i + BATCH);
    const { error } = await admin.from(table).insert(chunk);
    if (error) return { ok: false, error: `Falha ao inserir: ${error.message}` };
    inserted += chunk.length;
  }

  let updated = 0;
  for (const u of toUpdate) {
    const { error } = await admin.from(table).update(u.values).eq("id", u.id).eq("tenant_id", input.tenantId);
    if (!error) updated++;
    else errors.push({ line: 0, reason: `Atualização falhou: ${error.message}` });
  }

  return { ok: true, inserted, updated, skipped, errors };
}

/** Chaves de um registro EXISTENTE (mesmo formato do dedupKeys de uma linha normalizada). */
function existingKeysOf(entity: Entity, r: Record<string, unknown>): string[] {
  const fake: NormalizedRow = { values: {}, phoneDigits: "", errors: [] };
  if (entity === "clients") {
    fake.phoneDigits = String(r.phone ?? "").replace(/\D/g, "");
    fake.values.email = r.email;
  } else if (entity === "products") {
    fake.values.sku = r.sku;
    fake.values.name = r.name;
  } else {
    fake.values.name = r.name;
  }
  return dedupKeys(entity, fake);
}
