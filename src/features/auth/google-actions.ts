"use server";

import {
  GOOGLE_LOGIN_MESSAGES as MSG,
  type ConfirmWhatsappInput,
  type ConfirmWhatsappResult,
  type ProveAccountAndLinkInput,
  type ProveAccountAndLinkResult,
} from "./google-types";

/*
 * Ações do "Entrar com Google". CONTRATO FECHADO (ver google-types.ts); o corpo entra no #170
 * (confirmWhatsapp) e no #171 (proveAccountAndLink). Até lá respondem GENERIC sem mudar nada.
 */

export async function confirmWhatsapp(input: ConfirmWhatsappInput): Promise<ConfirmWhatsappResult> {
  void input;
  return { ok: false, code: "GENERIC", error: MSG.failed };
}

export async function proveAccountAndLink(input: ProveAccountAndLinkInput): Promise<ProveAccountAndLinkResult> {
  void input;
  return { ok: false, code: "GENERIC", error: MSG.failed };
}
