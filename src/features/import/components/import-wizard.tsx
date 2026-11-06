"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Users, Package, Scissors, Upload, Download, ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle,
  FileSpreadsheet, Undo2, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FIELD_MAP } from "../core/fields";
import { extractTable, firstUsefulSheet, readWorkbook, type Sheet, type Table } from "../core/parse-file";
import { buildIssuesCsv } from "../core/report";
import { addCounts, emptyCounts, type DuplicatePolicy, type Entity, type ImportCounts, type Mapping, type RowIssue } from "../core/types";
import { SOURCES, detectSource, getSource, headerRowFor, type SourceAdapter } from "../sources/registry";
import { CHUNK_SIZE, MAX_ROWS, chunk, prepareImport } from "../pipeline";
import { ENTITY_LABEL, CSV_TEMPLATE } from "../templates";
import { finishImportJob, processImportChunk, startImportJob, undoImportJob } from "../actions";
import { ColumnMapper } from "./column-mapper";
import { ImportPreview } from "./import-preview";
import { ImportHistory } from "./import-history";

type Step = "type" | "upload" | "source" | "map" | "preview" | "done";
const ENTITIES: { key: Entity; icon: typeof Users; hint: string }[] = [
  { key: "clients", icon: Users, hint: "Nome, telefone, e-mail, nascimento" },
  { key: "products", icon: Package, hint: "Nome, preço, custo, estoque, SKU" },
  { key: "services", icon: Scissors, hint: "Nome, duração, preço, categoria" },
];
const selectCls =
  "h-10 w-full rounded-md border border-border bg-inset px-3 text-body text-text hover:border-accent focus-visible:border-focus focus-visible:outline-none";

interface RunResult {
  counts: ImportCounts;
  issues: RowIssue[];
}
interface DoneResult extends RunResult {
  jobId: string | null;
  warning?: string;
  aborted?: string;
}
type Progress = { kind: "dry" | "commit"; done: number; total: number };

