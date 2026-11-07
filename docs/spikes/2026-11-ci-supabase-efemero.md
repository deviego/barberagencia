# Spike: Supabase efêmero no CI + schema do zero + testes de RLS

Data: 2026-11-07 · Autor: Bisturi (Specialist) · Time-box: 1 dia · Desbloqueia: 02-S2, 02-S3, 03-S4
Branch: `spike/ci-supabase-efemero` · Só docker local e runner do GitHub, só dados fictícios. Nada em produção ou staging.

## Resposta: **SIM**, com uma condição
O CI sobe um Supabase efêmero (`supabase start` no `ubuntu-latest`), aplica os 37 `supabase/schema*.sql` do zero
e roda testes de isolamento RLS com JWT `authenticated` de dois tenants fictícios. Estável e rápido.

**Condição:** a lógica atual do `scripts/bootstrap-staging.mjs` (nomeados antes dos numéricos + 2 passadas)
**aplica sem erro, mas gera um banco diferente da produção** (2 divergências abaixo). Para o CI (e para criar o staging)
é preciso trocar por uma **ordem cronológica explícita** (`supabase/ci-order.txt`, 1 passada), ou pela baseline da ADR 0002.

## O que foi medido
| | Resultado |
|---|---|
| `supabase start` (CLI 3.0.0, só db/auth/rest/kong/storage), imagens já baixadas, Mac | 18–41 s |
| Primeira subida com pull de imagens (Mac) | ~45 s até o erro de seed (ver falha 0) |
| Aplicar 37 arquivos | 115–134 ms |
| Teste RLS (10 casos) | 2–4 s |
| Ciclo completo stop → start → apply → test, 5 vezes seguidas | 26 / 41 / 45 / 39 / 31 s, **5/5 verdes, 0 flaky** |
| GitHub Actions `ubuntu-latest` (workflow `rls-spike`, run 42383838813) | **Não rodou**: "The job was not started because your account is locked due to a billing issue." Estimativa para o runner: +1–2 min de pull das imagens → **~2–4 min** por job (cache de imagens docker reduz). Medir de novo quando a conta for destravada. |

O teste **detecta vazamento**: com uma policy `using (true)` injetada em `clients` (só local), 4 dos 10 casos falharam; removida, 10/10.

## Falhas e problemas de ordem encontrados
0. **`supabase/seed.sql` roda automático** no `supabase start`/`db reset` (padrão do CLI) e quebra porque roda antes do schema
   (`relation "public.tenants" does not exist`). Corrigido com `[db.seed] enabled = false` no `config.toml`.
   Atenção: `seed.sql` e `seed-oliveira-catalog.sql` não podem virar seed do CI sem revisão LGPD (nome de barbearia real).
1. **Ordem do bootstrap (2 passadas):** na 1ª passada, 2 arquivos são adiados:
   - `schema-invite-fix.sql` → `relation "public.client_invites" does not exist` (os nomeados rodam antes dos numéricos; a tabela nasce no `schema-2`).
   - `schema-21-security-hardening.sql` → `function public.invite_info(text) does not exist` (depende do invite-fix).
   A 2ª passada aplica os dois. Até aqui, parece ok.
2. **Divergência A — `auth_tenant_id()` perde o "Atuar como" do MASTER.** `schema-actas.sql` (02/08) redefiniu a função
   depois de `schema-tenant-fix.sql` (30/07). O bootstrap ordena os nomeados por ordem alfabética → `tenant-fix` roda por
   último e **sobrescreve** a versão com o header `x-act-tenant`. O banco gerado não tem o recurso que a produção tem.
3. **Divergência B — reaplicar o `schema-21` na 2ª passada revoga permissões dadas depois.** O `schema-21` faz
   `revoke execute on all functions in schema public from public, anon, authenticated`. Na produção ele rodou **antes**
   do 22–31; no bootstrap ele roda **depois** (2ª passada). Resultado no banco gerado: `authenticated` perde `execute` em
   `blocked_ranges` (agenda nova / remarcar), `place_order` e `set_order_status` (pedidos), que o `schema-27`/`schema-28`
   concederam. Testes contra esse banco dariam falso negativo.
4. **Ordem cronológica resolve as duas:** `supabase/ci-order.txt` (data de criação de cada arquivo no git) aplica os 37 em
   **1 passada, 0 erros**, com `x-act-tenant` presente e os grants de 27/28 corretos. Também confirmado: 36 tabelas em
   `public`, **todas com RLS ligada**.
