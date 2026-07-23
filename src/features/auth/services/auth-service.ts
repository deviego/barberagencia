import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Camada de serviço de autenticação (client-side, sob RLS/anon key). */

export async function signInWithPassword(email: string, password: string) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

export async function signUpWithPassword(
  email: string,
  password: string,
  meta: { full_name?: string; phone?: string }
) {
  const supabase = createSupabaseBrowserClient();
  const emailRedirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: meta, emailRedirectTo },
  });
  if (error) throw new Error(error.message);
  return data; // data.session === null quando confirmação de e-mail está ativa
}

export async function sendPasswordReset(email: string) {
  const supabase = createSupabaseBrowserClient();
  // O link do e-mail passa pelo callback (troca code→sessão) e cai na tela de nova senha.
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback?next=/redefinir-senha`
      : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw new Error(error.message);
}

export async function updatePassword(newPassword: string) {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.signOut();
}
