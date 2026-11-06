/**
 * Testes do núcleo de importação (puros — NÃO conectam no Supabase).
 * Rodar: npm run test:import   (= npx tsx scripts/test-import.ts)
 *
 * Fixtures em src/features/import/__fixtures__/ são FICTÍCIAS (dados inventados).
 * Quando chegarem exports reais dos concorrentes, anonimize antes de salvar lá.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { autoMap } from "../src/features/import/core/fields";
import {
  formatPhoneBR, identityMapping, normalizeRecord, parseDateCell, parseDurationCell, parseEmailCell,
  parseIntCell, parseMoneyCell, phoneNationalDigits,
} from "../src/features/import/core/normalize";
import { decodeText, detectHeaderRow, extractTable, firstUsefulSheet, readWorkbook, type Sheet } from "../src/features/import/core/parse-file";
import { buildExistingIndex, dedupKeys, fetchAllPaged, planImport } from "../src/features/import/core/dedup";
import { buildIssuesCsv } from "../src/features/import/core/report";
import type { Entity } from "../src/features/import/core/types";
import { detectSource, getSource, headerRowFor } from "../src/features/import/sources/registry";
import { CHUNK_SIZE, chunk, prepareImport } from "../src/features/import/pipeline";

const FIX = join(__dirname, "..", "src", "features", "import", "__fixtures__");
let passed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${e instanceof Error ? e.message.split("\n").join("\n       ") : e}`);
  }
}

async function load(file: string): Promise<Sheet[]> {
  const buf = readFileSync(join(FIX, file));
  return readWorkbook(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, file);
}

async function loadDetected(file: string, entity: Entity) {
  const sheets = await load(file);
  const sheet = sheets[firstUsefulSheet(sheets)];
  const cand = detectSource(sheet, entity, file);
  return { sheet, cand, mapping: cand.source.mapping(entity, cand.table.headers) };
}

async function main() {
  console.log("autoMap");
  await test("match exato antes de substring; acentos ignorados", () => {
    const m = autoMap(["Preço de Venda", "Preço de custo", "Produto"], "products");
    assert.equal(m.price_brl, "Preço de Venda");
    assert.equal(m.cost_brl, "Preço de custo");
    assert.equal(m.name, "Produto");
  });
  await test("aliases curtos não casam por substring (tel/min/saldo/numero)", () => {
    assert.equal(autoMap(["Hotel", "Nome"], "clients").phone, undefined);
    assert.equal(autoMap(["Número do endereço", "Nome"], "clients").phone, undefined);
    assert.equal(autoMap(["Admin", "Serviço", "Preço"], "services").duration_min, undefined);
    assert.equal(autoMap(["Saldo devedor", "Produto", "Preço"], "products").stock, undefined);
    assert.equal(autoMap(["Saldo", "Produto", "Preço"], "products").stock, "Saldo"); // exato continua valendo
  });
  await test("substring por palavra inteira com alias de 4+ letras", () => {
    assert.equal(autoMap(["Telefone Principal", "Nome do Cliente"], "clients").phone, "Telefone Principal");
    assert.equal(autoMap(["Duração (min)", "Serviço", "Valor"], "services").duration_min, "Duração (min)");
  });

  console.log("normalize");
  await test("telefone BR: 10-11 dígitos após remover 55", () => {
    assert.equal(phoneNationalDigits("(11) 91234-5678"), "11912345678");
    assert.equal(phoneNationalDigits("+55 21 98765-4321"), "21987654321");
    assert.equal(phoneNationalDigits("5511987654321"), "11987654321");
    assert.equal(phoneNationalDigits(5551988887778), "51988887778");
    assert.equal(phoneNationalDigits("(31) 3333-4444"), "3133334444");
    assert.equal(phoneNationalDigits("011 91234-5678"), "11912345678");
    assert.equal(phoneNationalDigits("1234"), null);
    assert.equal(phoneNationalDigits("(11) 81234-5678 1"), null); // 12 dígitos sem 55
    assert.equal(phoneNationalDigits("11812345678"), null); // 11 dígitos sem o 9
    assert.equal(formatPhoneBR("11912345678"), "(11) 91234-5678");
    assert.equal(formatPhoneBR("3133334444"), "(31) 3333-4444");
  });
  await test("e-mail", () => {
    assert.equal(parseEmailCell(" MARIA@Exemplo.com "), "maria@exemplo.com");
    assert.equal(parseEmailCell("pedro@exemplo"), null);
    assert.equal(parseEmailCell("a b@c.com"), null);
  });
  await test("datas reais (31/02 inválida, bissexto ok, serial Excel)", () => {
    assert.equal(parseDateCell("31/02/1992"), null);
    assert.equal(parseDateCell("29/02/2024"), "2024-02-29");
    assert.equal(parseDateCell("29/02/2023"), null);
    assert.equal(parseDateCell("15/03/1990"), "1990-03-15");
    assert.equal(parseDateCell("1985-07-20"), "1985-07-20");
    assert.equal(parseDateCell("1985-07-20T00:00:00"), "1985-07-20");
    assert.equal(parseDateCell(33000), "1990-05-07");
    assert.equal(parseDateCell("2024-13-01"), null);
    assert.equal(parseDateCell("abc"), null);
  });
  await test("dinheiro, inteiro e duração", () => {
    assert.equal(parseMoneyCell("R$ 1.234,56"), 1234.56);
    assert.equal(parseMoneyCell("1,234.56"), 1234.56);
    assert.equal(parseMoneyCell("45"), 45);
    assert.equal(parseMoneyCell("45.5"), 45.5);
    assert.equal(parseMoneyCell("1.234"), 1234);
    assert.equal(parseMoneyCell("abc"), null);
    assert.equal(parseIntCell("12,0"), 12);
    assert.equal(parseIntCell("1.200"), 1200);
    assert.equal(parseIntCell("30 un"), 30);
    assert.equal(parseDurationCell("1h30"), 90);
    assert.equal(parseDurationCell("1h"), 60);
    assert.equal(parseDurationCell("0:45"), 45);
    assert.equal(parseDurationCell("45 min"), 45);
    assert.equal(parseDurationCell("1,5h"), 90);
    assert.equal(parseDurationCell(0.0625), 90);
    assert.equal(parseDurationCell("sem"), null);
  });
  await test("campo opcional inválido vira aviso; obrigatório vira erro", () => {
    const map = { name: "n", phone: "p", email: "e", birth_date: "d" };
    const r = normalizeRecord("clients", { n: "Pedro", p: "1234", e: "x@y", d: "31/02/1992" }, map, 5);
    assert.ok(r.ok);
    if (r.ok) {
      assert.deepEqual(r.record.values, { name: "Pedro" });
      assert.equal(r.warnings.length, 3);
    }
    const bad = normalizeRecord("clients", { n: "", p: "(11) 91234-5678" }, map, 6);
    assert.ok(!bad.ok);
  });
  await test("normalização é idempotente (servidor revalida com mapeamento identidade)", () => {
    const raw = { Nome: " João  da Silva ", Tel: "+55 11 91234-5678", Mail: "JOAO@X.COM", Nasc: "15/03/1990" };
    const first = normalizeRecord("clients", raw, { name: "Nome", phone: "Tel", email: "Mail", birth_date: "Nasc" }, 2);
    assert.ok(first.ok);
    if (!first.ok) return;
    const again = normalizeRecord("clients", first.record.values, identityMapping("clients"), 2);
    assert.ok(again.ok);
    if (again.ok) assert.deepEqual(again.record.values, first.record.values);
    assert.deepEqual(first.record.values, { name: "João da Silva", phone: "(11) 91234-5678", email: "joao@x.com", birth_date: "1990-03-15" });

    const svc = normalizeRecord("services", { a: "Corte", b: "1h30", c: "R$ 50,00" }, { name: "a", duration_min: "b", price_brl: "c" }, 2);
    assert.ok(svc.ok);
    if (!svc.ok) return;
    const svc2 = normalizeRecord("services", svc.record.values, identityMapping("services"), 2);
    assert.ok(svc2.ok && JSON.stringify(svc2.record.values) === JSON.stringify(svc.record.values));
  });
  await test("whitelist: campos fora do FIELD_MAP são descartados no servidor", () => {
    const r = normalizeRecord("clients", { name: "X", status: "ACTIVE", user_id: "abc", tenant_id: "t" }, identityMapping("clients"), 1);
    assert.ok(r.ok);
    if (r.ok) assert.deepEqual(r.record.values, { name: "X" });
  });

  console.log("parse-file");
  await test("decodeText cai para Windows-1252 quando não é UTF-8", () => {
    const t = decodeText(readFileSync(join(FIX, "trinks-clientes.csv")));
    assert.ok(t.includes("Gênero") && t.includes("José Araújo"), t.slice(0, 80));
  });
  await test("detecção da linha de cabeçalho com título de relatório", () => {
    const aoa = [["Relatório de Clientes"], ["Período: 01/01 a 31/01", ""], [], ["Cliente", "Celular", "E-mail"], ["Ana", "(11) 91234-5678", "a@b.com"]];
    assert.equal(detectHeaderRow(aoa), 3);
    const t = extractTable({ name: "x", aoa, firstLine: 1 }, 3);
    assert.deepEqual(t.headers, ["Cliente", "Celular", "E-mail"]);
    assert.equal(t.rows[0].line, 5);
  });
  await test("cabeçalhos duplicados/vazios ganham nome único", () => {
    const aoa = [["Nome", "Telefone", "Telefone", ""], ["A", "1", "2", "x"]];
    const t = extractTable({ name: "x", aoa, firstLine: 1 }, 0);
    assert.deepEqual(t.headers, ["Nome", "Telefone", "Telefone (2)", "Coluna D"]);
  });
  await test("xlsx: escolhe a aba útil e numera as linhas da planilha", async () => {
    const sheets = await load("appbarber-clientes.xlsx");
    assert.equal(sheets.length, 2);
    const idx = firstUsefulSheet(sheets);
    assert.equal(sheets[idx].name, "Clientes");
    assert.equal(headerRowFor(getSource("appbarber"), sheets[idx]), 4);
  });

  console.log("sources");
  await test("genérico: CSV qualquer cai no adaptador generic", async () => {
    const { cand, mapping } = await loadDetected("generic-clientes.csv", "clients");
    assert.equal(cand.source.id, "generic");
    assert.deepEqual(mapping, { name: "Nome", phone: "Celular", email: "E-mail", birth_date: "Data de Nascimento" });
  });
  await test("Trinks: detectado por Nome+Telefone+CPF+Gênero (arquivo Windows-1252, ';')", async () => {
    const { cand, mapping } = await loadDetected("trinks-clientes.csv", "clients");
    assert.equal(cand.source.id, "trinks");
    assert.equal(mapping.name, "Nome");
    assert.equal(mapping.phone, "Telefone");
    assert.equal(mapping.email, "Email");
    assert.equal(cand.table.rows[0].data["Nome"], "José Araújo");
  });
  await test("Booksy: cabeçalhos minúsculos nome/e-mail/telefone/nascimento", async () => {
    const { cand, mapping } = await loadDetected("booksy-clientes.csv", "clients");
    assert.equal(cand.source.id, "booksy");
    assert.equal(mapping.birth_date, "nascimento");
    const prep = prepareImport("clients", cand.source, cand.table.rows, mapping, "skip");
    assert.equal(prep.records[0].values.phone, "(11) 91234-0000");
  });
  await test("Booksy: transform junta nome + sobrenome", () => {
    const out = getSource("booksy").transform!("clients", { nome: "Lucas", sobrenome: "Pereira" });
    assert.equal(out?.nome, "Lucas Pereira");
  });
  await test("AppBarber: título antes do cabeçalho → locateHeader; rodapé de total descartado", async () => {
    const { cand, mapping } = await loadDetected("appbarber-clientes.xlsx", "clients");
    assert.equal(cand.source.id, "appbarber");
    assert.equal(cand.headerRow, 4);
    assert.equal(mapping.name, "Cliente");
    assert.equal(mapping.phone, "Celular");
    assert.equal(mapping.birth_date, "Aniversário");
    const prep = prepareImport("clients", cand.source, cand.table.rows, mapping, "skip");
    assert.equal(prep.records.length, 2);
    assert.equal(prep.dropped, 1);
    assert.equal(prep.records[0].values.birth_date, "1990-05-07");
    assert.equal(prep.records[1].values.phone, "(51) 98888-7778");
    assert.equal(prep.records[0].line, 6);
  });
  await test("BestBarbers: não auto-seleciona (sem amostra real), mas mapeia se escolhido", async () => {
    const { cand, sheet } = await loadDetected("bestbarbers-clientes.csv", "clients");
    assert.equal(cand.source.id, "generic");
    const bb = getSource("bestbarbers");
    const t = extractTable(sheet, headerRowFor(bb, sheet));
    assert.equal(bb.mapping("clients", t.headers).phone, "Celular");
  });

  console.log("pipeline + dedup");
  await test("clientes genéricos: erros, avisos e duplicado no arquivo", async () => {
    const { cand, mapping } = await loadDetected("generic-clientes.csv", "clients");
    const prep = prepareImport("clients", cand.source, cand.table.rows, mapping, "skip");
    // linhas: 2 João, 3 Maria, 4 Pedro(aviso tel/email/data), 5 sem nome(erro), 6 João dup(pulado),
    //         7 Ana (bissexto ok), 8 Carlos (nascimento no futuro → aviso)
    assert.equal(prep.invalid, 1);
    assert.equal(prep.skippedInFile, 1);
    assert.deepEqual(prep.records.map((r) => r.line), [2, 3, 4, 7, 8]);
    const pedro = prep.records.find((r) => r.line === 4)!;
    assert.deepEqual(pedro.values, { name: "Pedro Lima" });
    assert.ok(prep.issues.some((i) => i.line === 6 && /linha 2/.test(i.reason)));
    assert.ok(prep.issues.some((i) => i.line === 5 && i.level === "error"));
    assert.ok(prep.issues.some((i) => i.line === 8 && /futuro/.test(i.reason)));
    const create = prepareImport("clients", cand.source, cand.table.rows, mapping, "create");
    assert.equal(create.skippedInFile, 0);
  });
  await test("produtos: 'Saldo devedor' não vira estoque; '12,0' = 12; preço inválido = erro", async () => {
    const { cand, mapping } = await loadDetected("generic-produtos.csv", "products");
    assert.equal(mapping.stock, "Estoque atual");
    assert.equal(mapping.price_brl, "Valor de venda");
    assert.equal(mapping.cost_brl, "Valor de custo");
    assert.equal(mapping.sku, "Cód.");
    const prep = prepareImport("products", cand.source, cand.table.rows, mapping, "skip");
    assert.equal(prep.records.length, 2);
    assert.equal(prep.records[1].values.price_brl, 1234.5);
    assert.equal(prep.records[1].values.stock, 12);
    assert.equal(prep.invalid, 1); // Shampoo "abc"
    assert.equal(prep.skippedInFile, 1); // Pomada repetida (mesmo SKU)
  });
  await test("serviços: durações variadas; 'Admin' não vira duração", async () => {
    const { cand, mapping } = await loadDetected("generic-servicos.csv", "services");
    assert.equal(mapping.duration_min, "Duração (min)");
    assert.equal(mapping.category, "Tipo");
    const prep = prepareImport("services", cand.source, cand.table.rows, mapping, "skip");
    assert.deepEqual(prep.records.map((r) => r.values.duration_min), [30, 60, 90, 45]);
    assert.equal(prep.invalid, 1);
  });
  await test("dedup contra o banco: telefone em qualquer formato, e-mail sem caixa", () => {
    const idx = buildExistingIndex("clients", [
      { id: "a", phone: "5511912345678", email: null },
      { id: "b", phone: null, email: "Maria@Exemplo.com" },
    ]);
    const recs = [
      { line: 2, values: { name: "João", phone: "(11) 91234-5678" } },
      { line: 3, values: { name: "Maria", email: "maria@exemplo.com" } },
      { line: 4, values: { name: "Novo", phone: "(11) 90000-1111" } },
    ];
    const skip = planImport("clients", recs, idx, "skip");
    assert.deepEqual(skip.counts, { insert: 1, update: 0, skip: 2, error: 0 });
    const upd = planImport("clients", recs, idx, "update");
    assert.deepEqual(upd.toUpdate.map((u) => u.id), ["a", "b"]);
    const create = planImport("clients", recs, idx, "create");
    assert.equal(create.counts.insert, 3);
    assert.deepEqual(dedupKeys("products", { sku: "POM-1", name: "Pomada Modeladora" }), ["s:pom-1", "n:pomada modeladora"]);
  });
  await test("índice existente paginado em blocos de 1000 (.range)", async () => {
    const all = Array.from({ length: 2500 }, (_, i) => ({ id: String(i) }));
    const calls: [number, number][] = [];
    const rows = await fetchAllPaged(async (from, to) => {
      calls.push([from, to]);
      return { data: all.slice(from, to + 1), error: null };
    });
    assert.equal(rows.length, 2500);
    assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]]);
  });
  await test("lotes de ~500 registros normalizados cabem folgados no limite de 1 MB", () => {
    const recs = Array.from({ length: 1234 }, (_, i) => ({
      line: i + 2,
      values: { name: `Cliente Fictício Número ${i} da Silva Sauro`, phone: "(11) 91234-5678", email: `cliente${i}@exemplo-ficticio.com.br`, birth_date: "1990-01-01" },
    }));
    const parts = chunk(recs, CHUNK_SIZE);
    assert.deepEqual(parts.map((p) => p.length), [500, 500, 234]);
    const bytes = Buffer.byteLength(JSON.stringify(parts[0]));
    assert.ok(bytes < 200_000, `lote com ${bytes} bytes`);
  });

  console.log("relatório");
  await test("CSV de erros: BOM, ';', aspas e neutralização de fórmula", () => {
    const csv = buildIssuesCsv(
      [{ line: 2, level: "error", reason: 'Nome obrigatório; "x"' }],
      ["Nome", "Obs"],
      [{ line: 2, data: { Nome: "=HYPERLINK(1)", Obs: "a;b" } }]
    );
    assert.ok(csv.startsWith("﻿Linha;Tipo;Motivo;Nome;Obs"));
    assert.ok(csv.includes(`"Nome obrigatório; ""x"""`));
    assert.ok(csv.includes("'=HYPERLINK(1)"));
    assert.ok(csv.includes('"a;b"'));
  });

  console.log(`\n${passed} ok, ${failures.length} falha(s)`);
  if (failures.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