5. Limite conhecido: a ordem cronológica é a melhor reconstrução a partir do repositório, **não prova** que é igual à
   produção (algum arquivo pode ter sido editado/aplicado à mão). Só a baseline da ADR 0002 prova.

## Comparação com a ADR 0002 (baseline do dump de produção)
| | Arquivos + `ci-order.txt` (agora) | Baseline do dump (ADR 0002) |
|---|---|---|
| Disponível | hoje | quando o Diego fizer o dump + `migration repair` |
| Fidelidade à produção | provável, não garantida | garantida (é a produção) |
| CI | `supabase start` + `apply-schema.mjs` | `supabase start` (aplica `supabase/migrations/` sozinho) ou `supabase db reset` |
| Manutenção | novo arquivo precisa entrar no manifesto (o script falha se faltar) | `supabase migration new` |
| Teste de RLS | o mesmo `rls-isolation.test.mjs` | o mesmo, sem mudança |

## Recomendação
1. **Agora (desbloqueia 02-S2/02-S3/03-S4):** CI com Supabase efêmero + `ci-order.txt` + `rls-isolation.test.mjs`.
   O teste de RLS não muda quando a baseline chegar; só troca o passo de "aplicar schema".
2. **Quando o Diego entregar o dump:** gerar a baseline e comparar com o banco do CI (`pg_dump --schema-only` dos dois e `diff`).
   Se bater, ótimo; se não, a diferença é exatamente o drift que a ADR quer eliminar. Depois disso, `apply-schema.mjs` e
   `ci-order.txt` saem, e o CI passa a usar `supabase/migrations/`.
3. **Staging (projeto ainda não existe):** **não** criar com o `bootstrap-staging.mjs` como está (gera as divergências A e B).
   Ordem de preferência: (a) baseline da ADR 0002; (b) se o staging vier antes do dump, o `bootstrap-staging.mjs` passa a
   ler `supabase/ci-order.txt` em 1 passada.
4. Revisão da Navalha no teste de RLS e nos casos a cobrir (ver tarefas).

## Prova mínima (nesta branch)
- `.github/workflows/rls-spike.yml` — roda só na branch do spike. Trecho essencial:
  ```yaml
  - uses: supabase/setup-cli@v1
    with: { version: 3.0.0 }
  - run: supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,mailpit,realtime,postgres-meta
  - run: node scripts/ci/apply-schema.mjs
    env: { SCHEMA_ORDER_FILE: supabase/ci-order.txt, DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres }
  - run: supabase status -o env | sed 's/="/=/; s/"$//' >> "$GITHUB_ENV"
  - run: node --test scripts/ci/rls-isolation.test.mjs
  ```
- `scripts/ci/apply-schema.mjs` — recusa host que não seja local; modo 2 passadas (igual ao bootstrap) e modo manifesto.
- `scripts/ci/rls-isolation.test.mjs` — 2 tenants e 2 donos fictícios (`@example.test`), login real no GoTrue local;
  A não lê, não filtra por id, não insere, não altera, não apaga clientes de B, e não vê `tenants`/`memberships` de B (e vice-versa).
- As chaves usadas são as chaves de demonstração do Supabase local (`supabase status`), não segredos de nenhum projeto.

## Bloqueio externo (Diego)
A conta do GitHub está **bloqueada por cobrança**: nenhum job do Actions inicia. Afeta também o workflow
`Keep WhatsApp gateway awake` em `main` (falhando) e qualquer CI/branch protection com check obrigatório da `release.md`.
Diego: GitHub → Settings → **Billing and plans** → resolver a pendência (forma de pagamento / limite de gasto).

## Tarefas propostas
0. (Diego) Destravar a cobrança do GitHub Actions; depois reexecutar o `rls-spike` para medir o tempo real.
1. (Engrenagem) Promover para o CI de verdade: job `rls` no workflow de PR (`staging` e `main`), reaproveitando os 3 arquivos; tirar o `rls-spike.yml`.
2. (Engrenagem + Navalha) Ampliar o teste: appointments, services, barbers, plans, orders, `notification_log`; papel cliente
   (`owns_client`); MASTER com e sem `x-act-tenant`; RPCs `security definer` chamadas com tenant de outro.
3. (Diego → Engrenagem) Dump de schema da produção → baseline ADR 0002 → diff contra o banco do CI.
4. (Engrenagem) `bootstrap-staging.mjs` ler `ci-order.txt` (1 passada) antes de criar o staging, se o staging vier antes da baseline.
5. (Navalha) Revisar `seed.sql`/`seed-oliveira-catalog.sql` antes de virar seed de CI/staging (dados reais?).
