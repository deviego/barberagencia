import { autoMap, normHeader } from "../core/fields";
import type { Entity, Mapping } from "../core/types";

/** Cabeçalho do arquivo cujo nome normalizado é um dos `names` (ou undefined). */
export function findHeader(headers: string[], names: string[]): string | undefined {
  const wanted = new Set(names.map(normHeader));
  return headers.find((h) => wanted.has(normHeader(h)));
}

/** Quantos dos grupos de nomes aparecem nos cabeçalhos (cada grupo = sinônimos). */
export function countPresent(headers: string[], groups: string[][]): number {
  return groups.filter((g) => findHeader(headers, g) !== undefined).length;
}

/**
 * Mapeamento de um adaptador: primeiro os nomes de coluna conhecidos daquela origem
 * (match exato, sem acento); o que faltar cai no autoMap genérico.
 */
export function adapterMapping(
  entity: Entity,
  headers: string[],
  known: Partial<Record<Entity, Record<string, string[]>>>
): Mapping {
  const preset: Mapping = {};
  for (const [field, names] of Object.entries(known[entity] ?? {})) {
    const h = findHeader(headers, names);
    if (h && !Object.values(preset).includes(h)) preset[field] = h;
  }
  return autoMap(headers, entity, preset);
}

/** Linha de relatório que é rodapé/total ("Total: 152 clientes", "Gerado em ..."). */
export function isReportFooter(raw: Record<string, unknown>): boolean {
  const cells = Object.values(raw).filter((v) => v != null && String(v).trim() !== "");
  if (cells.length === 0) return true;
  const first = normHeader(cells[0]);
  return cells.length <= 2 && /^(total|quantidade|qtd|gerado em|emitido em|impresso em|pagina)\b/.test(first);
}
