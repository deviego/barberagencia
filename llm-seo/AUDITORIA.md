# Fases 3 e 4 — Auditoria técnica e de conteúdo

Data: 27/10/2026 · Base: produção (https://www.barberagencia.com, `main` @ 2ac65c1) via `curl` com UA de GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot e Googlebot, e leitura do código.

## Fase 3 — Auditoria técnica

### Nota: **3,0 / 10** (antes)

| Critério | Peso | Nota | Evidência |
|---|---|---|---|
| HTML legível sem JS | 2,0 | 1,5 | Landing é SSR: texto, H1 e 7 H2 aparecem no HTML. Mas o FAQ (`faq.tsx`, `"use client"` + `{isOpen && …}`) entrega só 1 de 5 respostas. |
| robots.txt | 1,5 | 0 | `/robots.txt` → **307 para `/client/login`** (middleware trata como rota protegida). |
| sitemap.xml | 1,0 | 0 | `/sitemap.xml` → 307 para `/client/login`. |
| llms.txt | 0,5 | 0 | `/llms.txt` → 307 para `/client/login`. |
| Metadados | 1,5 | 0,5 | Home tem title e description (com oferta velha "46% OFF nos 3 primeiros meses"). Sem canonical, OG, Twitter. `/termos` e `/privacidade` herdam a description genérica do root ("Barbearia — Agendamento"). |
| JSON-LD | 1,5 | 0 | Nenhum (`application/ld+json` ausente). |
| HTML semântico e links internos | 1,0 | 0,6 | `header`/`nav`/`main`/`footer`/`section` ok. Perguntas do FAQ são `<span>` dentro de `<button>`. Links rastreáveis só `/admin/login`, `/termos`, `/privacidade`, `/documentacao`; o resto é âncora. |
| Indexação seletiva | 0,5 | 0,1 | Áreas logadas redirecionam (ok), mas `/b/*`, `/convite/*`, `/design-system` e logins não têm `noindex`. |
| Resposta para bots | 0,5 | 0,3 | Todo request é SSR `no-store` (root layout lê cookies). Home levou de 1,0 s a 2,5 s para os bots no teste. Todos os bots receberam 200 (nenhum bloqueio de WAF). |
| **Total** | **10** | **3,0** | |

Achado extra (descoberto na implementação): o Next 15.5 faz *streaming* de metadata para quem não está na lista `htmlLimitedBots`. A lista padrão não inclui GPTBot, ClaudeBot, PerplexityBot nem OAI-SearchBot. No build local, esses bots recebiam title/description/canonical fora do `<head>`. Em produção apareceu no `<head>` porque a página resolve rápido, mas isso não é garantido.

### Tabela de achados técnicos

| # | Item | Evidência | Impacto | Correção (fase 5) |
|---|---|---|---|---|
| T1 | robots.txt inexistente/redirect | `curl -I /robots.txt` → 307 `/client/login` | Bots sem regras e sem link para o sitemap | `src/app/robots.ts` + liberar no middleware ✅ |
| T2 | sitemap inexistente | 307 | Descoberta de páginas depende só de links | `src/app/sitemap.ts` ✅ |
| T3 | llms.txt inexistente | 307 | IAs sem resumo factual curado | `public/llms.txt` ✅ |
| T4 | FAQ só com 1 resposta no HTML | `faq.tsx` renderização condicional | Respostas invisíveis para IAs | `<details>/<summary>` server-side ✅ |
| T5 | Sem JSON-LD | — | Sem entidade (Organization/Software/Offer/FAQ) | `LandingJsonLd` ✅ |
| T6 | Sem canonical/OG/Twitter | `<head>` | `?ref=` gera URLs duplicadas; preview pobre | `LANDING_SEO_METADATA` ✅ |
| T7 | Metadata em streaming para bots de IA | build local | Bot pode não ver title/description no head | `htmlLimitedBots` no `next.config.mjs` ✅ |
| T8 | Áreas privadas e white-label sem noindex | headers | Risco de indexar app de barbearia cliente como Barber Agência | `X-Robots-Tag: noindex` + `Disallow` ✅ |
| T9 | Legal pages sem metadata própria | `/termos` title "Termos de Uso", description do root | Baixo | metadata + canonical ✅ |
| T10 | SSR `no-store` em tudo | root layout `cookies()` | TTFB alto para bots | **Proposta** (não feito): landing estática/ISR com tenant neutro; mexe na arquitetura de tenant, precisa de ok |
| T11 | `favicon.ico` 404 | `curl` | Baixo (marca nos resultados) | TODO: ícone da marca (`src/app/icon.png`) |

## Fase 4 — Auditoria de conteúdo

### Nota de conteúdo: **3,5 / 10** (antes)

| Pergunta | Resposta |
|---|---|
| Resposta direta nas 2 primeiras frases? | **Não.** H1 é slogan ("A barbearia inteira em uma plataforma"); o subtítulo lista áreas, mas não diz o que é a Barber Agência, para quem e qual o diferencial (a fila não aparece no topo). |
| Trechos citáveis de 40–80 palavras por tema? | **Poucos.** Cards curtos (10–20 palavras). Fila, mensalidade, migração e preço não têm um parágrafo que responda sozinho. |
| Fica claro quem é, o que faz, para quem, quanto custa? | Parcial. Preço está claro (com oferta velha). "Para quem" (1 unidade, até 8 profissionais) só aparece nos limites dos planos. |
| Fatos, autor e data? | Sem autor, sem data de atualização, sem "quem somos". Provas reais (Max Estilo, Oliveira 01, fundador ex-barbeiro) não aparecem. |
| Afirmações verificáveis? | **Não.** Várias falsas (lista abaixo). Uma IA que lê o site hoje vai dizer que a Barber Agência emite NF-e, tem API, bot IA, SMS e reduz faltas em 72%. |

### Afirmações falsas e oferta velha — TODO para o Diego (não corrigidas na `llm-seo`)

Por decisão do coordenador, essas linhas **não foram alteradas** na branch `llm-seo`, porque a worktree `barberagencia-oferta-fim-de-ano` mexe nos mesmos arquivos. Linhas em `main` @ 2ac65c1. A coluna "Oferta" diz se a worktree da oferta já corrige.

| # | Arquivo:linha | Texto | Realidade | Oferta corrige? |
|---|---|---|---|---|
| F1 | `src/features/landing/content.ts:54` | "+38% de ocupação média da agenda no 3º mês" | sem medição | não |
| F2 | `content.ts:55` | "−72% de faltas com lembretes automáticos" | sem medição, não há lembrete | não |
| F3 | `content.ts:56` | "4 min para o cliente assinar um combo" | não medido | não |
| F4 | `content.ts:65` | "Reagendamento e lista de espera" | não há lista de espera (reagendar só antes de confirmar) | não |
| F5 | `content.ts:70-71` | "renovação automática e cobrança recorrente no cartão" | cobrança manual por PIX | não |
| F6 | `content.ts:81,83` | "Produtos e venda direta", "alerta de reposição" | venda direta não existe; alerta de reposição não confirmado | não |
| F7 | `content.ts:87-89` | Campanhas WhatsApp/e-mail, recuperação de cadastros, disparos, integração com redes sociais | não existem | não |
| F8 | `content.ts:94-95` | "bot IA" | não existe | não |
| F9 | `content.ts:110` | "Combos mensais com cobrança recorrente automática" | não existe | não |
| F10 | `content.ts:112` | "Campanha automática para quem está há 60 dias sem cortar" | não existe | não |
| F11 | `content.ts:118` | "Lembretes — WhatsApp, SMS e e-mail" | sem lembrete prévio nem SMS | não |
| F12 | `content.ts:119` | "Pagamento — PIX, cartão ou na unidade" | pagamento só no local | não |
| F13 | `content.ts:126` / `page.tsx:55,190` | "domínio" seu (em todos) | domínio próprio só no Advance; Essencial tem endereço próprio | não (`page.tsx:55,190` corrigidos na llm-seo) |
| F14 | `content.ts:128` | "Importe a base…" | a importação é feita pela equipe | **sim** |
| F15 | `content.ts:149-150,232,236` / `page.tsx:26,47,339,366` | "46% OFF nos 3 primeiros meses" | promoção de fim de ano: 2 meses, Personal R$ 69,90 e Essencial R$ 89,90 | **sim** |
| F16 | `content.ts:158,181,203,222` | "alertas WhatsApp/e-mail/SMS" | sem SMS; os avisos automáticos saem pelo WhatsApp da barbearia | não |
| F17 | `content.ts:160-167,182-189,204-211,224-231` | bot IA, recuperação de cadastros, campanhas, NF-e, venda direta, API/webhooks (tabela e cards de planos) | não existem | não |
| F18 | `page.tsx:76` | "Sem cartão para testar" | não há teste grátis | **sim** |
| F19 | `content.ts:239` | "plataforma envia o convite para cada cliente" (após importar) | convite existe; importação feita pela equipe | **sim** |
| F20 | `page.tsx:26` | meta description com "46% OFF nos 3 primeiros meses" | oferta velha | **sim** |

Recomendação: na worktree da oferta (ou logo depois do merge dela), remover F1–F13, F16 e F17. Sugestão de troca para os 4 números do topo (F1–F3): fatos verificáveis, como "10 min para confirmar uma solicitação", "1 dia para a barbearia ficar pronta", "R$ 0 de adesão, setup e migração" e "até 8 profissionais".

### Aberturas: antes → depois (answer-first)

| Seção | Antes | Depois | Aplicado? |
|---|---|---|---|
| Hero (subtítulo, `page.tsx:54-55`) | "Agenda, mensalistas, financeiro, produtos e atendimento no mesmo lugar — com a sua marca, no seu domínio. Seu cliente agenda sozinho; você acompanha tudo em tempo real." | "A Barber Agência é o sistema da barbearia com a sua marca: agenda online, fila por QR code com painel na TV, mensalidade com saldo de cortes, comanda e financeiro por barbeiro. Seu cliente agenda pelo link, sem baixar aplicativo; você acompanha tudo em tempo real." | ✅ (sem conflito com a oferta) |
| Benefícios (`page.tsx:109`) | "Não é só agenda. É a operação inteira da barbearia — do primeiro contato do cliente ao fechamento do caixa." | "Não é só agenda: a Barber Agência cuida da operação inteira da barbearia, do pedido de horário do cliente ao fechamento do caixa, com o faturamento separado por barbeiro, por dia e por serviço." | ✅ |
| App do cliente (`page.tsx:190-192`) | "Seu cliente entra no site da sua barbearia — logo, cores e domínio seus. Escolhe serviço, barbeiro e horário, assina um combo mensal e acompanha o saldo de cortes. Você só confirma." | "Seu cliente abre o link da sua barbearia no celular, sem baixar nada, e vê o seu logo e as suas cores. Escolhe barbeiro, serviços e horário, assina um combo mensal e acompanha o saldo de cortes. Você confirma em até 10 minutos." | ✅ |
| Rodapé (`page.tsx:394`) | "Plataforma white-label de agendamento, assinaturas e gestão para barbearias." | "Plataforma white-label para barbearias: agenda online, fila por QR code, mensalidade com saldo de cortes e financeiro, com a marca da sua barbearia." | ✅ |
| Meta description (`page.tsx:26`) | "…46% OFF nos 3 primeiros meses, sem adesão." | "Plataforma white-label para barbearias: agenda online, fila por QR code com painel na TV, mensalidade com saldo de cortes, comanda e financeiro por barbeiro. Sem adesão e sem custo de setup." | ⚠️ **Proposta.** A oferta reescreve essa linha. Hoje o texto novo está em OG/Twitter (`src/features/seo/site.ts`). |
| Selo do hero (`page.tsx:47`) | "46% OFF nos 3 primeiros meses · sem adesão" | (da oferta) "Promoção de fim de ano · 2 primeiros meses a partir de R$ 69,90" | ⚠️ Fica com a oferta. |
| Fila (seção nova da oferta, `#fila`) | — | Sugestão para o parágrafo: "A fila da Barber Agência funciona como senha de banco: o cliente escaneia o QR na parede ou pega a senha no totem, acompanha pelo celular quem está em atendimento e o próximo, e a TV chama a vez com som. Está nos planos Essencial e Advance." | ⚠️ Proposta (seção está na worktree da oferta). |
| Planos (subtítulo) | "Sem adesão · cancelamento livre." | (da oferta) + sugestão: "Escolha pelo número de profissionais: Personal até 3, Essencial até 5 com fila, Advance até 8." | ⚠️ Proposta. |
