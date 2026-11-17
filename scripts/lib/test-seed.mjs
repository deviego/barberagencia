// Dados de TESTE (100% fictícios, @example.test) para um banco recém-criado: staging ou Supabase local.
// Módulo único da semeadura, sem dependências: quem chama injeta `q` (SQL) e `ensureUser` (Admin API).
// Assim a mesma lógica serve à primeira carga do staging e ao ambiente local, e é testável sem banco.
//
// Regras:
// - Só INSERT e SELECT. Nenhum delete, update, truncate ou drop. Rodar de novo não duplica nem altera nada.
// - Nenhuma senha aqui: a senha de cada usuário é gerada por quem chama.
// - Todo e-mail termina em @example.test (domínio reservado, não entrega e-mail a ninguém).

export const TENANTS = {
  plataforma: { name: "Barber Agência (Plataforma Teste)", subdomain: "plataforma-teste", contract: "SIGNED" },
  // Fila ligada e modo AMBOS (totem + app): sem isso o totem fica "indisponível" (o padrão do banco é APP).
  barbearia: { name: "Barbearia Teste", subdomain: "barbearia-teste", contract: "SIGNED", extra: { queue_enabled: true }, settings: { queue_mode: "BOTH" } },
  distAtivo: { name: "Distribuidor Ativo Teste", subdomain: "distribuidor-ativo", contract: "SIGNED", extra: { kind: "DISTRIBUTOR", saas_plan: "distribuidor", status: "ACTIVE" } },
  distPendente: { name: "Distribuidor Pendente Teste", subdomain: "distribuidor-pendente", contract: "PENDING", extra: { kind: "DISTRIBUTOR", saas_plan: "distribuidor", status: "ACTIVE" } },
  distSuspenso: { name: "Distribuidor Suspenso Teste", subdomain: "distribuidor-suspenso", contract: "SIGNED", extra: { kind: "DISTRIBUTOR", saas_plan: "distribuidor", status: "SUSPENDED" } },
};

export const USERS = [
  { email: "master@example.test", tenant: "plataforma", role: "MASTER", entra: "/master/login" },
  { email: "dono.barbearia@example.test", tenant: "barbearia", role: "UNIT_ADMIN", entra: "/admin/login" },
  { email: "dist.ativo@example.test", tenant: "distAtivo", role: "UNIT_ADMIN", entra: "/distributor/login" },
  { email: "dist.pendente@example.test", tenant: "distPendente", role: "UNIT_ADMIN", entra: "/distributor/login" },
  { email: "dist.suspenso@example.test", tenant: "distSuspenso", role: "UNIT_ADMIN", entra: "/distributor/login" },
  { email: "cliente@example.test", tenant: "barbearia", role: "CLIENT", entra: "/b/barbearia-teste e depois /client/login" },
];

const PRODUCTS = [
  ["Pomada Modeladora Teste", 35],
  ["Óleo para Barba Teste", 29.9],
];

/**
 * @param {{ q: (sql: string, params?: unknown[]) => Promise<any[]>,
 *           ensureUser: (email: string) => Promise<{ id: string, created: boolean, inCredsFile?: boolean }> }} deps
 *   q devolve as linhas. ensureUser cria o usuário e devolve { id, created: true }; se o e-mail já existia,
 *   devolve { id, created: false, inCredsFile } (inCredsFile = está no arquivo local de credenciais de uma
 *   rodada anterior, isto é, foi criado por este script).
 *
 * Conta que já existia só é reaproveitada com prova de que é nossa: já tem o vínculo esperado (mesma
 * barbearia, mesmo papel) ou está no arquivo de credenciais. Fora disso ABORTA sem gravar vínculo: não se dá
 * papel (muito menos MASTER) a uma conta cuja senha este script não conhece.
 * @returns {Promise<{ tenants: Record<string, string>, users: Record<string, string> }>} ids por chave/e-mail
 */
