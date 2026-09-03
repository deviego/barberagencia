"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { FIELD_MAP, normalizeRow, type Entity } from "../normalize";
import { formatBRL } from "@/lib/utils";

const PREVIEW_LIMIT = 25;

export function ImportPreview({
  entity,
  rows,
  mapping,
}: {
  entity: Entity;
  rows: Record<string, unknown>[];
  mapping: Record<string, string>;
}) {
  const { valid, invalid, sample } = useMemo(() => {
    let valid = 0;
    let invalid = 0;
    const sample: { line: number; values: Record<string, unknown>; errors: string[] }[] = [];
    rows.forEach((raw, i) => {
      const n = normalizeRow(raw, mapping, entity);
      if (n.errors.length) invalid++;
      else valid++;
      if (sample.length < PREVIEW_LIMIT) sample.push({ line: i + 2, values: n.values, errors: n.errors });
    });
    return { valid, invalid, sample };
  }, [entity, rows, mapping]);

  const fields = FIELD_MAP[entity];
  const fmt = (key: string, v: unknown) => {
    if (v == null) return <span className="text-text-muted">—</span>;
    if (key.endsWith("_brl")) return formatBRL(Number(v));
    return String(v);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="neutral">{rows.length} linhas</Badge>
        <Badge variant="success">{valid} válidas</Badge>
        {invalid > 0 && <Badge variant="danger">{invalid} com erro</Badge>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-caption">
          <thead>
            <tr className="border-b border-border bg-surface text-left uppercase text-text-muted">
              <th className="px-3 py-2 font-semibold">#</th>
              {fields.map((f) => (
                <th key={f.key} className="px-3 py-2 font-semibold">{f.label}</th>
              ))}
              <th className="px-3 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {sample.map((r) => (
              <tr key={r.line} className="border-b border-border-subtle">
                <td className="px-3 py-2 text-text-muted tabular">{r.line}</td>
                {fields.map((f) => (
                  <td key={f.key} className="px-3 py-2 text-text-2">{fmt(f.key, r.values[f.key])}</td>
                ))}
                <td className="px-3 py-2">
                  {r.errors.length ? (
                    <span className="text-danger">{r.errors.join(", ")}</span>
                  ) : (
                    <Badge variant="success">ok</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > PREVIEW_LIMIT && (
        <p className="text-caption text-text-muted">Mostrando as primeiras {PREVIEW_LIMIT} de {rows.length} linhas.</p>
      )}
    </div>
  );
}
