/**
 * Normalização + validação de células e linhas. Puro (navegador, servidor e testes).
 *
 * Idempotente: normalizar um registro JÁ normalizado (mapeamento identidade) devolve o
 * mesmo resultado — o servidor usa isso para revalidar/whitelistar o que o navegador mandou.
 */
import { FIELD_MAP } from "./fields";
import type { Entity, FieldDef, Mapping, NormalizedRecord, RowIssue } from "./types";

export const cleanStr = (v: unknown): string => String(v ?? "").replace(/\s+/g, " ").trim();

const pad = (s: string | number) => String(s).padStart(2, "0");

/* ------------------------------------------------------------------ dinheiro */

/** "R$ 1.234,56" / "45,00" / "1,234.56" / "45.00" / "45" / 45 → número em reais (null se inválido). */
export function parseMoneyCell(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  let s = String(v).trim().replace(/R\$|\s/gi, "");
  if (!s) return null;
  const neg = /^-|^\(.*\)$/.test(s);
  s = s.replace(/[()\-+]/g, "");
  if (!/^[\d.,]+$/.test(s)) return null;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // separador decimal = o último que aparece
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasComma) {
    const parts = s.split(",");
    s = parts.length > 2 ? parts.join("") : s.replace(",", ".");
  } else if (hasDot) {
    // só ponto: "1.234" / "1.234.567" = milhar; "45.5" / "45.50" = decimal
    const parts = s.split(".");
    if (parts.length > 2 || parts[parts.length - 1].length === 3) s = parts.join("");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round((neg ? -n : n) * 100) / 100;
}

/* ------------------------------------------------------------------ inteiros */

/** Inteiro tolerante: "12" / "12,0" / "1.200" / 12.4 → 12 / 12 / 1200 / 12. */
export function parseIntCell(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : null;
  const s = String(v).trim().replace(/\s*(un|und|unid|unidades?|pcs?|itens?)\.?$/i, "");
  const n = parseMoneyCell(s);
  return n == null ? null : Math.round(n);
}

/**
 * Duração em minutos: 30 / "30" / "30 min" / "1h" / "1h30" / "1:30" / "01:30:00" / "1,5h"
 * e frações de dia do Excel (0.0625 = 90 min).
 */
export function parseDurationCell(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    if (!Number.isFinite(v) || v <= 0) return null;
    return v < 1 ? Math.round(v * 1440) : Math.round(v);
  }
  const s = String(v).trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  let m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = s.match(/^(\d+(?:[.,]\d+)?)h(?:oras?)?(\d{1,2})?(?:m(?:in)?(?:utos?)?)?$/);
  if (m) return Math.round(Number(m[1].replace(",", ".")) * 60 + Number(m[2] ?? 0));
  m = s.match(/^(\d+)(?:m|min|mins|minutos?)?\.?$/);
  if (m) return Number(m[1]);
  return null;
}

/* ------------------------------------------------------------------ telefone */

/**
 * Telefone BR → dígitos nacionais (DDD + número, 10–11 dígitos) ou null se inválido.
 * Aceita DDI 55 colado, "+55", zero de operadora/tronco ("0 11 ...", "011...") e números do Excel.
 */
export function phoneNationalDigits(v: unknown): string | null {
  let d = (typeof v === "number" ? String(Math.round(v)) : String(v ?? "")).replace(/\D/g, "");
  if (!d) return null;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if ((d.length === 11 || d.length === 12) && d.startsWith("0")) d = d.slice(1);
  if (d.length !== 10 && d.length !== 11) return null;
  if (d[0] === "0" || d[1] === "0") return null; // DDD válido: 11..99, sem zero
  if (d.length === 11 && d[2] !== "9") return null; // celular de 11 dígitos começa com 9
  return d;
}

