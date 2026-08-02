import "server-only";
import { cookies } from "next/headers";

/** Cookie que guarda a barbearia que um MASTER está "atuando como" no painel admin. */
export const ACT_COOKIE = "bb_act_tenant";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

export function isUuid(v: string | null | undefined): v is string {
  return !!v && UUID_RE.test(v);
}

/** Tenant do modo "atuar como" (lido do cookie). Retorna null se ausente/ inválido. */
export async function getActingTenantId(): Promise<string | null> {
  const raw = (await cookies()).get(ACT_COOKIE)?.value;
  return isUuid(raw) ? raw! : null;
}
