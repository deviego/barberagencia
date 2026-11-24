"use server";

import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPhoneKey, phoneKey } from "@/lib/phone";
import { hasAnyMembership, shopFromCookie } from "./google-server";
import {
  GOOGLE_LOGIN_MESSAGES as MSG,
  type ConfirmWhatsappInput,
  type ConfirmWhatsappResult,
  type ProveAccountAndLinkInput,
  type ProveAccountAndLinkResult,
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

/**
 * Prova de posse da conta existente e vínculo do Google (#171). CONTRATO FECHADO; o corpo entra
 * no #171. Até lá responde GENERIC sem mudar nada.
 */
export async function proveAccountAndLink(input: ProveAccountAndLinkInput): Promise<ProveAccountAndLinkResult> {
  void input;
  return fail("GENERIC", MSG.failed);
}
