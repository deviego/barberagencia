import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasAnyMembership, shopFromCookie } from "./google-server";
import type { LoginMethods, PendingAccount } from "./google-types";

/*
 * Leituras do "Entrar com Google". O usuário vem só da sessão da área do cliente.
 */

/** Estado da conta para a tela /client/confirmar-whatsapp (#170). */
export async function getPendingAccount(): Promise<PendingAccount> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "SIGNED_OUT" };
  const admin = createSupabaseAdminClient();
  const member = await hasAnyMembership(admin, user.id);
  if (member === null) return { status: "PENDING_NO_SHOP" }; // leitura falhou: não cria nada
  if (member) return { status: "ACTIVE" };
  const shop = await shopFromCookie(admin);
  return shop ? { status: "PENDING", shop: shop.shop } : { status: "PENDING_NO_SHOP" };
}

/** O cliente logado já entra com Google? (#171, botão "Conectar com Google" no perfil) */
export async function getMyLoginMethods(): Promise<LoginMethods> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { google: !!user?.identities?.some((i) => i.provider === "google") };
}
