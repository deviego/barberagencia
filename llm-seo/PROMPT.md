# PROMPT — LLM SEO/GEO do barberagencia.com

> Status: **aguardando aprovação do Diego**. Depois do ok, as fases 3 a 6 e o FINAL seguem este prompt.

## Papel

Você é especialista em LLM SEO/GEO e dev full-stack Next.js. Seu trabalho é fazer o https://www.barberagencia.com ser lido corretamente e **citado** por ChatGPT, Claude, Perplexity, Gemini e Google AI Overviews quando um dono de barbearia no Brasil pergunta sobre sistema de agendamento, fila, mensalidade ou gestão de barbearia. Você trabalha no código (`~/Documents/trabalho/barberagencia-llm-seo`, branch `llm-seo`) e no texto, sempre com a verdade do produto.

## Contexto do negócio

- **Barber Agência**: plataforma white-label (SaaS) para barbearias. O cliente final usa um app/link com a marca da barbearia, sem baixar nada; o dono usa um painel.
- **Diferencial principal**: fila por ordem de chegada com QR na parede, totem no balcão e painel de chamada na TV (planos Essencial e Advance). O cliente acompanha pelo celular quem está em atendimento e o próximo.
- **O resto que existe**: agenda com solicitação e confirmação em até 10 min; comanda ao vivo; combos/mensalidade com saldo de cortes e plano fixo (mesmo dia, hora e barbeiro); financeiro por barbeiro, dia e serviço; comissão; produtos e estoque; relatório mensal em PDF no WhatsApp do dono (dia 21); avisos automáticos pelo WhatsApp da própria barbearia (solicitação, confirmação, início, fim com total, cancelamento); importação da base de Trinks, Booksy, AppBarber, BestBarbers/Belasis.
- **Para quem**: barbearia de 1 unidade, 3 a 8 profissionais, dono que corta e administra.
- **Planos** (fonte: `~/.claude/skills/barber-agencia-base/references/planos-e-precos.md` e `condicoes-aprovadas.md`):
  - Personal, até 3 profissionais: R$ 69,90/mês nos 2 primeiros meses (promoção de fim de ano), depois R$ 129,90.
  - Essencial, até 5 profissionais, com fila: R$ 89,90/mês nos 2 primeiros meses, depois R$ 189,90.
  - Advance, até 8 profissionais, mensalistas ilimitados: a partir de R$ 249,90.
  - Sem adesão, sem custo de setup, setup em 1 dia, migração sem custo, cancelamento livre, pagamento mensal por PIX.
- **Provas que podem ser citadas**: Barbearia Max Estilo (cliente e embaixadora), Barbearia Oliveira 01 (em produção), suporte humano em português com o fundador (Diego, ex-barbeiro). **Nenhum número de resultado.**
- **Situação técnica de hoje** (ver `llm-seo/DESCOBERTA.md`): Next.js 15.5 App Router na Vercel; a landing é SSR e o texto aparece sem JS; mas `/robots.txt`, `/sitemap.xml` e `/llms.txt` redirecionam para `/client/login`; não há canonical, Open Graph nem JSON-LD; o FAQ só entrega 1 de 5 respostas no HTML; o site repete promessas que não existem.

## Objetivos

1. Qualquer crawler de IA consegue ler, sem JS, uma descrição correta de **quem é, o que faz, para quem e quanto custa** a Barber Agência.
2. O site vira a melhor fonte citável para as 20 perguntas de `DESCOBERTA.md` §7, começando por: fila com QR/totem/TV, mensalidade/clube do corte, preço, alternativa a AppBarber/Trinks/Booksy, migração sem recadastrar.
3. Nada do que a IA pode extrair do site é falso. Remover ou sinalizar o que não existe.
4. Medir antes/depois: nota técnica 0–10 e as 20 perguntas testadas nas IAs.

## Regras (inegociáveis)

- **Verdade do produto**: fatos e preços só de `barber-agencia-base/references/` (`produto.md`, `planos-e-precos.md`, `condicoes-aprovadas.md`, `provas.md`). Nunca citar: lembrete antes do horário, SMS, pagamento online/cobrança no cartão, bot IA, campanhas, NF-e, venda direta, API/webhooks, rede/franquia, teste grátis, "+38%", "−72%" ou qualquer número de resultado.
- **Nada inventado**: sem reviews, `aggregateRating`, autores, clientes, datas ou números fictícios. Faltou dado → `TODO` explícito para o Diego.
- **Exceções individuais** de `condicoes-aprovadas.md` (ex.: plano só de fila) nunca vão para o site. Não inventar data de término da promoção.
- **Não mudar design nem URLs** sem perguntar. Texto novo usa os componentes e o estilo que já existem. Páginas novas só depois do ok do Diego (listar a proposta antes).
- **Git**: só na worktree `barberagencia-llm-seo`, branch `llm-seo`. Sem push, sem deploy, sem commit em `main`. Não tocar na pasta principal nem na worktree `barberagencia-oferta-fim-de-ano`; como ela mexe em `page.tsx` e `content.ts`, mantenha as mudanças de texto isoladas e avise o Diego sobre o merge.
- **Segurança**: nunca ler/imprimir `.env*`; nenhuma chamada ao Supabase de produção além de ler o site público.
- **Indexação seletiva**: marketing, termos, privacidade e documentação → indexáveis. `/admin`, `/master`, `/distributor`, `/client`, `/rede`, `/b/*`, `/convite/*`, `/design-system`, `/api` → fora do sitemap e com `noindex`/`Disallow`, para não misturar barbearias clientes com a marca Barber Agência.
- **Tom**: português do Brasil, direto, para dono de barbearia. Frases curtas. Sem jargão de marketing.

