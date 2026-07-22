"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmModal } from "@/components/ui/modal";
import { ClientDetail } from "@/features/admin/components/client-detail";
import { formatBRL, cn } from "@/lib/utils";
import { maskBRL, brlInputFromNumber } from "@/lib/masks";
import { saveRow, deleteRow } from "@/features/admin/crud-actions";

type ColFormat = "text" | "price" | "minutes" | "stock" | "activeBadge";
export interface CrudColumn {
  key: string;
  label: string;
  format?: ColFormat;
}
export interface CrudField {
  name: string;
  label: string;
  /** "currency" aplica máscara de R$; os demais seguem o input HTML nativo. */
  type?: string;
  placeholder?: string;
}
type StatusFilter = "all" | "active" | "inactive";
type Row = Record<string, unknown> & { id: string };

function renderCell(col: CrudColumn, row: Row) {
  const v = row[col.key];
  switch (col.format) {
    case "price":
      return <span className="tabular">{formatBRL(Number(v ?? 0))}</span>;
    case "minutes":
      return <span className="tabular">{Number(v ?? 0)} min</span>;
    case "stock":
      return Number(v ?? 0) > 0 ? (
        <span className="tabular">{Number(v)}</span>
      ) : (
        <Badge variant="danger">Sem estoque</Badge>
      );
    case "activeBadge":
      return v ? <Badge variant="success">Ativo</Badge> : <Badge>Inativo</Badge>;
    default:
      return <span>{v == null || v === "" ? "—" : String(v)}</span>;
  }
}

export function CrudTable({
  table,
  title,
  newLabel,
  rows,
  columns,
  fields,
  searchKeys,
  inviteBlock,
  saveLabel = "Salvar",
  detail,
}: {
  table: string;
  title: string;
  newLabel: string;
  rows: Row[];
  columns: CrudColumn[];
  fields: CrudField[];
  searchKeys: string[];
  inviteBlock?: React.ReactNode;
  saveLabel?: string;
  /** Habilita o "olho" com uma view de detalhe dedicada. */
  detail?: "client";
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [viewing, setViewing] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [active, setActive] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [statusOpen, setStatusOpen] = useState(false);

  const hasStatus = columns.some((c) => c.format === "activeBadge");
  const currencyKeys = useMemo(() => fields.filter((f) => f.type === "currency").map((f) => f.name), [fields]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q))) return false;
      if (status === "active" && r.active === false) return false;
      if (status === "inactive" && r.active !== false) return false;
      return true;
    });
  }, [query, rows, searchKeys, status]);

  const statusLabel = status === "active" ? "ativos" : status === "inactive" ? "inativos" : "todos";

  function openNew() {
    setError(null);
    setForm({});
    setActive(true);
    setEditing("new");
  }
  function openEdit(row: Row) {
    setError(null);
    const f: Record<string, string> = {};
    for (const fld of fields) {
      if (fld.type === "currency") f[fld.name] = brlInputFromNumber(row[fld.name] as number | null);
      else f[fld.name] = row[fld.name] == null ? "" : String(row[fld.name]);
    }
    setForm(f);
    setActive(row.active !== false);
    setEditing(row);
  }
  function save() {
    setError(null);
    startTransition(async () => {
      const id = editing === "new" || editing === null ? null : editing.id;
      const res = await saveRow(table, id, { ...form, active });
      if (res.ok) {
        setEditing(null);
        router.refresh();
      } else setError(res.error);
    });
  }
  function confirmDelete() {
    if (!deleting) return;
    const id = deleting.id;
    startTransition(async () => {
      await deleteRow(table, id);
      setDeleting(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-h3 font-bold text-text">{title}</h1>
        <Button onClick={openNew}>
          <Plus size={16} />
          {newLabel}
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar…" className="w-full pl-9" />
        </div>
        {hasStatus && (
          <div className="relative">
            <button
              onClick={() => setStatusOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-caption capitalize text-text-2 transition-colors hover:border-accent hover:text-accent"
            >
              Status: {statusLabel}
              <ChevronDown size={14} />
            </button>
            {statusOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} />
                <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-md border border-border bg-surface shadow-lg">
                  {(["all", "active", "inactive"] as StatusFilter[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setStatus(s);
                        setStatusOpen(false);
                      }}
                      className={cn(
                        "block w-full px-3 py-2 text-left text-caption capitalize transition-colors hover:bg-accent-wash",
                        status === s ? "font-bold text-accent" : "text-text-2"
                      )}
                    >
                      {s === "all" ? "Todos" : s === "active" ? "Ativos" : "Inativos"}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
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
                    {renderCell(c, row)}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => (detail ? setViewing(row) : openEdit(row))} className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-accent-wash hover:text-accent" aria-label="Ver">
                      <Eye size={16} />
                    </button>
                    <button onClick={() => openEdit(row)} className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-accent-wash hover:text-accent" aria-label="Editar">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => setDeleting(row)} className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-inset hover:text-danger" aria-label="Excluir">
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

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? newLabel : `Editar ${title.toLowerCase()}`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button loading={pending} onClick={save}>
              {saveLabel}
            </Button>
          </div>
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          {fields.map((f) => {
            const isCurrency = f.type === "currency";
            return (
              <div key={f.name} className="flex flex-col gap-1.5">
                <Label>{f.label}</Label>
                <Input
                  type={isCurrency ? "text" : f.type ?? "text"}
                  inputMode={isCurrency ? "numeric" : undefined}
                  placeholder={isCurrency ? "R$ 0,00" : f.placeholder}
                  value={form[f.name] ?? ""}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, [f.name]: isCurrency ? maskBRL(e.target.value) : e.target.value }))
                  }
                />
              </div>
            );
          })}
          <div className="flex items-center justify-between">
            <Label className="mb-0">Ativo</Label>
            <Switch defaultChecked={active} onChange={setActive} />
          </div>
          {error && <p className="text-caption text-danger">{error}</p>}
          {inviteBlock}
        </form>
      </Drawer>

      <Drawer
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={`Detalhe · ${title.replace(/s$/i, "").toLowerCase()}`}
      >
        {viewing && detail === "client" && <ClientDetail clientId={viewing.id} />}
      </Drawer>

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Inativar registro?"
        message="Prefira inativar para preservar o histórico e os relatórios."
        confirmLabel="Inativar"
        danger
        onConfirm={confirmDelete}
      />
    </div>
  );
}
