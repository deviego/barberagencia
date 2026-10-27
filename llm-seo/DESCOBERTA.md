# Fase 1 — Descoberta (LLM SEO/GEO) · barberagencia.com

Data: 27/10/2026 · Branch `llm-seo` (criada a partir de `main` @ 2ac65c1) · Worktree `~/Documents/trabalho/barberagencia-llm-seo`

## 1. Stack (versões instaladas)

| Peça | Versão |
|---|---|
| Next.js (App Router) | 15.5.23 |
| React / React DOM | 19.0.0 |
| TypeScript | 5.9.3 |
| Tailwind CSS | 3.4.19 |
| Supabase JS / SSR | 2.110.7 / 0.5.x |
| Prisma | 6.19.3 |
| Hospedagem | Vercel (`server: Vercel`, região iad1) |
| Domínio | `barberagencia.com` → 308 → `https://www.barberagencia.com`; `barberagencia.vercel.app` → 308 → `.com` |

Fontes self-hosted (`next/font`). CSP restritiva em `next.config.mjs` (sem scripts externos). `/documentacao` é rewrite para `public/documentacao.html` (HTML estático).

## 2. Renderização por rota

- **`src/app/layout.tsx` (root)** é `async` e chama `getCurrentTenant()`, que lê `cookies()` → **todas as rotas são dinâmicas (SSR a cada request)**. Nenhum `generateStaticParams`, `revalidate` ou ISR. Resposta da home: `cache-control: private, no-cache, no-store` e `x-vercel-cache: MISS`.
- **`/` (landing)**: Server Component (`src/app/page.tsx`), conteúdo vem de `src/features/landing/content.ts`. Componentes client: `LandingHeader`, `DeviceShowcase`, `Faq`, `ContactForm`. O texto principal sai no HTML do servidor.
- **`Faq`** é `"use client"` com `useState(0)` e `{isOpen && <p>…}`: **só a 1ª resposta vai no HTML**; as outras 4 só existem depois de clicar (com JS).
- **`/termos`, `/privacidade`**: SSR, grupo `(legal)`, sem metadata própria (herdam a do root).
- **`/documentacao`**: HTML estático em `public/` (manual funcional, ~33 KB). Título "Documentação — Plataforma Barbearia".
- **Áreas logadas** (middleware redireciona sem sessão): `/admin/*`, `/master/*`, `/distributor/*`, `/client/*` (exceto login/cadastro/otp/recuperar), `/rede`.
- **White-label por barbearia**: `/b/[slug]` (route handler que grava cookie e redireciona para o app do cliente), `/b/[slug]/painel` (TV), `/b/[slug]/totem`, `/b/[slug]/fila`, `/convite/[token]`. São páginas de clientes da plataforma, não do marketing — **não devem ser indexadas como Barber Agência**.
- **`/design-system`**: pública no middleware (página interna de componentes).

## 3. O que um crawler sem JS vê hoje (curl com UA GPTBot)

**Home (200, 183 KB, ~7,5 mil caracteres de texto visível):**
- `<title>` "Barber Agência — a barbearia inteira em uma plataforma"; `<meta description>` presente (cita "46% OFF nos 3 primeiros meses").
- H1 "A barbearia inteira em uma plataforma"; 7 H2 (benefícios, antes/depois, app do cliente, 4 passos, planos, FAQ, CTA). Bom: o conteúdo está no HTML, não depende de JS.
- **Sem** `<link rel="canonical">`, **sem** Open Graph/Twitter, **sem** JSON-LD, **sem** `hreflang`/`og:locale`.
- FAQ: aparecem as 5 perguntas, mas **só 1 resposta**.
- Links internos rastreáveis: só `/admin/login`, `/termos`, `/privacidade`, `/documentacao` + WhatsApp. O resto é âncora (`#planos`).
- O texto servido repete **afirmações falsas** (ver §6).

**Arquivos de descoberta:**

