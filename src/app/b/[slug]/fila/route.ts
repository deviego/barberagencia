import { NextResponse } from "next/server";
import { getTenantBySubdomain, TENANT_COOKIE } from "@/lib/tenant/resolve";

/**
 * QR do totem: /b/{slug}/fila
 * Grava o tenant no cookie e leva o visitante à tela da fila (login/cadastro se preciso).
 */
export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const { origin } = new URL(request.url);
  const tenant = await getTenantBySubdomain(slug);
  if (!tenant) return NextResponse.redirect(`${origin}/client/login?erro=barbearia-nao-encontrada`);

  const res = NextResponse.redirect(`${origin}/client/fila`);
  res.cookies.set(TENANT_COOKIE, slug, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}
