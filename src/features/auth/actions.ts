"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { notifyWelcome } from "@/server/notifications/notify";
import { VIEW_AS_CLIENT_COOKIE } from "@/lib/auth/preview";
import { AREA_HEADER } from "@/lib/supabase/area";

/** Encerra a sessão da ÁREA atual (limpa o cookie dela) e volta ao login da área. */
export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  (await cookies()).delete(VIEW_AS_CLIENT_COOKIE);
  const area = (await headers()).get(AREA_HEADER) ?? "client";
  redirect(area === "admin" ? "/admin/login" : area === "master" ? "/master/login" : "/client/login");
}

/** Envia o e-mail de boas-vindas ao usuário logado (chamado logo após o cadastro). */
export async function sendWelcomeEmail() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false as const };
  const name = (user.user_metadata?.full_name as string | undefined) ?? "";
  const phone = (user.user_metadata?.phone as string | undefined) ?? null;
  const tenant = await getCurrentTenant();
  try {
    const hdrs = await headers();
    const host = hdrs.get("host") ?? "";
    const proto = host.includes("localhost") ? "http" : "https";
    const link = host ? `${proto}://${host}/client` : null;
    await notifyWelcome(user.email, name, tenant.name, { phone, link, tenantId: tenant.id });
  } catch {
    /* não bloqueia o cadastro se a boas-vindas falhar */
  }
  return { ok: true as const };
}

/** Admin entra no modo "ver como cliente" (pré-visualiza o app da própria barbearia). */
export async function enterClientPreview() {
  (await cookies()).set(VIEW_AS_CLIENT_COOKIE, "1", { path: "/", sameSite: "lax" });
  redirect("/client");
}

/** Sai do modo "ver como cliente" e volta ao painel do papel. */
export async function exitClientPreview() {
  (await cookies()).delete(VIEW_AS_CLIENT_COOKIE);
  const user = await getSessionUser();
  const dest = user?.role === "MASTER" ? "/master" : user?.role === "NETWORK_ADMIN" ? "/rede" : "/admin";
  redirect(dest);
}
