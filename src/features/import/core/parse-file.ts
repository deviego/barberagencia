/**
 * Leitura de arquivos (CSV/XLSX/XLS) → abas em matriz (array of arrays), detecção da
 * linha de cabeçalho e extração das linhas. Puro: roda no navegador e nos testes.
 */
import { knownHeaderScore } from "./fields";
import type { RawRow } from "./types";

export interface Sheet {
  name: string;
  /** Linhas da aba (células cruas). */
  aoa: unknown[][];
  /** Número (base 1) da linha da planilha correspondente a aoa[0]. */
  firstLine: number;
}

export interface Table {
  headers: string[];
  rows: RawRow[];
}

export const isBlank = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "");
export const isEmptyRow = (r: unknown[] | undefined) => !r || r.every(isBlank);

/** Decodifica bytes como UTF-8; se não for UTF-8 válido, cai para Windows-1252 (exports BR antigos). */
export function decodeText(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  return text.replace(/^﻿/, "");
}

/** CSV (delimitador , ; ou tab autodetectado) → matriz, preservando linhas vazias (p/ numeração). */
export async function parseCsvText(text: string): Promise<unknown[][]> {
  const Papa = (await import("papaparse")).default;
  const res = Papa.parse<unknown[]>(text, { header: false, skipEmptyLines: false, delimitersToGuess: [",", ";", "\t", "|"] });
  return res.data as unknown[][];
}

/** Lê o arquivo inteiro e devolve todas as abas (CSV = 1 aba). */
export async function readWorkbook(buf: ArrayBuffer, fileName: string): Promise<Sheet[]> {
  if (/\.(csv|txt)$/i.test(fileName)) {
    return [{ name: fileName.replace(/\.[^.]+$/, "") || "CSV", aoa: await parseCsvText(decodeText(buf)), firstLine: 1 }];
  }
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array" });
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const ref = ws?.["!ref"];
    const firstLine = ref ? XLSX.utils.decode_range(ref).s.r + 1 : 1;
    const aoa = ws ? XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "", blankrows: true }) : [];
    return { name, aoa, firstLine };
  });
}

/** Índice da primeira aba que tem pelo menos uma linha com 2+ células preenchidas. */
export function firstUsefulSheet(sheets: Sheet[]): number {
  const i = sheets.findIndex((s) => s.aoa.some((r) => r.filter((c) => !isBlank(c)).length >= 2));
  return i < 0 ? 0 : i;
}

const looksNumericOrDate = (v: unknown) =>
  typeof v === "number" || /^[\d\s()+\-./:,R$]+$/i.test(String(v ?? "").trim());

/**
 * Detecta a linha de cabeçalho nas primeiras `maxScan` linhas: ignora títulos de relatório
 * (linhas com 0–1 célula), pontua células de texto e, com peso maior, cabeçalhos conhecidos.
 * Empate → a linha mais acima (o cabeçalho vem antes dos dados).
 */
export function detectHeaderRow(aoa: unknown[][], maxScan = 30): number {
  let best = -1;
  let bestScore = 0;
  const limit = Math.min(aoa.length, maxScan);
  for (let i = 0; i < limit; i++) {
    const row = aoa[i] ?? [];
    const filled = row.filter((c) => !isBlank(c));
    if (filled.length < 2) continue;
    const text = filled.filter((c) => !looksNumericOrDate(c)).length;
    const score = knownHeaderScore(filled) * 3 + text;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  if (best >= 0) return best;
  const firstFilled = aoa.findIndex((r) => !isEmptyRow(r));
  return firstFilled < 0 ? 0 : firstFilled;
}

const colLetter = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/** Monta cabeçalhos únicos a partir da linha `headerRow` e converte as linhas abaixo em objetos. */
export function extractTable(sheet: Sheet, headerRow: number): Table {
  const { aoa, firstLine } = sheet;
  const headerCells = aoa[headerRow] ?? [];
  const body = aoa.slice(headerRow + 1);
  const width = Math.max(headerCells.length, ...body.map((r) => r.length), 0);

  const headers: (string | null)[] = [];
  const seen = new Map<string, number>();
  for (let c = 0; c < width; c++) {
    let h = String(headerCells[c] ?? "").replace(/\s+/g, " ").trim();
    if (!h) {
      const hasData = body.some((r) => !isBlank(r[c]));
      if (!hasData) {
        headers.push(null);
        continue;
      }
      h = `Coluna ${colLetter(c)}`;
    }
    const n = (seen.get(h) ?? 0) + 1;
    seen.set(h, n);
    headers.push(n > 1 ? `${h} (${n})` : h);
  }

  const rows: RawRow[] = [];
  body.forEach((r, i) => {
    if (isEmptyRow(r)) return;
    const data: Record<string, unknown> = {};
    headers.forEach((h, c) => {
      if (h) data[h] = r[c];
    });
    rows.push({ line: firstLine + headerRow + 1 + i, data });
  });
  return { headers: headers.filter((h): h is string => !!h), rows };
}
