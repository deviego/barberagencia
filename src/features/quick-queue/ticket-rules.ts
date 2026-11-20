import type { QuickQueueMyTicket, QuickQueueTicketState } from "./types";

/** Regras puras da tela "Minha senha" (#98), sem dependência do servidor nem dos planos. */

/** Senha de hoje deste aparelho, como vem do banco (só colunas sem dado de cliente). */
export type QuickQueueTicketRow = {
  ticket_number: number;
  status: "WAITING" | "IN_SERVICE" | "DONE" | "LEFT";
  called_at: string | null;
  left_by_client: boolean | null;
};

/** Retrato da fila da barbearia hoje: só números de senha. */
export type QuickQueueSnapshot = {
  /** Senha chamada por último hoje (null = ninguém chamado). */
  nowServing: number | null;
  /** Senhas em espera e ainda não chamadas, em ordem crescente. */
  waiting: number[];
};

/** Qual senha do aparelho mostrar: a ativa de número menor; sem ativa, a última encerrada. */
export function pickDeviceTicket<T extends QuickQueueTicketRow>(rows: readonly T[]): T | null {
  const active = rows.filter((r) => r.status === "WAITING" || r.status === "IN_SERVICE");
  if (active.length) return active.reduce((a, b) => (b.ticket_number < a.ticket_number ? b : a));
  if (!rows.length) return null;
  return rows.reduce((a, b) => (b.ticket_number > a.ticket_number ? b : a));
}

/** Estado mostrado em "Minha senha" (#98). */
export function quickQueueTicketState(row: QuickQueueTicketRow, ahead: number): QuickQueueTicketState {
  switch (row.status) {
    case "IN_SERVICE":
      return "CALLED";
    case "DONE":
      return "DONE";
    case "LEFT":
      return row.left_by_client ? "CANCELLED" : "SKIPPED";
    default:
      if (row.called_at) return "CALLED";
      return ahead > 0 ? "WAITING" : "NEXT";
  }
}

/** Monta a resposta da tela. Só números e estado: nada de cliente, serviço ou id. */
export function quickQueueMyTicket(row: QuickQueueTicketRow, snap: QuickQueueSnapshot): QuickQueueMyTicket {
  const waitingNotCalled = row.status === "WAITING" && !row.called_at;
  const ahead = waitingNotCalled ? snap.waiting.filter((n) => n < row.ticket_number).length : 0;
  return {
    number: row.ticket_number,
    state: quickQueueTicketState(row, ahead),
    nowServing: snap.nowServing,
    ahead,
  };
}
