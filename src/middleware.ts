import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { AREA_HEADER, NEUTRAL_BRAND_HEADER, STAFF, areaFromKey, areaKeyFor, type AreaKey } from "@/lib/supabase/area";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { VIEW_AS_CLIENT_COOKIE } from "@/lib/auth/preview";
import { REF_COOKIE, normalizeRefCode } from "@/lib/partners/ref";

/** Grava o cookie de indicação (?ref=CODE), se presente, em qualquer resposta. */
function applyRefCookie(request: NextRequest, res: NextResponse): NextResponse {
  const ref = normalizeRefCode(request.nextUrl.searchParams.get("ref"));
  if (ref) res.cookies.set(REF_COOKIE, ref, { path: "/", maxAge: 60 * 60 * 24 * 90, sameSite: "lax" });
  return res;
}

/** Rotas públicas (sem sessão). Todo o resto exige login. */
const PUBLIC_PREFIXES = [
  "/client/login", "/client/cadastro", "/client/otp", "/client/recuperar-senha", "/client/redefinir-senha", "/client/auth",
  "/admin/login", "/admin/auth",
  "/master/login", "/master/auth",
  "/distributor/login", "/distributor/auth",
  "/b",
  "/design-system", "/termos", "/privacidade", "/convite", "/documentacao", "/distribuidoras",
  "/api/master/report", // protegido por token próprio (não exige sessão)
];
/** robots/sitemap/llms.txt: servidos direto (antes iam para /client/login). */
const SEO_FILES = new Set(["/robots.txt", "/sitemap.xml", "/llms.txt", "/llms-full.txt"]);
/** Páginas de login: se já logado (na área), redireciona para a home da área. */
const AUTH_PAGES = ["/client/login", "/client/cadastro", "/client/otp", "/admin/login", "/master/login", "/distributor/login"];

/** Rotas antigas → novas (compatibilidade com links já divulgados). */
const OLD_REDIRECTS: Record<string, string> = {
  "/login": "/client/login",
  "/cadastro": "/client/cadastro",
  "/otp": "/client/otp",
  "/recuperar-senha": "/client/recuperar-senha",
  "/redefinir-senha": "/client/redefinir-senha",
  "/cliente/login": "/client/login",
  "/cliente": "/client/login",
};

function areaHome(key: AreaKey) {
  return key === "admin" ? "/admin" : key === "master" ? "/master" : key === "distributor" ? "/distributor" : "/client";
}
function loginFor(path: string) {
  if (path.startsWith("/admin") || path.startsWith("/rede")) return "/admin/login";
  if (path.startsWith("/master")) return "/master/login";
  if (path.startsWith("/distributor")) return "/distributor/login";
  return "/client/login";
}
function isPublic(path: string) {
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}
function isAuthPage(path: string) {
  return AUTH_PAGES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Domínio de produção (.vercel.app) que deve redirecionar para o domínio oficial .com. */
const VERCEL_HOST = "barberagencia.vercel.app";
const OFFICIAL_HOST = "barberagencia.com";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Acessou pelo .vercel.app → redireciona (308) para o domínio oficial .com, mantendo o caminho.
  // (Só o alias de produção; previews barberagencia-*.vercel.app continuam funcionando.)
  if ((request.headers.get("host") ?? "") === VERCEL_HOST) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = OFFICIAL_HOST;
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  // Arquivos para buscadores e IAs: públicos, sem sessão e sem consulta ao Supabase.
  if (SEO_FILES.has(path)) return NextResponse.next();

  // Raiz = landing page pública (marketing). Não exige sessão.
  // Também captura o cookie de afiliado (?ref=CODE) para atribuição de indicação.
  // A landing é da marca Barber Agência: sempre a cor neutra (dourado), nunca a da barbearia do
  // cookie bb_tenant ou da sessão. O root layout lê este header.
  if (path === "/") {
    const landingHeaders = new Headers(request.headers);
    landingHeaders.set(NEUTRAL_BRAND_HEADER, "1");
    return applyRefCookie(request, NextResponse.next({ request: { headers: landingHeaders } }));
  }
  if (OLD_REDIRECTS[path])
    return NextResponse.redirect(new URL(OLD_REDIRECTS[path] + request.nextUrl.search, request.url));

  const areaKey = areaKeyFor(path);
  // "Ver como cliente": no /client, um admin/equipe é autorizado pela sessão de equipe (sb-stf).
  const previewAsClient =
    areaKey === "client" &&
    request.cookies.get(VIEW_AS_CLIENT_COOKIE)?.value === "1" &&
    request.cookies.getAll().some((c) => c.name.startsWith("sb-stf"));
  const area = previewAsClient ? STAFF : areaFromKey(areaKey);

  // Header para os Server Components saberem a área (qual cookie de sessão usar).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(AREA_HEADER, areaKey);
  requestHeaders.delete(NEUTRAL_BRAND_HEADER);
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const { url, anonKey } = supabasePublicEnv();
  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookieOptions: { name: area.name, path: area.path, sameSite: "lax", secure: true },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Não logado tentando rota protegida → login da área correspondente.
  if (!user && !isPublic(path)) {
    const url = request.nextUrl.clone();
    url.pathname = loginFor(path);
    url.search = "";
    // Área do cliente: depois de entrar, volta para onde ia (o login passa por safeNext).
    if (url.pathname === "/client/login") url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  // Logado na página de login da própria área → home da área.
  if (user && isAuthPage(path)) {
    const url = request.nextUrl.clone();
    url.pathname = areaHome(areaKey);
    return NextResponse.redirect(url);
  }

  // Headers de segurança (CSP/HSTS/etc.) são aplicados globalmente em next.config.mjs
  // (cobrem também redirects e assets estáticos que o matcher do middleware exclui).
  return applyRefCookie(request, response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf|woff2?|pdf|html)$).*)"],
};
