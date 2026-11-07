// Teste de isolamento entre barbearias (RLS + RPCs) — 02-S2 / 02-S3.
// Roda SÓ contra o Supabase LOCAL do `supabase start` (o script recusa outro host).
// Dados 100% fictícios (@example.test), criados e apagados pelo próprio teste.
//
// Uso (chaves de demonstração do Supabase local, nunca de projeto real):
//   eval "$(supabase status -o env | sed 's/^/export /')"
//   node --test scripts/ci/rls-isolation.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { env, setup } from "./rls-fixtures.mjs";

// ---------------------------------------------------------------------------
// COBERTURA. Toda tabela de public com coluna tenant_id PRECISA estar aqui
// (o teste "cobertura" falha se faltar). Modos do dono:
//   admin   = o dono da barbearia lê e gerencia as linhas do próprio tenant
//   read    = o dono só lê (sem escrita pela API)
//   self    = cada usuário lê só a própria linha (memberships)
//   service = RLS ligada SEM policy: só service-role; dono e anônimo não leem nada
// ---------------------------------------------------------------------------
const TENANT_TABLES = {
  appointments: "admin",
  appointment_items: "admin",
  audit_log: "admin",
  barbers: "admin",
  branding: "admin",
  campaigns: "admin",
  children: "admin",
  client_invites: "admin",
  client_subscriptions: "admin",
  clients: "admin",
  combo_plans: "admin",
  distributor_customers: "admin",
  financial_entries: "admin",
  memberships: "self",
  notification_log: "admin",
  partners: "service",
  payments: "admin",
  plan_requests: "admin",
  plan_upgrade_requests: "admin",
  product_reservations: "admin",
  products: "admin",
  queue_entries: "admin",
  saas_payments: "service",
  sales: "admin",
  schedule_blocks: "admin",
  services: "admin",
  tenant_contracts: "read",
  tenant_settings: "admin",
  wa_sessions: "service",
};
// Tabelas de tenant SEM coluna tenant_id (escopo pelo pai): cobertas por casos próprios abaixo.
const PARENT_SCOPED = ["combo_plan_services", "order_items", "orders", "profiles", "sale_items", "tenants", "working_hours"];

// Exceções públicas de propósito para o anônimo (/b/<slug>): NENHUMA tabela.
// O link público usa RPCs (listadas em ANON_RPCS) ou o servidor com service-role.
const ANON_TABLE_EXCEPTIONS = {};
// RPCs que o anônimo pode executar, e por quê.
const ANON_RPCS = {
  invite_info: "página pública /convite/[token]: o token (UUID, 122 bits) é a credencial",
  invite_status: "idem",
  accept_invite: "idem",
  blocked_ranges: "agenda pública /b/<slug>: devolve só horários bloqueados (sem dado pessoal) do tenant do barbeiro",
  place_order: "exposta a anon por grant do schema-27, mas recusa sem is_admin() (coberto abaixo)",
  set_order_status: "idem (schema-27)",
  auth_tenant_id: "helper usado dentro das policies",
  auth_role: "helper usado dentro das policies",
  is_admin: "helper usado dentro das policies",
  owns_client: "helper usado dentro das policies",
};

// schema-33 (hotfix P0-A) corrige RPCs de cliente e as policies children_admin / wh_admin.
// Antes de ele entrar no supabase/ci-order.txt, esses casos rodam como TODO (aparecem no
// relatório, não derrubam o CI). Com o schema-33 aplicado, viram obrigatórios sozinhos.
const probe = new pg.Client({ connectionString: env().DB_URL });
await probe.connect();
const HAS_SCHEMA_33 = (await probe.query("select 1 from pg_proc where proname = 'is_admin_of_client'")).rowCount > 0;
const TENANT_ID_TABLES = (
  await probe.query(
    `select c.table_name from information_schema.columns c
       join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema = 'public' and c.column_name = 'tenant_id' and t.table_type = 'BASE TABLE'
      order by 1`
  )
).rows.map((r) => r.table_name);
const ALL_TABLES = (
  await probe.query("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1")
).rows.map((r) => r.table_name);
const ANON_EXEC = (
  await probe.query(
    `select p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
       and has_function_privilege('anon', p.oid, 'execute') order by 1`
  )
).rows.map((r) => r.proname);
await probe.end();

