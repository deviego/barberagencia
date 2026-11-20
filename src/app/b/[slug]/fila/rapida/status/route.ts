import { NextResponse } from "next/server";
import { requireQuickQueueOpen, QuickQueueClosedError } from "@/features/quick-queue/guard";
import type { QuickQueueStatusResponse } from "@/features/quick-queue/types";

export const dynamic = "force-dynamic";

/**
 * Consulta da tela "Minha senha" (#98). CONTRATO FECHADO; a leitura da senha pela credencial do
 * aparelho, o limite por aparelho e o retrato de 2 s entram com o back da #98 (depois da
 * schema-54). Até lá responde "sem senha" para todos.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const json = (body: QuickQueueStatusResponse, status = 200) =>
    NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  try {
    await requireQuickQueueOpen(slug);
  } catch (e) {
    return json({ ok: false, code: e instanceof QuickQueueClosedError ? "CLOSED" : "GENERIC" });
  }
  return json({ ok: true, ticket: null });
}
