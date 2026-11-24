import "server-only";
import type { LoginMethods, PendingAccount } from "./google-types";

/*
 * Leituras do "Entrar com Google". CONTRATO FECHADO (ver google-types.ts); o corpo entra no #170
 * (getPendingAccount) e no #171 (getMyLoginMethods). Até lá: sem barbearia e sem Google.
 */

export async function getPendingAccount(): Promise<PendingAccount> {
  return { status: "PENDING_NO_SHOP" };
}

export async function getMyLoginMethods(): Promise<LoginMethods> {
  return { google: false };
}