const P0A = HAS_SCHEMA_33 ? {} : { todo: "pendente: schema-33 (hotfix P0-A) ainda não está no supabase/ci-order.txt" };
const KNOWN_P0A_TABLES = new Set(["children"]); // policy children_admin sem tenant até o schema-33

let ctx;
before(async () => {
  ctx = await setup();
});
after(async () => {
  await ctx?.cleanup();
});

const RLS_DENIED = "42501";
const rowsOf = (res) => res.data ?? [];

/** Linha da tabela de B pronta para tentar inserir como A (sem id; colunas únicas trocadas). */
async function cloneRowOfB(table) {
  const { rows } = await ctx.db.query(`select * from public.${table} where tenant_id = $1 limit 1`, [ctx.T.B.id]);
  assert.ok(rows[0], `fixture ausente em ${table} para o tenant B`);
  const row = { ...rows[0] };
  delete row.id;
  const uniq = await ctx.db.query(
    `select a.attname, format_type(a.atttypid, a.atttypmod) as type
       from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
      where i.indrelid = $1::regclass and i.indisunique and not i.indisprimary`,
    [`public.${table}`]
  );
  for (const u of uniq.rows) if (u.attname !== "tenant_id" && u.type === "text") row[u.attname] = `${row[u.attname]}-x`;
  for (const [k, v] of Object.entries(row)) if (v instanceof Date) row[k] = v.toISOString();
  return row;
}

async function countB(table) {
  return (await ctx.db.query(`select count(*)::int as n from public.${table} where tenant_id = $1`, [ctx.T.B.id])).rows[0].n;
}

// ===========================================================================
// S3 · cobertura: toda tabela com tenant_id tem teste de isolamento
// ===========================================================================
test("cobertura: toda tabela com tenant_id está na lista de isolamento", () => {
  const missing = TENANT_ID_TABLES.filter((t) => !(t in TENANT_TABLES));
  const covered = TENANT_ID_TABLES.length - missing.length;
  console.log(`\n  ▶ ${covered} de ${TENANT_ID_TABLES.length} tabelas de tenant cobertas (métrica c)` +
    ` · + ${PARENT_SCOPED.length} tabelas com escopo pelo pai · schema-33: ${HAS_SCHEMA_33 ? "aplicado" : "PENDENTE (casos P0-A em TODO)"}\n`);
  assert.deepEqual(missing.map((t) => `Tabela ${t} tem tenant_id e não tem teste de isolamento.`), []);
  const stale = Object.keys(TENANT_TABLES).filter((t) => !TENANT_ID_TABLES.includes(t));
  assert.deepEqual(stale, [], "tabela na lista de cobertura que não existe mais (ou perdeu tenant_id)");
  const unknown = ALL_TABLES.filter((t) => !(t in TENANT_TABLES) && !PARENT_SCOPED.includes(t));
  assert.deepEqual(unknown, [], "tabela nova em public sem tenant_id: classificar em PARENT_SCOPED com um caso próprio");
});

test("cobertura: RLS ligada em todas as tabelas de public", async () => {
  const c = new pg.Client({ connectionString: env().DB_URL });
  await c.connect();
  const { rows } = await c.query(
    "select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity"
  );
  await c.end();
  assert.deepEqual(rows.map((r) => r.relname), []);
});

test("cobertura: toda RPC executável por anon está justificada", () => {
  const unjustified = ANON_EXEC.filter((f) => !(f in ANON_RPCS));
  assert.deepEqual(unjustified, [], "RPC exposta a anon sem motivo em ANON_RPCS");
});

