// Fixtures do teste de isolamento (02-S2/S3). 100% fictícias (@example.test), só em Supabase LOCAL.
// Linhas criadas direto no Postgres local (superusuário, sem RLS); usuários criados no GoTrue local
// para o teste logar com JWT de verdade. Tudo é apagado no fim (cleanup).
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const LOCAL = /^(127\.0\.0\.1|localhost|::1)$/;

export function env() {
  const API_URL = process.env.API_URL ?? "http://127.0.0.1:54321";
  const DB_URL = process.env.DB_URL ?? process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
  const ANON = process.env.ANON_KEY;
  const SERVICE = process.env.SERVICE_ROLE_KEY;
  if (!ANON || !SERVICE) throw new Error("Faltam ANON_KEY/SERVICE_ROLE_KEY (use `supabase status -o env`, chaves do Supabase LOCAL).");
  if (!LOCAL.test(new URL(API_URL).hostname)) throw new Error(`ABORTADO: API ${API_URL} não é local.`);
  if (!LOCAL.test(new URL(DB_URL).hostname)) throw new Error(`ABORTADO: banco ${new URL(DB_URL).hostname} não é local.`);
  return { API_URL, DB_URL, ANON, SERVICE };
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

export async function setup() {
  const { API_URL, DB_URL, ANON, SERVICE } = env();
  const db = new pg.Client({ connectionString: DB_URL });
  await db.connect();
  const admin = createClient(API_URL, SERVICE, opts);
  const run = randomUUID().slice(0, 8);
  const users = [];

  /** insert genérico como postgres (sem RLS), devolve a linha. */
  async function ins(table, row) {
    const cols = Object.keys(row);
    const sql = `insert into public.${table} (${cols.map((c) => `"${c}"`).join(", ")})
                 values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning *`;
    const { rows } = await db.query(sql, cols.map((c) => row[c]));
    return rows[0];
  }

  async function makeUser(label) {
    const email = `${label}-${run}@example.test`;
    const password = `senha-teste-${run}`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    users.push(data.user.id);
    return { id: data.user.id, email, password };
  }

  /** Cliente supabase-js logado (JWT authenticated real). `headers` = headers extras (ex.: x-act-tenant). */
  async function login(user, headers) {
    const c = createClient(API_URL, ANON, { ...opts, global: headers ? { headers } : undefined });
    const { error } = await c.auth.signInWithPassword({ email: user.email, password: user.password });
    if (error) throw error;
    return c;
  }

  const anon = createClient(API_URL, ANON, opts);

  // ---- Tenants: A e B (barbearias), D (distribuidor), M (casa do master) -------------
  const T = {};
  for (const k of ["A", "B"]) {
    T[k] = await ins("tenants", { name: `Barbearia Teste ${k} ${run}`, subdomain: `teste-rls-${k.toLowerCase()}-${run}`, saas_plan: "advance" });
  }
  T.D = await ins("tenants", { name: `Distribuidor Teste ${run}`, subdomain: `teste-rls-d-${run}`, kind: "DISTRIBUTOR", saas_plan: "distribuidor" });
  T.M = await ins("tenants", { name: `Plataforma Teste ${run}`, subdomain: `teste-rls-m-${run}`, saas_plan: "advance" });

  // ---- Usuários ----------------------------------------------------------------------
  const U = {
    ownerA: await makeUser("dono-a"),
    ownerB: await makeUser("dono-b"),
    clientA: await makeUser("cliente-a"), // cliente final da A (tem login)
    master: await makeUser("master"),
    ownerD: await makeUser("dono-d"),
  };
  await ins("memberships", { user_id: U.ownerA.id, tenant_id: T.A.id, role: "UNIT_ADMIN" });
  await ins("memberships", { user_id: U.ownerB.id, tenant_id: T.B.id, role: "UNIT_ADMIN" });
  await ins("memberships", { user_id: U.clientA.id, tenant_id: T.A.id, role: "CLIENT" });
  await ins("memberships", { user_id: U.master.id, tenant_id: T.M.id, role: "MASTER" });
  await ins("memberships", { user_id: U.ownerD.id, tenant_id: T.D.id, role: "UNIT_ADMIN" });

  // ---- Linhas de cada tabela de tenant, para A e para B ------------------------------
  // Em cada barbearia: "outro" = cliente sem login (dono das linhas genéricas);
  // na A existe também o cliente com login (U.clientA), com agendamento e plano próprios.
  const F = { A: {}, B: {} };
  const future = (d) => new Date(Date.now() + d * 86400000).toISOString();
  for (const k of ["A", "B"]) {
    const t = T[k].id;
    const f = F[k];
    f.branding = await ins("branding", { tenant_id: t });
    f.tenant_settings = await ins("tenant_settings", { tenant_id: t });
    f.tenant_contracts = await ins("tenant_contracts", { tenant_id: t });
    f.wa_sessions = await ins("wa_sessions", { tenant_id: t });
    f.barber = await ins("barbers", { tenant_id: t, name: `Barbeiro ${k}` });
    f.working_hours = await ins("working_hours", { barber_id: f.barber.id, weekday: 1, start_min: 540, end_min: 1080 });
    f.service = await ins("services", { tenant_id: t, name: `Corte ${k}`, duration_min: 30, price_brl: 40 });
    f.combo = await ins("combo_plans", { tenant_id: t, name: `Plano ${k}`, cuts: 4, price_brl: 120, service_id: f.service.id });
    f.combo_plan_services = await ins("combo_plan_services", { combo_plan_id: f.combo.id, service_id: f.service.id });
    f.client = await ins("clients", { tenant_id: t, name: `Cliente Fictício ${k}`, email: `cliente-${k.toLowerCase()}-sem-login-${run}@example.test` });
    f.children = await ins("children", { tenant_id: t, client_id: f.client.id, name: `Filho Fictício ${k}` });
    f.client_subscriptions = await ins("client_subscriptions", { tenant_id: t, client_id: f.client.id, combo_plan_id: f.combo.id, saldo_cortes: 4 });
    f.appointment = await ins("appointments", {
      tenant_id: t, client_id: f.client.id, barber_id: f.barber.id, service_id: f.service.id, start_at: future(3), status: "CONFIRMED",
    });
    f.appointment_items = await ins("appointment_items", { appointment_id: f.appointment.id, tenant_id: t, kind: "service", name: `Corte ${k}` });
    f.queue_entries = await ins("queue_entries", { tenant_id: t, client_id: f.client.id, ticket_number: 1 });
    f.product = await ins("products", { tenant_id: t, name: `Pomada ${k}`, price_brl: 30 });
    f.product_reservations = await ins("product_reservations", { tenant_id: t, client_id: f.client.id, product_id: f.product.id });
    f.payments = await ins("payments", { tenant_id: t, method: "PIX", amount_brl: 40 });
    f.sale = await ins("sales", { tenant_id: t, total_brl: 40 });
    f.sale_items = await ins("sale_items", { sale_id: f.sale.id, kind: "service", name: `Corte ${k}`, price_brl: 40 });
    f.financial_entries = await ins("financial_entries", { tenant_id: t, type: "REVENUE", amount_brl: 40 });
    f.schedule_blocks = await ins("schedule_blocks", { tenant_id: t, barber_id: f.barber.id, starts_at: future(5), ends_at: future(5.1) });
    f.client_invites = await ins("client_invites", { tenant_id: t, token: `tok-${k}-${run}-${randomUUID()}`, expires_at: future(7) });
    f.campaigns = await ins("campaigns", { tenant_id: t, name: `Campanha ${k}`, segment: "todos", message: "Mensagem de teste" });
    f.notification_log = await ins("notification_log", { tenant_id: t });
    f.audit_log = await ins("audit_log", { tenant_id: t });
    f.plan_requests = await ins("plan_requests", { tenant_id: t, client_id: f.client.id, type: "CHANGE" });
    f.plan_upgrade_requests = await ins("plan_upgrade_requests", { tenant_id: t });
    f.distributor_customers = await ins("distributor_customers", { tenant_id: t });
    f.partners = await ins("partners", { name: `Parceiro ${k}`, ref_code: `ref-${k}-${run}`, tenant_id: t });
    f.saas_payments = await ins("saas_payments", { tenant_id: t, amount_brl: 129.9 });
  }

  // Cliente com login na A: linhas próprias (para provar que ele vê só as dele).
  F.A.myClient = await ins("clients", { tenant_id: T.A.id, user_id: U.clientA.id, name: "Cliente Com Login A", email: U.clientA.email });
  F.A.myAppointment = await ins("appointments", {
    tenant_id: T.A.id, client_id: F.A.myClient.id, barber_id: F.A.barber.id, service_id: F.A.service.id, start_at: future(4), status: "CONFIRMED",
  });
  F.A.mySubscription = await ins("client_subscriptions", { tenant_id: T.A.id, client_id: F.A.myClient.id, combo_plan_id: F.A.combo.id, saldo_cortes: 2 });

  // ---- Distribuidor D atende A e B: um pedido de cada ----------------------------------
  await ins("distributor_customers", { tenant_id: T.D.id, customer_tenant_id: T.A.id, active: true });
  await ins("distributor_customers", { tenant_id: T.D.id, customer_tenant_id: T.B.id, active: true });
  const productD = await ins("products", { tenant_id: T.D.id, name: "Produto do Distribuidor", price_brl: 10, active: true });
  const orders = {};
  for (const k of ["A", "B"]) {
    orders[k] = await ins("orders", { distributor_id: T.D.id, customer_tenant_id: T[k].id, status: "PLACED", total_brl: 10 });
    orders[`${k}item`] = await ins("order_items", { order_id: orders[k].id, product_id: productD.id, name: "Produto do Distribuidor", price_brl: 10, qty: 1 });
  }

  const sessions = {
    ownerA: await login(U.ownerA),
    ownerB: await login(U.ownerB),
    clientA: await login(U.clientA),
    ownerD: await login(U.ownerD),
    master: await login(U.master),
    masterActingA: await login(U.master, { "x-act-tenant": T.A.id }),
    ownerAFakeActB: await login(U.ownerA, { "x-act-tenant": T.B.id }),
  };

  async function cleanup() {
    try {
      await db.query("delete from public.orders where distributor_id = $1", [T.D.id]);
      await db.query("delete from public.tenants where id = any($1::uuid[])", [Object.values(T).map((t) => t.id)]);
      for (const id of users) await admin.auth.admin.deleteUser(id);
    } finally {
      await db.end();
    }
  }

  return { run, db, admin, anon, T, U, F, orders, productD, sessions, cleanup };
}
