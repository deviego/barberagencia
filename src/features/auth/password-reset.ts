"use server";

import { createHash } from "crypto";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestOrigin } from "@/lib/http";
import { notifyPasswordReset } from "@/server/notifications/notify";
import { prepareReset } from "./account-lookup";

/*
 * "Esqueci minha senha" (área do cliente). O link é gerado no servidor e vai para o e-mail de
 * CONTATO da conta; abre /client/auth/confirm, que confirma no servidor. A resposta é sempre a
 * mesma, exista conta ou não.
 */

const Input = z.object({ identifier: z.string().trim().min(3).max(200) });
const LIMIT = { windowSeconds: 15 * 60, perIdentifier: 3, perAccount: 3 } as const;

export type PasswordResetResult = { ok: true } | { ok: false; error: string };

export async function requestPasswordReset(identifier: string): Promise<PasswordResetResult> {
  const parsed = Input.safeParse({ identifier });
  if (!parsed.success) return { ok: false, error: "Digite seu e-mail ou telefone." };

  const admin = createSupabaseAdminClient();
  const key = createHash("sha256").update(parsed.data.identifier.toLowerCase()).digest("hex");
  const { data: allowed, error: limitError } = await admin.rpc("rate_limit_hit", {
    p_scope: "password_reset",
    p_key: key,
    p_window_seconds: LIMIT.windowSeconds,
    p_limit: LIMIT.perIdentifier,
  });
  // Limite estourado ou indisponível: mesma resposta, sem enviar nada.
  if (limitError || allowed === false) return { ok: true };

  try {
    const target = await prepareReset(admin, parsed.data.identifier);
    const perAccount = target
      ? await admin.rpc("rate_limit_hit", {
          p_scope: "password_reset_account",
          p_key: target.userId,
          p_window_seconds: LIMIT.windowSeconds,
          p_limit: LIMIT.perAccount,
        })
      : null;
    if (target && perAccount && !perAccount.error && perAccount.data !== false) {
      const origin = await getRequestOrigin();
      const link =
        `${origin}/client/auth/confirm?type=recovery&token_hash=${encodeURIComponent(target.hashedToken)}`;
      await notifyPasswordReset(target.contactEmail, link, target.tenantId);
    }
  } catch {
    console.error("[auth] pedido de nova senha não concluído");
  }
  return { ok: true };
}