// ===========================================================================
// S2 · dono da A × dados da B, tabela por tabela (e o espelho B × A no select)
// ===========================================================================
for (const [table, mode] of Object.entries(TENANT_TABLES)) {
  const o = KNOWN_P0A_TABLES.has(table) ? P0A : {};

  test(`[${table}] dono A não lê linhas da B (nem filtrando pelo tenant)`, o, async () => {
    const res = await ctx.sessions.ownerA.from(table).select("*").eq("tenant_id", ctx.T.B.id);
    assert.equal(rowsOf(res).length, 0, `vazou ${rowsOf(res).length} linha(s) de B`);
    const back = await ctx.sessions.ownerB.from(table).select("*").eq("tenant_id", ctx.T.A.id);
    assert.equal(rowsOf(back).length, 0, `B leu ${rowsOf(back).length} linha(s) de A`);
  });

  test(`[${table}] dono A só vê o próprio tenant (modo ${mode})`, o, async () => {
    const res = await ctx.sessions.ownerA.from(table).select("*");
    const rows = rowsOf(res);
    assert.ok(rows.every((r) => r.tenant_id === ctx.T.A.id), "viu linha de outro tenant");
    if (mode === "admin" || mode === "read" || mode === "self") assert.ok(rows.length >= 1, "deveria ver as próprias linhas (fixture)");
    if (mode === "service") assert.equal(rows.length, 0, "tabela só de service-role não pode ser lida pelo dono");
  });

  test(`[${table}] dono A não insere linha com tenant_id da B`, o, async () => {
    const row = await cloneRowOfB(table);
    const before = await countB(table);
    const res = await ctx.sessions.ownerA.from(table).insert(row);
    assert.equal(await countB(table), before, "insert cross-tenant gravou linha");
    assert.equal(res.error?.code, RLS_DENIED, `esperava recusa da RLS (42501), veio: ${res.error?.code ?? "sucesso"} ${res.error?.message ?? ""}`);
  });

  test(`[${table}] dono A não altera nem apaga linhas da B`, o, async () => {
    const before = await countB(table);
    const upd = await ctx.sessions.ownerA.from(table).update({ tenant_id: ctx.T.B.id }).eq("tenant_id", ctx.T.B.id).select();
    assert.equal(rowsOf(upd).length, 0, "update cross-tenant afetou linha");
    const del = await ctx.sessions.ownerA.from(table).delete().eq("tenant_id", ctx.T.B.id).select();
    assert.equal(rowsOf(del).length, 0, "delete cross-tenant afetou linha");
    assert.equal(await countB(table), before, "linhas de B mudaram");
  });

  test(`[${table}] cliente final da A não lê nada da B e na A só o permitido`, o, async () => {
    const res = await ctx.sessions.clientA.from(table).select("*");
    const rows = rowsOf(res);
    assert.ok(rows.every((r) => r.tenant_id === ctx.T.A.id), "cliente viu linha de outro tenant");
    if ("client_id" in (rows[0] ?? {})) {
      assert.ok(rows.every((r) => r.client_id === ctx.F.A.myClient.id), "cliente viu linha de outro cliente");
    }
    if (table === "clients") assert.ok(rows.every((r) => r.user_id === ctx.U.clientA.id), "cliente viu outro cadastro");
    if (mode === "service") assert.equal(rows.length, 0);
  });
}

test("anônimo não lê nenhuma tabela de public (exceções listadas: nenhuma)", async () => {
  const leaks = [];
  for (const table of ALL_TABLES) {
    if (table in ANON_TABLE_EXCEPTIONS) continue;
    const res = await ctx.anon.from(table).select("*").limit(5);
    if (rowsOf(res).length) leaks.push(`${table} (${rowsOf(res).length})`);
  }
  assert.deepEqual(leaks, []);
});

