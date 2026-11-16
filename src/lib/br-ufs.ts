/** Siglas das 27 unidades federativas do Brasil (whitelist para validação de UF). */
export const BR_UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export type BrUf = (typeof BR_UFS)[number];

export function isBrUf(value: string): value is BrUf {
  return (BR_UFS as readonly string[]).includes(value);
}
