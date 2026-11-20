import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireQuickQueueOpen, QuickQueueClosedError } from "@/features/quick-queue/guard";
import { hashDeviceToken, readDeviceToken } from "@/features/quick-queue/device";
import { quickQueueMyTicket } from "@/features/quick-queue/rules";
import { claimStatusSlot, loadDeviceTicket, loadSnapshot } from "@/features/quick-queue/ticket";
import type { QuickQueueStatusResponse } from "@/features/quick-queue/types";

export const dynamic = "force-dynamic";

/**
 * Consulta da tela "Minha senha" (#98). O endereço é o mesmo para todos: a senha vem só da
 * credencial do aparelho (cookie HttpOnly, caminho /b/<slug>/fila). A resposta traz só a senha
 * deste aparelho, a senha em atendimento e a contagem na frente.
 * Limite: 1 consulta a cada 2 s por aparelho (429 + LIMIT); retrato da fila guardado por 2 s.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const json = (body: QuickQueueStatusResponse, status = 200) =>
    NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

  let tenantId: string;
  try {
    ({ tenantId } = await requireQuickQueueOpen(slug));
  } catch (e) {
    return json({ ok: false, code: e instanceof QuickQueueClosedError ? "CLOSED" : "GENERIC" });
  }

  const token = await readDeviceToken();
  if (!token) return json({ ok: true, ticket: null });

  const admin = createSupabaseAdminClient();
  const slot = await claimStatusSlot(admin, tenantId, hashDeviceToken(token));
  if (slot === "error") return json({ ok: false, code: "GENERIC" }, 503);
  if (slot === "limited") return json({ ok: false, code: "LIMIT" }, 429);
  if (!slot) return json({ ok: true, ticket: null });

  const [mine, snap] = await Promise.all([loadDeviceTicket(admin, tenantId, slot.deviceId), loadSnapshot(admin, tenantId)]);
  if (mine === "error" || snap === "error") return json({ ok: false, code: "GENERIC" }, 503);
  return json({ ok: true, ticket: mine ? quickQueueMyTicket(mine, snap) : null });
}
