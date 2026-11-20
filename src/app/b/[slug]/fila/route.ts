import { NextResponse } from "next/server";
import { getTenantBySubdomain, TENANT_COOKIE } from "@/lib/tenant/resolve";
import { getQuickQueueRoute } from "@/features/quick-queue/data";

/**
 * QR do cliente: /b/{slug}/fila (o QR impresso nunca muda).
 * Despachante no servidor:
 * - fila rápida desligada → exatamente como antes: grava o tenant no cookie e leva à fila com login;
 * - fila rápida ligada → /b/{slug}/fila/rapida, sem login nem cadastro.
 * O endereço final não leva chave, sessão nem dado de cliente: só o slug.
 */
export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const { origin } = new URL(request.url);
  const tenant = await getTenantBySubdomain(slug);
  if (!tenant) return NextResponse.redirect(`${origin}/client/login?erro=barbearia-nao-encontrada`);

  const route = await getQuickQueueRoute(slug);
  const target = route === "QUICK" ? `${origin}/b/${encodeURIComponent(slug)}/fila/rapida` : `${origin}/client/fila`;

  // O cookie só guarda o slug (já público no endereço). Na fila rápida ele faz o aviso de
  // privacidade e o restante do app abrirem com a marca desta barbearia.
  const res = NextResponse.redirect(target);
  res.cookies.set(TENANT_COOKIE, slug, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}
