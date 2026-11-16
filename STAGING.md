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

## Passo 2 — Banco de homologação: estado atual e dados de teste
Projeto de staging: `fscujfbgfbiknhjvfqif`.

### Estado atual (16/11/2026)
- **O schema já está aplicado.** Foram carregados os 39 `supabase/schema*.sql` do commit `08a0c98` da `staging`,
  pela página de Query do Vercel, na ordem de **`supabase/ci-order.txt`** (com a `schema-33` logo depois da
  `schema-31` e a `schema-35` no fim). Resultado: 37 tabelas, 26 funções, 58 policies, RLS ligado.
- **Sem dados:** nenhum usuário, nenhuma barbearia, nenhum seed. Os dados de teste (abaixo) ainda não foram
  inseridos; dependem do OK do Diego.
- O `supabase/ci-order.txt` é o registro da ordem aplicada. Toda `schema-NN` nova entra nele na posição em que
  foi (ou será) aplicada; `seed*.sql` nunca entra.

### Dados de teste (etapa separada; não aplica schema e não exige banco vazio)
Só depois do OK do Diego, e avisando o CTO antes. Nenhum agente lê o snippet copiado.

**Uma vez, antes:** baixe o certificado do Supabase **do projeto de staging**: Project Settings → Database →
**SSL Configuration** → *Download certificate*. Deixe o `prod-ca-2021.crt` em `~/Downloads`
(ou aponte outro caminho com `SUPABASE_CA_CERT`).

1. No Vercel, abra a página do banco de staging e clique em **Copy Snippet**.
2. Logo em seguida, na raiz do repositório:

```bash
bash scripts/staging-test-seed.sh
```

> **Atenção, histórico de área de transferência:** o comando limpa a área de transferência no fim (também em
> erro), mas **não alcança apps de histórico** (Raycast, Maccy, Alfred, Paste) nem o que a Área de Transferência
> Universal já mandou para outro aparelho Apple. Se você usa algum app de histórico, pause-o antes de copiar ou
> apague o item do snippet de lá depois.

O que o comando faz (`scripts/staging-test-seed.mjs`):
- lê a área de transferência **só em memória**: a senha do banco não é gravada em disco, não é impressa, não
  vira argumento de processo (`ps`) e não entra no histórico do shell;
- escolhe, entre as URLs do snippet, a do **pooler de sessão (porta 5432)**, que funciona em rede IPv4. A conexão
  direta (`db.<ref>.supabase.co`, IPv6) nunca é usada;
- **só aceita o projeto de staging**: a ref de staging no usuário do pooler, na URL da API e na chave; a ref de
  produção é recusada em qualquer campo; SSL sempre verificado com o certificado acima;
- **confere o banco antes de inserir**: aborta se o schema não estiver aplicado, se existir alguma barbearia que
  não seja de teste ou algum usuário fora de `@example.test`;
- insere os dados de teste (abaixo) e imprime um resumo sem segredos;
- **só `insert` e `select`**: não tem `drop`, `truncate`, `delete`, `update` nem reset. Rodar de novo insere só o
  que falta e não altera o que já existe (nem as senhas).

**Dados de teste** (`scripts/lib/test-seed.mjs`; tudo fictício, e-mails `@example.test`):

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

**Se der erro:** a mensagem diz se algo foi inserido. Antes da conferência do banco, nada é alterado. Se parar no
meio, o que já entrou fica; copie o snippet de novo e rode o mesmo comando, que completa o que falta.
Não apague nada à mão.

### Conferir o schema (somente leitura)
No SQL Editor do **staging**, o esperado é tudo `true`:
```sql
select pg_get_functiondef('public.auth_tenant_id'::regproc) like '%x-act-tenant%' as act_as,
       has_function_privilege('authenticated', 'public.blocked_ranges(uuid,timestamptz,timestamptz)', 'EXECUTE') as blocked_ranges,
       has_function_privilege('authenticated', 'public.place_order(uuid,jsonb,text)', 'EXECUTE') as place_order,
       has_function_privilege('authenticated', 'public.set_order_status(uuid,text)', 'EXECUTE') as set_order_status,
       (select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r') as rls_em_todas;
```

### Recriar o schema num banco NOVO e vazio (não é o caso do staging atual)
`scripts/bootstrap-staging.mjs` aplica os `schema*.sql` na ordem do `ci-order.txt`, em uma passada, cada arquivo
numa transação, e para no primeiro erro. Usa as mesmas guardas (`scripts/lib/schema-apply.mjs`): allowlist pela
ref de staging, produção recusada, SSL verificado, e **aborta se o `public` já tiver alguma tabela**. Por isso
ele **não roda** no banco de staging de hoje. Recebe o destino por variáveis de ambiente, nunca por argumento:

```bash
export STAGING_PROJECT_REF="<ref do projeto novo>"
export SUPABASE_CA_CERT="$HOME/Downloads/prod-ca-2021.crt"
read -s -p "Senha do Postgres: " PGPASS_STAGING; echo
export STAGING_DATABASE_URL="postgresql://postgres.${STAGING_PROJECT_REF}:${PGPASS_STAGING}@aws-N-<região>.pooler.supabase.com:5432/postgres"
node scripts/bootstrap-staging.mjs
unset PGPASS_STAGING STAGING_DATABASE_URL
```
> Por que uma passada, na ordem: o jeito antigo (2 passadas) aplicava sem erro, mas gerava um banco diferente da
> produção (`auth_tenant_id` sem o "Atuar como" do MASTER e `authenticated` sem EXECUTE em 3 funções). Detalhes em
> `docs/spikes/2026-11-ci-supabase-efemero.md` (branch `spike/ci-supabase-efemero`).

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
