"use client";

import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/utils";
import { FIELD_MAP } from "../core/fields";
import type { Entity, NormalizedRecord, RowIssue } from "../core/types";

const PREVIEW_LIMIT = 25;

/** Amostra das linhas já normalizadas + problemas por linha (validação feita no navegador). */
export function ImportPreview({
  entity,
  totalRows,
  records,
  issues,
}: {
  entity: Entity;
  totalRows: number;
  records: NormalizedRecord[];
  issues: RowIssue[];
}) {
  const byLine = new Map<number, RowIssue[]>();
  for (const i of issues) byLine.set(i.line, [...(byLine.get(i.line) ?? []), i]);
  const errorLines = new Set(issues.filter((i) => i.level === "error").map((i) => i.line));

  // Amostra: registros válidos + linhas com erro, na ordem do arquivo.
  const sample: { line: number; values: Record<string, unknown> }[] = [
    ...records.map((r) => ({ line: r.line, values: r.values })),
    ...[...errorLines].map((line) => ({ line, values: {} })),
  ]
    .sort((a, b) => a.line - b.line)
    .slice(0, PREVIEW_LIMIT);

  const fields = FIELD_MAP[entity];
  const fmt = (key: string, v: unknown) => {
    if (v == null) return <span className="text-text-muted">—</span>;
    if (key.endsWith("_brl")) return formatBRL(Number(v));
    return String(v);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="neutral">{totalRows} linhas</Badge>
        <Badge variant="success">{records.length} prontas</Badge>
        {errorLines.size > 0 && <Badge variant="danger">{errorLines.size} com erro</Badge>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-caption">
          <thead>
            <tr className="border-b border-border bg-surface text-left uppercase text-text-muted">
              <th className="px-3 py-2 font-semibold">Linha</th>
              {fields.map((f) => (
                <th key={f.key} className="px-3 py-2 font-semibold">{f.label}</th>
              ))}
              <th className="px-3 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {sample.map((r) => {
              const its = byLine.get(r.line) ?? [];
              const isErr = errorLines.has(r.line);
              return (
                <tr key={r.line} className="border-b border-border-subtle">
                  <td className="px-3 py-2 text-text-muted tabular">{r.line}</td>
                  {fields.map((f) => (
                    <td key={f.key} className="px-3 py-2 text-text-2">{fmt(f.key, r.values[f.key])}</td>
                  ))}
                  <td className="px-3 py-2">
                    {its.length === 0 ? (
                      <Badge variant="success">ok</Badge>
                    ) : (
                      <span className={isErr ? "text-danger" : "text-warning-strong"}>{its.map((i) => i.reason).join("; ")}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalRows > PREVIEW_LIMIT && (
        <p className="text-caption text-text-muted">Mostrando as primeiras {sample.length} de {totalRows} linhas.</p>
      )}
    </div>
  );
}
