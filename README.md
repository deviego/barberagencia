# Barbearia — Plataforma White-Label (SaaS Multi-tenant)

Sistema de agendamento e fidelização por assinatura para barbearias. White-label e
multi-tenant: uma plataforma serve N barbearias, cada uma com domínio, tema e planos
próprios. 4 perfis: **Cliente**, **Admin da Unidade**, **Rede/Franquia**, **Admin Master**.

## Stack
- **Next.js 15** (App Router, TS strict) — front + server actions (runtime usa **supabase-js**, sob RLS)
- **Tailwind** com tokens `--bb-*` (white-label por CSS variables) + primitivas próprias em `components/ui`
- **Supabase** (Postgres + Auth + RLS + Storage) · **Prisma** só para schema/tipos/migrations
- **Resend** (e-mails) · **Gateway de WhatsApp** próprio (Baileys) hospedado à parte — ver `wa-gateway/`
- **Cobrança manual** (sem gateway de pagamento online no app; pagamento é no local)

## Permissionamento (3 camadas)
1. **RBAC** — papéis `CLIENT` / `UNIT_ADMIN` / `NETWORK_ADMIN` / `MASTER` (`src/lib/rbac.ts`)
2. **Entitlements por plano SaaS** — `personal` / `essencial` / `advance`: limites (barbeiros, mensalistas,
   agendamentos/mês, admins) e recursos (marketing, fila, etc.), **trial-aware** (`src/lib/entitlements.ts`,
   `src/lib/plan/effective.ts`)
3. **Regras por combo do cliente** — saldo de cortes, renovação mensal, agendamento-como-solicitação

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
App do **Cliente** e painel do **Admin** completos e persistindo (agendar/comanda, pedidos, planos
flexíveis e **fixos**, clientes, produtos **com foto**, barbeiros, financeiro, marketing, branding).
Recursos avançados no ar: **contratos** (teste 15d → aceite), **limitação por plano** (entitlements +
upgrade), **fila** (App/QR + **totem** + painel TV), **painel Master** (criar/gerir barbearias). WhatsApp
via gateway próprio (`wa-gateway/`, deploy em Railway/Oracle — ver guias). Documentação de uso completa
em `DOCUMENTACAO.md`.

> Detalhes de deploy em `DEPLOY.md` (app na Vercel) e `wa-gateway/DEPLOY-RAILWAY.md` (gateway).
