import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/*
 * Convite pendente (#177): o cadastro pelo convite criou a conta, mas não ligou a ficha (duas
 * tentativas). O servidor marca a conta em app_metadata.pending_invite = { h, exp } — h é o hash do
 * token do convite (nunca o token), exp o fim da janela de 1 h do cadastro (a mesma que o
 * finalize_client_signup aceita). Com o marcador, o login conclui o aceite sozinho e, se ainda não
 * der, a área do cliente manda para /client/concluir-convite (só a conta da sessão).
 * Gravar e limpar sempre leem, mesclam e gravam: o resto do app_metadata (provider, providers,
 * google_linked...) nunca se perde. Nunca apaga conta.
 */

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export const PENDING_INVITE_KEY = "pending_invite";
export const PENDING_INVITE_WINDOW_MS = 60 * 60 * 1000;

export type PendingInviteState = { state: "none" } | { state: "expired" } | { state: "valid"; hash: string };

/** Lê o marcador de um app_metadata. Formato estranho conta como vencido (para ser limpo). */
export function readPendingInvite(appMetadata: unknown, now = Date.now()): PendingInviteState {
  const meta = (appMetadata ?? {}) as Record<string, unknown>;
  const m = meta[PENDING_INVITE_KEY];
  if (m === undefined || m === null) return { state: "none" };
  const { h, exp } = m as { h?: unknown; exp?: unknown };
  if (typeof h !== "string" || !/^[0-9a-f]{64}$/.test(h) || typeof exp !== "number" || exp <= now) return { state: "expired" };
  return { state: "valid", hash: h };
}

/** Lê o app_metadata atual, aplica a mudança e grava tudo de volta. */
async function mergeAppMetadata(admin: Admin, userId: string, change: (meta: Record<string, unknown>) => void) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user) return false;
  const meta = { ...(data.user.app_metadata ?? {}) } as Record<string, unknown>;
  change(meta);
  const { error: uErr } = await admin.auth.admin.updateUserById(userId, { app_metadata: meta });
  return !uErr;
}

/** Marca a conta recém-criada. Falha só registra (sem dado pessoal): nunca muda a resposta do cadastro. */
export async function markPendingInvite(admin: Admin, userId: string, inviteHash: string, createdAt: string | undefined) {
  const start = Date.parse(createdAt ?? "");
  const exp = (Number.isFinite(start) ? start : Date.now()) + PENDING_INVITE_WINDOW_MS;
  try {
    const ok = await mergeAppMetadata(admin, userId, (meta) => {
      meta[PENDING_INVITE_KEY] = { h: inviteHash, exp };
    });
    if (!ok) console.error("[auth] marcador de convite pendente não gravado");
  } catch {
    console.error("[auth] marcador de convite pendente não gravado");
  }
}

/** Tira o marcador (mantendo o resto). Falha só registra. */
export async function clearPendingInvite(admin: Admin, userId: string) {
  try {
    // O Auth mescla o app_metadata por chave e só apaga a chave enviada como null (ausente = mantém).
    const ok = await mergeAppMetadata(admin, userId, (meta) => {
      meta[PENDING_INVITE_KEY] = null;
    });
    if (!ok) console.error("[auth] marcador de convite pendente não limpo");
  } catch {
    console.error("[auth] marcador de convite pendente não limpo");
  }
}

export type FinishPendingResult = "NONE" | "OK" | "INVITE_INVALID" | "INVALID" | "ERROR";

/**
 * Conclui o convite pendente da conta `userId` (que o chamador já provou ser a da sessão ou a que
 * acabou de acertar a senha). Lê o marcador da fonte (Auth), nunca do pedido. Vencido: limpa e
 * responde NONE. Válido: chama o finalize com o hash do marcador e o contato do perfil; com resposta
 * do banco (OK ou recusa), limpa. Erro de banco mantém o marcador para a próxima tentativa
 * (a própria janela de 1 h encerra).
 */
export async function finishPendingInvite(admin: Admin, userId: string): Promise<FinishPendingResult> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user) return "ERROR";
  const marker = readPendingInvite(data.user.app_metadata);
  if (marker.state === "none") return "NONE";
  if (marker.state === "expired") {
    await clearPendingInvite(admin, userId);
    return "NONE";
  }

  const { data: p } = await admin.from("profiles").select("contact_email").eq("id", userId).maybeSingle();
  const { data: fin, error: finError } = await admin.rpc("finalize_client_signup", {
    p_user_id: userId,
    p_contact_email: (p?.contact_email as string | null) ?? null,
    p_invite_token_hash: marker.hash,
  });
  if (finError) {
    console.error(`[auth] convite pendente não concluído (${finError.code ?? "sem código"})`);
    return "ERROR";
  }
  await clearPendingInvite(admin, userId);
  if (fin === "OK") return "OK";
  console.error(`[auth] convite pendente recusado (${String(fin)})`);
  return fin === "INVITE_INVALID" ? "INVITE_INVALID" : "INVALID";
}

/**
 * Para a área do cliente: a conta (sem vínculo) tem convite pendente válido? Lê do Auth pelo id da
 * sessão (o chamador já tem a sessão). Vencido: limpa e responde false.
 */
export async function hasPendingInvite(userId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data?.user) return false;
    const marker = readPendingInvite(data.user.app_metadata);
    if (marker.state === "expired") await clearPendingInvite(admin, userId);
    return marker.state === "valid";
  } catch {
    return false;
  }
}
