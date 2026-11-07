# Direção A — Navalha

**Ideia:** preciso e quieto, como um corte bem feito. O conteúdo entra ao rolar e um fio dourado "corta" sob cada sobretítulo.

## O que se mexe, seção por seção
| Seção | Movimento |
|---|---|
| Hero | Nada entra. Só o brilho dourado do fundo "respira" (opacidade 1 → 0,55, 9 s, vai e volta), começando 1,2 s depois de carregar. Texto, CTAs e mockup ficam parados. |
| Métricas, Benefícios, Antes/depois, Fila, Implantação, Planos | Blocos de título e cards sobem 20 px e aparecem (700 ms). Os cards de uma grade entram em cascata (70 ms entre eles, até 5). |
| Sobretítulos ("Tudo o que você ganha" etc.) | Fio dourado de 48 × 1 px desenha da esquerda para a direita (900 ms, 250 ms depois do título). |
| Cards (hover) | Sobem 4 px (450 ms). Botões encolhem para 98% ao tocar. |
| FAQ, CTA final, rodapé | Mesmo "sobe e aparece". |

**Timing/easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (chega rápido, assenta devagar), 700 ms. Nada de linear nem ease-in-out.

## Técnica e peso
CSS + IntersectionObserver, **sem lib**. JS: ~1,1 kB (só a rota de prévia; na Fase 2, o mesmo na `/`). Nada no caminho do hero: o JS roda depois da hidratação e só toca o que está abaixo da dobra.

## Movimento reduzido e sem JS
- `prefers-reduced-motion: reduce`: o JS não marca nada e o CSS está todo dentro de `no-preference`. Sem brilho, sem fio animado (fica desenhado), sem elevação.
- Sem JS: nenhuma classe que esconde é aplicada. A página aparece inteira.

## Risco para LCP/CLS e como evitar
- LCP é o parágrafo do hero, que não é tocado. A animação do brilho começa 1,2 s depois e mexe só em opacidade.
- CLS: só `transform`/`opacity`. O fio usa `::after` com posição absoluta (não empurra nada).
- Lighthouse (mediana de 3): perf 80, LCP 4.814 ms, CLS 0, TBT 165 ms. Base `/`: 79 / 4.884 ms / 0 / 212 ms.
