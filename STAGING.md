# Ambiente de teste (staging) na Vercel

Objetivo: testar mudanças numa **URL de preview** com um **banco separado**, sem
tocar nos dados de produção (clientes reais já usam a plataforma).

**Arquitetura escolhida**
- **App**: branch `staging` fixa → a Vercel gera uma URL de preview estável.
- **Banco**: um **projeto Supabase separado** só para staging (dados descartáveis).
- **Fluxo**: `push na staging` → testa no preview → **merge na `main`** (produção).

---

## Passo 1 — Criar o projeto Supabase de staging
1. https://supabase.com → **New project** (ex.: `barberagencia-staging`). Guarde a senha do Postgres.
2. Pegue, em **Project Settings → API**: `Project URL`, `anon key`, `service_role key`.
3. Em **Project Settings → Database → Connection string**, pegue a **Direct** (porta 5432).

## Passo 2 — Replicar o schema no banco de staging
Na raiz do repo, com a conexão **direta** do staging:

```bash
STAGING_DATABASE_URL="postgresql://postgres.<REF>:<SENHA>@<HOST>:5432/postgres" \
  node scripts/bootstrap-staging.mjs
```
O script:
- aplica os `supabase/schema*.sql` na ordem de **`supabase/ci-order.txt`** (ordem em que foram criados),
  em **uma passada**, cada arquivo numa transação, e **para no primeiro erro**;
- confere que o `ci-order.txt` lista exatamente os `schema*.sql` do repositório (arquivo novo fora da lista → recusa);
- recusa rodar se a URL parecer a de produção e **nunca** aplica seeds.

O banco de staging precisa estar **vazio** (projeto recém-criado). Se parar no meio, apague e recrie o projeto
(ou resete o banco) antes de rodar de novo.

Confira o resultado (somente leitura) no SQL Editor do **staging**. O esperado é tudo `true`:
```sql
select pg_get_functiondef('public.auth_tenant_id'::regproc) like '%x-act-tenant%' as act_as,
       has_function_privilege('authenticated', 'public.blocked_ranges(uuid,timestamptz,timestamptz)', 'EXECUTE') as blocked_ranges,
       has_function_privilege('authenticated', 'public.place_order(uuid,jsonb,text)', 'EXECUTE') as place_order,
       has_function_privilege('authenticated', 'public.set_order_status(uuid,text)', 'EXECUTE') as set_order_status,
       (select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r') as rls_em_todas;
```

> Por que não mais "2 passadas": o jeito antigo aplicava sem erro, mas gerava um banco diferente da produção
> (`auth_tenant_id` sem o "Atuar como" do MASTER e `authenticated` sem EXECUTE nessas 3 funções). Detalhes em
> `docs/spikes/2026-11-ci-supabase-efemero.md` (branch `spike/ci-supabase-efemero`).
>
> Alternativa (mirror exato via dump): `pg_dump --schema-only --no-owner --no-privileges --schema=public "<PROD_DIRECT_URL>" > schema.sql` e depois `psql "<STAGING_DIRECT_URL>" -f schema.sql`. É o caminho da ADR 0002 (baseline) e o mais fiel; o dump é feito pelo Diego.

Depois, opcional: crie 1–2 barbearias de teste pelo painel Master do preview.

## Passo 3 — Branch `staging` (já criada)
A branch `staging` já existe no repositório. Toda mudança para testar:
```bash
git checkout staging && git merge main   # ou trabalhe direto na staging
git push origin staging                   # dispara o preview na Vercel
```

## Passo 4 — Configurar a Vercel
No projeto da Vercel (Settings):
1. **Git → Production Branch = `main`** (garante que produção só sai da main).
2. **Environment Variables** — cadastre as variáveis abaixo com **Environment = Preview**
   (e marque, se possível, só a branch `staging`). Assim o preview usa o banco de
   staging e a produção continua com o banco de produção:

| Variável | Valor no Preview (staging) |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do Supabase de **staging** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key de staging |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role de staging |
| `DATABASE_URL` / `DIRECT_URL` | conexões do banco de staging |
| `NEXT_PUBLIC_APP_DOMAIN` / `NEXT_PUBLIC_MASTER_HOST` | pode repetir os de prod (só afeta subdomínio) |
| `WA_SERVICE_URL` | **deixe vazio** no preview (evita mandar WhatsApp real) ou aponte a um gateway de teste |
| `WA_SERVICE_TOKEN` | idem |
| `RESEND_API_KEY` | **vazio** no preview (não dispara e-mail real) — ou uma key de teste |

> Importante: variáveis marcadas só como **Production** não vazam para o Preview, e
> vice-versa. Confira que as chaves do Supabase **de produção** estão marcadas como
> **Production** (não Preview), senão o preview cairia no banco de produção.

## Passo 5 — Testar e promover
1. `git push origin staging` → abra a URL de preview que a Vercel comenta/lista.
2. Valide a mudança no preview (banco de staging, sem risco).
3. Aprovado: `git checkout main && git merge staging && git push` → deploy de produção.

---

## Migrations de banco no fluxo
Quando uma mudança tem `supabase/schema-NN.sql`:
1. Aplique **primeiro no staging**: `node dbadmin.mjs supabase/schema-NN.sql` com o
   `dbadmin` apontando ao banco de staging (edite a URL ou use `STAGING_DATABASE_URL`).
2. Teste no preview.
3. Ao promover para produção, aplique a mesma migration no banco de produção.

## Notas
- **WhatsApp/e-mail**: mantenha desligados no preview para não disparar mensagem real.
  O código já trata env vazio como "sem gateway" (nada é enviado).
- **Custo**: o projeto Supabase de staging cabe no free tier para testes.
- Nunca commite segredos: as chaves vão só nas Environment Variables da Vercel.
