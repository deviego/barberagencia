# Direção C — Cinema

**Ideia:** profundidade. O mockup do painel recua quando você rola, o celular do app flutua, o "antes" perde força quando o "depois" chega e um holofote dourado segue o mouse nos planos.

## O que se mexe, seção por seção
| Seção | Movimento |
|---|---|
| Hero | Texto parado. O mockup (notebook/tablet/celular) **começa intacto** e só recua quando sai da tela: escala 1 → 0,92, opacidade 1 → 0,35, ligado à rolagem (`animation-timeline: view()`, range `exit`). |
| Títulos de seção | O bloco sobe 32 px com escala 0,97 → 1 e o H2 chega 120 ms depois (900 ms). |
| Antes/depois | Quando o card "Com a Barber Agência" aparece, o "Sem a plataforma" cai para 55% de opacidade. |
| App do cliente | O celular flutua em parallax (+28 px → −28 px enquanto a seção cruza a tela). |
| Planos (só desktop, mouse) | Holofote dourado (`--bb-accent-wash`) segue o cursor dentro do card (pointermove + rAF). No celular, não existe. |
| Demais cards | Sobem e aparecem em cascata. Hover sobe 4 px. |

**Timing/easing:** `cubic-bezier(0.16, 1, 0.3, 1)`, 700–900 ms. A rolagem é linear por definição (segue o dedo).

## Técnica e peso
CSS + IntersectionObserver + CSS scroll-driven animations, **sem lib**. JS ~1,1 kB (+ ~0,3 kB do holofote). Navegador sem `animation-timeline` (Firefox, Safari antigo): o mockup e o celular ficam parados, o resto funciona. Fica quase igual à Navalha.

## Movimento reduzido e sem JS
- Reduced-motion: sem parallax, sem recuo, sem holofote, sem cascata. Tudo visível.
- Sem JS: tudo visível. O recuo/parallax é CSS puro e respeita reduced-motion.

## Risco para LCP/CLS e como evitar
- O recuo do mockup só começa quando o mockup **sai** da tela, então a imagem do hero aparece inteira na primeira pintura. O LCP é o parágrafo do hero, que não se mexe.
- Parallax e recuo usam só `transform`/`opacity` (não contam como layout shift).
- É a direção mais pesada de pintura durante a rolagem. Na Fase 2, testar no celular com CPU 4× mais lenta antes de aprovar.
- Lighthouse (mediana de 3): perf 81, LCP 4.820 ms, CLS 0,001, TBT 149 ms. Base `/`: 79 / 4.884 ms / 0 / 212 ms.
