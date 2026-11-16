import { z } from "zod";

/** Limites do pedido (os mesmos que a RPC vai aplicar no banco). */
export const ORDER_LIMITS = { maxItems: 50, minQty: 1, maxQty: 999, maxNote: 500 } as const;

export const ORDER_STATUSES = ["CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
export type OrderTargetStatus = (typeof ORDER_STATUSES)[number];

const uuid = z.string().uuid();

export const PlaceOrderSchema = z.object({
  distributorId: uuid,
  items: z
    .array(
      z.object({
        productId: uuid,
        qty: z.number().int().min(ORDER_LIMITS.minQty).max(ORDER_LIMITS.maxQty),
      }),
    )
    .min(1)
    .max(ORDER_LIMITS.maxItems),
  note: z
    .string()
    .trim()
    .max(ORDER_LIMITS.maxNote)
    .optional()
    .transform((v) => (v ? v : null)),
});

export const SetOrderStatusSchema = z.object({
  orderId: uuid,
  status: z.enum(ORDER_STATUSES),
});

/** Mensagem de validação curta para a UI (primeiro problema encontrado). */
export function placeOrderInputError(error: z.ZodError): string {
  const path = error.issues[0]?.path ?? [];
  if (path[0] === "distributorId") return "Distribuidor inválido.";
  if (path[0] === "note") return `A observação pode ter no máximo ${ORDER_LIMITS.maxNote} caracteres.`;
  if (path[0] === "items" && path.length === 1) {
    return error.issues[0]?.code === "too_big"
      ? `O pedido pode ter no máximo ${ORDER_LIMITS.maxItems} itens.`
      : "Carrinho vazio.";
  }
  if (path[2] === "qty") return `Quantidade deve ser de ${ORDER_LIMITS.minQty} a ${ORDER_LIMITS.maxQty}.`;
  return "Pedido inválido.";
}

export const ORDER_GENERIC_ERROR = "Não foi possível concluir agora. Tente de novo.";

/**
 * Converte o erro da RPC em mensagem pt-BR para a UI. Nunca devolve o texto do banco.
 * Aceita os códigos estáveis (ORDER_STALE, ORDER_DELIVERED, INVALID_TRANSITION) e as
 * mensagens atuais das RPCs.
 */
export function mapOrderRpcError(error: { message?: string | null } | null | undefined): string {
  const msg = (error?.message ?? "").toLowerCase();
  if (msg.includes("order_delivered")) return "Pedido entregue não pode ser cancelado.";
  if (msg.includes("order_stale") || msg.includes("invalid_transition") || msg.includes("transição inválida")) {
    return "Esse pedido já foi atualizado.";
  }
  if (msg.includes("estoque insuficiente")) return "Estoque insuficiente para confirmar este pedido.";
  if (msg.includes("produto indisponível")) return "Algum produto não está mais disponível. Atualize a página.";
  if (msg.includes("quantidade inválida")) return `Quantidade deve ser de ${ORDER_LIMITS.minQty} a ${ORDER_LIMITS.maxQty}.`;
  if (msg.includes("pedido vazio")) return "Carrinho vazio.";
  if (msg.includes("pedido não encontrado")) return "Pedido não encontrado.";
  return ORDER_GENERIC_ERROR;
}
