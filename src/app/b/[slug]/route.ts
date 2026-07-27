import { NextResponse } from "next/server";
import { getTenantBySubdomain, TENANT_COOKIE } from "@/lib/tenant/resolve";

/**
 * Link público da barbearia: /b/{slug}
 * Grava o tenant num cookie (1 ano) e leva o visitante ao app do cliente.
 * É o link que cada barbearia divulga (funciona sem domínio próprio).
 */
export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const { origin } = new URL(request.url);
  const tenant = await getTenantBySubdomain(slug);

  if (!tenant) {
    return NextResponse.redirect(`${origin}/client/login?erro=barbearia-nao-encontrada`);
  }

  const res = NextResponse.redirect(`${origin}/client`);
  res.cookies.set(TENANT_COOKIE, slug, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}
