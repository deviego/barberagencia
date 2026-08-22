import { NextResponse } from "next/server";
import { getMonthlyReport, getBarbershopReport } from "@/features/platform/report";
import { authorizeReport } from "../_auth";

export const dynamic = "force-dynamic";

/** Nome de arquivo seguro para o header Content-Disposition (sem aspas/CRLF/path). */
function safeFileName(base: string): string {
  return base.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "relatorio";
}

function parseDate(s: string | null): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0);
}

/**
 * PDF profissional do relatório. O PDF é renderizado no gateway (pdfkit em Node
 * completo, sem os problemas de fonte em serverless); este route apenas monta os
 * dados e faz o proxy. Requer WA_SERVICE_URL/WA_SERVICE_TOKEN.
 * - Plataforma:  /api/master/report/pdf?ym=YYYY-MM
 * - Barbearia:   /api/master/report/pdf?tenant=<id>&from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!(await authorizeReport(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const base = process.env.WA_SERVICE_URL;
  const token = process.env.WA_SERVICE_TOKEN;
  if (!base || !token) {
    return NextResponse.json({ error: "Gateway (WA_SERVICE_URL/TOKEN) não configurado — necessário para gerar o PDF." }, { status: 503 });
  }

  const tenant = url.searchParams.get("tenant");
  let kind: "platform" | "barbershop" = "platform";
  let report: unknown;
  let fileName = "relatorio.pdf";

  if (tenant) {
    const from = parseDate(url.searchParams.get("from"));
    let to = parseDate(url.searchParams.get("to"));
    if (to) to = new Date(to.getTime() + 24 * 60 * 60 * 1000);
    const r = await getBarbershopReport(tenant, from, to);
    if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
    kind = "barbershop";
    report = r;
    fileName = `${safeFileName(`relatorio-${r.name.toLowerCase()}`)}.pdf`;
  } else {
    const ym = url.searchParams.get("ym");
    let ref: Date | undefined;
    if (ym && /^\d{4}-\d{2}$/.test(ym)) {
      const [y, m] = ym.split("-").map(Number);
      ref = new Date(y, m - 1, 15);
    }
    report = await getMonthlyReport(ref);
    fileName = "relatorio-plataforma.pdf";
  }

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/render-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-wa-token": token },
      body: JSON.stringify({ kind, report }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return NextResponse.json({ error: `Falha ao renderizar (gateway ${res.status})` }, { status: 502 });
    const buf = Buffer.from(await res.arrayBuffer());
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[report/pdf] falha ao renderizar no gateway:", e);
    return NextResponse.json({ error: "Falha ao gerar o PDF." }, { status: 502 });
  }
}