| URL | Resposta |
|---|---|
| `/robots.txt` | **307 → `/client/login`** (não existe; o middleware trata como rota protegida) |
| `/sitemap.xml` | **307 → `/client/login`** |
| `/llms.txt` | **307 → `/client/login`** |
| `/termos`, `/privacidade` | 200, mas `<title>` genérico ("Termos de Uso") e description herdada |
| `/documentacao` | 200, HTML estático com title/description próprios |
| `/b/max-estilo` | 307 → `/client/login?erro=barbearia-nao-encontrada` |

Sem robots nem sitemap, os bots (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended) recebem um redirect para tela de login ao pedir o robots — na prática "sem regras", mas também sem mapa do site.

## 4. Problemas mais óbvios (prioridade)

1. **robots.txt / sitemap.xml / llms.txt redirecionam para o login** (middleware não lista esses caminhos como públicos). Corrigir é simples: `src/app/robots.ts`, `src/app/sitemap.ts`, `/llms.txt` + liberar no middleware.
2. **Conteúdo com promessas que não existem** (NF-e, API/webhooks, bot IA, campanhas, SMS, cobrança recorrente no cartão, lembretes, +38%/−72%, "Sem cartão para testar"). IA que cita o site vai repetir isso. É o maior risco de reputação.
3. **Oferta desatualizada no HTML**: site diz "46% OFF nos 3 primeiros meses (Personal)"; a oferta vigente é a promoção de fim de ano (Personal R$ 69,90 e Essencial R$ 89,90 nos **2** primeiros meses). Já existe trabalho em andamento na worktree `barberagencia-oferta-fim-de-ano` (`page.tsx`, `content.ts`) → risco de conflito; coordenar.
4. **Nenhum dado estruturado** (Organization, SoftwareApplication/Product com Offer, FAQPage) e nenhuma canonical/OG.
5. **FAQ esconde 4 de 5 respostas** do HTML (renderização condicional no client).
6. **Uma página só**: tudo na home. Não há páginas que respondam perguntas específicas (fila por QR, mensalidade/clube, migração do AppBarber/Trinks, preço). Sem autor, sem data, sem "quem somos".
7. **Abertura não é answer-first**: H1 é slogan; a frase que diz "o que é, para quem" só aparece na meta description e no rodapé.
8. Metadata do root layout é "Barbearia — Agendamento" (genérica de white-label) e vaza para `/termos` e `/privacidade`.
9. Todo request é SSR sem cache (root layout lê cookies) → TTFB maior para bots; não bloqueia, mas a landing poderia ser estática.
10. `/b/*`, `/convite/*`, `/design-system`, logins: sem `noindex`.

## 5. O negócio (resumo das skills `barber-agencia-base`)

- **O que é:** plataforma white-label (SaaS) para barbearias no Brasil: app do cliente com a marca da barbearia (link, sem baixar nada), painel do dono, **fila por QR/totem/painel na TV** (principal diferencial, Essencial e Advance), agenda com solicitação e confirmação em 10 min, comanda ao vivo, combos/mensalidade com saldo de cortes e plano fixo, financeiro por barbeiro/dia/serviço, relatório mensal em PDF no WhatsApp (dia 21), avisos automáticos pelo WhatsApp da própria barbearia, importação da base de Trinks, Booksy, AppBarber e BestBarbers/Belasis.
- **Para quem:** barbearia de 1 unidade, 3 a 8 profissionais, dono que corta e administra; agenda no caderno/WhatsApp/app genérico.
- **Planos:** Personal (até 3 prof.) R$ 69,90/mês nos 2 primeiros meses, depois R$ 129,90 · Essencial (até 5, com fila) R$ 89,90 nos 2 primeiros meses, depois R$ 189,90 · Advance (até 8, mensalistas ilimitados) a partir de R$ 249,90. Sem adesão, sem setup, setup em 1 dia, cancela quando quiser, migração sem custo, pagamento por PIX.
- **Provas permitidas:** Barbearia Max Estilo (embaixadora), Barbearia Oliveira 01 (em produção), fundador ex-barbeiro (Diego) no suporte humano. **Nenhum número de resultado.**
- **Não existe:** lembrete antes do horário, SMS, pagamento online/cobrança no cartão, bot IA, campanhas, NF-e, venda direta, API/webhooks, rede/franquia, teste grátis.

