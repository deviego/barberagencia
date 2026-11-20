import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireQuickQueueTicketAccess, QuickQueueClosedError } from "@/features/quick-queue/guard";
import { hashDeviceToken, readDeviceToken } from "@/features/quick-queue/device";
import { quickQueueMyTicket } from "@/features/quick-queue/ticket-rules";
import { claimStatusSlot, loadDeviceTicket, loadSnapshot } from "@/features/quick-queue/ticket";
import type { QuickQueueStatusResponse } from "@/features/quick-queue/types";
import { QUICK_QUEUE_STATUS_LIMITS as SL } from "@/features/quick-queue/limits";
import { isQuickQueueSlug } from "@/features/quick-queue/rules";
import { createVerifiedSet, createWindowCounter } from "@/features/quick-queue/status-limit";

export const dynamic = "force-dynamic";

/**
 * Consulta da tela "Minha senha" (#98). O endereço é o mesmo para todos: a senha vem só da
 * credencial do aparelho (cookie HttpOnly, caminho /b/<slug>/fila). A resposta traz só a senha
 * deste aparelho, a senha em atendimento e a contagem na frente.
 * Limite: 1 consulta a cada 2 s por aparelho (429 + LIMIT); retrato da fila guardado por 2 s.
 * Guard da senha já criada (#102): continua respondendo com a fila rápida desligada.
 * #148: consulta sem credencial conferida passa antes por um teto por barbearia, em memória e
 * antes de qualquer leitura no banco (sem dado de rede nem pessoal). O contrato não muda.
 */
const unverified = createWindowCounter(SL.unverifiedPerShop, SL.unverifiedWindowMs);
const verified = createVerifiedSet(SL.verifiedTtlMs);
export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const json = (body: QuickQueueStatusResponse, status = 200) =>
    NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

  const token = await readDeviceToken();
  const deviceHash = token ? hashDeviceToken(token) : null;
  // Liberação vale só para esta barbearia + esta credencial.
  const verifiedKey = deviceHash ? `${slug}:${deviceHash}` : null;
  // Endereço fora do formato: o guard recusa sem ir ao banco; não vira chave do contador.
  if (isQuickQueueSlug(slug) && !(verifiedKey && verified.has(verifiedKey)) && !unverified.hit(slug)) {
    return json({ ok: false, code: "LIMIT" }, 429);
  }

  let tenantId: string;
  try {
    ({ tenantId } = await requireQuickQueueTicketAccess(slug));
  } catch (e) {
    return json({ ok: false, code: e instanceof QuickQueueClosedError ? "CLOSED" : "GENERIC" });
  }

  if (!deviceHash) return json({ ok: true, ticket: null });

  const admin = createSupabaseAdminClient();
  const slot = await claimStatusSlot(admin, tenantId, deviceHash);
  if (slot === "error") return json({ ok: false, code: "GENERIC" }, 503);
  if (slot === "limited") {
    verified.add(verifiedKey!); // credencial válida (só cedo demais)
    return json({ ok: false, code: "LIMIT" }, 429);
  }
  if (!slot) {
    verified.delete(verifiedKey!);
    return json({ ok: true, ticket: null });
  }
  verified.add(verifiedKey!);

  const [mine, snap] = await Promise.all([loadDeviceTicket(admin, tenantId, slot.deviceId), loadSnapshot(admin, tenantId)]);
  if (mine === "error" || snap === "error") return json({ ok: false, code: "GENERIC" }, 503);
  return json({ ok: true, ticket: mine ? quickQueueMyTicket(mine, snap) : null });
}
