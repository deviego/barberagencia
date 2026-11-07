# Direção B — Letreiro

**Ideia:** ritmo de barbearia: os números sobem como placa de senha, os passos acendem em sequência e o poste listrado gira quando a gente chega no "Pronto para encher a agenda?".

## O que se mexe, seção por seção
| Seção | Movimento |
|---|---|
| Hero | Nada entra (LCP intacto). |
| Métricas ("R$ 0", "1 dia", "10 min", "até 8") | O valor sobe de dentro da célula, como uma placa (800 ms, em cascata). O texto é o mesmo, **sem contador** (não inventa número). |
| Benefícios, Antes/depois, Planos, FAQ | Sobem 28 px e aparecem em cascata (700 ms, 70 ms entre cards). |
| Fila | O número de cada etapa (01, 02, 03) vira de cima para baixo como placa de senha (`rotateX`, 700 ms). Aponta para o diferencial real: a fila com senha. |
| Implantação ("No ar em 4 passos") | A linha dourada de cada passo acende da esquerda para a direita, um passo depois do outro. |
| CTA final | O poste listrado do topo do card gira 2 voltas quando a seção aparece e para. |
| Cards (hover) | Sobem 4 px. Botões encolhem para 98% ao tocar. |

**Timing/easing:** `cubic-bezier(0.16, 1, 0.3, 1)`, 700–900 ms. O poste é a única exceção linear (gira 1,2 s × 2 e para; nada pisca).

## Técnica e peso
CSS + IntersectionObserver, **sem lib**. Mesmo JS da Navalha (~1,1 kB). O poste anima `background-position` num elemento de 5 px de altura, só 2 voltas (custo de pintura irrisório).

## Movimento reduzido e sem JS
- Reduced-motion: nada é marcado; os números, as linhas dos passos e o poste ficam no estado final, parados.
- Sem JS: página inteira visível, linhas dos passos desenhadas (a borda original continua lá).

## Risco para LCP/CLS e como evitar
- Hero intocado. As placas usam `overflow: hidden` + `translateY` dentro da célula (a célula não muda de tamanho). Já o `display: inline-block` do valor vem no CSS do servidor, antes da primeira pintura.
- Lighthouse (mediana de 3): perf 81, LCP 4.807 ms, CLS 0, TBT 141 ms. Base `/`: 79 / 4.884 ms / 0 / 212 ms.
