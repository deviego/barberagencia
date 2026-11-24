"use server";

import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { formatPhoneKey, phoneKey } from "@/lib/phone";
import { syntheticEmail } from "@/lib/auth/phone-identity";
import { createClientAreaSupabase, hasAnyMembership, shopFromCookie } from "./google-server";
import { setLinkIntent } from "./google-link";
import { provisionalEligible } from "./google-link-rules";
import {
  GOOGLE_LOGIN_MESSAGES as MSG,
  type ConfirmWhatsappInput,
  type ConfirmWhatsappResult,
  type ProveAccountAndLinkInput,
  type ProveAccountAndLinkResult,
  type StartGoogleLinkResult,
} from "./google-types";

/*
 * Ações do "Entrar com Google" (ADR 0005).
 * Por que service role: a conta pendente ainda não tem vínculo, então a RLS não deixa ela criar
 * a própria ficha. O usuário vem só da sessão da área do cliente; a barbearia só do cookie
 * bb_tenant, validada no servidor. Nada aqui recebe id de usuário, cliente ou barbearia do
 * navegador, e nenhum log leva telefone, nome ou e-mail.
 */

const ConfirmInput = z.object({ phone: z.string().max(40) });

/** Tentativas por conta na janela (confirmar WhatsApp). */
const CONFIRM_LIMIT = { windowSeconds: 10 * 60, perUser: 10 } as const;

const fail = <C extends string>(code: C, error: string) => ({ ok: false as const, code, error });

/**
 * Confirma o WhatsApp de uma conta que entrou pelo Google e ainda não é cliente (#170).
 * Telefone sem conta: cria a ficha e o vínculo CLIENT na barbearia do bb_tenant.
 * Telefone que já tem conta: NEEDS_PROOF (nunca liga só pelo telefone).
 */
export async function confirmWhatsapp(input: ConfirmWhatsappInput): Promise<ConfirmWhatsappResult> {
  const parsed = ConfirmInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_PHONE", MSG.invalidPhone);
  const key = phoneKey(parsed.data.phone);
  if (!key) return fail("INVALID_PHONE", MSG.invalidPhone);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("NOT_SIGNED_IN", MSG.notSignedIn);

  const admin = createSupabaseAdminClient();
  const { data: allowed, error: limitError } = await admin.rpc("rate_limit_hit", {
    p_scope: "google_confirm",
    p_key: user.id,
    p_window_seconds: CONFIRM_LIMIT.windowSeconds,
    p_limit: CONFIRM_LIMIT.perUser,
  });
  if (limitError) return fail("GENERIC", MSG.failed);
  if (allowed === false) return fail("LIMIT", MSG.limited);

  const member = await hasAnyMembership(admin, user.id);
  if (member === null) return fail("GENERIC", MSG.failed);
  if (member) return { ok: true, next: "/client" }; // já confirmado

  const shop = await shopFromCookie(admin);
  if (!shop) return fail("NO_SHOP", MSG.noShop);

  // Telefone que já tem conta (em qualquer barbearia): só com prova de posse (#171).
  const { data: existing, error: existsError } = await admin.rpc("auth_email_for_phone", { p_digits: key });
  if (existsError) return fail("GENERIC", MSG.failed);
  if (existing) return fail("NEEDS_PROOF", MSG.needsProof);
  // Ficha desta barbearia com o mesmo telefone (ex.: convite ainda sem conta): não é assumida.
  const { data: sameShop, error: sameError } = await admin
    .from("clients")
    .select("id")
    .eq("tenant_id", shop.id)
    .eq("phone_key", key)
    .limit(1);
  if (sameError) return fail("GENERIC", MSG.failed);
  if ((sameShop ?? []).length) return fail("NEEDS_PROOF", MSG.needsProof);

  const phone = formatPhoneKey(key);
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name = String(meta.full_name ?? meta.name ?? "").trim().slice(0, 120) || "Cliente";

  // Ficha desta conta nesta barbearia: reaproveita a de uma tentativa anterior que parou no meio.
  const { data: mine, error: mineError } = await admin
    .from("clients")
    .select("id")
    .eq("tenant_id", shop.id)
    .eq("user_id", user.id)
    .limit(1);
  if (mineError) return fail("GENERIC", MSG.failed);
  if (!(mine ?? []).length) {
    const { error: insError } = await admin.from("clients").insert({
      tenant_id: shop.id,
      user_id: user.id,
      name,
      email: user.email ?? null,
      phone,
      status: "ACTIVE",
    });
    if (insError) {
      console.error(`[auth-google] ficha não criada (${insError.code ?? "sem código"})`);
      return fail("GENERIC", MSG.failed);
    }
  }

  const { error: memError } = await admin
    .from("memberships")
    .upsert({ user_id: user.id, tenant_id: shop.id, role: "CLIENT" }, { onConflict: "user_id,tenant_id,role", ignoreDuplicates: true });
  if (memError) {
    console.error(`[auth-google] vínculo não criado (${memError.code ?? "sem código"})`);
    return fail("GENERIC", MSG.failed);
  }
  await admin.from("profiles").update({ phone }).eq("id", user.id);

  return { ok: true, next: "/client" };
}