test("cliente final da A vê o próprio agendamento e plano", async () => {
  const a = await ctx.sessions.clientA.from("appointments").select("id");
  assert.deepEqual(rowsOf(a).map((r) => r.id), [ctx.F.A.myAppointment.id]);
  const s = await ctx.sessions.clientA.from("client_subscriptions").select("id");
  assert.deepEqual(rowsOf(s).map((r) => r.id), [ctx.F.A.mySubscription.id]);
});

// ===========================================================================
// Tabelas com escopo pelo pai (sem tenant_id)
// ===========================================================================
test("[tenants] dono A só lê a própria barbearia", async () => {
  const res = await ctx.sessions.ownerA.from("tenants").select("id");
  assert.deepEqual(rowsOf(res).map((r) => r.id), [ctx.T.A.id]);
});

test("[profiles] dono A não lê o perfil do dono B", async () => {
  const res = await ctx.sessions.ownerA.from("profiles").select("id").eq("id", ctx.U.ownerB.id);
  assert.equal(rowsOf(res).length, 0);
});

test("[working_hours] dono A não lê, altera nem apaga horários de barbeiro da B", async () => {
  const b = ctx.F.B.barber.id;
  assert.equal(rowsOf(await ctx.sessions.ownerA.from("working_hours").select("id").eq("barber_id", b)).length, 0);
  assert.equal(rowsOf(await ctx.sessions.ownerA.from("working_hours").update({ end_min: 1000 }).eq("barber_id", b).select()).length, 0);
  assert.equal(rowsOf(await ctx.sessions.ownerA.from("working_hours").delete().eq("barber_id", b).select()).length, 0);
});

test("[working_hours] dono A não insere horário para barbeiro da B", P0A, async () => {
  const res = await ctx.sessions.ownerA.from("working_hours").insert({ barber_id: ctx.F.B.barber.id, weekday: 2, start_min: 600, end_min: 700 });
  const n = (await ctx.db.query("select count(*)::int n from public.working_hours where barber_id = $1", [ctx.F.B.barber.id])).rows[0].n;
  assert.equal(n, 1, "gravou horário no barbeiro de outra barbearia");
  assert.equal(res.error?.code, RLS_DENIED);
});

for (const [table, parent, fk] of [["combo_plan_services", "combo", "combo_plan_id"], ["sale_items", "sale", "sale_id"]]) {
  test(`[${table}] dono A não lê nem insere filho de registro da B`, async () => {
    const pid = ctx.F.B[parent].id;
    assert.equal(rowsOf(await ctx.sessions.ownerA.from(table).select("*").eq(fk, pid)).length, 0);
    const row = table === "combo_plan_services"
      ? { combo_plan_id: pid, service_id: ctx.F.A.service.id }
      : { sale_id: pid, kind: "service", name: "Intruso", price_brl: 1 };
    const res = await ctx.sessions.ownerA.from(table).insert(row);
    assert.equal(res.error?.code, RLS_DENIED, `esperava 42501, veio ${res.error?.code ?? "sucesso"}`);
  });
}

// ===========================================================================
// S3 · pedidos de distribuidor: barbearia vê só os dela; distribuidor vê os feitos a ele
// ===========================================================================
test("[orders] dono A vê só o pedido da A; dono B só o da B; distribuidor os dois", async () => {
  const ids = async (s) => rowsOf(await s.from("orders").select("id")).map((r) => r.id).sort();
  assert.deepEqual(await ids(ctx.sessions.ownerA), [ctx.orders.A.id]);
  assert.deepEqual(await ids(ctx.sessions.ownerB), [ctx.orders.B.id]);
  assert.deepEqual(await ids(ctx.sessions.ownerD), [ctx.orders.A.id, ctx.orders.B.id].sort());
  assert.deepEqual(await ids(ctx.sessions.clientA), [], "cliente final não vê pedidos");
});

