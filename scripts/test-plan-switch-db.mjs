// Testes de banco do bug #131 (schema-59): trocar plano fixo não deixa reservas do plano antigo.
// SÓ em Supabase LOCAL descartável (loopback), com o ci-order aplicado. Dados fictícios.
// Cada execução cria barbearias novas com sufixo aleatório e não apaga nada.
// Uso: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:<porta>/postgres node scripts/test-plan-switch-db.mjs
import { randomBytes, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { localTarget } from "./lib/schema-apply.mjs";

const require = createRequire(import.meta.url);
const pg = require("pg");

if (!process.env.DATABASE_URL) {
  console.error("✗ Defina DATABASE_URL (Supabase local).");
  process.exit(1);
}
const pool = new pg.Pool({ ...localTarget(process.env.DATABASE_URL), max: 5 });
const RUN = randomBytes(3).toString("hex");
const q = (sql, params) => pool.query(sql, params);

// ---------- dados fictícios ----------

async function shop(label) {
  const { rows } = await q(
    `insert into public.tenants (name, subdomain, saas_plan) values ($1, $2, 'advance') returning id`,
    [`Barbearia ${label} Teste`, `pl-${label}-${RUN}`]
  );
  const t = rows[0].id;
  const svc = (await q(
    `insert into public.services (tenant_id, name, price_brl, duration_min) values ($1, 'Corte Teste', 40, 30) returning id`,
    [t]
  )).rows[0].id;
  const barber = (await q(`insert into public.barbers (tenant_id, name) values ($1, 'Barbeiro Teste') returning id`, [t])).rows[0].id;
  const barber2 = (await q(`insert into public.barbers (tenant_id, name) values ($1, 'Barbeiro Dois Teste') returning id`, [t])).rows[0].id;
  const plan = async (name, cuts, mode) =>
    (await q(
      `insert into public.combo_plans (tenant_id, name, cuts, price_brl, booking_mode, service_id) values ($1, $2, $3, 100, $4, $5) returning id`,
      [t, name, cuts, mode, svc]
    )).rows[0].id;
  return {
    t,
    svc,
    barber,
    barber2,
    fixedA: await plan("Fixo A Teste", 4, "FIXED"),
    fixedB: await plan("Fixo B Teste", 2, "FIXED"),
    combo: await plan("Combo Teste", 5, "FLEXIBLE"),
  };
}

async function client(t, name) {
  return (await q(`insert into public.clients (tenant_id, name) values ($1, $2) returning id`, [t, name])).rows[0].id;
}

async function admin(t, label) {
  const uid = randomUUID();
  await q(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', now(), now(), now(), '{}', '{}')`,
    [uid, `${label}-${RUN}@example.test`]
  );
  await q(`insert into public.memberships (user_id, tenant_id, role) values ($1, $2, 'UNIT_ADMIN')`, [uid, t]);
  return uid;
}

/** Roda sql como o usuário (papel authenticated + jwt), como o PostgREST faz. */
async function asUser(uid, sql, params, { before } = {}) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    if (before) await c.query(before);
    await c.query("set local role authenticated");
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: "authenticated" })]);
    const r = await c.query(sql, params);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

const activateFixed = (uid, cl, plan, weekday, startMin, barber) =>
  asUser(uid, `select public.activate_fixed_plan($1, $2, $3, $4, $5, null)`, [cl, plan, weekday, startMin, barber]);
const assignCombo = (uid, cl, plan) => asUser(uid, `select public.assign_combo($1, $2)`, [cl, plan]);

