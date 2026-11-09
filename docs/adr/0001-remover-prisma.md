# 0001 — Remover o Prisma: supabase-js como única camada de dados

- Status: Aceito (CTO, 2026-11-07)
- Item do roadmap: 6
- Autor: Alicerce (Tech Lead)

## Contexto
Todo acesso a dados em runtime usa supabase-js com RLS. `src/lib/prisma.ts` e `src/lib/db/scoped.ts`
não são importados por nenhum arquivo em `src/` (o próprio `scoped.ts` diz "NOT IN USE"). Mesmo assim,
`build` e `postinstall` rodam `prisma generate`, e existem os scripts `prisma:migrate`/`prisma:studio`.
O `prisma/schema.prisma` está desatualizado em relação ao banco real, e um `prisma migrate`/`db push`
contra produção seria destrutivo.

## Decisão
Remover `prisma/`, `src/lib/prisma.ts`, `src/lib/db/scoped.ts`, as dependências `prisma` e `@prisma/client`
e os scripts `prisma:*`. `build` passa a ser só `next build`; sai o `postinstall`.
Tipos do banco passam a vir de `supabase gen types typescript` (fonte única: o schema do Supabase).

## Consequências
- Build e install mais rápidos; some o risco de alguém rodar migração do Prisma em produção.
- Nada muda em runtime (código não usado).
- Sequência: só depois do item 12 (CI com lint + build) estar no main, para o CI provar que o build segue verde.
- Dono: Engrenagem. Um PR pequeno, sem migração.
