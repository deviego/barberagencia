# 0002 — Migrações versionadas com Supabase CLI

- Status: Aceito (CTO, 2026-11-07) — execução depende do Diego
- Item do roadmap: 7
- Autor: Alicerce (Tech Lead)

## Contexto
`supabase/` tem ~40 arquivos soltos: `schema.sql`, `schema-2` a `schema-31` com buracos (11, 12) e arquivos
sem número (`schema-tenant`, `schema-unit`, `schema-wa`, `schema-fixed-plan`, `schema-children`,
`schema-actas`, `schema-invite-fix`, `schema-tenant-fix`). Não há `config.toml` nem registro do que foi
aplicado em produção; a ordem de aplicação depende da memória de quem aplicou. Isso impede um banco local
ou de staging reproduzível (item 8) e testes automáticos de RLS (item 16).

## Decisão
1. Adotar a Supabase CLI (`supabase init` → `supabase/config.toml`, `supabase/migrations/`).
2. Criar uma migração **baseline** a partir de um dump **somente de schema** da produção
   (`supabase db dump`), feito pelo Diego — em vez de reexecutar os arquivos antigos, que podem divergir do banco real.
3. Marcar a baseline como já aplicada em produção com `supabase migration repair` (registra, não executa SQL). Feito pelo Diego.
4. Mover os arquivos antigos para `supabase/legacy/` (somente leitura, histórico). Seeds ficam em `supabase/seed.sql`, sem dado real.
5. Toda mudança nova: `supabase migration new <nome>`, aditiva, com RLS e revisão da Navalha.

## Consequências
- Banco local/staging reproduzível com `supabase db reset`; CI pode validar migrações.
- Risco único: divergência entre arquivos e produção — a baseline vinda do dump elimina esse risco.
- Agentes nunca rodam nada contra produção; dump e repair são do Diego.
- Convenção `schema-NN-*.sql` nas skills `tech-*` precisa ser atualizada quando isso entrar.
- Dono: Engrenagem, revisão Navalha.
