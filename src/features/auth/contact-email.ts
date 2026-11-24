import "server-only";
import { createHash, randomBytes } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestOrigin } from "@/lib/http";
import { notifyContactConfirmation } from "@/server/notifications/notify";

/*
 * Confirmação do e-mail de CONTATO (#177). Só contato confirmado vale para entrar e para
 * recuperar a senha. Token aleatório de uso único; o banco guarda só o resumo (sha256), a
 * validade e quando foi usado. Tabela só do servidor (service role).
 */

type Admin = ReturnType<typeof createSupabaseAdminClient>;
export const CONTACT_CONFIRM_TTL_HOURS = 24;
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

/** Cria um pedido de confirmação para o contato atual; devolve o token (só para o link). */
export async function createContactConfirmation(admin: Admin, userId: string, email: string): Promise<string | null> {
  const token = randomBytes(32).toString("base64url");
  const { error } = await admin.from("contact_email_confirmations").insert({
    user_id: userId,
    email: email.toLowerCase(),
    token_hash: sha256(token),
    expires_at: new Date(Date.now() + CONTACT_CONFIRM_TTL_HOURS * 3600_000).toISOString(),
  });
  return error ? null : token;
}

/**
 * Usa o token (uma vez só) e marca o contato como confirmado, se ainda for o mesmo e-mail do
 * perfil. "invalid" = token inexistente, vencido, já usado, ou contato trocado depois do pedido.
 */
export async function consumeContactConfirmation(admin: Admin, token: string): Promise<"ok" | "invalid" | "error"> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return "invalid";
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("contact_email_confirmations")
    .update({ used_at: now })
    .eq("token_hash", sha256(token))
    .is("used_at", null)
    .gt("expires_at", now)
    .select("user_id, email");
  if (error) return "error";
  const row = (data ?? [])[0] as { user_id: string; email: string } | undefined;
  if (!row) return "invalid";
  const { data: p, error: pErr } = await admin
    .from("profiles")
    .update({ contact_email_verified_at: now })
    .eq("id", row.user_id)
    .ilike("contact_email", row.email.replace(/[\\%_]/g, (c) => `\\${c}`))
    .select("id");
  if (pErr) return "error";
  return (p ?? []).length ? "ok" : "invalid";
}

/** Cria o pedido e manda o link para o contato (mesmo canal da boas-vindas). */
export async function sendContactConfirmation(
  admin: Admin,
  user: { id: string; name?: string },
  email: string,
  opts: { welcome?: boolean; tenantId?: string | null } = {}
): Promise<boolean> {
  const token = await createContactConfirmation(admin, user.id, email);
  if (!token) return false;
  const origin = await getRequestOrigin();
  const link = `${origin}/client/auth/confirmar-contato?token=${encodeURIComponent(token)}`;
  const r = await notifyContactConfirmation(email, link, { name: user.name, tenantId: opts.tenantId, welcome: opts.welcome });
  return r.ok || !!r.skipped;
}

