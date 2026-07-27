import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { AREA_HEADER, areaFromKey, areaKeyFor, type AreaKey } from "@/lib/supabase/area";

/** Rotas públicas (sem sessão). Todo o resto exige login. */
const PUBLIC_PREFIXES = [
  "/client/login", "/client/cadastro", "/client/otp", "/client/recuperar-senha", "/client/redefinir-senha", "/client/auth",
  "/admin/login", "/admin/auth",
  "/master", "/master/auth",
  "/design-system", "/termos", "/privacidade", "/convite", "/documentacao",
];
/** Páginas de login: se já logado (na área), redireciona para a home da área. */
const AUTH_PAGES = ["/client/login", "/client/cadastro", "/client/otp", "/admin/login", "/master/login"];

/** Rotas antigas → novas (compatibilidade com links já divulgados). */
const OLD_REDIRECTS: Record<string, string> = {
  "/login": "/client/login",
  "/cadastro": "/client/cadastro",
  "/otp": "/client/otp",
  "/recuperar-senha": "/client/recuperar-senha",
  "/redefinir-senha": "/client/redefinir-senha",
};

function areaHome(key: AreaKey) {
  return key === "admin" ? "/admin" : key === "master" ? "/master" : "/client";
}
function loginFor(path: string) {
  if (path.startsWith("/admin") || path.startsWith("/rede")) return "/admin/login";
  if (path.startsWith("/master")) return "/master/login";
  return "/client/login";
}
function isPublic(path: string) {
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}
function isAuthPage(path: string) {
  return AUTH_PAGES.some((p) => path === p || path.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Raiz e rotas antigas → área do cliente.
  if (path === "/") return NextResponse.redirect(new URL("/client", request.url));
  if (OLD_REDIRECTS[path])
    return NextResponse.redirect(new URL(OLD_REDIRECTS[path] + request.nextUrl.search, request.url));

  const areaKey = areaKeyFor(path);
  const area = areaFromKey(areaKey);

  // Header para os Server Components saberem a área (qual cookie de sessão usar).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(AREA_HEADER, areaKey);
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
    return NextResponse.redirect(url);
  }
  // Logado na página de login da própria área → home da área.
  if (user && isAuthPage(path)) {
    const url = request.nextUrl.clone();
    url.pathname = areaHome(areaKey);
    return NextResponse.redirect(url);
  }

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf|woff2?|pdf|html)$).*)"],
};
