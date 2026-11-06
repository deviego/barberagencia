/**
 * Deduplicação: chaves por entidade, dedup dentro do arquivo (no navegador, antes de
 * fatiar em lotes), índice paginado do que já existe no banco e o plano de gravação
 * (inserir/atualizar/pular). Puro — o acesso ao banco entra por callback.
 */
import { normHeader } from "./fields";
import { phoneKeyDigits } from "./normalize";
import type { DuplicatePolicy, Entity, ImportCounts, NormalizedRecord, RowIssue } from "./types";

const normName = (v: unknown) => normHeader(v).replace(/[^a-z0-9 ]/g, "").trim();

/** Chaves de dedup de um registro (normalizado ou existente no banco). */
export function dedupKeys(entity: Entity, values: Record<string, unknown>): string[] {
  const keys: string[] = [];
  if (entity === "clients") {
    const p = phoneKeyDigits(values.phone);
    if (p.length >= 10) keys.push("p:" + p);
    const email = String(values.email ?? "").trim().toLowerCase();
    if (email) keys.push("e:" + email);
  } else {
    if (entity === "products") {
      const sku = String(values.sku ?? "").trim().toLowerCase();
      if (sku) keys.push("s:" + sku);
    }
    const name = normName(values.name);
    if (name) keys.push("n:" + name);
  }
  return keys;
}

/** Colunas lidas do banco para montar o índice de dedup. */
export const EXISTING_COLUMNS: Record<Entity, string> = {
  clients: "id, phone, email",
  products: "id, sku, name",
  services: "id, name",
};

export const PAGE_SIZE = 1000;

/**
 * Lê TODOS os registros existentes em páginas de 1000 (o PostgREST corta em 1000 por
 * requisição — sem paginar, o índice ficava incompleto e duplicava em bases grandes).
 */
export async function fetchAllPaged<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = PAGE_SIZE
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

/** chave → id do registro existente (o primeiro que aparecer). */
export function buildExistingIndex(entity: Entity, rows: Record<string, unknown>[]): Map<string, string> {
  const idx = new Map<string, string>();
  for (const r of rows) for (const k of dedupKeys(entity, r)) if (!idx.has(k)) idx.set(k, String(r.id));
  return idx;
}

/**
 * Dedup dentro do próprio arquivo (feito ANTES de fatiar em lotes, senão uma duplicata
 * em lotes diferentes passaria). Com política "create" nada é removido.
 */
export function dedupWithinFile(
  entity: Entity,
  records: NormalizedRecord[],
  policy: DuplicatePolicy
): { kept: NormalizedRecord[]; skipped: RowIssue[] } {
  if (policy === "create") return { kept: records, skipped: [] };
  const firstLine = new Map<string, number>();
  const kept: NormalizedRecord[] = [];
  const skipped: RowIssue[] = [];
  for (const r of records) {
    const keys = dedupKeys(entity, r.values);
    const dup = keys.find((k) => firstLine.has(k));
    if (dup) {
      skipped.push({ line: r.line, level: "warning", reason: `Duplicado no arquivo (igual à linha ${firstLine.get(dup)}) — pulado` });
      continue;
    }
    keys.forEach((k) => firstLine.set(k, r.line));
    kept.push(r);
  }
  return { kept, skipped };
}

export interface ImportPlan {
  toInsert: NormalizedRecord[];
  toUpdate: { id: string; record: NormalizedRecord }[];
  skipped: RowIssue[];
  counts: ImportCounts;
}

/** Decide, para cada registro, se insere/atualiza/pula contra o que já existe no banco. */
export function planImport(
  entity: Entity,
  records: NormalizedRecord[],
  existing: Map<string, string>,
  policy: DuplicatePolicy
): ImportPlan {
  const toInsert: NormalizedRecord[] = [];
  const toUpdate: { id: string; record: NormalizedRecord }[] = [];
  const skipped: RowIssue[] = [];
  const updatingIds = new Set<string>();
  for (const r of records) {
    const hit = dedupKeys(entity, r.values).find((k) => existing.has(k));
    if (!hit || policy === "create") {
      toInsert.push(r);
      continue;
    }
    const id = existing.get(hit)!;
    if (policy === "update" && !updatingIds.has(id)) {
      updatingIds.add(id);
      toUpdate.push({ id, record: r });
    } else {
      skipped.push({ line: r.line, level: "warning", reason: "Já existe na barbearia — pulado" });
    }
  }
  return {
    toInsert,
    toUpdate,
    skipped,
    counts: { insert: toInsert.length, update: toUpdate.length, skip: skipped.length, error: 0 },
  };
}