export async function runSeed({ q, ensureUser }) {
  for (const u of USERS) if (!u.email.endsWith("@example.test")) throw new Error("Usuário de teste fora de @example.test.");

  // Barbearias e distribuidores, com o básico que o painel espera (marca, configurações, contrato).
  const tenants = {};
  for (const [key, t] of Object.entries(TENANTS)) {
    const found = await q("select id from public.tenants where subdomain = $1", [t.subdomain]);
    const isNew = !found[0];
    if (found[0]) {
      tenants[key] = found[0].id;
    } else {
      const row = { name: t.name, subdomain: t.subdomain, saas_plan: "advance", ...t.extra };
      const cols = Object.keys(row);
      const inserted = await q(
        `insert into public.tenants (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
        cols.map((c) => row[c])
      );
      tenants[key] = inserted[0].id;
    }
    const id = tenants[key];
    await q("insert into public.branding (tenant_id) values ($1) on conflict do nothing", [id]);
    // Configurações próprias (ex.: modo da fila) só para tenant criado nesta rodada; tenant que já existia
    // recebe, no máximo, a linha padrão que faltar. Linha existente nunca é alterada.
    const settings = isNew ? { tenant_id: id, ...t.settings } : { tenant_id: id };
    const sCols = Object.keys(settings);
    await q(
      `insert into public.tenant_settings (${sCols.join(", ")}) values (${sCols.map((_, i) => `$${i + 1}`).join(", ")}) on conflict do nothing`,
      sCols.map((c) => settings[c])
    );
    const signed = t.contract === "SIGNED";
    await q(
      `insert into public.tenant_contracts (tenant_id, status, signed_at, signed_name, legal_name, trade_name)
       select $1, $2, $3, $4, 'Empresa Fictícia LTDA', 'Nome Fantasia Fictício'
       where not exists (select 1 from public.tenant_contracts where tenant_id = $1)`,
      [id, t.contract, signed ? new Date() : null, signed ? "Responsável Fictício" : null]
    );
  }

  // Usuários e vínculos.
  const users = {};
  for (const u of USERS) {
    const { id, created, inCredsFile } = await ensureUser(u.email);
    if (!created && !inCredsFile) {
      const has = await q("select 1 from public.memberships where user_id = $1 and tenant_id = $2 and role = $3", [id, tenants[u.tenant], u.role]);
      if (!has.length)
        throw new Error(
          `ABORTADO: ${u.email} já existia e não foi criado por este script (não tem o vínculo ${u.role} esperado ` +
            "nem está no arquivo local de credenciais). Nenhum vínculo foi gravado para essa conta."
        );
    }
    users[u.email] = id;
    await q(
      `insert into public.memberships (user_id, tenant_id, role)
       select $1, $2, $3 where not exists (select 1 from public.memberships where user_id = $1 and tenant_id = $2)`,
      [id, tenants[u.tenant], u.role]
    );
  }

  // Barbearia Teste: 1 barbeiro (seg a sáb, 9h às 18h), 1 serviço e o cliente com login.
  const B = tenants.barbearia;
  if (!(await q("select 1 from public.barbers where tenant_id = $1", [B])).length) {
    const [barber] = await q("insert into public.barbers (tenant_id, name) values ($1, 'Barbeiro Teste') returning id", [B]);
    for (let wd = 1; wd <= 6; wd++)
      await q("insert into public.working_hours (barber_id, weekday, start_min, end_min) values ($1, $2, 540, 1080)", [barber.id, wd]);
  }
  if (!(await q("select 1 from public.services where tenant_id = $1", [B])).length)
    await q("insert into public.services (tenant_id, name, duration_min, price_brl) values ($1, 'Corte Teste', 30, 40)", [B]);
  const cliente = users["cliente@example.test"];
  if (!(await q("select 1 from public.clients where user_id = $1", [cliente])).length)
    await q("insert into public.clients (tenant_id, user_id, name, email) values ($1, $2, 'Cliente Teste', 'cliente@example.test')", [B, cliente]);

  // Distribuidor ativo: 2 produtos e a Barbearia Teste na carteira.
  const DA = tenants.distAtivo;
  if (!(await q("select 1 from public.products where tenant_id = $1", [DA])).length)
    for (const [name, price] of PRODUCTS)
      await q("insert into public.products (tenant_id, name, price_brl, active) values ($1, $2, $3, true)", [DA, name, price]);
  if (!(await q("select 1 from public.distributor_customers where tenant_id = $1 and customer_tenant_id = $2", [DA, B])).length)
    await q(
      `insert into public.distributor_customers (tenant_id, customer_tenant_id, trade_name, contact_name, contact_email, active)
       values ($1, $2, 'Barbearia Teste', 'Dono Teste', 'dono.barbearia@example.test', true)`,
      [DA, B]
    );

  return { tenants, users };
}

/**
 * Guarda antes de semear: o schema tem de existir, e o banco não pode ter barbearia nem usuário que não
 * seja de teste. Protege produção e qualquer banco com dados reais, independentemente da URL.
 * Lança Error com mensagem sem dados pessoais (só contagens).
 */
export async function assertOnlyTestData(q) {
  const [{ ok }] = await q(
    "select (to_regclass('public.tenants') is not null and to_regclass('public.memberships') is not null " +
      "and to_regclass('public.tenant_contracts') is not null and to_regclass('public.distributor_customers') is not null) as ok"
  );
  if (!ok) throw new Error("ABORTADO: o schema não está aplicado neste banco (faltam tabelas). Esta etapa não aplica schema.");
  const subs = Object.values(TENANTS).map((t) => t.subdomain);
  const [{ n: tenants }] = await q("select count(*)::int as n from public.tenants where not (subdomain = any($1))", [subs]);
  if (tenants > 0)
    throw new Error(`ABORTADO: o banco tem ${tenants} barbearia(s) que não são de teste. Só semeio banco sem dados reais.`);
  const [{ n: users }] = await q("select count(*)::int as n from auth.users where email is null or email not like '%@example.test'");
  if (users > 0)
    throw new Error(`ABORTADO: o banco tem ${users} usuário(s) fora de @example.test. Só semeio banco sem dados reais.`);
}
