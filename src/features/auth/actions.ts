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
import { createHash } from "crypto";
import { phoneDigits, syntheticEmail, isEmail } from "@/lib/auth/phone-identity";
import { isTechnicalEmail, loginEmailFor } from "./account-lookup";
import { sendContactConfirmation } from "./contact-email";
import { finishPendingInvite, markPendingInvite, readPendingInvite } from "./pending-invite";

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
  /** Aceite de convite: o token do link. O cadastro liga a ficha convidada só por ele. */
  inviteToken?: string;
}): Promise<
  | { ok: true; authEmail: string; /** convite ainda não ligado: chamar completeInviteAcceptance já logado */ pendingInvite?: true }
  | { ok: false; error: string }
> {
  const name = input.name?.trim();
  const digits = phoneDigits(input.phone ?? "");
  if (!name) return { ok: false, error: "Informe seu nome." };
  if (digits.length < 10) return { ok: false, error: "Informe um telefone válido com DDD." };
  if (!input.password || input.password.length < 8) return { ok: false, error: "A senha deve ter ao menos 8 caracteres." };

  // E-mail de autenticação SEMPRE técnico (a partir do telefone); o e-mail real é só contato e só
  // vale para entrar e recuperar a senha depois de confirmado (#177).
  const contact = input.email && isEmail(input.email) ? input.email.trim().toLowerCase() : null;
  if (contact && isTechnicalEmail(contact)) return { ok: false, error: "Confira o e-mail." };
  const authEmail = syntheticEmail(digits);
  const admin = createSupabaseAdminClient();

  // Convite: confere antes (mensagem clara); o banco confere de novo e usa o convite uma vez só.
  let inviteHash: string | null = null;
  if (input.inviteToken) {
    const token = input.inviteToken.trim();
    if (!/^[A-Za-z0-9_-]{8,200}$/.test(token)) return { ok: false, error: "Este convite não vale mais." };
    const { data: inv } = await admin
      .from("client_invites")
      .select("status, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (!inv || inv.status !== "PENDING" || new Date(inv.expires_at as string).getTime() <= Date.now()) {
      return { ok: false, error: "Este convite não vale mais." };
    }
    inviteHash = createHash("sha256").update(token).digest("hex");
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: authEmail,
    password: input.password,
    email_confirm: true,
    // Com convite a barbearia vem do convite (finalize_client_signup), nunca do pedido.
    user_metadata: { full_name: name, phone: input.phone, tenant_subdomain: inviteHash ? undefined : input.tenantSubdomain },
  });
  if (error || !data.user) {
    const msg = (error?.message ?? "").toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists"))
      return { ok: false, error: "Este telefone já tem conta. Faça login." };
    return { ok: false, error: "Não foi possível criar a conta. Tente de novo." };
  }

  // Cadastro comum com o telefone de uma ficha convidada: nasce ficha NOVA (decisão do CTO; unir
  // fichas é o #184). O índice único do telefone não quebra: a ficha nova fica sem chave de
  // telefone (regra do gatilho da schema-52), coberto no teste de banco do cadastro.
  // Contato (sem confirmar) e, com convite, o aceite de uso único: tudo no banco, pelo servidor.
  // A conta já existe daqui em diante: falha aqui nunca vira "tente de novo" (cairia em "já tem
  // conta"). Com convite, uma nova tentativa na hora; se ainda falhar, a tela conclui o aceite
  // depois, já logada (completeInviteAcceptance).
  const finalize = () =>
    admin.rpc("finalize_client_signup", {
      p_user_id: data.user.id,
      p_contact_email: contact,
      p_invite_token_hash: inviteHash,
    });
  let { data: fin, error: finError } = await finalize();
  if (inviteHash && (finError || fin !== "OK")) ({ data: fin, error: finError } = await finalize());
  if (finError || fin !== "OK") {
    // Erro, INVITE_INVALID (convite vencido/usado) ou INVALID (conta fora da regra): registra, sem dado pessoal.
    console.error(
      finError ? `[auth] cadastro sem finalização (${finError.code ?? "sem código"})` : `[auth] cadastro não finalizado (${String(fin)})`
    );
    if (!inviteHash) return { ok: true, authEmail };
    // Marca a conta para o login e a área do cliente concluírem o aceite depois (janela de 1 h).
    // Falha ao marcar só registra: a resposta do cadastro é a mesma.
    await markPendingInvite(admin, data.user.id, inviteHash, data.user.created_at);
    return { ok: true, authEmail, pendingInvite: true };
  }
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

  if (!isEmail(id) && phoneDigits(id).length < 10) {
    return { ok: false, error: "Informe um e-mail ou telefone válido (com DDD)." };
  }
  // E-mail de contato CONFIRMADO ou telefone → e-mail de autenticação, no servidor.
  const admin = createSupabaseAdminClient();
  let email: string | null = null;
  try {
    email = await loginEmailFor(admin, id);
  } catch {
    email = null;
  }
  if (!email) email = isEmail(id) ? id.toLowerCase() : syntheticEmail(phoneDigits(id));

  // Limite por identificador e por conta (o Auth só vê o IP do servidor). Mesma mensagem de senha
  // errada, exista a conta ou não.
  const LOGIN_LIMIT = { windowSeconds: 15 * 60, perId: 10, perAccount: 10 } as const;
  for (const [scope, key, max] of [
    ["login_identifier", createHash("sha256").update(id.toLowerCase()).digest("hex"), LOGIN_LIMIT.perId],
    ["login_account", createHash("sha256").update(email).digest("hex"), LOGIN_LIMIT.perAccount],
  ] as const) {
    const { data: ok, error: limitError } = await admin.rpc("rate_limit_hit", {
      p_scope: scope,
      p_key: key,
      p_window_seconds: LOGIN_LIMIT.windowSeconds,
      p_limit: max,
    });
    // Sem conseguir conferir o limite: recusa com a mesma mensagem (não segue sem limite).
    if (limitError || ok === false) return { ok: false, error: "Telefone/e-mail ou senha inválidos." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: signed, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: "Telefone/e-mail ou senha inválidos." };

  // Convite pendente do cadastro (marcador do servidor): senha certa conclui o aceite aqui mesmo,
  // para a conta que acabou de entrar. Vencido só é limpo. Nada disso muda a resposta do login;
  // se ainda não der, a área do cliente manda para /client/concluir-convite.
  if (signed?.user && readPendingInvite(signed.user.app_metadata).state !== "none") {
    try {
      await finishPendingInvite(admin, signed.user.id);
    } catch {
      console.error("[auth] convite pendente não concluído no login");
    }
  }
  return { ok: true };
}

