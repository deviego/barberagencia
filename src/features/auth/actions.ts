"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { notifyWelcome } from "@/server/notifications/notify";
import { VIEW_AS_CLIENT_COOKIE } from "@/lib/auth/preview";
import { AREA_HEADER } from "@/lib/supabase/area";
import { getRequestOrigin } from "@/lib/http";
import { phoneDigits, syntheticEmail, isEmail } from "@/lib/auth/phone-identity";

/**
 * [Cliente] Cria a conta pelo telefone (e-mail opcional). Usa o service-role para
 * já confirmar a conta (o e-mail técnico não tem caixa de entrada). Se o cliente
 * informar um e-mail real, ele vira a identidade; senão, o telefone.
 * Retorna o e-mail de autenticação para o form fazer o signIn na sequência.
 */
export async function registerClientAccount(input: {
  name: string;
  phone: string;
  password: string;
  email?: string;
  tenantSubdomain?: string;
}): Promise<{ ok: true; authEmail: string } | { ok: false; error: string }> {
  const name = input.name?.trim();
  const digits = phoneDigits(input.phone ?? "");
  if (!name) return { ok: false, error: "Informe seu nome." };
  if (digits.length < 10) return { ok: false, error: "Informe um telefone válido com DDD." };
  if (!input.password || input.password.length < 8) return { ok: false, error: "A senha deve ter ao menos 8 caracteres." };

  const realEmail = input.email && isEmail(input.email) ? input.email.trim().toLowerCase() : null;
  const authEmail = realEmail ?? syntheticEmail(digits);
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email: authEmail,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: name, phone: input.phone, tenant_subdomain: input.tenantSubdomain },
  });
  if (error || !data.user) {
    const msg = (error?.message ?? "").toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists"))
      return { ok: false, error: "Este telefone/e-mail já tem conta. Faça login." };
    return { ok: false, error: error?.message ?? "Falha ao criar conta." };
  }

  // O trigger handle_new_user preenche clients.email com o e-mail de auth (técnico
  // quando sem e-mail real) — normaliza para o e-mail real ou nulo.
  await admin.from("clients").update({ email: realEmail }).eq("user_id", data.user.id);

  return { ok: true, authEmail };
}

/** Encerra a sessão da ÁREA atual (limpa o cookie dela) e volta ao login da área. */
export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  (await cookies()).delete(VIEW_AS_CLIENT_COOKIE);
  const area = (await headers()).get(AREA_HEADER) ?? "client";
  redirect(area === "admin" ? "/admin/login" : area === "master" ? "/master/login" : "/client/login");
}

/**
 * Login por E-MAIL ou TELEFONE. Se vier telefone, resolve o e-mail de auth real
 * vinculado (funciona p/ conta com e-mail real e p/ conta telefone-only), senão
 * usa o e-mail técnico. Faz o signIn no servidor (seta o cookie da área).
 */
export async function signInWithIdentifier(
  identifier: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = (identifier ?? "").trim();
  if (!id || !password) return { ok: false, error: "Informe telefone/e-mail e senha." };

  let email = id.toLowerCase();
  if (!isEmail(id)) {
    const digits = phoneDigits(id);
    if (digits.length < 10) return { ok: false, error: "Informe um e-mail ou telefone válido (com DDD)." };
    let resolved: string | null = null;
    try {
      const admin = createSupabaseAdminClient();
      const { data } = await admin.rpc("auth_email_for_phone", { p_digits: digits });
      resolved = (data as string | null) ?? null;
    } catch {
      /* usa o e-mail técnico abaixo */
    }
    email = (resolved ?? syntheticEmail(digits)).toLowerCase();
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: "Telefone/e-mail ou senha inválidos." };
  return { ok: true };
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
    const origin = await getRequestOrigin();
    const link = origin ? `${origin}/client` : null;
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

/** Sai do modo "ver como cliente" e volta ao painel ADMIN da barbearia (de onde o
 *  preview é sempre iniciado). MASTER volta ao /admin atuando na mesma barbearia
 *  (o "Painel Master" continua acessível pelo sidebar). */
export async function exitClientPreview() {
  (await cookies()).delete(VIEW_AS_CLIENT_COOKIE);
  const user = await getSessionUser();
  const dest = user?.role === "NETWORK_ADMIN" ? "/rede" : "/admin";
  redirect(dest);
}
