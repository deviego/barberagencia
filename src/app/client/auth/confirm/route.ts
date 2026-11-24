import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { AREAS } from "@/lib/supabase/area";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { VIEW_AS_CLIENT_COOKIE } from "@/lib/auth/preview";

/**
 * Confirmação do link de "Esqueci minha senha" (área do cliente). Confere no servidor o código de
 * uso único (token_hash) e grava a sessão no cookie da área do cliente; depois abre a tela de nova
 * senha. Só o tipo "recovery" é aceito.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const fail = NextResponse.redirect(`${origin}/client/recuperar-senha?error=link`);
  if (!tokenHash || type !== "recovery" || tokenHash.length > 512) return fail;

  const cookieStore = await cookies();
  cookieStore.delete(VIEW_AS_CLIENT_COOKIE);
  const area = AREAS.client;
  const { url, anonKey } = supabasePublicEnv();
  const supabase = createServerClient(url, anonKey, {
    cookieOptions: { name: area.name, path: area.path, sameSite: "lax", secure: true },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list: { name: string; value: string; options?: Record<string, unknown> }[]) =>
        list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  });
  const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
  if (error) return fail;
  return NextResponse.redirect(`${origin}/client/redefinir-senha`);
}