test("[order_items] dono A não vê itens do pedido da B; insert direto é negado", async () => {
  const res = await ctx.sessions.ownerA.from("order_items").select("order_id");
  assert.ok(rowsOf(res).every((r) => r.order_id === ctx.orders.A.id));
  const ins = await ctx.sessions.ownerA.from("orders").insert({ distributor_id: ctx.T.D.id, customer_tenant_id: ctx.T.B.id });
  assert.equal(ins.error?.code, RLS_DENIED, "orders só são criados pela RPC place_order");
});

// ===========================================================================
// S3 · MASTER "Atuar como" (header x-act-tenant)
// ===========================================================================
test("[act-as] master atuando como A lê só a A, nunca a B", async () => {
  const s = ctx.sessions.masterActingA;
  const c = rowsOf(await s.from("clients").select("tenant_id"));
  assert.ok(c.length >= 1, "master atuando como A deveria ver os clientes da A");
  assert.ok(c.every((r) => r.tenant_id === ctx.T.A.id));
  assert.equal(rowsOf(await s.from("clients").select("id").eq("tenant_id", ctx.T.B.id)).length, 0);
  const t = rowsOf(await s.from("tenants").select("id")).map((r) => r.id);
  assert.deepEqual(t, [ctx.T.A.id]);
});

test("[act-as] master sem o header fica no próprio tenant (não vê A nem B)", async () => {
  const c = rowsOf(await ctx.sessions.master.from("clients").select("tenant_id"));
  assert.ok(c.every((r) => r.tenant_id !== ctx.T.A.id && r.tenant_id !== ctx.T.B.id));
});

test("[act-as] dono (não master) mandando x-act-tenant da B é ignorado", async () => {
  const s = ctx.sessions.ownerAFakeActB;
  const c = rowsOf(await s.from("clients").select("tenant_id"));
  assert.ok(c.length >= 1 && c.every((r) => r.tenant_id === ctx.T.A.id), "header de outro tenant foi honrado para não-master");
  assert.deepEqual(rowsOf(await s.from("tenants").select("id")).map((r) => r.id), [ctx.T.A.id]);
});

// ===========================================================================
// S3 · RPCs security definer chamadas com id de outra barbearia
// ===========================================================================
async function rpcError(session, fn, args) {
  const res = await session.rpc(fn, args);
  return res.error?.message ?? null;
}

test("[rpc place_order] dono A não faz pedido como se fosse de outra carteira / produto alheio", async () => {
  // A não é distribuidor: pedir "à B" é recusado.
  assert.match(await rpcError(ctx.sessions.ownerA, "place_order", { p_distributor: ctx.T.B.id, p_items: [{ product_id: ctx.F.B.product.id, qty: 1 }], p_note: null }) ?? "", /carteira/);
  // A está na carteira de D, mas item com produto da B (não do D) é recusado.
  assert.match(await rpcError(ctx.sessions.ownerA, "place_order", { p_distributor: ctx.T.D.id, p_items: [{ product_id: ctx.F.B.product.id, qty: 1 }], p_note: null }) ?? "", /indisponível/);
  // Anônimo e cliente final: recusados.
  assert.match(await rpcError(ctx.anon, "place_order", { p_distributor: ctx.T.D.id, p_items: [{ product_id: ctx.productD.id, qty: 1 }], p_note: null }) ?? "", /forbidden/);
  assert.match(await rpcError(ctx.sessions.clientA, "place_order", { p_distributor: ctx.T.D.id, p_items: [{ product_id: ctx.productD.id, qty: 1 }], p_note: null }) ?? "", /forbidden/);
});

test("[rpc set_order_status] dono A não mexe no pedido da B", async () => {
  for (const status of ["CANCELLED", "CONFIRMED", "SHIPPED"]) {
    assert.match(await rpcError(ctx.sessions.ownerA, "set_order_status", { p_order_id: ctx.orders.B.id, p_status: status }) ?? "", /forbidden/, status);
  }
  assert.ok(await rpcError(ctx.anon, "set_order_status", { p_order_id: ctx.orders.B.id, p_status: "CANCELLED" }));
  const { rows } = await ctx.db.query("select status from public.orders where id = $1", [ctx.orders.B.id]);
  assert.equal(rows[0].status, "PLACED");
});

