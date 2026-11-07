# Landing com movimento — Fase 1 (Epic 16 · S1)

Três direções, aplicadas por cima da landing real (mesmo texto, mesmas seções). A `/` não muda nesta fase.

| Direção | Ideia | Prévia |
|---|---|---|
| [Navalha](direcao-navalha.md) | Preciso e quieto: revela ao rolar e um fio dourado "corta" sob cada sobretítulo | `/preview/landing/navalha` |
| [Letreiro](direcao-letreiro.md) | Ritmo de barbearia: números sobem como placa de senha, passos acendem em sequência, o poste gira | `/preview/landing/letreiro` |
| [Cinema](direcao-cinema.md) | Profundidade: o mockup recua ao rolar, o celular flutua, o "antes" apaga quando o "depois" chega | `/preview/landing/cinema` |

## Como as prévias funcionam
- `src/app/preview/landing/[nome]/page.tsx` renderiza o componente da `/` dentro de `MotionStage` (`src/features/landing/motion/`). O movimento está todo em `motion.css` (CSS com escopo `[data-motion]`) + um IntersectionObserver. **Sem lib.** São +1,1 kB de JS só nesta rota.
- **Guardas:** `noindex, nofollow` (meta + header `X-Robots-Tag`), fora do `sitemap.xml`, sem link em nenhuma página, e **404 quando `VERCEL_ENV=production`** (testado: 404 com a variável, 200 sem). `/preview` entrou no `PUBLIC_PREFIXES` do middleware (sem sessão).
- **Melhoria progressiva (vale para as três):** o HTML do servidor vem completo e visível. Só o JS marca como pendente o que está **abaixo da dobra**, e só com `prefers-reduced-motion: no-preference`. Sem JS ou com movimento reduzido, nada fica escondido e nada se mexe. O hero **nunca** começa em `opacity: 0`.
- **SEO:** a prévia renderiza o mesmo HTML da `/` (JSON-LD, FAQ e aberturas answer-first no HTML, conferido com `curl`). Canonical/OG da `/` não foram tocados.

## Lighthouse mobile (12.8.2, emulação mobile padrão, mediana de 3)
Build de produção local (`next build && next start`), mesma máquina e mesmas condições, Chromium headless isolado.

| Rota | Perf | LCP | CLS | TBT | FCP | JS transferido |
|---|---|---|---|---|---|---|
| **`/` atual (base, o "antes" da S2)** | 79 | 4.884 ms | 0 | 212 ms | 1.060 ms | 136 KB |
| Navalha | 80 | 4.814 ms | 0 | 165 ms | 1.214 ms | 135 KB |
| Letreiro | 81 | 4.807 ms | 0 | 141 ms | 1.207 ms | 135 KB |
| Cinema | 81 | 4.820 ms | 0,001 | 149 ms | 1.232 ms | 135 KB |

Leitura:
- Nenhuma direção piora LCP ou CLS. As diferenças estão dentro do ruído.
- O FCP das prévias é ~150 ms maior porque a rota de prévia é dinâmica (renderizada a cada request) e a `/` é estática. Na Fase 2 o movimento entra na própria `/`, que continua estática.
- **Achado da base:** o elemento de LCP é o **parágrafo do hero (texto)**, não a imagem, e ele leva ~4,9 s no 4G lento simulado. Isso aponta para a cadeia de fonte/CSS, não para o movimento. Vale olhar junto com o item 17 (Epic 12) na Fase 2, que usa esta mesma medição como "antes".
- Medição local: em produção/Vercel os números absolutos mudam. A comparação entre as rotas é o que vale.

## Recomendação (Vitrine): **Letreiro**
É a única direção em que o movimento conta algo do produto: a placa de senha aponta para a **fila**, que é o diferencial principal (produto.md), e os 4 passos acendendo mostram o "no ar em 1 dia". Tem a cara de barbearia (poste, placa) sem virar enfeite. O custo é o mesmo das outras (CSS + IO, sem lib). Se o Diego achar demais, a Navalha é a versão segura. O Cinema é o mais "premium", mas depende de `animation-timeline` (CSS de rolagem), que ainda não roda em todo navegador. Em navegador sem suporte ele vira quase a Navalha.

## Pendente
- Prints mobile/desktop de cada direção no portal Maestri (o Maestri estava fora do ar na hora do teste).
