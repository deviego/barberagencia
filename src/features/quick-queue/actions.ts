"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { phoneKey } from "@/lib/phone";
import { requireQuickQueueOpen, QuickQueueClosedError } from "./guard";
import { hashDeviceToken, newDeviceToken, readDeviceToken, writeDeviceToken } from "./device";
import { QUICK_QUEUE_DEVICE_TTL_DAYS, QUICK_QUEUE_IDENTIFY_LIMITS, QUICK_QUEUE_PENDING_MINUTES } from "./limits";
import { IdentifyPhoneInput, RegisterNameInput, quickQueueName } from "./schema";
import {
  QUICK_QUEUE_IDENTIFY_MESSAGES as MSG,
  type IdentifyPhoneResult,
  type QuickQueueActionError,
  type RegisterNameResult,
} from "./types";

/*
 * Identificação da fila rápida (#96).
 * Por que service role: a jornada é de visitante sem sessão; quick_queue_identify só pode ser
 * executada pelo service_role e confere dentro dela a barbearia, a credencial e os limites.
 * A barbearia vem do endereço (guard); o cliente é resolvido no banco a partir do telefone.
 * Nada aqui devolve ou recebe identificador de cliente, e nenhum log leva telefone ou nome.
 */

type IdentifyCode = "KNOWN" | "NEED_NAME" | "CREATED" | "NO_PENDING" | "LIMIT" | "INVALID" | "CLOSED";

const L = QUICK_QUEUE_IDENTIFY_LIMITS;

async function callIdentify(
  slug: string,
  tenantId: string,
  step: { phoneKey: string; name?: undefined } | { phoneKey?: undefined; name: string }
): Promise<IdentifyCode | null> {
  const current = await readDeviceToken();
  // Só o passo do telefone pode emitir credencial nova; o servidor gera o valor, nunca o aparelho.
  const fresh = step.phoneKey ? newDeviceToken() : null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("quick_queue_identify", {
    p_tenant_id: tenantId,
    p_device_hash: current ? hashDeviceToken(current) : null,
    p_new_device_hash: fresh ? hashDeviceToken(fresh) : null,
    p_phone_key: step.phoneKey ?? null,
    p_name: step.name ?? null,
    p_window_seconds: L.windowSeconds,
    p_per_device: L.perDevice,
    p_per_client: L.perClient,
    p_per_tenant: L.perTenant,
    p_new_devices_hour: L.newDevicesPerTenantHour,
    p_new_clients_day: L.newClientsPerTenantDay,
    p_device_ttl_days: QUICK_QUEUE_DEVICE_TTL_DAYS,
    p_pending_minutes: QUICK_QUEUE_PENDING_MINUTES,
  });
  if (error) {
    console.error(`[quick-queue] identificação indisponível (${error.code ?? "sem código"})`);
    return null;
  }
  const row = (Array.isArray(data) ? data[0] : data) as { result?: string; new_device?: boolean } | undefined;
  if (row?.new_device && fresh) await writeDeviceToken(slug, fresh);
  else if (current && row?.result !== "NO_PENDING") await writeDeviceToken(slug, current); // renova a validade
  return (row?.result as IdentifyCode | undefined) ?? null;
}

function fail(error: string, field?: QuickQueueActionError["field"]): QuickQueueActionError {
  return field ? { ok: false, error, field } : { ok: false, error };
}

/** Recusa do guard → mensagem fixa (fechada) ou genérica (leitura indisponível). */
function guardFailure(e: unknown): QuickQueueActionError {
  if (e instanceof QuickQueueClosedError) return fail(e.message);
  console.error("[quick-queue] conferência da barbearia indisponível");
  return fail(MSG.failed);
}

/** Passo do telefone: NAME (novo nesta barbearia) ou SERVICE (já cadastrado). */
export async function identifyPhone(slug: string, phone: string): Promise<IdentifyPhoneResult> {
  const parsed = IdentifyPhoneInput.safeParse({ slug, phone });
  if (!parsed.success) return fail(MSG.invalidPhone, "phone");

  let tenantId: string;
  try {
    ({ tenantId } = await requireQuickQueueOpen(parsed.data.slug));
  } catch (e) {
    return guardFailure(e);
  }

  const key = phoneKey(parsed.data.phone);
  if (!key) return fail(MSG.invalidPhone, "phone");

  switch (await callIdentify(parsed.data.slug, tenantId, { phoneKey: key })) {
    case "KNOWN":
      return { ok: true, next: "SERVICE" };
    case "NEED_NAME":
      return { ok: true, next: "NAME" };
    case "LIMIT":
      return fail(MSG.limited);
    case "INVALID":
      return fail(MSG.invalidPhone, "phone");
    case "CLOSED":
      return fail(new QuickQueueClosedError().message);
    default:
      return fail(MSG.failed);
  }
}

/** Passo do nome (só depois de um telefone novo neste aparelho). Cria o convidado. */
export async function registerName(slug: string, name: string): Promise<RegisterNameResult> {
  const parsed = RegisterNameInput.safeParse({ slug, name });
  if (!parsed.success) return fail(MSG.invalidName, "name");

  let tenantId: string;
  try {
    ({ tenantId } = await requireQuickQueueOpen(parsed.data.slug));
  } catch (e) {
    return guardFailure(e);
  }

  const checked = quickQueueName(parsed.data.name);
  if (!checked.ok) return fail(checked.reason === "chars" ? MSG.nameLettersOnly : MSG.invalidName, "name");

  switch (await callIdentify(parsed.data.slug, tenantId, { name: checked.name })) {
    case "CREATED":
    case "KNOWN": // o telefone foi cadastrado por outro caminho entre os dois passos
      return { ok: true, next: "SERVICE" };
    case "NO_PENDING":
      return { ok: false, error: MSG.restart, restart: true };
    case "LIMIT":
      return fail(MSG.limited);
    case "INVALID":
      return fail(MSG.invalidName, "name");
    case "CLOSED":
      return fail(new QuickQueueClosedError().message);
    default:
      return fail(MSG.failed);
  }
}
