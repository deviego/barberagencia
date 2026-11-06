/**
 * Pipeline do navegador (e dos testes): linhas cruas → transform do adaptador →
 * normalização/validação → dedup no arquivo → lotes de registros normalizados.
 * Só os registros normalizados (pequenos) vão para a server action, em lotes.
 */
import { dedupWithinFile } from "./core/dedup";
import { normalizeRecord } from "./core/normalize";
import type { DuplicatePolicy, Entity, Mapping, NormalizedRecord, RawRow, RowIssue } from "./core/types";
import type { SourceAdapter } from "./sources/types";

export const CHUNK_SIZE = 500;
export const MAX_ROWS = 10000;

export interface PreparedImport {
  /** Registros válidos (já sem duplicatas do próprio arquivo, conforme a política). */
  records: NormalizedRecord[];
  /** Erros (linha descartada) e avisos (campo descartado / duplicado no arquivo / rodapé). */
  issues: RowIssue[];
  /** Linhas com erro (não serão enviadas). */
  invalid: number;
  /** Linhas puladas por duplicidade dentro do arquivo. */
  skippedInFile: number;
  /** Linhas descartadas pelo adaptador (rodapé/total de relatório). */
  dropped: number;
}

export function prepareImport(
  entity: Entity,
  source: SourceAdapter,
  rows: RawRow[],
  mapping: Mapping,
  policy: DuplicatePolicy
): PreparedImport {
  const valid: NormalizedRecord[] = [];
  const issues: RowIssue[] = [];
  let invalid = 0;
  let dropped = 0;
  for (const row of rows) {
    const data = source.transform ? source.transform(entity, row.data) : row.data;
    if (!data) {
      dropped++;
      continue;
    }
    const res = normalizeRecord(entity, data, mapping, row.line);
    if (res.ok) {
      valid.push(res.record);
      issues.push(...res.warnings);
    } else {
      invalid++;
      issues.push(...res.issues);
    }
  }
  const { kept, skipped } = dedupWithinFile(entity, valid, policy);
  issues.push(...skipped);
  issues.sort((a, b) => a.line - b.line);
  return { records: kept, issues, invalid, skippedInFile: skipped.length, dropped };
}

export function chunk<T>(arr: T[], size = CHUNK_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
