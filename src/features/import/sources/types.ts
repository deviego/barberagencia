import type { Entity, Mapping } from "../core/types";

/** Contexto extra que o registry passa ao detect (onde o cabeçalho foi achado etc.). */
export interface DetectContext {
  /** Índice (base 0) da linha de cabeçalho dentro da aba. > 0 = havia título/linhas antes. */
  headerRow: number;
  fileName?: string;
  sheetName?: string;
}

/**
 * Adaptador por sistema de origem (concorrente ou planilha genérica).
 * Um adaptador só sabe LER o formato da origem; validação, dedup e gravação são do núcleo.
 */
export interface SourceAdapter {
  id: string;
  label: string;
  /** Passo a passo para tirar os dados da plataforma de origem. */
  guide: string;
  /** Entidades que esta origem sabe exportar. */
  entities: Entity[];
  /** Confiança (0..1) de que o arquivo veio desta origem. ≥ 0.5 = auto-seleciona. */
  detect(headers: string[], sample: Record<string, unknown>[], ctx?: DetectContext): number;
  /** Índice da linha de cabeçalho (exports "de relatório" com título antes). -1 = não achou. */
  locateHeader?(aoa: unknown[][]): number;
  /** De-para cabeçalho → campo para a entidade. */
  mapping(entity: Entity, headers: string[]): Mapping;
  /** Ajuste da linha crua antes de normalizar (juntar colunas, etc.). null = descartar a linha. */
  transform?(entity: Entity, raw: Record<string, unknown>): Record<string, unknown> | null;
}