test("[rpc blocked_ranges / booked_starts] só horários, só do tenant do barbeiro", async () => {
  const from = new Date().toISOString();
  const to = new Date(Date.now() + 30 * 86400000).toISOString();
  const r = await ctx.sessions.ownerA.rpc("blocked_ranges", { p_barber_id: ctx.F.A.barber.id, p_from: from, p_to: to });
  assert.ifError(r.error);
  assert.equal(r.data.length, 1, "deveria ver só o bloqueio da A (não o da B)");
  assert.deepEqual(Object.keys(r.data[0]).sort(), ["ends_at", "starts_at"], "não pode devolver dado além do horário");
  const b = await ctx.sessions.ownerA.rpc("booked_starts", { p_barber_id: ctx.F.A.barber.id, p_from: from, p_to: to });
  assert.ifError(b.error);
  assert.ok(b.data.every((v) => typeof v === "string"), "booked_starts devolve só horários");
});

test("[rpc invite_info / invite_status / accept_invite] token desconhecido não devolve nada", async () => {
  for (const s of [ctx.anon, ctx.sessions.ownerA]) {
    const i = await s.rpc("invite_info", { p_token: `chute-${ctx.run}` });
    assert.equal(rowsOf(i).length, 0);
    const st = await s.rpc("invite_status", { p_token: `chute-${ctx.run}` });
    assert.equal(rowsOf(st).length, 0);
  }
  await ctx.anon.rpc("accept_invite", { p_token: `chute-${ctx.run}` });
  const { rows } = await ctx.db.query("select status from public.client_invites where tenant_id = $1", [ctx.T.B.id]);
  assert.ok(rows.every((r) => r.status === "PENDING"));
});

test("[rpc join_queue / leave_queue] cliente da A não entra na fila da B nem tira entrada da B", async () => {
  assert.match(await rpcError(ctx.sessions.clientA, "join_queue", { p_tenant_id: ctx.T.B.id, p_service_id: null, p_barber_id: null }) ?? "", /não encontrado/);
  await ctx.sessions.clientA.rpc("leave_queue", { p_entry_id: ctx.F.B.queue_entries.id });
  const { rows } = await ctx.db.query("select status from public.queue_entries where id = $1", [ctx.F.B.queue_entries.id]);
  assert.equal(rows[0].status, "WAITING");
});

// As 7 RPCs do P0-A (schema-33): dono A com cliente da B → 'forbidden'. TODO até o schema-33 entrar no manifesto.
const P0A_CALLS = (cb, B) => [
  ["consume_cut", { p_client_id: cb }],
  ["return_cut", { p_client_id: cb }],
  ["assign_combo", { p_client_id: cb, p_combo_plan_id: B.combo?.id }],
  ["activate_fixed_plan", { p_client_id: cb, p_combo_id: B.combo?.id, p_weekday: 1, p_start_min: 600, p_barber_id: B.barber?.id, p_service_id: B.service?.id }],
  ["add_fixed_makeup", { p_client_id: cb }],
  ["cancel_future_plan_appointments", { p_client_id: cb }],
  ["ensure_fixed_reservations", { p_client_id: cb }],
];
P0A_CALLS(null, {}).forEach(([name], i) => {
  test(`[rpc ${name}] dono A com cliente da B é recusado (P0-A)`, P0A, async () => {
    const [fn, args] = P0A_CALLS(ctx.F.B.client.id, ctx.F.B)[i];
    const saldo = async () =>
      (await ctx.db.query("select saldo_cortes from public.client_subscriptions where id = $1", [ctx.F.B.client_subscriptions.id])).rows[0].saldo_cortes;
    const before = await saldo();
    const err = await rpcError(ctx.sessions.ownerA, fn, args);
    assert.equal(err, "forbidden", `${fn} aceitou cliente de outra barbearia`);
    assert.equal(await saldo(), before);
  });
});
