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

## Passo 2 — Primeira carga do banco de staging (só o Diego roda)
Projeto de staging: `fscujfbgfbiknhjvfqif`. Nenhum agente roda este passo nem lê o que foi copiado.

**Uma vez, antes:** baixe o certificado do Supabase **do projeto de staging**: Project Settings → Database →
**SSL Configuration** → *Download certificate*. Deixe o `prod-ca-2021.crt` em `~/Downloads`
(ou aponte outro caminho com `SUPABASE_CA_CERT`).

**A carga, em um comando:**
1. No Vercel, abra a página do banco de staging e clique em **Copy Snippet**.
2. Logo em seguida, na raiz do repositório:

```bash
bash scripts/staging-first-load.sh
```

> **Atenção, histórico de área de transferência:** o comando limpa a área de transferência no fim (também em
> erro), mas **não alcança apps de histórico** (Raycast, Maccy, Alfred, Paste) nem o que a Área de Transferência Universal
> já mandou para outro aparelho Apple. Se você usa algum app de histórico, pause-o antes de copiar ou apague o item do snippet de lá depois.

O que o comando faz (`scripts/staging-first-load.mjs`):
- lê a área de transferência **só em memória**: a senha do banco não é gravada em disco, não é impressa, não
  vira argumento de processo (`ps`) e não entra no histórico do shell;
- escolhe, entre as URLs do snippet, a do **pooler de sessão (porta 5432)**, que funciona em rede IPv4. A conexão
  direta (`db.<ref>.supabase.co`, IPv6) nunca é usada;
- **só aceita o projeto de staging**: a ref de staging no usuário do pooler, na URL da API e na chave; a ref de
  produção é recusada em qualquer campo; SSL sempre verificado com o certificado acima;
- **aborta se o schema `public` já tiver alguma tabela** (só roda em banco vazio);
- aplica os `supabase/schema*.sql` na ordem de **`supabase/ci-order.txt`**, em uma passada, cada arquivo numa
  transação, e para no primeiro erro. O `ci-order.txt` tem de listar exatamente os `schema*.sql` do repositório;
  `seed*.sql` nunca entra;
- cria os **dados de teste** (abaixo) e imprime um resumo sem segredos;
- não tem `drop`, `truncate`, `delete`, `update` nem reset em lugar nenhum.

**Dados de teste criados** (`scripts/lib/test-seed.mjs`; tudo fictício, e-mails `@example.test`):

| E-mail | Papel | Onde | Entra em |
|---|---|---|---|
| `master@example.test` | MASTER | Barber Agência (Plataforma Teste) | `/master/login` |
| `dono.barbearia@example.test` | UNIT_ADMIN | Barbearia Teste (`barbearia-teste`): 1 barbeiro, 1 serviço | `/admin/login` |
| `dist.ativo@example.test` | UNIT_ADMIN | Distribuidor Ativo Teste: contrato assinado, 2 produtos, Barbearia Teste na carteira | `/distributor/login` |
| `dist.pendente@example.test` | UNIT_ADMIN | Distribuidor Pendente Teste: contrato pendente | `/distributor/login` |
| `dist.suspenso@example.test` | UNIT_ADMIN | Distribuidor Suspenso Teste: conta suspensa | `/distributor/login` |
| `cliente@example.test` | CLIENT | Barbearia Teste | `/b/barbearia-teste`, depois `/client/login` |

Os usuários são criados pela Admin API com **senha gerada na hora**, uma por usuário. As senhas ficam só em
`.staging-test-users.json` na raiz do repositório (permissão 600, ignorado pelo git). São credenciais de teste,
não a senha do banco.

**Se der erro:**
- antes de aplicar (snippet errado, certificado ausente, banco não vazio): nada foi alterado; corrija e rode de novo;
- no meio do schema: o comando diz em qual arquivo parou. O banco ficou pela metade e o comando não roda de novo
  nele (exige banco vazio). Não apague nada por conta própria: avise o CTO com o nome do arquivo;
- o schema aplicou e só os dados de teste falharam: copie o snippet de novo e rode
  `bash scripts/staging-first-load.sh --so-dados-de-teste` (só insere o que falta; não altera o que já existe).

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

### Alternativa manual (só o schema, sem dados de teste)
`scripts/bootstrap-staging.mjs` usa as mesmas guardas (`scripts/lib/schema-apply.mjs`) e recebe o destino por
variáveis de ambiente (nunca por argumento). Para a senha não ir para o histórico, digite-a com `read -s`:

```bash
export STAGING_PROJECT_REF="fscujfbgfbiknhjvfqif"
export SUPABASE_CA_CERT="$HOME/Downloads/prod-ca-2021.crt"
read -s -p "Senha do Postgres de staging: " PGPASS_STAGING; echo
export STAGING_DATABASE_URL="postgresql://postgres.${STAGING_PROJECT_REF}:${PGPASS_STAGING}@aws-N-<região>.pooler.supabase.com:5432/postgres"
node scripts/bootstrap-staging.mjs
unset PGPASS_STAGING STAGING_DATABASE_URL
```
> Se a senha tiver caracteres especiais (`@ : / ? #`), use a versão já codificada que o painel mostra na connection string.
>
> Outra alternativa (mirror exato via dump): `pg_dump --schema-only --no-owner --no-privileges --schema=public "<PROD_DIRECT_URL>" > schema.sql` e depois `psql "<STAGING_DIRECT_URL>" -f schema.sql`. É o caminho da ADR 0002 (baseline) e o mais fiel; o dump é feito pelo Diego.

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
