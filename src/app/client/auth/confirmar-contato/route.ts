import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { consumeContactConfirmation } from "@/features/auth/contact-email";

/**
 * Link de confirmação do e-mail de contato (#177). O token vale uma vez, no servidor; não cria
 * sessão. Depois abre o perfil com o resultado.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("token") ?? "";
  const r = await consumeContactConfirmation(createSupabaseAdminClient(), token);
  const status = r === "ok" ? "confirmado" : "link-invalido";
  return NextResponse.redirect(`${origin}/client/perfil?contato=${status}`);
}
