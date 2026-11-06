"use client";

import { useEffect, useState, useTransition } from "react";
import { History, Info, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listImportJobs, undoImportJob, type ImportJobSummary } from "../actions";
import { getSource } from "../sources/registry";
import { ENTITY_LABEL } from "../templates";

/** Últimas importações da barbearia, com "Desfazer". Sem a migration 32, mostra o aviso. */
export function ImportHistory({ tenantId }: { tenantId: string }) {
  const [jobs, setJobs] = useState<ImportJobSummary[] | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      const res = await listImportJobs(tenantId);
      if (!res.ok) { setWarning(res.error); setJobs([]); return; }
      setWarning(res.available ? null : res.warning ?? null);
      setJobs(res.jobs);
    });
  }
  useEffect(() => {
    load();
  }, [tenantId]);

  function undo(job: ImportJobSummary) {
    if (!confirm(`Desfazer a importação de ${ENTITY_LABEL[job.entity].toLowerCase()} de ${new Date(job.createdAt).toLocaleString("pt-BR")}? Só são apagados os registros criados por ela que ainda não têm acesso, assinatura, agendamento ou venda.`)) return;
    setMsg(null);
    startTransition(async () => {
      const res = await undoImportJob({ tenantId, jobId: job.id });
      if (!res.ok) setMsg(res.error);
      else setMsg(`Desfeita: ${res.deleted} apagados${res.kept ? `, ${res.kept} mantidos (já vinculados)` : ""}.`);
      const list = await listImportJobs(tenantId);
      if (list.ok) setJobs(list.jobs);
    });
  }

  if (jobs === null) return null;
  if (warning) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-caption text-text-muted">
        <Info size={15} /> {warning}
      </div>
    );
  }
  if (!jobs.length) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <span className="flex items-center gap-2 text-caption font-semibold text-text-2"><History size={15} /> Importações recentes</span>
      {msg && <span className="text-caption text-text-2">{msg}</span>}
      <ul className="flex flex-col gap-2">
        {jobs.map((j) => (
          <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-2 text-caption last:border-0 last:pb-0">
            <span className="flex flex-wrap items-center gap-2 text-text-2">
              <Badge variant="neutral">{ENTITY_LABEL[j.entity]}</Badge>
              {new Date(j.createdAt).toLocaleString("pt-BR")} · {getSource(j.source).label}
              {j.fileName && <span className="text-text-muted">· {j.fileName}</span>}
              <span className="text-text-muted">
                · {j.counts.insert ?? 0} inseridos, {j.counts.update ?? 0} atualizados, {j.counts.error ?? 0} com erro
              </span>
              {j.undoneAt && <Badge variant="warning">desfeita{j.counts.undo ? ` (${j.counts.undo.deleted} apagados)` : ""}</Badge>}
            </span>
            {!j.undoneAt && (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => undo(j)}>
                <Undo2 size={14} /> Desfazer
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
