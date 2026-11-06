"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { ROLES } from "@/lib/rbac";
import { isUuid } from "@/lib/auth/acting";
import { FIELD_MAP } from "./core/fields";
import { identityMapping, normalizeRecord } from "./core/normalize";
import { EXISTING_COLUMNS, buildExistingIndex, fetchAllPaged, planImport } from "./core/dedup";
import type { DuplicatePolicy, Entity, ImportCounts, NormalizedRecord, RowIssue } from "./core/types";
import { getSource } from "./sources/registry";

type Admin = ReturnType<typeof createSupabaseAdminClient>;
type Fail = { ok: false; error: string };
type PgError = { message: string; code?: string } | null;
type PageResult = PromiseLike<{ data: Record<string, unknown>[] | null; error: PgError }>;

const TABLE: Record<Entity, string> = { clients: "clients", products: "products", services: "services" };
const POLICIES: DuplicatePolicy[] = ["skip", "update", "create"];
const MAX_CHUNK = 1000;
const MAX_STORED_ISSUES = 2000;
const JOBS_MISSING =
  "Histórico/desfazer indisponível: a migration supabase/schema-32-import.sql ainda não foi aplicada no banco.";

/** Tabela/coluna inexistente (ex.: migration 32 não aplicada). */
function isMissingSchema(err: PgError): boolean {
  if (!err) return false;
  return (
    ["42P01", "42703", "PGRST204", "PGRST205"].includes(err.code ?? "") ||
    /does not exist|schema cache|could not find/i.test(err.message)
  );
}

async function guard(tenantId: string): Promise<{ admin: Admin; userId: string } | Fail> {
  const user = await getSessionUser();
  if (user?.role !== ROLES.MASTER) return { ok: false, error: "Apenas o Master pode importar dados." };
  if (!isUuid(tenantId)) return { ok: false, error: "Barbearia inválida." };
  return { admin: createSupabaseAdminClient(), userId: user.id };
}

function revalidateTenant(tenantId: string) {
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/produtos");
  revalidatePath("/admin/servicos");
  revalidatePath("/admin");
  revalidatePath(`/master/barbearias/${tenantId}`);
  revalidatePath(`/master/barbearias/${tenantId}/importar`);
}

/** Índice do que já existe na barbearia — paginado (o PostgREST devolve no máx. 1000 por vez). */
async function loadExistingIndex(admin: Admin, tenantId: string, entity: Entity) {
  const rows = await fetchAllPaged<Record<string, unknown>>(
    (from, to) =>
      admin
        .from(TABLE[entity])
        .select(EXISTING_COLUMNS[entity])
        .eq("tenant_id", tenantId)
        .order("id")
        .range(from, to) as unknown as PageResult
  );
  return buildExistingIndex(entity, rows);
}

/** Valores de INSERT: tenant + (clientes) status INVITED sem usuário — reconvidável e reconciliado no cadastro. */
function insertRow(entity: Entity, tenantId: string, values: Record<string, unknown>, jobId: string | null) {
  const row: Record<string, unknown> = { ...values, tenant_id: tenantId };
  if (entity === "clients") {
    row.status = "INVITED"; // NÃO dispara convite: o envio é ação separada (Reenviar convite no admin)
    row.user_id = null;
  }
  if (jobId) row.import_job_id = jobId;
  return row;
}

export interface ChunkResult {
  ok: true;
  counts: ImportCounts;
  issues: RowIssue[];
}

/**
 * [Master] Processa UM lote (≤ 1000; o navegador manda ~500) de registros JÁ normalizados.
 *  - dryRun=true: só calcula inserir/atualizar/pular/erro (prévia) — não grava nada.
 *  - dryRun=false: grava. Lote com erro → tenta linha a linha e registra o erro de cada uma.
 * O servidor revalida cada registro (mapeamento identidade): whitelist de campos + validação.
 */