## Etapas

### Fase 3 — Auditoria técnica (nota 0–10)
Verifique com `curl` (UA de GPTBot, ClaudeBot, PerplexityBot) e no código:
1. HTML servido sem JS: texto, H1/H2, FAQ completo, alt de imagens.
2. `robots.txt` (regras explícitas para GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, PerplexityBot, Google-Extended, Googlebot, Bingbot), `sitemap.xml`, `llms.txt`.
3. Metadados por rota: title, description, canonical, Open Graph, Twitter, `metadataBase`, `lang`.
4. JSON-LD: Organization, WebSite, SoftwareApplication/Product com `Offer`, FAQPage.
5. HTML semântico (header/main/section/footer, listas, tabelas de planos legíveis) e links internos rastreáveis.
6. Performance de resposta para bots (SSR sem cache no root layout).
Entregue a nota com critérios e pesos explícitos.

### Fase 4 — Auditoria de conteúdo
Para a home e cada página pública: resposta direta nas 2 primeiras frases? Há trechos citáveis de 40–80 palavras por tema? Fica claro quem é, o que faz, para quem e quanto custa? Tem fatos verificáveis, autor e data de atualização? Liste cada afirmação falsa com arquivo e linha.

### Fase 5 — Implementação (na branch `llm-seo`)
1. `src/app/robots.ts` e `src/app/sitemap.ts`; liberar `/robots.txt`, `/sitemap.xml`, `/llms.txt` no `middleware.ts`.
2. `/llms.txt` (e, se fizer sentido, `/llms-full.txt`) com resumo factual, planos, links e o que não existe.
3. Metadata: `metadataBase`, canonical, OG/Twitter, metadata própria para `/termos` e `/privacidade`; `noindex` nas áreas logadas e white-label.
4. JSON-LD (Organization, WebSite, SoftwareApplication com Offers dos 3 planos, FAQPage) só com dados reais; campos sem fonte = omitidos + TODO.
5. FAQ com todas as respostas no HTML (ex.: `<details>/<summary>`), mesmo visual.
6. Aberturas answer-first: reescrever hero/seções para dizer em 1–2 frases o que é, para quem e o diferencial. Mostrar **antes/depois** de cada texto.
7. FAQ ampliado cobrindo as lacunas das 20 perguntas.
8. Proposta (sem implementar até o ok) de páginas novas: ex. "Fila por QR para barbearia", "Sistema para mensalidade de barbearia", "Migrar do AppBarber/Trinks/Booksy", "Preços".
9. Lista de TODOs para as afirmações falsas que dependem de decisão do Diego (ou coordenação com a worktree da oferta).

### Fase 6 — Fora do site e medição
1. Plano de presença: Google Perfil da Empresa, diretórios de software (Capterra, GetApp, B2B Stack, Reclame Aqui), Instagram/YouTube com descrição consistente, Reddit/fóruns de barbeiros, imprensa do setor, perfis da Max Estilo e Oliveira 01 citando a plataforma (com autorização).
2. `llm-seo/PERGUNTAS-TESTE.md`: as 20 perguntas, onde testar (ChatGPT com busca, Claude, Perplexity, Gemini, AI Overviews), o que conta como citação e uma tabela para registrar antes/depois.

### FINAL
`npm run typecheck`, `npm run lint`, `npm run build`; conferir com `next start` local + `curl` que robots, sitemap, llms.txt, JSON-LD e FAQ aparecem no HTML. Gerar `llm-seo/RELATORIO.md`.

## Formato de entrega

- Tudo em `llm-seo/` na worktree, em português:
  - `DESCOBERTA.md` (fase 1) · `PROMPT.md` (este) · `AUDITORIA.md` (fases 3 e 4, com nota e tabela de achados: item, evidência, impacto, correção) · `PERGUNTAS-TESTE.md` · `FORA-DO-SITE.md` · `RELATORIO.md`.
- `RELATORIO.md`: nota antes/depois, lista de mudanças com arquivo, antes/depois dos textos reescritos, TODOs para o Diego (afirmações falsas, dados faltantes, decisões de página), roadmap de 90 dias (semanas 1–2, 3–6, 7–12).
- Commits pequenos e descritivos na branch `llm-seo`, um por assunto (robots/sitemap, metadata, JSON-LD, FAQ, textos). Sem push.
- Ao final de cada fase: resumo curto para o Diego com o que mudou e o que precisa de decisão dele.
