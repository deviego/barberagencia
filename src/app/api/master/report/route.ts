import { NextResponse } from "next/server";
import { getMonthlyReport } from "@/features/platform/report";

export const dynamic = "force-dynamic";

/**
 * Relatório mensal consolidado em JSON — consumido pelo agendador (gateway) que
 * gera o PDF e envia no WhatsApp. Protegido por token compartilhado (REPORT_TOKEN).
 * GET /api/master/report?token=...&ym=YYYY-MM (ym opcional; padrão = mês atual)
 */
export async function GET(request: Request) {
  const token = process.env.REPORT_TOKEN;
  const url = new URL(request.url);
  if (!token || url.searchParams.get("token") !== token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ym = url.searchParams.get("ym"); // "YYYY-MM"
  let ref: Date | undefined;
  if (ym && /^\d{4}-\d{2}$/.test(ym)) {
    const [y, m] = ym.split("-").map(Number);
    ref = new Date(y, m - 1, 15); // meio do mês → evita borda de fuso
  }

  const report = await getMonthlyReport(ref);
  return NextResponse.json(report);
}
