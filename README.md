# Barbearia — Plataforma White-Label (SaaS Multi-tenant)

Sistema de agendamento e fidelização por assinatura para barbearias. White-label e
multi-tenant: uma plataforma serve N barbearias, cada uma com domínio, tema e planos
próprios. 4 perfis: **Cliente**, **Admin da Unidade**, **Rede/Franquia**, **Admin Master**.

## Stack
- **Next.js 15** (App Router, TS strict) — front + server-side
- **Tailwind + shadcn/ui** com tokens `--bb-*` (white-label por CSS variables)
- **Supabase** (Postgres + Auth + RLS + Storage) · **Prisma** (ORM + migrations)
- **Stripe** (Billing + Connect) · notificações via `NotificationProvider` abstrato
- TanStack Query + Axios · React Hook Form + Zod · Inngest (jobs) · Sentry + PostHog

## Permissionamento (3 camadas)
1. **RBAC** — papéis `CLIENT` / `UNIT_ADMIN` / `NETWORK_ADMIN` / `MASTER` (`src/lib/rbac.ts`)
2. **Entitlements por plano SaaS** — Essencial/Profissional/Advanced (`src/lib/entitlements.ts`, `<Gate>`)
3. **Regras por combo do cliente** — saldo de cortes, renovação dia 05, agendamento-como-solicitação

## Setup
```bash
npm install
cp .env.example .env    # preencher credenciais (Supabase, Stripe...)
npx prisma generate
npx prisma db push      # requer Session Pooler (IPv4) do Supabase
npm run dev
```

## Estrutura
- `src/app` — rotas (route groups por perfil: `(auth) (client) (admin) (network) (master)`)
- `src/features/<domínio>` — módulos (components/hooks/services/schemas/actions)
- `src/components/ui` — primitivas (Button, Input, Card, Badge…)
- `src/lib` — prisma, supabase, tenant, rbac, entitlements, utils
- `src/styles/tokens.css` — design tokens white-label (`--bb-*`)
- `prisma/schema.prisma` — modelo de dados multi-tenant

> Design de referência: `handof/` (handoff hi-fi) e `slides/` — não versionados no bundle.

## Status
**M0 — Fundação** concluído: tokens/tema, tenancy, RBAC + entitlements, Prisma schema, UI base.
Próximo: M1 (componentes + Auth).
