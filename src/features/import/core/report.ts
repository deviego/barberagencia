import type { RawRow, RowIssue } from "./types";

const LEVEL: Record<RowIssue["level"], string> = { error: "Erro (não importada)", warning: "Aviso" };

function cell(v: unknown): string {
  let s = v == null ? "" : String(v);
  // Neutraliza fórmula no Excel (CSV injection).
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Relatório de erros/avisos em CSV (separador ";" + BOM, abre direto no Excel BR),
 * com as colunas originais da linha para o dono corrigir e reimportar.
 */
export function buildIssuesCsv(issues: RowIssue[], headers: string[], rows: RawRow[]): string {
  const byLine = new Map(rows.map((r) => [r.line, r.data]));
  const head = ["Linha", "Tipo", "Motivo", ...headers];
  const lines = [head.map(cell).join(";")];
  for (const i of issues) {
    const data = byLine.get(i.line) ?? {};
    lines.push([i.line || "", LEVEL[i.level], i.reason, ...headers.map((h) => data[h])].map(cell).join(";"));
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}
