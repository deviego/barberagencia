/** Formas de pagamento (declaradas no agendamento; pagamento é no local). */
export const PAYMENT_METHODS = [
  { value: "PIX", label: "PIX" },
  { value: "CARD_CREDIT", label: "Crédito" },
  { value: "CARD_DEBIT", label: "Débito" },
  { value: "CASH", label: "Dinheiro" },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export function paymentLabel(value: string | null | undefined): string {
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? "—";
}
