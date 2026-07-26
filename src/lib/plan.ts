/** Monta a lista de benefícios de um plano para exibição (card de assinar / Meu plano).
 *  O texto detalhado (adesão, desconto em produtos, etc.) vem do campo `scope`,
 *  separado por " · ". A quantidade de cortes vem como primeiro item. */
export function planBenefits(cuts: number, scope: string | null | undefined): string[] {
  const parts = (scope ?? "")
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean);
  return [`${cuts} ${cuts === 1 ? "corte" : "cortes"} no mês`, ...parts];
}
