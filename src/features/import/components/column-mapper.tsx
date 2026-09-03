"use client";

import { FIELD_MAP, type Entity } from "../normalize";

const selectCls =
  "h-10 w-full rounded-md border border-border bg-inset px-3 text-body text-text hover:border-accent focus-visible:border-focus focus-visible:outline-none";

export function ColumnMapper({
  entity,
  headers,
  mapping,
  onChange,
}: {
  entity: Entity;
  headers: string[];
  mapping: Record<string, string>;
  onChange: (fieldKey: string, header: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-caption text-text-muted">
        Confira o de-para. Ajuste as colunas que não foram reconhecidas automaticamente.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELD_MAP[entity].map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-caption font-semibold text-text-2">
              {f.label} {f.required && <span className="text-danger">*</span>}
            </span>
            <select className={selectCls} value={mapping[f.key] ?? ""} onChange={(e) => onChange(f.key, e.target.value)}>
              <option value="">— não importar —</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}
