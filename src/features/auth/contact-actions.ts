"use server";

import { createHash } from "crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendContactConfirmation } from "./contact-email";
import { CONTACT_EMAIL_MESSAGES as MSG, type ContactEmailActionResult } from "./contact-types";

/*
 * E-mail de contato do cliente (#177): reenviar a confirmação e trocar o contato. A conta vem só
 * da sessão. Por que service role: a tabela de confirmação é só do servidor.
 */

const LIMIT = { windowSeconds: 60 * 60, perAccount: 5, perEmail: 5 } as const;
const EmailInput = z.string().trim().toLowerCase().email().max(200);
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
type Admin = ReturnType<typeof createSupabaseAdminClient>;

async function limited(admin: Admin, userId: string, email: string): Promise<"ok" | "limited" | "error"> {
  for (const [scope, key, max] of [
    ["contact_confirm_user", userId, LIMIT.perAccount],
    ["contact_confirm_email", sha256(email), LIMIT.perEmail],
  ] as const) {
    const { data, error } = await admin.rpc("rate_limit_hit", {
      p_scope: scope,
      p_key: key,
      p_window_seconds: LIMIT.windowSeconds,
      p_limit: max,
    });
    if (error) return "error";
    if (data === false) return "limited";
  }
  return "ok";
}

async function sessionUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Reenvia a confirmação do contato atual (sem dizer nada além do resultado). */
export async function resendContactEmailConfirmation(): Promise<ContactEmailActionResult> {
  const user = await sessionUser();
  if (!user) return { ok: false, code: "NOT_SIGNED_IN", error: MSG.notSignedIn };
  const admin = createSupabaseAdminClient();
  const { data: p, error } = await admin
    .from("profiles")
    .select("contact_email, contact_email_verified_at, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return { ok: false, code: "GENERIC", error: MSG.failed };
  const email = (p?.contact_email as string | null) ?? null;
  if (!email) return { ok: false, code: "NO_EMAIL", error: MSG.noEmail };
  if (p?.contact_email_verified_at) return { ok: true };
  const lim = await limited(admin, user.id, email);
  if (lim === "error") return { ok: false, code: "GENERIC", error: MSG.failed };
  if (lim === "limited") return { ok: false, code: "LIMIT", error: MSG.limited };
  const sent = await sendContactConfirmation(admin, { id: user.id, name: (p?.full_name as string | null) ?? undefined }, email);
  return sent ? { ok: true } : { ok: false, code: "GENERIC", error: MSG.failed };
}

/** Troca o e-mail de contato: zera a confirmação e pede uma nova. */
export async function updateContactEmail(email: string): Promise<ContactEmailActionResult> {
  const parsed = EmailInput.safeParse(email);
  if (!parsed.success || parsed.data.endsWith("@cliente.barberagencia.app")) {
    return { ok: false, code: "INVALID_EMAIL", error: MSG.invalidEmail };
  }
  const user = await sessionUser();
  if (!user) return { ok: false, code: "NOT_SIGNED_IN", error: MSG.notSignedIn };
  const admin = createSupabaseAdminClient();
  const lim = await limited(admin, user.id, parsed.data);
  if (lim === "error") return { ok: false, code: "GENERIC", error: MSG.failed };
  if (lim === "limited") return { ok: false, code: "LIMIT", error: MSG.limited };

  const { data: p, error } = await admin
    .from("profiles")
    .update({ contact_email: parsed.data, contact_email_verified_at: null })
    .eq("id", user.id)
    .select("full_name");
  if (error || !(p ?? []).length) return { ok: false, code: "GENERIC", error: MSG.failed };
  // Fichas da conta passam a mostrar o contato novo.
  await admin.from("clients").update({ email: parsed.data }).eq("user_id", user.id);
  const sent = await sendContactConfirmation(
    admin,
    { id: user.id, name: ((p ?? [])[0]?.full_name as string | null) ?? undefined },
    parsed.data
  );
  revalidatePath("/client/perfil");
  return sent ? { ok: true } : { ok: false, code: "GENERIC", error: MSG.failed };
}
