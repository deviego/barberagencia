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

> O M0 ainda **não consulta o banco** (usa tenant de referência), então o deploy sobe e
> funciona mesmo antes de o banco estar conectado. A conexão real passa a ser necessária no M2/M3.

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
4. Em **Authentication → Providers → Email**: para testar sem confirmar e-mail, desative "Confirm email" (ou confirme pelo link).

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
