import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ContactEmailState } from "./contact-types";

/** Estado do e-mail de contato do cliente logado (#177). Sem sessão: sem e-mail. */
export async function getContactEmailState(): Promise<ContactEmailState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { email: null, verified: false };
  const { data } = await createSupabaseAdminClient()
    .from("profiles")
    .select("contact_email, contact_email_verified_at")
    .eq("id", user.id)
    .maybeSingle();
  return { email: (data?.contact_email as string | null) ?? null, verified: !!data?.contact_email_verified_at };
}