export async function processImportChunk(input: {
  tenantId: string;
  entity: Entity;
  records: NormalizedRecord[];
  policy: DuplicatePolicy;
  dryRun: boolean;
  jobId?: string | null;
}): Promise<ChunkResult | Fail> {
  const g = await guard(input.tenantId);
  if ("ok" in g) return g;
  const { admin } = g;
  const entity = input.entity;
  if (!FIELD_MAP[entity]) return { ok: false, error: "Tipo de importação inválido." };
  if (!POLICIES.includes(input.policy)) return { ok: false, error: "Política de duplicados inválida." };
  if (!Array.isArray(input.records)) return { ok: false, error: "Lote inválido." };
  if (input.records.length > MAX_CHUNK) return { ok: false, error: `Lote acima de ${MAX_CHUNK} registros.` };
  const jobId = input.jobId && isUuid(input.jobId) ? input.jobId : null;

  const issues: RowIssue[] = [];
  const counts: ImportCounts = { insert: 0, update: 0, skip: 0, error: 0 };

  // Revalidação no servidor (não confia no navegador).
  const idMap = identityMapping(entity);
  const records: NormalizedRecord[] = [];
  for (const r of input.records) {
    const line = Number.isFinite(r?.line) ? Number(r.line) : 0;
    const res = normalizeRecord(entity, (r?.values ?? {}) as Record<string, unknown>, idMap, line);
    if (res.ok) records.push(res.record);
    else {
      counts.error++;
      issues.push(...res.issues.filter((i) => i.level === "error"));
    }
  }

  let existing: Map<string, string>;
  try {
    existing = await loadExistingIndex(admin, input.tenantId, entity);
  } catch (e) {
    return { ok: false, error: `Falha ao ler os registros existentes: ${e instanceof Error ? e.message : String(e)}` };
  }
  const plan = planImport(entity, records, existing, input.policy);
  issues.push(...plan.skipped);
  counts.skip += plan.counts.skip;

  if (input.dryRun) {
    counts.insert += plan.counts.insert;
    counts.update += plan.counts.update;
    return { ok: true, counts, issues };
  }

  const table = TABLE[entity];

  // INSERT em lote; se o lote falhar, linha a linha (uma linha ruim não derruba as outras).
  if (plan.toInsert.length) {
    const rows = plan.toInsert.map((r) => insertRow(entity, input.tenantId, r.values, jobId));
    const { error } = await admin.from(table).insert(rows);
    if (!error) counts.insert += rows.length;
    else {
      if (jobId && isMissingSchema(error)) return { ok: false, error: JOBS_MISSING };
      for (let i = 0; i < rows.length; i++) {
        const { error: rowErr } = await admin.from(table).insert(rows[i]);
        if (rowErr) {
          counts.error++;
          issues.push({ line: plan.toInsert[i].line, level: "error", reason: `Não gravou: ${rowErr.message}` });
        } else counts.insert++;
      }
    }
  }

  // UPDATE do existente (não mexe em status/user_id/import_job_id).
  for (const u of plan.toUpdate) {
    const { error } = await admin.from(table).update(u.record.values).eq("id", u.id).eq("tenant_id", input.tenantId);
    if (error) {
      counts.error++;
      issues.push({ line: u.record.line, level: "error", reason: `Não atualizou: ${error.message}` });
    } else counts.update++;
  }

  return { ok: true, counts, issues };
}

/**
 * [Master] Abre o registro da importação (import_jobs). Sem a migration 32 a importação
 * segue normalmente — só volta jobId=null + aviso (sem histórico/desfazer).
 */
export async function startImportJob(input: {
  tenantId: string;
  entity: Entity;
  source: string;
  fileName?: string;
}): Promise<{ ok: true; jobId: string | null; warning?: string } | Fail> {
  const g = await guard(input.tenantId);
  if ("ok" in g) return g;
  if (!FIELD_MAP[input.entity]) return { ok: false, error: "Tipo de importação inválido." };
  const { data, error } = await g.admin
    .from("import_jobs")
    .insert({
      tenant_id: input.tenantId,
      entity: input.entity,
      source: getSource(input.source).id,
      file_name: (input.fileName ?? "").slice(0, 200) || null,
      created_by: g.userId,
    })
    .select("id")
    .single();
  if (error) {
    if (isMissingSchema(error)) return { ok: true, jobId: null, warning: JOBS_MISSING };
    return { ok: false, error: `Falha ao registrar a importação: ${error.message}` };
  }
  return { ok: true, jobId: data.id as string };
}

