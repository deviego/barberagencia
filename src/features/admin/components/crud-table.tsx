"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Eye, MailCheck, Pencil, Plus, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmModal } from "@/components/ui/modal";

export interface CrudColumn<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

export interface CrudField {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
}

export function CrudTable<T extends { id: string; name: string }>({
  title,
  newLabel,
  columns,
  rows,
  fields,
  searchKeys,
  inviteBanner,
  inviteBlock,
  saveLabel = "Salvar",
}: {
  title: string;
  newLabel: string;
  columns: CrudColumn<T>[];
  rows: T[];
  fields: CrudField[];
  searchKeys: (keyof T)[];
  inviteBanner?: React.ReactNode;
  inviteBlock?: React.ReactNode;
  saveLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<T | "new" | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => searchKeys.some((k) => String(r[k]).toLowerCase().includes(q)));
  }, [query, rows, searchKeys]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-h3 font-bold text-text">{title}</h1>
        <Button onClick={() => setEditing("new")}>
          <Plus size={16} />
          {newLabel}
        </Button>
      </div>

      {inviteBanner && (
        <div className="flex items-center gap-2.5 rounded-md border border-success bg-success-bg px-4 py-3 text-caption text-text-2">
          <MailCheck size={18} className="shrink-0 text-success-strong" />
          {inviteBanner}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar…"
            className="w-full pl-9"
          />
        </div>
        <button className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-caption text-text-2 transition-colors hover:border-accent hover:text-accent">
          <SlidersHorizontal size={14} />
          Filtros
        </button>
        <button className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-caption text-text-2 transition-colors hover:border-accent hover:text-accent">
          Status: todos
          <ChevronDown size={14} />
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-body">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-caption uppercase text-text-muted">
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-3 font-semibold">
                  {c.label}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-b border-border-subtle transition-colors hover:bg-accent-wash">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3 text-text">
                    {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => setEditing(row)}
                      className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-accent-wash hover:text-accent"
                      aria-label="Ver"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => setEditing(row)}
                      className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-accent-wash hover:text-accent"
                      aria-label="Editar"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setDeleting(row)}
                      className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-inset hover:text-danger"
                      aria-label="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-10 text-center text-text-muted">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer de cadastro/edição */}
      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? newLabel : `Editar ${title.toLowerCase()}`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={() => setEditing(null)}>{saveLabel}</Button>
          </div>
        }
      >
        <form className="flex flex-col gap-4">
          {fields.map((f) => (
            <div key={f.name} className="flex flex-col gap-1.5">
              <Label>{f.label}</Label>
              <Input
                type={f.type ?? "text"}
                placeholder={f.placeholder}
                defaultValue={
                  editing && editing !== "new"
                    ? String((editing as Record<string, unknown>)[f.name] ?? "")
                    : ""
                }
              />
            </div>
          ))}

          <div className="flex items-center justify-between">
            <Label className="mb-0">Ativo</Label>
            <Switch defaultChecked />
          </div>

          {inviteBlock}
        </form>
      </Drawer>

      {/* Confirmação de exclusão */}
      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Excluir registro?"
        message="Prefira inativar para preservar o histórico e os relatórios. A exclusão é permanente."
        confirmLabel="Excluir mesmo assim"
        danger
        onConfirm={() => setDeleting(null)}
      />
    </div>
  );
}