/** Formato de exibição usado no app (mesmo do maskPhoneBR do formulário do admin). */
export function formatPhoneBR(national: string): string {
  const ddd = national.slice(0, 2);
  const rest = national.slice(2);
  return `(${ddd}) ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
}

/** Dígitos para deduplicar telefones já gravados (qualquer formato, com ou sem 55). */
export function phoneKeyDigits(v: unknown): string {
  const n = phoneNationalDigits(v);
  if (n) return n;
  return String(v ?? "").replace(/\D/g, "");
}

/* ------------------------------------------------------------------ e-mail */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function parseEmailCell(v: unknown): string | null {
  const s = cleanStr(v).toLowerCase().replace(/^mailto:/, "");
  return EMAIL_RE.test(s) ? s : null;
}

/* ------------------------------------------------------------------ datas */

function realDate(y: number, mo: number, d: number): boolean {
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}
const iso = (y: number, mo: number, d: number) => `${y}-${pad(mo)}-${pad(d)}`;

/** Data → ISO "YYYY-MM-DD" a partir de DD/MM/AAAA, AAAA-MM-DD, DD/MM/AA ou serial do Excel. null se inválida (ex.: 31/02). */
export function parseDateCell(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : iso(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  }
  if (typeof v === "number") {
    // serial do Excel (epoch 1899-12-30)
    if (v <= 0 || v >= 73051) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = String(v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:$|[T\s])/);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return realDate(y, mo, d) ? iso(y, mo, d) : null;
  }
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:$|\s)/);
  if (m) {
    let y = Number(m[3]);
    if (m[3].length === 2) y += y > new Date().getFullYear() % 100 ? 1900 : 2000;
    const [d, mo] = [Number(m[1]), Number(m[2])];
    return realDate(y, mo, d) ? iso(y, mo, d) : null;
  }
  return null;
}

/* ------------------------------------------------------------------ linha */

export type NormalizeResult =
  | { ok: true; record: NormalizedRecord; warnings: RowIssue[] }
  | { ok: false; issues: RowIssue[] };

const today = () => new Date().toISOString().slice(0, 10);

function normalizeField(f: FieldDef, cell: unknown): { value?: unknown; problem?: string } {
  const empty = cell == null || (typeof cell === "string" && cell.trim() === "");
  if (empty) return {};
  switch (f.type) {
    case "text": {
      const s = cleanStr(cell);
      return s ? { value: s.slice(0, 200) } : {};
    }
    case "email": {
      const e = parseEmailCell(cell);
      return e ? { value: e } : { problem: `${f.label} inválido ("${cleanStr(cell)}")` };
    }
    case "phone": {
      const n = phoneNationalDigits(cell);
      return n ? { value: formatPhoneBR(n) } : { problem: `${f.label} inválido ("${cleanStr(cell)}") — precisa ter DDD + número` };
    }
    case "money": {
      const n = parseMoneyCell(cell);
      if (n == null) return { problem: `${f.label} inválido ("${cleanStr(cell)}")` };
      if (n < 0) return { problem: `${f.label} negativo` };
      return { value: n };
    }
    case "int": {
      const n = parseIntCell(cell);
      if (n == null) return { problem: `${f.label} inválido ("${cleanStr(cell)}")` };
      if (n < 0) return { value: 0, problem: `${f.label} negativo — importado como 0` };
      return { value: n };
    }
    case "duration": {
      const n = parseDurationCell(cell);
      if (n == null || n <= 0 || n > 24 * 60) return { problem: `${f.label} inválida ("${cleanStr(cell)}")` };
      return { value: n };
    }
    case "date": {
      const d = parseDateCell(cell);
      if (!d) return { problem: `${f.label} inválida ("${cleanStr(cell)}")` };
      if (d > today()) return { problem: `${f.label} no futuro ("${cleanStr(cell)}")` };
      return { value: d };
    }
  }
}

/**
 * Aplica o mapeamento + normalização a uma linha crua.
 *  - Campo obrigatório ausente/inválido → erro (linha não é importada).
 *  - Campo opcional inválido (telefone, e-mail, data…) → aviso; o campo é descartado e a linha segue.
 */
export function normalizeRecord(
  entity: Entity,
  raw: Record<string, unknown>,
  mapping: Mapping,
  line: number
): NormalizeResult {
  const values: Record<string, unknown> = {};
  const errors: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  for (const f of FIELD_MAP[entity]) {
    const col = mapping[f.key];
    const { value, problem } = normalizeField(f, col ? raw[col] : undefined);
    if (value !== undefined) values[f.key] = value;
    if (f.required && value === undefined) {
      errors.push({ line, level: "error", reason: problem ?? `${f.label} obrigatório` });
    } else if (problem) {
      warnings.push({ line, level: "warning", reason: problem });
    }
  }
  if (errors.length) return { ok: false, issues: [...errors, ...warnings] };
  return { ok: true, record: { line, values }, warnings };
}

/** Mapeamento identidade (campo → campo) para revalidar registros já normalizados. */
export function identityMapping(entity: Entity): Mapping {
  return Object.fromEntries(FIELD_MAP[entity].map((f) => [f.key, f.key]));
}
