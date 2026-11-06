/**
 * Tipos do núcleo de importação. Código puro (sem "server-only"): roda no
 * navegador (wizard), no servidor (server actions) e nos testes (tsx).
 */

export type Entity = "clients" | "products" | "services";

export type FieldType = "text" | "email" | "phone" | "money" | "int" | "duration" | "date";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /**
   * Aliases de cabeçalho (comparados SEM acento, minúsculos, espaços colapsados).
   * Match exato sempre; match por conteúdo (palavra inteira) só para aliases com 4+ letras
   * que não estejam em `exactOnly`.
   */
  aliases: string[];
  /** Aliases ambíguos: só valem em match exato (ex.: "saldo", "numero", "tipo"). */
  exactOnly?: string[];
}

/** De-para: chave do nosso campo → nome do cabeçalho do arquivo. */
export type Mapping = Record<string, string>;

/** Linha crua do arquivo (cabeçalho → célula) com o número da linha na planilha (base 1). */
export interface RawRow {
  line: number;
  data: Record<string, unknown>;
}

/** Registro já normalizado (o que trafega do navegador para a server action). */
export interface NormalizedRecord {
  line: number;
  values: Record<string, unknown>;
}

export type IssueLevel = "error" | "warning";

export interface RowIssue {
  line: number;
  level: IssueLevel;
  reason: string;
}

export type DuplicatePolicy = "skip" | "update" | "create";

export interface ImportCounts {
  insert: number;
  update: number;
  skip: number;
  error: number;
}

export const emptyCounts = (): ImportCounts => ({ insert: 0, update: 0, skip: 0, error: 0 });

export function addCounts(a: ImportCounts, b: ImportCounts): ImportCounts {
  return { insert: a.insert + b.insert, update: a.update + b.update, skip: a.skip + b.skip, error: a.error + b.error };
}