function download(name: string, content: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const rowPreview = (row: unknown[] | undefined) =>
  (row ?? []).map((c) => String(c ?? "").trim()).filter(Boolean).slice(0, 6).join(" | ").slice(0, 90);

const errorsIn = (issues: RowIssue[]) => issues.filter((i) => i.level === "error").length;

export function ImportWizard({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const [step, setStep] = useState<Step>("type");
  const [entity, setEntity] = useState<Entity | null>(null);
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [source, setSource] = useState<SourceAdapter>(getSource("generic"));
  const [detected, setDetected] = useState<{ id: string; score: number } | null>(null);
  const [headerRow, setHeaderRow] = useState(0);
  const [table, setTable] = useState<Table>({ headers: [], rows: [] });
  const [mapping, setMapping] = useState<Mapping>({});
  const [policy, setPolicy] = useState<DuplicatePolicy>("skip");
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [dryRun, setDryRun] = useState<RunResult | null>(null);
  const [result, setResult] = useState<DoneResult | null>(null);
  const [undoMsg, setUndoMsg] = useState<string | null>(null);

  const requiredMapped = useMemo(
    () => (entity ? FIELD_MAP[entity].filter((f) => f.required).every((f) => mapping[f.key]) : false),
    [entity, mapping]
  );
  const prepared = useMemo(
    () => (entity && table.rows.length ? prepareImport(entity, source, table.rows, mapping, policy) : null),
    [entity, source, table, mapping, policy]
  );
  const sourceOptions = useMemo(() => SOURCES.filter((s) => !entity || s.entities.includes(entity)), [entity]);

  function reset() {
    setStep("type"); setEntity(null); setFileName(""); setSheets([]); setSheetIdx(0);
    setSource(getSource("generic")); setDetected(null); setHeaderRow(0); setTable({ headers: [], rows: [] });
    setMapping({}); setPolicy("skip"); setError(null); setDryRun(null); setResult(null); setProgress(null); setUndoMsg(null);
  }

  /** Aplica aba + origem (null = detectar) + linha de cabeçalho (opcional) e recalcula tabela e de-para. */
  function apply(sh: Sheet[], idx: number, src: SourceAdapter | null, row?: number, name = fileName) {
    if (!entity) return;
    const sheet = sh[idx];
    if (!sheet) return;
    let chosen = src;
    if (!chosen) {
      const best = detectSource(sheet, entity, name);
      chosen = best.source;
      setDetected({ id: best.source.id, score: best.score });
    }
    const hr = row ?? headerRowFor(chosen, sheet);
    const t = extractTable(sheet, hr);
    setSheetIdx(idx);
    setSource(chosen);
    setHeaderRow(hr);
    setTable(t);
    setMapping(chosen.mapping(entity, t.headers));
    setDryRun(null);
    if (!t.headers.length) setError("Não encontramos cabeçalhos nesta aba/linha.");
    else if (!t.rows.length) setError("Não há linhas de dados abaixo do cabeçalho.");
    else if (t.rows.length > MAX_ROWS) setError(`Limite de ${MAX_ROWS.toLocaleString("pt-BR")} linhas por importação — divida o arquivo.`);
    else setError(null);
  }

  async function onFile(file: File) {
    if (!entity) return;
    setError(null); setParsing(true); setFileName(file.name);
    try {
      const sh = await readWorkbook(await file.arrayBuffer(), file.name);
      if (!sh.length) throw new Error("O arquivo não tem abas.");
      setSheets(sh);
      apply(sh, firstUsefulSheet(sh), null, undefined, file.name);
      setStep("source");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao ler o arquivo.");
    } finally {
      setParsing(false);
    }
  }

  function downloadTemplate() {
    if (!entity) return;
    download(`modelo-${entity}.csv`, "﻿" + CSV_TEMPLATE[entity]);
  }

  function downloadReport(issues: RowIssue[]) {
    download(
      `relatorio-importacao-${entity}-${new Date().toISOString().slice(0, 10)}.csv`,
      buildIssuesCsv(issues, table.headers, table.rows)
    );
  }

  /** Prévia (dry-run) no servidor, em lotes: contagens inserir/atualizar/pular/erro, sem gravar. */
  function runDryRun(nextPolicy = policy) {
    if (!entity || !table.rows.length) return;
    const prep = prepareImport(entity, source, table.rows, mapping, nextPolicy);
    setError(null); setDryRun(null);
    startTransition(async () => {
      let counts: ImportCounts = { ...emptyCounts(), error: prep.invalid, skip: prep.skippedInFile };
      const issues: RowIssue[] = [...prep.issues];
      const parts = chunk(prep.records, CHUNK_SIZE);
      setProgress({ kind: "dry", done: 0, total: parts.length });
      for (let i = 0; i < parts.length; i++) {
        const res = await processImportChunk({ tenantId, entity, records: parts[i], policy: nextPolicy, dryRun: true });
        if (!res.ok) { setError(res.error); setProgress(null); return; }
        counts = addCounts(counts, res.counts);
        issues.push(...res.issues);
        setProgress({ kind: "dry", done: i + 1, total: parts.length });
      }
      setProgress(null);
      setDryRun({ counts, issues: issues.sort((a, b) => a.line - b.line) });
    });
  }

  /** Gravação em lotes de ~500 registros normalizados (cabe no limite de 1 MB da Server Action). */
  function runImport() {
    if (!entity || !prepared) return;
    setError(null);
    startTransition(async () => {
      const job = await startImportJob({ tenantId, entity, source: source.id, fileName });
      if (!job.ok) { setError(job.error); return; }
      let counts: ImportCounts = { ...emptyCounts(), error: prepared.invalid, skip: prepared.skippedInFile };
      const issues: RowIssue[] = [...prepared.issues];
      const parts = chunk(prepared.records, CHUNK_SIZE);
      let aborted: string | undefined;
      setProgress({ kind: "commit", done: 0, total: parts.length });
      for (let i = 0; i < parts.length; i++) {
        let res: Awaited<ReturnType<typeof processImportChunk>>;
        try {
          res = await processImportChunk({ tenantId, entity, records: parts[i], policy, dryRun: false, jobId: job.jobId });
        } catch (e) {
          res = { ok: false, error: e instanceof Error ? e.message : "falha de rede" };
        }
        if (!res.ok) {
          // Para e relata: os lotes anteriores já foram gravados (e podem ser desfeitos).
          aborted = `Lote ${i + 1} de ${parts.length} falhou: ${res.error}`;
          const rest = parts.slice(i).flat();
          counts = addCounts(counts, { ...emptyCounts(), error: rest.length });
          issues.push(...rest.map((r) => ({ line: r.line, level: "error" as const, reason: "Não processada (importação interrompida)" })));
          break;
        }
        counts = addCounts(counts, res.counts);
        issues.push(...res.issues);
        setProgress({ kind: "commit", done: i + 1, total: parts.length });
      }
      issues.sort((a, b) => a.line - b.line);
      const fin = await finishImportJob({ tenantId, jobId: job.jobId, counts, issues });
      if (!fin.ok) setError(fin.error);
      setProgress(null);
      setResult({ counts, issues, jobId: job.jobId, warning: job.warning, aborted });
      setStep("done");
    });
  }

  function undo(jobId: string) {
    if (!confirm("Desfazer esta importação? Os registros criados por ela que ainda não têm acesso, assinatura, agendamento ou venda serão apagados.")) return;
    setUndoMsg(null);
    startTransition(async () => {
      const res = await undoImportJob({ tenantId, jobId });
      if (!res.ok) setError(res.error);
      else {
        setUndoMsg(`Importação desfeita: ${res.deleted} apagados${res.kept ? `, ${res.kept} mantidos (já vinculados)` : ""}.`);
        setResult((r) => (r ? { ...r, jobId: null } : r));
      }
    });
  }

  const importable = dryRun ? dryRun.counts.insert + dryRun.counts.update : 0;

  return (
    <div className="flex flex-col gap-6">
      <Steps current={step} />
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger-bg px-4 py-3 text-caption text-danger-strong">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {/* 1. Tipo */}
      {step === "type" && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {ENTITIES.map((e) => {
              const Icon = e.icon;
              return (
                <button
                  key={e.key}
                  onClick={() => { setEntity(e.key); setStep("upload"); }}
                  className="flex flex-col items-start gap-2 rounded-lg border border-border bg-surface p-5 text-left transition hover:border-accent"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-wash text-accent"><Icon size={20} /></span>
                  <span className="text-body font-semibold text-text">{ENTITY_LABEL[e.key]}</span>
                  <span className="text-caption text-text-muted">{e.hint}</span>
                </button>
              );
            })}
          </div>
          <ImportHistory tenantId={tenantId} />
        </div>
      )}

      {/* 2. Arquivo */}
      {step === "upload" && entity && (
        <div className="flex flex-col gap-5">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface p-10 text-center transition hover:border-accent">
            <Upload size={26} className="text-accent" />
            <span className="text-body font-semibold text-text">Selecionar arquivo CSV ou Excel</span>
            <span className="text-caption text-text-muted">{parsing ? "Lendo…" : fileName || "Arraste ou clique para escolher"}</span>
            <input type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" disabled={parsing}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
          </label>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-caption font-semibold text-text-2">Como exportar de cada sistema</span>
              <Button size="sm" variant="outline" onClick={downloadTemplate}><Download size={14} /> Baixar modelo</Button>
            </div>
            <ul className="flex flex-col gap-2">
              {sourceOptions.map((s) => (
                <li key={s.id} className="text-caption text-text-muted">
                  <span className="font-semibold text-text-2">{s.label}:</span> {s.guide}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <Button variant="ghost" onClick={() => setStep("type")}><ArrowLeft size={15} /> Voltar</Button>
          </div>
        </div>
      )}

      {/* 3. Fonte (origem detectada + aba + linha de cabeçalho) */}
      {step === "source" && entity && sheets[sheetIdx] && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2 text-caption text-text-muted">
            <FileSpreadsheet size={15} /> {fileName} · {table.rows.length} linhas
          </div>
          {detected && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-caption text-text-2">
              <Info size={15} className="text-accent" />
              {detected.id === "generic" ? (
                "Não reconhecemos o sistema de origem — usando o mapeamento genérico. Se souber de onde veio, escolha abaixo."
              ) : (
                <span>
                  Arquivo reconhecido como <strong>{getSource(detected.id).label}</strong> ({Math.round(detected.score * 100)}% de confiança). Confira abaixo.
                </span>
              )}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-caption font-semibold text-text-2">Sistema de origem</span>
              <select className={selectCls} value={source.id} onChange={(e) => apply(sheets, sheetIdx, getSource(e.target.value))}>
                {sourceOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            {sheets.length > 1 && (
              <label className="flex flex-col gap-1">
                <span className="text-caption font-semibold text-text-2">Aba da planilha</span>
                <select className={selectCls} value={sheetIdx} onChange={(e) => apply(sheets, Number(e.target.value), null)}>
                  {sheets.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className="text-caption font-semibold text-text-2">Linha do cabeçalho</span>
              <select className={selectCls} value={headerRow} onChange={(e) => apply(sheets, sheetIdx, source, Number(e.target.value))}>
                {sheets[sheetIdx].aoa.slice(0, 30).map((r, i) => {
                  const p = rowPreview(r);
                  return p ? <option key={i} value={i}>Linha {sheets[sheetIdx].firstLine + i}: {p}</option> : null;
                })}
              </select>
            </label>
          </div>
          <p className="text-caption text-text-muted">
            <span className="font-semibold text-text-2">{source.label}:</span> {source.guide}
          </p>
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep("upload")}><ArrowLeft size={15} /> Trocar arquivo</Button>
            <Button disabled={!table.headers.length || !table.rows.length || table.rows.length > MAX_ROWS} onClick={() => setStep("map")}>
              Colunas <ArrowRight size={15} />
            </Button>
          </div>
        </div>
      )}

      {/* 4. Colunas */}
      {step === "map" && entity && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2 text-caption text-text-muted">
            <FileSpreadsheet size={15} /> {fileName} · {source.label} · {table.rows.length} linhas
          </div>
          <ColumnMapper entity={entity} headers={table.headers} mapping={mapping}
            onChange={(k, h) => { setMapping((m) => ({ ...m, [k]: h })); setDryRun(null); }} />
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep("source")}><ArrowLeft size={15} /> Fonte</Button>
            <Button disabled={!requiredMapped} onClick={() => { setStep("preview"); runDryRun(); }}>Revisar <ArrowRight size={15} /></Button>
          </div>
          {!requiredMapped && <p className="text-caption text-warning-strong">Mapeie os campos obrigatórios (*) para continuar.</p>}
        </div>
      )}

      {/* 5. Revisão (prévia no servidor) */}
      {step === "preview" && entity && prepared && (
        <div className="flex flex-col gap-5">
          <ImportPreview entity={entity} totalRows={table.rows.length} records={prepared.records} issues={prepared.issues} />
          <label className="flex flex-col gap-1 sm:max-w-xs">
            <span className="text-caption font-semibold text-text-2">Se já existir na barbearia…</span>
            <select className={selectCls} value={policy} disabled={pending}
              onChange={(e) => { const p = e.target.value as DuplicatePolicy; setPolicy(p); runDryRun(p); }}>
              <option value="skip">Pular (não duplicar)</option>
              <option value="update">Atualizar o registro existente</option>
              <option value="create">Criar mesmo assim</option>
            </select>
          </label>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <span className="text-caption font-semibold text-text-2">Prévia — nada foi gravado ainda</span>
            {progress?.kind === "dry" && (
              <span className="text-caption text-text-muted">Simulando… lote {progress.done}/{progress.total}</span>
            )}
            {dryRun && (
              <>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Stat label="Inserir" value={dryRun.counts.insert} tone="success" />
                  <Stat label="Atualizar" value={dryRun.counts.update} />
                  <Stat label="Pular" value={dryRun.counts.skip} />
                  <Stat label="Com erro" value={dryRun.counts.error} tone={dryRun.counts.error ? "danger" : undefined} />
                </div>
                {dryRun.issues.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-caption text-text-muted">
                      {errorsIn(dryRun.issues)} erros e {dryRun.issues.length - errorsIn(dryRun.issues)} avisos.
                    </span>
                    <Button size="sm" variant="outline" onClick={() => downloadReport(dryRun.issues)}>
                      <Download size={14} /> Relatório (CSV)
                    </Button>
                  </div>
                )}
                {entity === "clients" && (
                  <p className="text-caption text-text-muted">
                    Clientes entram como <strong>Convidado</strong>, sem envio de convite. O convite é enviado depois, pelo admin da barbearia (Reenviar convite).
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Button variant="ghost" disabled={pending} onClick={() => setStep("map")}><ArrowLeft size={15} /> Ajustar colunas</Button>
            <Button disabled={!dryRun || importable === 0 || pending} loading={pending} onClick={runImport}>
              {progress?.kind === "commit"
                ? `Importando… lote ${progress.done}/${progress.total}`
                : `Importar ${importable} ${ENTITY_LABEL[entity].toLowerCase()} para ${tenantName}`}
            </Button>
          </div>
        </div>
      )}

      {/* 6. Resultado */}
      {step === "done" && result && entity && (
        <div className="flex flex-col gap-5">
          {result.aborted ? (
            <div className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger-bg px-4 py-3 text-caption text-danger-strong">
              <AlertTriangle size={18} /> Importação interrompida. {result.aborted}. O que foi gravado antes continua gravado.
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-success-strong/30 bg-success-bg px-4 py-3 text-success-strong">
              <CheckCircle2 size={18} /> Importação concluída.
            </div>
          )}
          {result.warning && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-warning-bg px-4 py-3 text-caption text-warning-strong">
              <Info size={15} /> {result.warning}
            </div>
          )}
          {undoMsg && <div className="rounded-lg border border-border bg-surface px-4 py-3 text-caption text-text-2">{undoMsg}</div>}
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Inseridos" value={result.counts.insert} tone="success" />
            <Stat label="Atualizados" value={result.counts.update} />
            <Stat label="Pulados" value={result.counts.skip} />
            <Stat label="Com erro" value={result.counts.error} tone={result.counts.error ? "danger" : undefined} />
          </div>
          {result.issues.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-caption font-semibold text-text-2">
                  {errorsIn(result.issues)} erros e {result.issues.length - errorsIn(result.issues)} avisos
                </span>
                <Button size="sm" variant="outline" onClick={() => downloadReport(result.issues)}>
                  <Download size={14} /> Baixar relatório (CSV)
                </Button>
              </div>
              <ul className="max-h-48 overflow-y-auto text-caption text-text-muted">
                {result.issues.slice(0, 50).map((er, i) => (
                  <li key={i} className={er.level === "error" ? "text-danger" : undefined}>
                    Linha {er.line || "—"}: {er.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={reset}>Importar outro arquivo</Button>
            {result.jobId && (
              <Button variant="ghost" disabled={pending} loading={pending} onClick={() => undo(result.jobId!)}>
                <Undo2 size={15} /> Desfazer esta importação
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Steps({ current }: { current: Step }) {
  const order: Step[] = ["type", "upload", "source", "map", "preview", "done"];
  const labels: Record<Step, string> = { type: "Tipo", upload: "Arquivo", source: "Fonte", map: "Colunas", preview: "Revisão", done: "Concluído" };
  const idx = order.indexOf(current);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {order.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <Badge variant={i < idx ? "success" : i === idx ? "accent" : "neutral"}>{i + 1}. {labels[s]}</Badge>
          {i < order.length - 1 && <span className="text-text-muted">→</span>}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" }) {
  const color = tone === "success" ? "text-success-strong" : tone === "danger" ? "text-danger-strong" : "text-text";
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
      <span className="text-caption text-text-muted">{label}</span>
      <span className={`text-h4 font-bold tabular ${color}`}>{value}</span>
    </div>
  );
}
