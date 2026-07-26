"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { notifyWelcome } from "@/server/notifications/notify";
import { VIEW_AS_CLIENT_COOKIE } from "@/lib/auth/preview";

/** Encerra a sessão no servidor (limpa cookies) e volta ao login. */
export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  (await cookies()).delete(VIEW_AS_CLIENT_COOKIE);
  redirect("/login");
}

/** Envia o e-mail de boas-vindas ao usuário logado (chamado logo após o cadastro). */
export async function sendWelcomeEmail() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false as const };
  const name = (user.user_metadata?.full_name as string | undefined) ?? "";
  const tenant = await getCurrentTenant();
  try {
    await notifyWelcome(user.email, name, tenant.name);
  } catch {
    /* não bloqueia o cadastro se o e-mail falhar */
  }
  return { ok: true as const };
}

/** Admin entra no modo "ver como cliente" (visualiza o app do cliente). */
export async function enterClientPreview() {
  (await cookies()).set(VIEW_AS_CLIENT_COOKIE, "1", { path: "/", sameSite: "lax" });
  redirect("/");
}

/** Sai do modo "ver como cliente" e volta ao painel do papel. */
export async function exitClientPreview() {
  (await cookies()).delete(VIEW_AS_CLIENT_COOKIE);
  const user = await getSessionUser();
  const dest = user?.role === "MASTER" ? "/master" : user?.role === "NETWORK_ADMIN" ? "/rede" : "/admin";
  redirect(dest);
}
