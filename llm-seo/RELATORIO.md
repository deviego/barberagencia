# Relatório final — LLM SEO/GEO do barberagencia.com

Data: 27/10/2026 · Branch `llm-seo` (worktree `~/Documents/trabalho/barberagencia-llm-seo`), criada a partir de `main` @ 2ac65c1. **Sem push e sem deploy.**

## Notas

| | Antes (produção) | Depois (branch `llm-seo`, build local) | Depois + correções da oferta e TODOs F1–F17 |
|---|---|---|---|
| Técnica (0–10) | **3,0** | **9,0** | 9,3 |
| Conteúdo (0–10) | **3,5** | **5,5** | 8,0 (estimado) |

A nota técnica "depois" foi conferida com `next start` local e `curl` com UA de GPTBot, ClaudeBot, PerplexityBot e Googlebot. O que falta para 10: SSR `no-store` em toda request (T10), `favicon` (T11), `sameAs`/fundador no JSON-LD (dados do Diego) e a meta description da home, que ainda tem a oferta velha até o merge da oferta.
A nota de conteúdo só sobe de verdade quando as afirmações falsas (AUDITORIA F1–F17) saírem da landing.

Critérios e evidências: `llm-seo/AUDITORIA.md`.

## O que mudou (commits na `llm-seo`)

| Commit | Mudança | Arquivos |
|---|---|---|
| `eeb94c7` | Descoberta e prompt | `llm-seo/DESCOBERTA.md`, `llm-seo/PROMPT.md` |
| `605cc06` | `robots.txt` com regras explícitas para GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, Claude-SearchBot, PerplexityBot, Perplexity-User, Google-Extended, Googlebot, Bingbot e Applebot, e `Disallow` nas áreas privadas. `sitemap.xml` só com páginas públicas. `llms.txt` factual (inclui "o que a plataforma não faz"). O middleware passa a servir esses arquivos sem sessão e sem Supabase (antes iam para `/client/login`). `X-Robots-Tag: noindex, nofollow` em `/admin`, `/master`, `/distributor`, `/client`, `/rede`, `/b`, `/convite`, `/design-system` e `/api`. `htmlLimitedBots` para os bots de IA receberem title, description e canonical no `<head>`. | `src/app/robots.ts`, `src/app/sitemap.ts`, `public/llms.txt`, `src/middleware.ts`, `next.config.mjs`, `src/features/seo/site.ts` |
| `f71762e` | Title, description e canonical em `/termos` e `/privacidade` | `src/app/(legal)/*/page.tsx` |
| `89e333c` | FAQ em `<details>/<summary>`, renderizado no servidor, com todas as respostas no HTML (antes: 1 de 5). Mesmo visual, com a 1ª pergunta aberta. Pergunta como `<h3>`. Mais **11 perguntas answer-first** cobrindo as 20 perguntas: o que é, fila por QR, sem baixar app, mensalidade, preço, fidelidade, migração, WhatsApp, financeiro/comissão, prazo, pagamento. | `src/features/seo/faq.ts`, `src/features/landing/components/faq.tsx` |
| `835abf1` | JSON-LD (`@graph`: Organization, WebSite, WebPage, SoftwareApplication com 3 Offers em BRL e FAQPage com as 11 perguntas novas). Canonical, Open Graph e Twitter na home. Aberturas answer-first no hero, em Benefícios, no App do cliente e no rodapé. | `src/features/seo/landing-json-ld.tsx`, `src/app/page.tsx` |
| (este) | Auditoria, perguntas de teste, plano fora do site e relatório | `llm-seo/*.md` |

**Conflito com a worktree da oferta:** simulei com `git merge-file` o merge de `src/app/page.tsx` contra as mudanças (ainda não commitadas) de `barberagencia-oferta-fim-de-ano` e não deu conflito. A `llm-seo` não toca em `content.ts`. A FAQ junta `FAQS` (da oferta, quando entrar) com as perguntas novas e descarta as duplicadas.

### Antes → depois dos textos

Detalhe completo em `AUDITORIA.md` → "Aberturas". Resumo:

- **Hero.** Antes: "Agenda, mensalistas, financeiro, produtos e atendimento no mesmo lugar — com a sua marca, no seu domínio. Seu cliente agenda sozinho; você acompanha tudo em tempo real." Depois: "A Barber Agência é o sistema da barbearia com a sua marca: agenda online, fila por QR code com painel na TV, mensalidade com saldo de cortes, comanda e financeiro por barbeiro. Seu cliente agenda pelo link, sem baixar aplicativo; você acompanha tudo em tempo real."
- **App do cliente.** Saiu o "domínio seus" (domínio próprio é só no Advance). Entrou "sem baixar nada" e "você confirma em até 10 minutos".
- **Benefícios e rodapé:** frases que dizem o que é e para quem.
- **Meta description da home:** ficou como proposta, porque a oferta reescreve essa linha. O texto novo já está no OG e no Twitter.

## Verificação (FINAL)

| Checagem | Resultado |
|---|---|
| `npm run typecheck` | ✅ sem erros |
| `npm run build` | ✅ (`/robots.txt` e `/sitemap.xml` estáticos; o resto continua dinâmico) |
| `npm run lint` | ⚠️ **não roda**. O projeto não tem configuração de ESLint e o `next lint` abre o assistente interativo (problema que já existia). TODO: configurar o ESLint (o `next lint` também está depreciado no Next 16). |
| Testes | Não há suíte de testes da landing (só `test:import`, que não tem relação com esta mudança). |
| `next start` local + `curl` (UA GPTBot/ClaudeBot/PerplexityBot/Googlebot) | `/robots.txt`, `/sitemap.xml` e `/llms.txt` → 200. `/admin/login` → `X-Robots-Tag: noindex`. Home: canonical, 8 tags OG e description no `<head>`. JSON-LD com 5 entidades e 11 perguntas. 16 `<details>` com resposta no HTML. Texto visível sem JS: de cerca de 7,5 mil para cerca de 12 mil caracteres. |

