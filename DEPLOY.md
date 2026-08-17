# Deploy na Vercel

Repositório: `https://github.com/deviego/barberagencia` · Framework: Next.js 15 (auto-detectado).

## 1. Importar o projeto
1. Acesse **https://vercel.com/new** e importe o repo `deviego/barberagencia`.
2. Framework Preset: **Next.js** (detectado automaticamente).
3. Build Command: `npm run build` (já faz `prisma generate && next build`).
4. Install Command: `npm install` (o `postinstall` roda `prisma generate`).
5. Node.js Version: **20.x** (ou superior).

## 2. Variáveis de ambiente (Project → Settings → Environment Variables)
Marque para **Production, Preview e Development**.

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://tusfxbnnrypjtzqcvpov.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_VVCqaWc3hbofMn4oJBusrg_Apdc0aAW` |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_...` (painel Supabase → API Keys) — necessário só p/ webhooks/jobs |
| `DATABASE_URL` | connection string do **Transaction Pooler** (porta 6543) — ver nota abaixo |
| `DIRECT_URL` | connection string do **Session Pooler** (porta 5432) — para migrations |
| `NEXT_PUBLIC_APP_DOMAIN` | `barber.app` (ou o domínio base dos subdomínios de tenant) |
| `NEXT_PUBLIC_MASTER_HOST` | `admin.barber.app` (host do painel da plataforma) |
| `WA_SERVICE_URL` | URL pública do **gateway de WhatsApp** (ex.: `https://wa-gateway-production-3785.up.railway.app`) |
| `WA_SERVICE_TOKEN` | segredo compartilhado com o gateway (mesmo valor nos dois lados) |
| `RESEND_API_KEY` | chave do **Resend** (e-mails). Sem ela, e-mails são apenas "pulados" |
| `NOTIFICATIONS_FROM` | remetente verificado no Resend (ex.: `Barber Agência <no-reply@barberagencia.com>`) |

> A `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable) é pública por design — pode ir no bundle.
> Segredos (`SUPABASE_SERVICE_ROLE_KEY`, senha do banco) **nunca** entram no git; só nas env vars da Vercel.

### Nota sobre o banco (importante para serverless)
Em ambiente serverless (Vercel), **use o Pooler do Supabase**, não a conexão direta
(`db.<ref>.supabase.co`), que é IPv6-only e estoura o limite de conexões:
- `DATABASE_URL` → **Transaction Pooler**, porta **6543**, sufixo `?pgbouncer=true`
- `DIRECT_URL` → **Session Pooler**, porta **5432** (usado só nas migrations)

Formato (pegar a região no painel Supabase → **Connect**):
```
DATABASE_URL="postgresql://postgres.tusfxbnnrypjtzqcvpov:SENHA@aws-0-<REGIÃO>.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.tusfxbnnrypjtzqcvpov:SENHA@aws-0-<REGIÃO>.pooler.supabase.com:5432/postgres"
```

> O runtime usa **supabase-js (HTTPS/RLS)** — o `DATABASE_URL`/`DIRECT_URL` (Prisma) são usados
> apenas para migrations/tipos. Para o app funcionar, basta o Supabase com as tabelas criadas (ver 3b).

## 3. Migrations (rodar localmente, uma vez que o pooler esteja configurado)
```bash
# com DATABASE_URL/DIRECT_URL apontando para o pooler:
npx prisma migrate deploy    # aplica migrations em produção
# ou, na primeira vez:
npx prisma migrate dev --name init
```

## 3b. Banco funcional (SQL — sem depender do pooler)
O runtime usa **supabase-js (HTTPS/RLS)**, então não precisa do pooler para funcionar. Basta criar as tabelas:
1. Supabase → **SQL Editor** → **New query**.
2. Cole e rode **`supabase/schema.sql`** (tabelas + RLS + trigger de onboarding + RPC).
3. Cole e rode **`supabase/seed.sql`** (tenant "Barbearia Oliveira 01" + serviços/combos/barbeiros).
4. Rode **em ordem** as demais migrações `supabase/schema-*.sql` — elas adicionam recursos ao longo do tempo:
   - `schema-2..13` / `schema-*.sql` (RPCs de convite/agenda, comanda `appointment_items`, planos de horário fixo, Storage `avatars`, etc.);
   - `schema-14` (contratos), `schema-15` (entitlements + limite de barbeiros), `schema-16` (fila), `schema-17` (foto de produto + bucket `products`), `schema-18` (serviço no plano fixo), `schema-19`/`schema-20` (fila modo Totem + padrão App).
   > O script local `dbadmin.mjs` também aplica um arquivo `.sql` inteiro (`node dbadmin.mjs supabase/schema-XX.sql`).
5. Em **Authentication → Providers → Email**: para testar sem confirmar e-mail, desative "Confirm email" (ou confirme pelo link).

### Criar um assinante de teste (saldo de cortes)
Após um usuário se cadastrar (o trigger cria profile+client+membership CLIENT), rode no SQL Editor:
```sql
insert into public.client_subscriptions (tenant_id, client_id, combo_plan_id, saldo_cortes)
select c.tenant_id, c.id, cp.id, cp.cuts
from public.clients c
join public.combo_plans cp on cp.tenant_id = c.tenant_id and cp.name = 'Combo Mensal 02'
where c.email = 'SEU-EMAIL@exemplo.com';
```

### Promover um usuário a admin da unidade (para acessar /admin)
```sql
update public.memberships set role = 'UNIT_ADMIN'
where user_id = (select id from auth.users where email = 'ADMIN@exemplo.com');
```
(Use `'MASTER'` para acessar `/master` e `'NETWORK_ADMIN'` para `/rede`.)

## 4. Domínios (white-label)
- Domínio da plataforma (master) → `NEXT_PUBLIC_MASTER_HOST`.
- Cada barbearia = subdomínio `*.barber.app` (wildcard) ou domínio próprio (plano Advanced).
- Configurar o wildcard `*.barber.app` em Vercel → Domains quando o domínio estiver pronto.

## 5. Gateway de WhatsApp (serviço separado, sempre ligado)
O envio de WhatsApp é feito por um serviço Node à parte (**`wa-gateway/`**, Baileys) que precisa
ficar **sempre online** (socket persistente). Ele **não** roda na Vercel.

- **Onde hospedar:** Railway (guia em `wa-gateway/DEPLOY-RAILWAY.md`) — recomendado; ou Oracle Cloud
  Always Free (`wa-gateway/DEPLOY-ORACLE.md`); ou Render Starter. **Planos grátis que hibernam/suspendem
  não servem** para produção.
- **Variáveis do gateway:** `WA_SERVICE_TOKEN` (igual ao do app), `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `PORT` (injetado pelo host). Root Directory = `wa-gateway`.
- **Ligar ao app:** setar `WA_SERVICE_URL` (URL pública do gateway) e `WA_SERVICE_TOKEN` na Vercel e **redeploy**.
- **Conectar cada barbearia:** admin → Configurações → WhatsApp → **Conectar** (lê o QR). As sessões
  ficam no Supabase (`wa_sessions`) e **re-hidratam** sozinhas após restart.