/** [Master] Fecha a importação: grava contagens/erros no job (se houver) e revalida as telas do admin. */
export async function finishImportJob(input: {
  tenantId: string;
  jobId: string | null;
  counts: ImportCounts;
  issues: RowIssue[];
}): Promise<{ ok: true } | Fail> {
  const g = await guard(input.tenantId);
  if ("ok" in g) return g;
  if (input.jobId && isUuid(input.jobId)) {
    const errors = (Array.isArray(input.issues) ? input.issues : []).slice(0, MAX_STORED_ISSUES).map((i) => ({
      line: Number(i.line) || 0,
      level: i.level === "error" ? "error" : "warning",
      reason: String(i.reason ?? "").slice(0, 300),
    }));
    const c = input.counts ?? { insert: 0, update: 0, skip: 0, error: 0 };
    const counts = { insert: +c.insert || 0, update: +c.update || 0, skip: +c.skip || 0, error: +c.error || 0 };
    await g.admin
      .from("import_jobs")
      .update({ counts, errors, finished_at: new Date().toISOString() })
      .eq("id", input.jobId)
      .eq("tenant_id", input.tenantId);
  }
  revalidateTenant(input.tenantId);
  return { ok: true };
}

export interface ImportJobSummary {
  id: string;
  source: string;
  entity: Entity;
  fileName: string | null;
  counts: Partial<ImportCounts> & { undo?: { deleted: number; kept: number } };
  createdAt: string;
  undoneAt: string | null;
}

/** [Master] Últimas importações da barbearia. available=false → migration 32 não aplicada. */
export async function listImportJobs(
  tenantId: string
): Promise<{ ok: true; available: boolean; jobs: ImportJobSummary[]; warning?: string } | Fail> {
  const g = await guard(tenantId);
  if ("ok" in g) return g;
  const { data, error } = await g.admin
    .from("import_jobs")
    .select("id, source, entity, file_name, counts, created_at, undone_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) {
    if (isMissingSchema(error)) return { ok: true, available: false, jobs: [], warning: JOBS_MISSING };
    return { ok: false, error: error.message };
  }
  return {
    ok: true,
    available: true,
    jobs: (data ?? []).map((j) => ({
      id: j.id as string,
      source: j.source as string,
      entity: j.entity as Entity,
      fileName: (j.file_name as string | null) ?? null,
      counts: (j.counts ?? {}) as ImportJobSummary["counts"],
      createdAt: j.created_at as string,
      undoneAt: (j.undone_at as string | null) ?? null,
    })),
  };
}

/** Tabelas que referenciam o registro: com vínculo, o registro NÃO é apagado no desfazer. */
const REFERENCES: Record<Entity, [table: string, column: string][]> = {
  clients: [
    ["client_subscriptions", "client_id"],
    ["appointments", "client_id"],
    ["payments", "client_id"],
    ["sales", "client_id"],
    ["product_reservations", "client_id"],
    ["queue_entries", "client_id"],
    ["children", "client_id"],
    ["plan_requests", "client_id"],
  ],
  services: [
    ["appointments", "service_id"],
    ["queue_entries", "service_id"],
    ["combo_plans", "service_id"],
    ["combo_plan_services", "service_id"],
    ["client_subscriptions", "fixed_service_id"],
    ["sale_items", "ref_id"],
  ],
  products: [
    ["product_reservations", "product_id"],
    ["order_items", "product_id"],
    ["sale_items", "ref_id"],
  ],
};
const ID_BATCH = 200;