O teste local usou variáveis Supabase **falsas** (`http://127.0.0.1:9`), sem acesso a `.env` nem ao Supabase de produção.

## TODOs para o Diego

1. **Afirmações falsas na landing** (AUDITORIA F1–F17, com arquivo e linha): +38%, −72%, lembretes, SMS, cobrança no cartão, bot IA, campanhas, NF-e, venda direta, API, lista de espera. Decidir quem remove: a worktree da oferta ou a `llm-seo` depois do merge dela. **É o item de maior impacto:** as IAs vão repetir o que está no site.
2. **Meta description da home:** depois do merge da oferta, trocar pela versão answer-first (proposta na AUDITORIA).
3. **"O que a plataforma não faz" no `llms.txt`:** está lá por honestidade e para evitar que a IA invente recursos. Confirmar se quer manter (recomendo) e lembrar que contradiz a landing atual até o item 1 ser resolvido.
4. **Fim da promoção:** quando acabar, atualizar `PLAN_FACTS`/`promoPrice` em `src/features/seo/site.ts`, a resposta "Quanto custa" em `src/features/seo/faq.ts` e `public/llms.txt`.
5. **Dados para o schema e para os diretórios:** Instagram, YouTube e LinkedIn oficiais (`sameAs`), nome público do fundador, CNPJ/razão social se quiser exibir, e autorização da Max Estilo e da Oliveira 01 para serem citadas no site.
6. **Avisos automáticos de WhatsApp** (pendência nº 1 das skills): o FAQ diz que existem, sem atrelar a plano. Confirmar.
7. **ESLint:** configurar.
8. **Performance para bots (T10):** autorizar estudo para servir a landing estática/ISR (o root layout lê cookies para resolver o tenant).
9. **Favicon/ícone da marca:** `favicon.ico` dá 404.
10. Depois do deploy: enviar o sitemap no Google Search Console e no Bing Webmaster Tools.

## Páginas novas propostas (não criadas, aguardam ok)

| URL | Título | Outline (answer-first, só fatos das skills) |
|---|---|---|
| `/fila-por-qr-code-barbearia` | Fila por QR code e senha na TV para barbearia | O que é (2 frases) · como o cliente usa (QR, totem, celular, TV) · como o dono acompanha · para quem atende por ordem de chegada · planos (Essencial e Advance) · o que não faz (não mostra "quantos faltam", sem impressão de senha) · FAQ · CTA WhatsApp |
| `/sistema-mensalidade-barbearia` | Mensalidade e clube do corte com saldo de cortes | O que é · plano livre × fixo · saldo visível ao cliente · cancelamento devolve o corte · pagamento no balcão (sem cobrança automática) · limites de mensalistas por plano · FAQ |
| `/migrar-de-outro-sistema` | Como migrar do AppBarber, Trinks, Booksy ou BestBarbers | Resposta direta (a equipe importa, sem custo) · passo a passo da exportação por sistema (do `barber-concorrentes` e da importação) · o que vem (clientes) e o que não vem · convite para os clientes · prazo · FAQ |
| `/precos` | Preços da Barber Agência | Tabela honesta dos 3 planos (sem NF-e/API/bot) · como escolher pelo número de profissionais · condições (sem adesão, setup, migração; PIX; cancelamento) · promoção vigente · FAQ de preço |
| `/sobre` | Quem é a Barber Agência | Fundador ex-barbeiro · suporte humano · clientes que podem ser citados · contato · data de atualização (autor e E-E-A-T) |

Cada página teria metadata própria, JSON-LD (`WebPage` + `FAQPage`), entrada no sitemap e link no rodapé.

## Roadmap de 90 dias

**Semanas 1–2**
- Merge da oferta → remover F1–F17 → merge da `llm-seo` → deploy (com o ok do Diego).
- Rodar a linha de base de `PERGUNTAS-TESTE.md` **antes** do deploy.
- Search Console + Bing Webmaster com o sitemap. Google Perfil da Empresa. Bio do Instagram com o texto-padrão.

**Semanas 3–6**
- Criar as páginas `/fila-por-qr-code-barbearia`, `/precos` e `/migrar-de-outro-sistema` (se aprovadas).
- Diretórios (B2B Stack, Capterra/GetApp, G2) e Reclame Aqui. 3 vídeos curtos no YouTube.
- Pedir avaliações reais aos clientes ativos.
- Remedir as 20 perguntas na semana 6.

**Semanas 7–12**
- Páginas `/sistema-mensalidade-barbearia` e `/sobre`. Caso da Max Estilo (com autorização).
- Pauta de imprensa do setor. Respostas em comunidades como Diego.
- Estudo de landing estática (T10). Configurar ESLint.
- Remedir na semana 12 e comparar com a meta de `PERGUNTAS-TESTE.md`.

## Arquivos

`llm-seo/DESCOBERTA.md` · `llm-seo/PROMPT.md` · `llm-seo/AUDITORIA.md` · `llm-seo/PERGUNTAS-TESTE.md` · `llm-seo/FORA-DO-SITE.md` · `llm-seo/RELATORIO.md`
