import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { VIEW_AS_CLIENT_COOKIE } from "@/lib/auth/preview";
import { safeNext } from "@/lib/auth/safe-next";
import { createClientAreaSupabase, hasAnyMembership, shopFromCookie } from "@/features/auth/google-server";
import { consumeLinkIntent } from "@/features/auth/google-link";
import { freshGoogleNextToPassword } from "@/features/auth/google-link-rules";
import type { GoogleCallbackError } from "@/features/auth/google-types";

/**
 * Callback PKCE da ÁREA DO CLIENTE: confirmação de e-mail, redefinição de senha e Entrar com
 * Google (#170).
 * - A sessão é gravada SEMPRE no cookie da área do cliente (nunca no de equipe).
 * - Conta sem vínculo nenhum vai para /client/confirmar-whatsapp, ignorando `next`; sem
 *   barbearia válida no bb_tenant, sai da sessão e volta ao login.
 * - Destino só dentro da área do cliente (safeNext).
 * - Google recém-ligado a conta com senha, sem intenção de vínculo do servidor: desfeito (#171).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const toLogin = (error: GoogleCallbackError) => NextResponse.redirect(`${origin}/client/login?error=${error}`);

  const code = searchParams.get("code");
  if (!code) {
    // O provedor voltou sem código: cancelado, ou Google já ligado a outra conta (vindo do perfil).
    // Nenhum texto do provedor é repassado para a tela.
    if (searchParams.get("error_code") === "identity_already_exists") {
      return NextResponse.redirect(`${origin}/client/perfil?error=conta_vinculada_outra`);
    }
    return toLogin(searchParams.get("error") === "access_denied" ? "google_cancelado" : "auth");
  }

  // "Ver como cliente" da equipe não pode receber esta sessão.
  (await cookies()).delete(VIEW_AS_CLIENT_COOKIE);
  const supabase = await createClientAreaSupabase();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return toLogin("auth");

  const admin = createSupabaseAdminClient();

  // Google que acabou de ser ligado a uma conta que também entra por senha só vale com a intenção
  // de vínculo criada pelo servidor (perfil ou prova de posse). Sem ela, desfaz e sai (#171).
  const intentOk = await consumeLinkIntent(admin, data.user);
  const fresh = freshGoogleNextToPassword(data.user.identities, Date.now());
  if (fresh && !intentOk) {
    const { error: unlinkError } = await supabase.auth.unlinkIdentity(fresh);
    if (unlinkError) console.error(`[auth-google] desfazer vínculo falhou (${unlinkError.code ?? "sem código"})`);
    await supabase.auth.signOut();
    return toLogin("email_ja_tem_conta");
  }

  const member = await hasAnyMembership(admin, data.user.id);
  if (member === null) return toLogin("auth");
  if (!member) {
    if (!(await shopFromCookie(admin))) {
      await supabase.auth.signOut();
      return toLogin("google_sem_barbearia");
    }
    return NextResponse.redirect(`${origin}/client/confirmar-whatsapp`);
  }
  return NextResponse.redirect(`${origin}${safeNext(searchParams.get("next"), origin, "client")}`);
}
