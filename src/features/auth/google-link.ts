import "server-only";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/*
 * Intenção de vínculo com Google (#171). Só o servidor cria: "Conectar com Google" do perfil ou a
 * prova de posse. Valor aleatório em cookie HttpOnly, curto, restrito à área do cliente; o banco
 * (app_metadata do usuário, que só o servidor grava) guarda só o resumo e a validade. O callback
 * consome a intenção sempre (válida ou não).
 */

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export const LINK_INTENT_COOKIE = "bb_link_intent";
const LINK_INTENT_TTL_SECONDS = 10 * 60;
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

type IntentMeta = { h: string; exp: number };

async function writeIntentMeta(admin: Admin, userId: string, intent: IntentMeta | null): Promise<boolean> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) return false;
  const current = { ...(data.user.app_metadata ?? {}) } as Record<string, unknown>;
  if (intent) current.link_intent = intent;
  else delete current.link_intent;
  const { error: uErr } = await admin.auth.admin.updateUserById(userId, { app_metadata: current });
  return !uErr;
}

/** Cria a intenção para este usuário (cookie + resumo no app_metadata). */
export async function setLinkIntent(admin: Admin, userId: string): Promise<boolean> {
  const token = randomBytes(32).toString("base64url");
  const ok = await writeIntentMeta(admin, userId, { h: sha256(token), exp: Date.now() + LINK_INTENT_TTL_SECONDS * 1000 });
  if (!ok) return false;
  (await cookies()).set(LINK_INTENT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: "/client",
    maxAge: LINK_INTENT_TTL_SECONDS,
  });
  return true;
}

/**
 * Consome a intenção: apaga o cookie e o resumo, e diz se ela valia para este usuário agora.
 * Sempre chamado no callback, com ou sem cookie.
 */
export async function consumeLinkIntent(
  admin: Admin,
  user: { id: string; app_metadata?: Record<string, unknown> | null }
): Promise<boolean> {
  const store = await cookies();
  const token = store.get(LINK_INTENT_COOKIE)?.value ?? "";
  if (token) store.delete(LINK_INTENT_COOKIE);
  const meta = (user.app_metadata?.link_intent ?? null) as IntentMeta | null;
  if (meta) await writeIntentMeta(admin, user.id, null);
  if (!token || !meta || typeof meta.h !== "string" || typeof meta.exp !== "number") return false;
  return meta.exp > Date.now() && meta.h === sha256(token);
}