## 6. Afirmações falsas no site hoje (TODO para o Diego — não repetir em nada novo)

| Onde (content.ts / page.tsx) | Texto | Realidade |
|---|---|---|
| METRICS | "+38% de ocupação", "−72% de faltas com lembretes automáticos" | sem medição; não há lembrete |
| Hero | "Sem cartão para testar" | não há teste grátis |
| Benefícios / antes-depois | "cobrança recorrente no cartão", "renovação automática" | cobrança manual por PIX |
| Benefícios | campanhas WhatsApp/e-mail, recuperação de cadastros, integração redes sociais, bot IA | não existem |
| App do cliente | "Lembretes WhatsApp, SMS e e-mail", "Pagamento PIX, cartão" (online) | sem lembrete/SMS; pagamento no local |
| Planos / PLAN_TABLE | NF-e, venda direta, API/webhooks, SMS, bot IA | não existem |
| Hero/CTA/FAQ | "46% OFF nos 3 primeiros meses" | oferta vigente: 2 primeiros meses, Personal e Essencial |
| Implantação | "Importe a base… plataforma envia o convite" | importação é feita pela equipe no Master |

## 7. As 20 perguntas (dono de barbearia → IA) em que o site deveria ser a resposta

1. Qual o melhor sistema de agendamento para barbearia no Brasil?
2. Existe app de barbearia com a marca da minha barbearia (white-label)?
3. Como colocar fila por ordem de chegada com QR code e senha na TV na minha barbearia?
4. Tem sistema de barbearia com totem de senha para o cliente se atender sozinho?
5. Qual sistema para barbearia controla mensalidade / clube do corte com saldo de cortes?
6. Como diminuir faltas de cliente na barbearia sem ficar respondendo WhatsApp o dia todo?
7. Quanto custa um sistema para barbearia com 3 a 5 barbeiros?
8. Sistema para barbearia sem taxa de adesão e sem fidelidade existe?
9. Qual alternativa ao AppBarber (ou Trinks, Booksy, BestBarbers) para barbearia pequena?
10. Como migrar meus clientes do AppBarber/Trinks para outro sistema sem recadastrar?
11. Como calcular e controlar a comissão dos barbeiros automaticamente?
12. Qual app de barbearia manda mensagem automática pelo WhatsApp da própria barbearia?
13. Meu cliente precisa baixar aplicativo para agendar na barbearia?
14. Como organizar a agenda da barbearia que hoje é no caderno ou no WhatsApp?
15. Sistema para barbearia com horário fixo semanal para mensalista (mesmo dia, hora e barbeiro)?
16. Como saber o faturamento do mês da barbearia por barbeiro e por serviço?
17. Sistema de comanda para barbearia (abrir, adicionar produto, fechar com PIX/cartão)?
18. Qual sistema para barbearia tem suporte humano em português, pelo WhatsApp?
19. Quanto tempo leva para implantar um sistema na barbearia?
20. O que é a Barber Agência e quanto custa?

## 8. Arquivos-chave para as próximas fases

- `src/middleware.ts` (PUBLIC_PREFIXES, matcher) · `src/app/layout.tsx` (metadata root, cookies) · `src/app/page.tsx` (landing) · `src/features/landing/content.ts` (textos, planos, FAQ) · `src/features/landing/components/faq.tsx` · `src/app/(legal)/*` · `public/documentacao.html` · `next.config.mjs`.
- Worktree paralela `barberagencia-oferta-fim-de-ano` mexe em `page.tsx` e `content.ts` (não tocar; coordenar merge).
