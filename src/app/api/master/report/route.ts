import { NextResponse } from "next/server";
import { getMonthlyReport, getBarbershopReport } from "@/features/platform/report";
import { getSessionUser } from "@/lib/auth/session";
import { isMaster } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** Autoriza por token compartilhado (gateway) OU sessão MASTER (download no painel). */
async function authorize(url: URL): Promise<boolean> {
  const token = process.env.REPORT_TOKEN;
  if (token && url.searchParams.get("token") === token) return true;
  const user = await getSessionUser();
  return !!user?.role && isMaster(user.role);
}

function parseDate(s: string | null): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0);
}

/**
 * Relatório em JSON: { kind, report }.
 * - Plataforma:  /api/master/report?ym=YYYY-MM
 * - Barbearia:   /api/master/report?tenant=<id>&from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!(await authorize(url))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tenant = url.searchParams.get("tenant");
  if (tenant) {
    const from = parseDate(url.searchParams.get("from"));
    let to = parseDate(url.searchParams.get("to"));
    if (to) to = new Date(to.getTime() + 24 * 60 * 60 * 1000); // fim exclusivo (inclui o dia "to")
    const report = await getBarbershopReport(tenant, from, to);
    if (!report) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ kind: "barbershop", report });
  }

  const ym = url.searchParams.get("ym");
  let ref: Date | undefined;
  if (ym && /^\d{4}-\d{2}$/.test(ym)) {
    const [y, m] = ym.split("-").map(Number);
    ref = new Date(y, m - 1, 15);
  }
  const report = await getMonthlyReport(ref);
  return NextResponse.json({ kind: "platform", report });
}