const ProveInput = z.object({ phone: z.string().max(40), password: z.string().min(1).max(200) });
/** Tentativas de prova: por conta provisória e por telefone (o limite do Auth é por IP do servidor). */
const PROVE_LIMIT = { windowSeconds: 15 * 60, perUser: 5, perPhone: 5 } as const;
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

async function hit(admin: ReturnType<typeof createSupabaseAdminClient>, scope: string, key: string, max: number) {
  const { data, error } = await admin.rpc("rate_limit_hit", {
    p_scope: scope,
    p_key: key,
    p_window_seconds: PROVE_LIMIT.windowSeconds,
    p_limit: max,
  });
  return error ? "error" : data === false ? "limited" : "ok";
}

/**
 * Prova de posse da conta existente e vínculo do Google (#171). Ordem: confere a senha da conta
 * existente → encerra a conta provisória (só se estiver vazia; condições em provisionalEligible)
 * → entra na conta existente → registra a intenção de vínculo. Com ok, o NAVEGADOR chama
 * linkIdentity. Desistir no meio deixa só a conta existente.
 */
export async function proveAccountAndLink(input: ProveAccountAndLinkInput): Promise<ProveAccountAndLinkResult> {
  const parsed = ProveInput.safeParse(input);
  if (!parsed.success) return fail("WRONG_CREDENTIALS", MSG.wrongCredentials);
  const key = phoneKey(parsed.data.phone);
  if (!key) return fail("WRONG_CREDENTIALS", MSG.wrongCredentials);

  const area = await createClientAreaSupabase();
  const {
    data: { user },
  } = await area.auth.getUser();
  if (!user) return fail("NOT_SIGNED_IN", MSG.notSignedIn);

  const admin = createSupabaseAdminClient();
  for (const [scope, k, max] of [
    ["google_prove_user", user.id, PROVE_LIMIT.perUser],
    ["google_prove_phone", sha256(key), PROVE_LIMIT.perPhone],
  ] as const) {
    const r = await hit(admin, scope, k, max);
    if (r === "error") return fail("GENERIC", MSG.failed);
    if (r === "limited") return fail("LIMIT", MSG.limited);
  }

  // A conta da sessão precisa ser uma provisória vazia (só Google, sem vínculo, sem ficha, < 24 h).
  const [{ data: full, error: uErr }, members, clientsRes] = await Promise.all([
    admin.auth.admin.getUserById(user.id),
    admin.from("memberships").select("user_id", { count: "exact", head: true }).eq("user_id", user.id),
    admin.from("clients").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  if (uErr || !full.user || members.error || clientsRes.error) return fail("GENERIC", MSG.failed);
  const eligible = provisionalEligible({
    sessionUserId: user.id,
    user: full.user,
    memberships: members.count ?? 0,
    clients: clientsRes.count ?? 0,
    now: Date.now(),
  });
  if (!eligible) return fail("NOT_ELIGIBLE", MSG.notEligible);

  // 1) Senha da conta existente, num cliente à parte (não mexe na sessão atual).
  const { data: resolved } = await admin.rpc("auth_email_for_phone", { p_digits: key });
  const email = ((resolved as string | null) ?? syntheticEmail(key)).toLowerCase();
  const { url, anonKey } = supabasePublicEnv();
  const probe = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: signed, error: signError } = await probe.auth.signInWithPassword({ email, password: parsed.data.password });
  if (signError || !signed.session || !signed.user || signed.user.id === user.id) {
    return fail("WRONG_CREDENTIALS", MSG.wrongCredentials);
  }

  // 2) Encerra a conta provisória (só ela, pelo id da sessão).
  const { error: delError } = await admin.auth.admin.deleteUser(user.id);
  if (delError) {
    console.error(`[auth-google] conta provisória não encerrada (${delError.code ?? "sem código"})`);
    return fail("GENERIC", MSG.failed);
  }
  console.info("[auth-google] conta provisória encerrada na prova de posse");

  // 3) Entra na conta existente (cookie da área do cliente).
  const { error: setError } = await area.auth.setSession({
    access_token: signed.session.access_token,
    refresh_token: signed.session.refresh_token,
  });
  if (setError) return fail("NOT_SIGNED_IN", MSG.notSignedIn);

  // 4) Intenção de vínculo para o callback aceitar o Google nesta conta.
  if (!(await setLinkIntent(admin, signed.user.id))) return fail("GENERIC", MSG.failed);
  return { ok: true, next: "LINK_GOOGLE" };
}

/** "Conectar com Google" no perfil (#171): registra a intenção; o navegador chama linkIdentity. */
export async function startGoogleLink(): Promise<StartGoogleLinkResult> {
  const area = await createClientAreaSupabase();
  const {
    data: { user },
  } = await area.auth.getUser();
  if (!user) return fail("NOT_SIGNED_IN", MSG.notSignedIn);
  const admin = createSupabaseAdminClient();
  const member = await hasAnyMembership(admin, user.id);
  if (!member) return fail("GENERIC", MSG.failed);
  if (!(await setLinkIntent(admin, user.id))) return fail("GENERIC", MSG.failed);
  return { ok: true };
}
