import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isEmail, phoneDigits, syntheticEmail } from "@/lib/auth/phone-identity";

/*
 * Resolve a conta pelo que a pessoa digitou (e-mail de contato ou telefone), no servidor.
 * O e-mail de autenticação pode ser técnico (contas por telefone e contas novas); o e-mail que a
 * pessoa conhece é o de contato. Por que service role: login e "Esqueci minha senha" acontecem sem
 * sessão.
 */

type Admin = ReturnType<typeof createSupabaseAdminClient>;
const TECH_DOMAIN = "@cliente.barberagencia.app";

export const isTechnicalEmail = (e: string | null | undefined) => !!e && e.toLowerCase().endsWith(TECH_DOMAIN);

/**
 * E-mail de autenticação para um e-mail de contato. Usa a função de banco que só resolve quando
 * há UMA conta com aquele contato; sem ela (ou com mais de uma conta), devolve null.
 */
export async function authEmailForContactEmail(admin: Admin, email: string): Promise<string | null> {
  const { data, error } = await admin.rpc("auth_email_for_contact_email", { p_email: email });
  if (error) return null;
  return (data as string | null) ?? null;
}

/** E-mail para entrar com senha: contato → autenticação; senão, o próprio e-mail digitado. */
export async function loginEmailFor(admin: Admin, identifier: string): Promise<string | null> {
  const id = identifier.trim();
  if (isEmail(id)) {
    const email = id.toLowerCase();
    return (await authEmailForContactEmail(admin, email)) ?? email;
  }
  const digits = phoneDigits(id);
  if (digits.length < 10) return null;
  const { data } = await admin.rpc("auth_email_for_phone", { p_digits: digits });
  return ((data as string | null) ?? syntheticEmail(digits)).toLowerCase();
}

export type ResetTarget = { userId: string; contactEmail: string; tenantId: string | null; hashedToken: string };

/**
 * Para "Esqueci minha senha": gera no servidor o código de uso único da conta e diz para onde vai o
 * link: o e-mail de contato CONFIRMADO; em conta antiga (e-mail de autenticação real), esse e-mail.
 * null quando não há conta, o contato não está confirmado ou é ambíguo. Nunca e-mail técnico.
 */
export async function prepareReset(admin: Admin, identifier: string): Promise<ResetTarget | null> {
  const authEmail = await loginEmailFor(admin, identifier);
  if (!authEmail) return null;

  const { data: link, error } = await admin.auth.admin.generateLink({ type: "recovery", email: authEmail });
  const userId = link?.user?.id;
  const hashedToken = link?.properties?.hashed_token;
  if (error || !userId || !hashedToken) return null;

  const [{ data: p }, { data: c }] = await Promise.all([
    admin.from("profiles").select("contact_email, contact_email_verified_at").eq("id", userId).maybeSingle(),
    admin.from("clients").select("tenant_id").eq("user_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);
  const verifiedContact = p?.contact_email_verified_at ? ((p.contact_email as string | null) ?? null) : null;
  const target = (verifiedContact ?? (isTechnicalEmail(authEmail) ? null : authEmail))?.toLowerCase() ?? null;
  if (!target || isTechnicalEmail(target) || !isEmail(target)) return null;
  return { userId, contactEmail: target, tenantId: (c?.tenant_id as string | null) ?? null, hashedToken };
}