/** Reserva avulsa ou de plano criada à mão (para os casos que não podem mudar). */
async function appt(s, cl, { plan = null, fromPlan = false, at, status = "CONFIRMED", debited = false, started = false }) {
  return (await q(
    `insert into public.appointments (tenant_id, client_id, barber_id, service_id, combo_plan_id, start_at, status, consumed_from_plan, plan_debited, service_started_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
    [s.t, cl, s.barber2, s.svc, plan, at, status, fromPlan, debited, started ? new Date() : null]
  )).rows[0].id;
}

const statusOf = async (id) => (await q(`select status from public.appointments where id = $1`, [id])).rows[0].status;
const futureActive = async (cl, plan) =>
  (await q(
    `select count(*)::int n from public.appointments
      where client_id = $1 and combo_plan_id = $2 and consumed_from_plan and start_at > now()
        and status in ('REQUESTED','CONFIRMED','ALT_OFFERED')`,
    [cl, plan]
  )).rows[0].n;
const sub = async (cl) =>
  (await q(
    `select combo_plan_id, saldo_cortes, status, fixed_weekday, fixed_start_min, fixed_barber_id, fixed_service_id
       from public.client_subscriptions where client_id = $1`,
    [cl]
  )).rows[0];

const DAY = 24 * 60 * 60 * 1000;
const inDays = (d) => new Date(Date.now() + d * DAY);

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`ok - ${name}`);
  } catch (e) {
    console.error(`FALHOU - ${name}`);
    throw e;
  }
}

// ---------- testes ----------

await test("reprodução: plano fixo cria as reservas futuras do plano", async () => {
  const s = await shop("repro");
  const cl = await client(s.t, "Cliente Repro Teste");
  const uid = await admin(s.t, "repro");
  await activateFixed(uid, cl, s.fixedA, 2, 600, s.barber);
  assert.equal(await futureActive(cl, s.fixedA), 4);
});

await test("fixo → combo: reservas futuras do fixo canceladas, campos fixos limpos, combo ativo com saldo", async () => {
  const s = await shop("fc");
  const cl = await client(s.t, "Cliente Fixo Combo Teste");
  const uid = await admin(s.t, "fc");
  await activateFixed(uid, cl, s.fixedA, 3, 540, s.barber);
  assert.equal(await futureActive(cl, s.fixedA), 4);
  await assignCombo(uid, cl, s.combo);
  assert.equal(await futureActive(cl, s.fixedA), 0);
  assert.deepEqual(await sub(cl), {
    combo_plan_id: s.combo, saldo_cortes: 5, status: "ACTIVE",
    fixed_weekday: null, fixed_start_min: null, fixed_barber_id: null, fixed_service_id: null,
  });
  // O horário do barbeiro fica livre: nenhuma reserva ativa dele no slot do plano.
  const { rows } = await q(
    `select count(*)::int n from public.appointments where barber_id = $1 and start_at > now() and status in ('REQUESTED','CONFIRMED','ALT_OFFERED')`,
    [s.barber]
  );
  assert.equal(rows[0].n, 0);
});

await test("fixo → combo: passadas, atendidas, debitadas, em atendimento e avulsas não mudam", async () => {
  const s = await shop("keep");
  const cl = await client(s.t, "Cliente Mantem Teste");
  const uid = await admin(s.t, "keep");
  await activateFixed(uid, cl, s.fixedA, 4, 600, s.barber);
  const keep = {
    passada: await appt(s, cl, { plan: s.fixedA, fromPlan: true, at: inDays(-7), status: "CONFIRMED" }),
    atendida: await appt(s, cl, { plan: s.fixedA, fromPlan: true, at: inDays(-14), status: "DONE" }),
    debitada: await appt(s, cl, { plan: s.fixedA, fromPlan: true, at: inDays(40), status: "CANCELLED", debited: true }),
    emAtendimento: await appt(s, cl, { plan: s.fixedA, fromPlan: true, at: new Date(Date.now() + 60 * 1000), status: "CONFIRMED", started: true }),
    avulsa: await appt(s, cl, { at: inDays(3), status: "CONFIRMED" }),
  };
  const before = Object.fromEntries(await Promise.all(Object.entries(keep).map(async ([k, id]) => [k, await statusOf(id)])));
  const debitedBefore = (await q(`select plan_debited from public.appointments where id = $1`, [keep.debitada])).rows[0].plan_debited;
  await assignCombo(uid, cl, s.combo);
  for (const [k, id] of Object.entries(keep)) assert.equal(await statusOf(id), before[k], k);
  assert.equal((await q(`select plan_debited from public.appointments where id = $1`, [keep.debitada])).rows[0].plan_debited, debitedBefore);
});

await test("fixo → combo: reservas de outro cliente (mesmo plano) e de outra barbearia não mudam", async () => {
  const s = await shop("iso-a");
  const o = await shop("iso-b");
  const cl = await client(s.t, "Cliente Troca Teste");
  const other = await client(s.t, "Outro Cliente Teste");
  const clB = await client(o.t, "Cliente Barbearia B Teste");
  const uid = await admin(s.t, "iso-a");
  const uidB = await admin(o.t, "iso-b");
  await activateFixed(uid, cl, s.fixedA, 1, 600, s.barber);
  await activateFixed(uid, other, s.fixedA, 1, 660, s.barber);
  await activateFixed(uidB, clB, o.fixedA, 1, 600, o.barber);
  await assignCombo(uid, cl, s.combo);
  assert.equal(await futureActive(cl, s.fixedA), 0);
  assert.equal(await futureActive(other, s.fixedA), 4);
  assert.equal(await futureActive(clB, o.fixedA), 4);
});

await test("fixo A → fixo B: reservas do A canceladas, só as do B existem", async () => {
  const s = await shop("ff");
  const cl = await client(s.t, "Cliente Fixo Fixo Teste");
  const uid = await admin(s.t, "ff");
  await activateFixed(uid, cl, s.fixedA, 2, 600, s.barber);
  await activateFixed(uid, cl, s.fixedB, 5, 720, s.barber2);
  assert.equal(await futureActive(cl, s.fixedA), 0);
  assert.equal(await futureActive(cl, s.fixedB), 2);
  const st = await sub(cl);
  assert.equal(st.combo_plan_id, s.fixedB);
  assert.equal(st.fixed_weekday, 5);
});

await test("fixo A → fixo B pelo assign_combo (pedido de troca): A cancelado e B sem horário herdado", async () => {
  const s = await shop("ffa");
  const cl = await client(s.t, "Cliente Pedido Troca Teste");
  const uid = await admin(s.t, "ffa");
  await activateFixed(uid, cl, s.fixedA, 2, 600, s.barber);
  await assignCombo(uid, cl, s.fixedB);
  assert.equal(await futureActive(cl, s.fixedA), 0);
  const st = await sub(cl);
  assert.equal(st.combo_plan_id, s.fixedB);
  assert.deepEqual([st.fixed_weekday, st.fixed_start_min, st.fixed_barber_id, st.fixed_service_id], [null, null, null, null]);
  // Sem horário, ensure_fixed_reservations (chamado pelo app do cliente) não cria nada.
  await asUser(uid, `select public.ensure_fixed_reservations($1)`, [cl]);
  assert.equal(await futureActive(cl, s.fixedB), 0);
});

await test("mesmo plano fixo pelo assign_combo: nada cancelado, horário mantido", async () => {
  const s = await shop("fsame");
  const cl = await client(s.t, "Cliente Renova Teste");
  const uid = await admin(s.t, "fsame");
  await activateFixed(uid, cl, s.fixedA, 2, 600, s.barber);
  await assignCombo(uid, cl, s.fixedA);
  assert.equal(await futureActive(cl, s.fixedA), 4);
  assert.equal((await sub(cl)).fixed_weekday, 2);
});

await test("mesmo plano fixo em outro horário: reservas do horário antigo canceladas, novas no horário novo", async () => {
  const s = await shop("slot");
  const cl = await client(s.t, "Cliente Horario Teste");
  const uid = await admin(s.t, "slot");
  await activateFixed(uid, cl, s.fixedA, 2, 600, s.barber);
  await activateFixed(uid, cl, s.fixedA, 4, 900, s.barber2);
  const { rows } = await q(
    `select barber_id, extract(dow from start_at at time zone 'America/Sao_Paulo')::int dow
       from public.appointments where client_id = $1 and combo_plan_id = $2 and consumed_from_plan
        and start_at > now() and status in ('REQUESTED','CONFIRMED','ALT_OFFERED')`,
    [cl, s.fixedA]
  );
  assert.equal(rows.length, 4);
  assert.ok(rows.every((r) => r.barber_id === s.barber2 && r.dow === 4), JSON.stringify(rows));
});

await test("mesmo plano e mesmo horário salvo de novo: nada é cancelado", async () => {
  const s = await shop("same");
  const cl = await client(s.t, "Cliente Mesmo Teste");
  const uid = await admin(s.t, "same");
  await activateFixed(uid, cl, s.fixedA, 2, 600, s.barber);
  const ids = (await q(`select id from public.appointments where client_id = $1 and status = 'CONFIRMED' order by start_at`, [cl])).rows.map((r) => r.id);
  await activateFixed(uid, cl, s.fixedA, 2, 600, s.barber);
  const after = (await q(`select id from public.appointments where client_id = $1 and status = 'CONFIRMED' order by start_at`, [cl])).rows.map((r) => r.id);
  assert.deepEqual(after, ids);
});

await test("combo → fixo: reservas do combo (flexível) não são canceladas", async () => {
  const s = await shop("cf");
  const cl = await client(s.t, "Cliente Combo Fixo Teste");
  const uid = await admin(s.t, "cf");
  await assignCombo(uid, cl, s.combo);
  const flex = await appt(s, cl, { plan: s.combo, fromPlan: true, at: inDays(2) });
  await activateFixed(uid, cl, s.fixedA, 3, 600, s.barber);
  assert.equal(await statusOf(flex), "CONFIRMED");
});

await test("combo → combo continua igual (nada cancelado, campos fixos vazios)", async () => {
  const s = await shop("cc");
  const cl = await client(s.t, "Cliente Combo Combo Teste");
  const uid = await admin(s.t, "cc");
  await assignCombo(uid, cl, s.combo);
  const flex = await appt(s, cl, { plan: s.combo, fromPlan: true, at: inDays(2) });
  await assignCombo(uid, cl, s.combo);
  assert.equal(await statusOf(flex), "CONFIRMED");
  assert.equal((await sub(cl)).saldo_cortes, 5);
});

await test("falha no meio da troca: nada muda (reservas e assinatura como estavam)", async () => {
  const s = await shop("atom");
  const cl = await client(s.t, "Cliente Atomico Teste");
  const uid = await admin(s.t, "atom");
  await activateFixed(uid, cl, s.fixedA, 2, 600, s.barber);
  // Gatilho temporário que falha no UPDATE da assinatura, DEPOIS do cancelamento.
  // Criado dentro da transação do teste: o rollback o desfaz junto.
  const before = `
    create function pg_temp.qq_fail() returns trigger language plpgsql as $$ begin raise exception 'falha de teste'; end $$;
    create trigger qq_fail before update on public.client_subscriptions for each row execute function pg_temp.qq_fail();`;
  await assert.rejects(asUser(uid, `select public.assign_combo($1, $2)`, [cl, s.combo], { before }), /falha de teste/);
  assert.equal(await futureActive(cl, s.fixedA), 4);
  assert.equal((await sub(cl)).combo_plan_id, s.fixedA);
  const { rows } = await q(`select count(*)::int n from pg_trigger where tgname = 'qq_fail'`);
  assert.equal(rows[0].n, 0);
});

await test("admin de outra barbearia: recusado e nenhuma reserva muda", async () => {
  const s = await shop("x-a");
  const o = await shop("x-b");
  const cl = await client(s.t, "Cliente Alvo Teste");
  const uid = await admin(s.t, "x-a");
  const intruder = await admin(o.t, "x-b");
  await activateFixed(uid, cl, s.fixedA, 2, 600, s.barber);
  await assert.rejects(assignCombo(intruder, cl, o.combo), /forbidden/);
  await assert.rejects(assignCombo(intruder, cl, s.combo), /forbidden/);
  await assert.rejects(activateFixed(intruder, cl, s.fixedB, 1, 600, s.barber), /forbidden/);
  assert.equal(await futureActive(cl, s.fixedA), 4);
});

await test("plano de outra barbearia: recusado e nada muda", async () => {
  const s = await shop("p-a");
  const o = await shop("p-b");
  const cl = await client(s.t, "Cliente Plano Alheio Teste");
  const uid = await admin(s.t, "p-a");
  await activateFixed(uid, cl, s.fixedA, 2, 600, s.barber);
  await assert.rejects(assignCombo(uid, cl, o.combo), /combo inválido/);
  await assert.rejects(activateFixed(uid, cl, o.fixedB, 1, 600, s.barber), /combo inválido/);
  assert.equal(await futureActive(cl, s.fixedA), 4);
});

await test("cliente sem assinatura: assign_combo cria como antes", async () => {
  const s = await shop("new");
  const cl = await client(s.t, "Cliente Novo Teste");
  const uid = await admin(s.t, "new");
  await assignCombo(uid, cl, s.combo);
  assert.equal((await sub(cl)).saldo_cortes, 5);
});

const cancelPlan = (uid, cl) => asUser(uid, `select public.cancel_client_plan($1) n`, [cl]);

await test("aprovar cancelamento de plano fixo: plano cancelado e reservas futuras do plano canceladas", async () => {
  const s = await shop("cancel");
  const cl = await client(s.t, "Cliente Cancela Teste");
  const uid = await admin(s.t, "cancel");
  await activateFixed(uid, cl, s.fixedA, 2, 600, s.barber);
  const r = await cancelPlan(uid, cl);
  assert.equal(r.rows[0].n, 4);
  assert.equal(await futureActive(cl, s.fixedA), 0);
  assert.equal((await sub(cl)).status, "CANCELLED");
});

await test("aprovar cancelamento: passadas, atendidas, debitadas, em atendimento, avulsas, outro cliente e outra barbearia não mudam", async () => {
  const s = await shop("cancel-keep");
  const o = await shop("cancel-other");
  const cl = await client(s.t, "Cliente Cancela Mantem Teste");
  const other = await client(s.t, "Outro Cliente Cancela Teste");
  const clB = await client(o.t, "Cliente B Cancela Teste");
  const uid = await admin(s.t, "cancel-keep");
  const uidB = await admin(o.t, "cancel-other");
  await activateFixed(uid, cl, s.fixedA, 4, 600, s.barber);
  await activateFixed(uid, other, s.fixedA, 4, 660, s.barber);
  await activateFixed(uidB, clB, o.fixedA, 4, 600, o.barber);
  const keep = {
    passada: await appt(s, cl, { plan: s.fixedA, fromPlan: true, at: inDays(-7) }),
    atendida: await appt(s, cl, { plan: s.fixedA, fromPlan: true, at: inDays(-14), status: "DONE" }),
    debitada: await appt(s, cl, { plan: s.fixedA, fromPlan: true, at: inDays(40), status: "CANCELLED", debited: true }),
    emAtendimento: await appt(s, cl, { plan: s.fixedA, fromPlan: true, at: new Date(Date.now() + 60 * 1000), started: true }),
    avulsa: await appt(s, cl, { at: inDays(3) }),
  };
  const before = Object.fromEntries(await Promise.all(Object.entries(keep).map(async ([k, id]) => [k, await statusOf(id)])));
  await cancelPlan(uid, cl);
  for (const [k, id] of Object.entries(keep)) assert.equal(await statusOf(id), before[k], k);
  assert.equal(await futureActive(other, s.fixedA), 4);
  assert.equal(await futureActive(clB, o.fixedA), 4);
});

await test("aprovar cancelamento de combo (flexível): plano cancelado, reservas não mudam", async () => {
  const s = await shop("cancel-flex");
  const cl = await client(s.t, "Cliente Cancela Combo Teste");
  const uid = await admin(s.t, "cancel-flex");
  await assignCombo(uid, cl, s.combo);
  const flex = await appt(s, cl, { plan: s.combo, fromPlan: true, at: inDays(2) });
  const r = await cancelPlan(uid, cl);
  assert.equal(r.rows[0].n, 0);
  assert.equal((await sub(cl)).status, "CANCELLED");
  assert.equal(await statusOf(flex), "CONFIRMED");
});

await test("aprovar cancelamento sem plano ativo: nada muda", async () => {
  const s = await shop("cancel-none");
  const cl = await client(s.t, "Cliente Sem Plano Teste");
  const uid = await admin(s.t, "cancel-none");
  assert.equal((await cancelPlan(uid, cl)).rows[0].n, 0);
  assert.equal(await sub(cl), undefined);
});

await test("cancelamento por admin de outra barbearia: recusado e nada muda", async () => {
  const s = await shop("cancel-x-a");
  const o = await shop("cancel-x-b");
  const cl = await client(s.t, "Cliente Alvo Cancela Teste");
  const uid = await admin(s.t, "cancel-x-a");
  const intruder = await admin(o.t, "cancel-x-b");
  await activateFixed(uid, cl, s.fixedA, 2, 600, s.barber);
  await assert.rejects(cancelPlan(intruder, cl), /forbidden/);
  assert.equal(await futureActive(cl, s.fixedA), 4);
  assert.equal((await sub(cl)).status, "ACTIVE");
});

await test("cancelamento: visitante não executa a função", async () => {
  const { rows } = await q(`select has_function_privilege('anon', 'public.cancel_client_plan(uuid)', 'execute') ok`);
  assert.equal(rows[0].ok, false);
});

const cancelFuture = (uid, cl) => asUser(uid, `select public.cancel_future_plan_appointments($1) n`, [cl]);

await test("cancel_future_plan_appointments (regra única): mesmo alcance de antes, todas as reservas futuras de plano do cliente", async () => {
  const s = await shop("cfpa");
  const cl = await client(s.t, "Cliente Cancela Futuras Teste");
  const uid = await admin(s.t, "cfpa");
  await activateFixed(uid, cl, s.fixedA, 2, 600, s.barber);
  const flexAntiga = await appt(s, cl, { plan: s.combo, fromPlan: true, at: inDays(5) });
  const r = await cancelFuture(uid, cl);
  assert.equal(r.rows[0].n, 5);
  assert.equal(await futureActive(cl, s.fixedA), 0);
  assert.equal(await statusOf(flexAntiga), "CANCELLED");
});

await test("cancel_future_plan_appointments: passadas, atendidas, debitadas, em atendimento, avulsas, outro cliente e outra barbearia não mudam", async () => {
  const s = await shop("cfpa-keep");
  const o = await shop("cfpa-other");
  const cl = await client(s.t, "Cliente Futuras Mantem Teste");
  const other = await client(s.t, "Outro Futuras Teste");
  const clB = await client(o.t, "Cliente B Futuras Teste");
  const uid = await admin(s.t, "cfpa-keep");
  const uidB = await admin(o.t, "cfpa-other");
  await activateFixed(uid, other, s.fixedA, 4, 660, s.barber);
  await activateFixed(uidB, clB, o.fixedA, 4, 600, o.barber);
  const keep = {
    passada: await appt(s, cl, { plan: s.fixedA, fromPlan: true, at: inDays(-7) }),
    atendida: await appt(s, cl, { plan: s.fixedA, fromPlan: true, at: inDays(-14), status: "DONE" }),
    debitada: await appt(s, cl, { plan: s.fixedA, fromPlan: true, at: inDays(40), status: "CANCELLED", debited: true }),
    emAtendimento: await appt(s, cl, { plan: s.fixedA, fromPlan: true, at: new Date(Date.now() + 60 * 1000), started: true }),
    avulsa: await appt(s, cl, { at: inDays(3) }),
  };
  const before = Object.fromEntries(await Promise.all(Object.entries(keep).map(async ([k, id]) => [k, await statusOf(id)])));
  await cancelFuture(uid, cl);
  for (const [k, id] of Object.entries(keep)) assert.equal(await statusOf(id), before[k], k);
  assert.equal(await futureActive(other, s.fixedA), 4);
  assert.equal(await futureActive(clB, o.fixedA), 4);
});

await test("cancel_future_plan_appointments: admin de outra barbearia continua recusado", async () => {
  const s = await shop("cfpa-x-a");
  const o = await shop("cfpa-x-b");
  const cl = await client(s.t, "Cliente Alvo Futuras Teste");
  const uid = await admin(s.t, "cfpa-x-a");
  const intruder = await admin(o.t, "cfpa-x-b");
  await activateFixed(uid, cl, s.fixedA, 2, 600, s.barber);
  await assert.rejects(cancelFuture(intruder, cl), /forbidden/);
  assert.equal(await futureActive(cl, s.fixedA), 4);
});

await test("o helper interno não é executável por nenhum papel do app", async () => {
  for (const role of ["anon", "authenticated", "service_role"]) {
    const { rows } = await q(
      `select has_function_privilege($1, 'public._cancel_future_plan_reservations(uuid, uuid, uuid)', 'execute') ok`,
      [role]
    );
    assert.equal(rows[0].ok, false, role);
  }
});

await pool.end();
console.log(`\n${passed} testes de banco ok`);