/** Envia o e-mail de boas-vindas ao usuário logado (chamado logo após o cadastro). */
export async function sendWelcomeEmail() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };
  // E-mail de CONTATO (o de autenticação pode ser técnico). Contato ainda não confirmado: a
  // boas-vindas já leva o link de confirmação (mesmo canal, um e-mail só).
  const admin = createSupabaseAdminClient();
  const { data: p } = await admin
    .from("profiles")
    .select("contact_email, contact_email_verified_at")
    .eq("id", user.id)
    .maybeSingle();
  const contact = (p?.contact_email as string | null) ?? (isTechnicalEmail(user.email) ? null : user.email ?? null);
  if (!contact) return { ok: false as const };
  const name = (user.user_metadata?.full_name as string | undefined) ?? "";
  if (p?.contact_email && !p.contact_email_verified_at) {
    const tenantForEmail = await getCurrentTenant();
    try {
      await sendContactConfirmation(admin, { id: user.id, name }, contact, { welcome: true, tenantId: tenantForEmail.id });
    } catch {
      /* não bloqueia o cadastro */
    }
    return { ok: true as const };
  }
  const phone = (user.user_metadata?.phone as string | undefined) ?? null;
  const tenant = await getCurrentTenant();
  try {
    const origin = await getRequestOrigin();
    const link = origin ? `${origin}/client` : null;
    await notifyWelcome(contact, name, tenant.name, { phone, link, tenantId: tenant.id });
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
