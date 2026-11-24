"use server";

import { createHash } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/*
 * Concluir o aceite de um convite já com a conta criada (#177): quando o cadastro pelo convite
 * criou a conta mas não conseguiu ligar a ficha. A conta é sempre a da SESSÃO; o token vem do link
 * e é conferido de novo no banco (uso único, não vencido, conta de e-mail sem vínculo, até 1 h do
 * cadastro).
 * Nunca apaga conta.
 */

export type CompleteInviteResult =
  | { ok: true }
  | { ok: false; code: "INVALID_INVITE" | "NOT_SIGNED_IN" | "GENERIC"; error: string };

const MSG = {
  invalid: "Este convite não vale mais. Fale com a barbearia.",
  notSignedIn: "Entre na sua conta para concluir o convite.",
  failed: "Não deu certo agora. Tente de novo.",
} as const;

export async function completeInviteAcceptance(token: string): Promise<CompleteInviteResult> {
  const t = typeof token === "string" ? token.trim() : "";
  if (!/^[A-Za-z0-9_-]{8,200}$/.test(t)) return { ok: false, code: "INVALID_INVITE", error: MSG.invalid };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: "NOT_SIGNED_IN", error: MSG.notSignedIn };

  const admin = createSupabaseAdminClient();
  const { data: p } = await admin.from("profiles").select("contact_email").eq("id", user.id).maybeSingle();
  const { data, error } = await admin.rpc("finalize_client_signup", {
    p_user_id: user.id,
    p_contact_email: (p?.contact_email as string | null) ?? null,
    p_invite_token_hash: createHash("sha256").update(t).digest("hex"),
  });
  if (error) {
    console.error(`[auth] aceite de convite não concluído (${error.code ?? "sem código"})`);
    return { ok: false, code: "GENERIC", error: MSG.failed };
  }
  if (data !== "OK") {
    console.error(`[auth] aceite de convite recusado (${String(data)})`);
    return { ok: false, code: "INVALID_INVITE", error: MSG.invalid };
  }
  return { ok: true };
}
