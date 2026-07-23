import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Rotas públicas (sem sessão). Todo o resto exige login. */
const PUBLIC_PREFIXES = [
  "/login", "/admin/login", "/master/login", "/cadastro", "/otp", "/recuperar-senha", "/redefinir-senha",
  "/design-system", "/auth", "/termos", "/privacidade", "/convite",
];
/** Páginas de login: se já logado, redireciona para a home (guardas roteiam por papel). */
const AUTH_PAGES = ["/login", "/admin/login", "/master/login", "/cadastro", "/otp"];

/** Tela de login apropriada para uma rota protegida. */
function loginFor(path: string) {
  if (path.startsWith("/admin")) return "/admin/login";
  if (path.startsWith("/master")) return "/master/login";
  if (path.startsWith("/rede")) return "/admin/login";
  return "/login";
}

function isPublic(path: string) {
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}
function isAuthPage(path: string) {
  return AUTH_PAGES.some((p) => path === p || path.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Não logado tentando rota protegida → login da área correspondente
  if (!user && !isPublic(path)) {
    const url = request.nextUrl.clone();
    url.pathname = loginFor(path);
    return NextResponse.redirect(url);
  }
  // Logado numa página de auth → home (o layout redireciona por papel)
  if (user && isAuthPage(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf|woff2?)$).*)"],
};
