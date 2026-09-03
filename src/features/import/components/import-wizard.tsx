"use client";

import { useState, useMemo, useTransition } from "react";
import { Users, Package, Scissors, Upload, Download, ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FIELD_MAP, autoMap, normalizeRow, type Entity } from "../normalize";
import { ENTITY_LABEL, CSV_TEMPLATE, PLATFORM_GUIDES } from "../templates";
import { importRows, type DuplicatePolicy, type ImportResult } from "../actions";
import { ColumnMapper } from "./column-mapper";
import { ImportPreview } from "./import-preview";

type Step = "type" | "upload" | "map" | "preview" | "done";
const ENTITIES: { key: Entity; icon: typeof Users; hint: string }[] = [
  { key: "clients", icon: Users, hint: "Nome, telefone, e-mail, nascimento" },
  { key: "products", icon: Package, hint: "Nome, preço, custo, estoque, SKU" },
  { key: "services", icon: Scissors, hint: "Nome, duração, preço, categoria" },
];
const selectCls = "h-10 w-full rounded-md border border-border bg-inset px-3 text-body text-text hover:border-accent focus-visible:border-focus focus-visible:outline-none";

export function ImportWizard({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const [step, setStep] = useState<Step>("type");
  const [entity, setEntity] = useState<Entity | null>(null);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [policy, setPolicy] = useState<DuplicatePolicy>("skip");
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);

  const requiredMapped = useMemo(
    () => (entity ? FIELD_MAP[entity].filter((f) => f.required).every((f) => mapping[f.key]) : false),
    [entity, mapping]
  );
  const validCount = useMemo(() => {
    if (!entity) return 0;
    return rows.reduce((a, r) => a + (normalizeRow(r, mapping, entity).errors.length ? 0 : 1), 0);
  }, [rows, mapping, entity]);

  function reset() {
    setStep("type"); setEntity(null); setFileName(""); setHeaders([]); setRows([]);
    setMapping({}); setPolicy("skip"); setError(null); setResult(null);
  }

  function finalize(rawHeaders: unknown[], rawRows: Record<string, unknown>[]) {
    const hs = rawHeaders.map((h) => String(h ?? "").trim()).filter(Boolean);
    if (!hs.length) { setError("Não encontramos cabeçalhos no arquivo."); setParsing(false); return; }
    if (!rawRows.length) { setError("O arquivo não tem linhas de dados."); setParsing(false); return; }
    setHeaders(hs);
    setRows(rawRows);
    setMapping(entity ? autoMap(hs, entity) : {});
    setParsing(false);
    setStep("map");
  }

  async function onFile(file: File) {
    setError(null); setParsing(true); setFileName(file.name);
    try {
      const isCsv = /\.csv$/i.test(file.name);
      if (isCsv) {
        const Papa = (await import("papaparse")).default;
        Papa.parse<Record<string, unknown>>(file, {
          header: true,
          skipEmptyLines: "greedy",
          complete: (res) => finalize(res.meta.fields ?? [], res.data as Record<string, unknown>[]),
          error: (err: Error) => { setError(err.message); setParsing(false); },
        });
      } else {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
        const hs = (aoa[0] ?? []) as unknown[];
        const dataRows = aoa.slice(1)
          .filter((r) => (r as unknown[]).some((c) => c !== "" && c != null))
          .map((r) => {
            const o: Record<string, unknown> = {};
            hs.forEach((h, i) => { o[String(h ?? "").trim()] = (r as unknown[])[i]; });
            return o;
          });
        finalize(hs, dataRows);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao ler o arquivo.");
      setParsing(false);
    }
  }

  function downloadTemplate() {
    if (!entity) return;
    const blob = new Blob(["﻿" + CSV_TEMPLATE[entity]], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `modelo-${entity}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function runImport() {
    if (!entity) return;
    setError(null);
    startTransition(async () => {
      const res = await importRows({ tenantId, entity, rows, mapping, duplicatePolicy: policy });
      if (res.ok) { setResult(res); setStep("done"); }
      else setError(res.error);
    });
  }

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
      )}

      {/* 2. Upload */}
      {step === "upload" && entity && (
        <div className="flex flex-col gap-5">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface p-10 text-center transition hover:border-accent">
            <Upload size={26} className="text-accent" />
            <span className="text-body font-semibold text-text">Selecionar arquivo CSV ou Excel</span>
            <span className="text-caption text-text-muted">{parsing ? "Lendo…" : fileName || "Arraste ou clique para escolher"}</span>
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" disabled={parsing}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          </label>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-caption font-semibold text-text-2">Não tem exportação limpa?</span>
              <Button size="sm" variant="outline" onClick={downloadTemplate}><Download size={14} /> Baixar modelo</Button>
            </div>
            <ul className="flex flex-col gap-2">
              {PLATFORM_GUIDES.map((g) => (
                <li key={g.name} className="text-caption text-text-muted">
                  <span className="font-semibold text-text-2">{g.name}:</span> {g.steps}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <Button variant="ghost" onClick={() => setStep("type")}><ArrowLeft size={15} /> Voltar</Button>
          </div>
        </div>
      )}

      {/* 3. Mapeamento */}
      {step === "map" && entity && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2 text-caption text-text-muted">
            <FileSpreadsheet size={15} /> {fileName} · {rows.length} linhas
          </div>
          <ColumnMapper entity={entity} headers={headers} mapping={mapping} onChange={(k, h) => setMapping((m) => ({ ...m, [k]: h }))} />
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep("upload")}><ArrowLeft size={15} /> Trocar arquivo</Button>
            <Button disabled={!requiredMapped} onClick={() => setStep("preview")}>Revisar <ArrowRight size={15} /></Button>
          </div>
          {!requiredMapped && <p className="text-caption text-warning-strong">Mapeie os campos obrigatórios (*) para continuar.</p>}
        </div>
      )}

      {/* 4. Preview */}
      {step === "preview" && entity && (
        <div className="flex flex-col gap-5">
          <ImportPreview entity={entity} rows={rows} mapping={mapping} />
          <label className="flex flex-col gap-1 sm:max-w-xs">
            <span className="text-caption font-semibold text-text-2">Se já existir na barbearia…</span>
            <select className={selectCls} value={policy} onChange={(e) => setPolicy(e.target.value as DuplicatePolicy)}>
              <option value="skip">Pular (não duplicar)</option>
              <option value="update">Atualizar o registro existente</option>
              <option value="create">Criar mesmo assim</option>
            </select>
          </label>
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep("map")}><ArrowLeft size={15} /> Ajustar colunas</Button>
            <Button disabled={validCount === 0 || pending} loading={pending} onClick={runImport}>
              Importar {validCount} {ENTITY_LABEL[entity].toLowerCase()} para {tenantName}
            </Button>
          </div>
        </div>
      )}

      {/* 5. Resultado */}
      {step === "done" && result && entity && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2 rounded-lg border border-success-strong/30 bg-success-bg px-4 py-3 text-success-strong">
            <CheckCircle2 size={18} /> Importação concluída.
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Inseridos" value={result.inserted} tone="success" />
            <Stat label="Atualizados" value={result.updated} />
            <Stat label="Pulados (duplicados)" value={result.skipped} />
          </div>
          {result.errors.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
              <span className="text-caption font-semibold text-danger-strong">{result.errors.length} linhas com erro</span>
              <ul className="max-h-48 overflow-y-auto text-caption text-text-muted">
                {result.errors.slice(0, 50).map((er, i) => (
                  <li key={i}>Linha {er.line || "—"}: {er.reason}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <Button variant="outline" onClick={reset}>Importar outro tipo</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Steps({ current }: { current: Step }) {
  const order: Step[] = ["type", "upload", "map", "preview", "done"];
  const labels: Record<Step, string> = { type: "Tipo", upload: "Arquivo", map: "Colunas", preview: "Revisão", done: "Concluído" };
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

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
      <span className="text-caption text-text-muted">{label}</span>
      <span className={`text-h4 font-bold tabular ${tone === "success" ? "text-success-strong" : "text-text"}`}>{value}</span>
    </div>
  );
}