async function referencedIds(admin: Admin, entity: Entity, ids: string[]): Promise<Set<string>> {
  const used = new Set<string>();
  for (const [table, col] of REFERENCES[entity]) {
    for (let i = 0; i < ids.length; i += ID_BATCH) {
      const part = ids.slice(i, i + ID_BATCH);
      try {
        const rows = await fetchAllPaged<Record<string, unknown>>(
          (from, to) => admin.from(table).select(col).in(col, part).order(col).range(from, to) as unknown as PageResult
        );
        for (const r of rows) if (r[col]) used.add(String(r[col]));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Tabela/coluna opcional que não existe neste banco → nada a checar nela.
        if (isMissingSchema({ message: msg })) break;
        throw new Error(`Falha ao checar vínculos em ${table}: ${msg}`);
      }
    }
  }
  return used;
}

/**
 * [Master] Desfaz uma importação: apaga os registros CRIADOS por ela que ainda não têm
 * vínculo (cliente sem usuário/assinatura/agendamento/venda; serviço/produto sem uso).
 * Registros atualizados pela importação não são tocados (não recebem import_job_id).
 */
export async function undoImportJob(input: {
  tenantId: string;
  jobId: string;
}): Promise<{ ok: true; deleted: number; kept: number } | Fail> {
  const g = await guard(input.tenantId);
  if ("ok" in g) return g;
  const { admin } = g;
  if (!isUuid(input.jobId)) return { ok: false, error: "Importação inválida." };

  const { data: job, error: jobErr } = await admin
    .from("import_jobs")
    .select("id, entity, counts, undone_at")
    .eq("id", input.jobId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (jobErr) return { ok: false, error: isMissingSchema(jobErr) ? JOBS_MISSING : jobErr.message };
  if (!job) return { ok: false, error: "Importação não encontrada." };
  if (job.undone_at) return { ok: false, error: "Esta importação já foi desfeita." };
  const entity = job.entity as Entity;
  if (!FIELD_MAP[entity]) return { ok: false, error: "Tipo de importação inválido." };
  const table = TABLE[entity];

  let created: Record<string, unknown>[];
  try {
    created = await fetchAllPaged<Record<string, unknown>>(
      (from, to) =>
        admin
          .from(table)
          .select(entity === "clients" ? "id, user_id, status" : "id")
          .eq("tenant_id", input.tenantId)
          .eq("import_job_id", input.jobId)
          .order("id")
          .range(from, to) as unknown as PageResult
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: isMissingSchema({ message: msg }) ? JOBS_MISSING : msg };
  }

  const candidates = entity === "clients" ? created.filter((c) => !c.user_id && c.status === "INVITED") : created;
  let ids = candidates.map((c) => String(c.id));
  try {
    const used = await referencedIds(admin, entity, ids);
    ids = ids.filter((id) => !used.has(id));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  let deleted = 0;
  for (let i = 0; i < ids.length; i += ID_BATCH) {
    let q = admin
      .from(table)
      .delete({ count: "exact" })
      .in("id", ids.slice(i, i + ID_BATCH))
      .eq("tenant_id", input.tenantId)
      .eq("import_job_id", input.jobId);
    // Rechecagem no próprio DELETE: o cliente pode ter criado acesso entre a leitura e o delete.
    if (entity === "clients") q = q.is("user_id", null).eq("status", "INVITED");
    const { error, count } = await q;
    if (error) return { ok: false, error: `Falha ao apagar (${deleted} já apagados): ${error.message}` };
    deleted += count ?? 0;
  }
  const kept = created.length - deleted;

  await admin
    .from("import_jobs")
    .update({
      undone_at: new Date().toISOString(),
      counts: { ...((job.counts as Record<string, unknown> | null) ?? {}), undo: { deleted, kept } },
    })
    .eq("id", input.jobId)
    .eq("tenant_id", input.tenantId);

  revalidateTenant(input.tenantId);
  return { ok: true, deleted, kept };
}
