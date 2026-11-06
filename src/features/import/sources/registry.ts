import { detectHeaderRow, extractTable, type Sheet, type Table } from "../core/parse-file";
import type { Entity } from "../core/types";
import { appbarberSource } from "./appbarber";
import { bestbarbersSource } from "./bestbarbers";
import { booksySource } from "./booksy";
import { genericSource } from "./generic";
import { trinksSource } from "./trinks";
import type { SourceAdapter } from "./types";

export type { SourceAdapter, DetectContext } from "./types";

/** Ordem = desempate (o genérico fica por último e é o fallback). */
export const SOURCES: SourceAdapter[] = [trinksSource, booksySource, appbarberSource, bestbarbersSource, genericSource];

export const AUTO_SELECT_THRESHOLD = 0.5;

export function getSource(id: string): SourceAdapter {
  return SOURCES.find((s) => s.id === id) ?? genericSource;
}

/** Linha de cabeçalho para uma origem: locateHeader do adaptador, senão a heurística genérica. */
export function headerRowFor(source: SourceAdapter, sheet: Sheet): number {
  const located = source.locateHeader?.(sheet.aoa) ?? -1;
  return located >= 0 ? located : detectHeaderRow(sheet.aoa);
}

export interface SourceCandidate {
  source: SourceAdapter;
  score: number;
  headerRow: number;
  table: Table;
}

/** Pontua todas as origens que suportam a entidade; a melhor vem primeiro. */
export function rankSources(sheet: Sheet, entity: Entity, fileName?: string): SourceCandidate[] {
  const out: SourceCandidate[] = [];
  for (const source of SOURCES) {
    if (!source.entities.includes(entity)) continue;
    const headerRow = headerRowFor(source, sheet);
    const table = extractTable(sheet, headerRow);
    const sample = table.rows.slice(0, 20).map((r) => r.data);
    let score = 0;
    try {
      score = source.detect(table.headers, sample, { headerRow, fileName, sheetName: sheet.name });
    } catch {
      score = 0;
    }
    out.push({ source, score: Math.max(0, Math.min(1, score)), headerRow, table });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Origem detectada: a melhor com score ≥ limiar; senão a planilha genérica. */
export function detectSource(sheet: Sheet, entity: Entity, fileName?: string): SourceCandidate {
  const ranked = rankSources(sheet, entity, fileName);
  const best = ranked[0];
  if (best && best.score >= AUTO_SELECT_THRESHOLD) return best;
  return ranked.find((c) => c.source.id === genericSource.id)!;
}
