"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { phoneKey } from "@/lib/phone";
import { requireQuickQueueOpen, requireQuickQueueTicketAccess, QuickQueueClosedError } from "./guard";
import { hashDeviceToken, newDeviceToken, readDeviceToken, writeDeviceToken } from "./device";
import {
  QUICK_QUEUE_DEVICE_TTL_DAYS,
  QUICK_QUEUE_IDENTIFY_LIMITS,
  QUICK_QUEUE_JOIN_LIMITS,
  QUICK_QUEUE_PENDING_MINUTES,
  QUICK_QUEUE_STATUS_LIMITS,
} from "./limits";
import { cancelDeviceTicket, resolveDevice } from "./ticket";
import { deviceHasClient, loadQuickQueueOptions as readOptions } from "./options";
import {
  IdentifyPhoneInput,
  JoinQuickQueueInputSchema,
  LoadQuickQueueOptionsInput,
  RegisterNameInput,
  quickQueueName,
} from "./schema";
import {
  QUICK_QUEUE_IDENTIFY_MESSAGES as MSG,
  QUICK_QUEUE_JOIN_MESSAGES as JOIN_MSG,
  QUICK_QUEUE_TICKET_MESSAGES as TICKET_MSG,
  QUICK_QUEUE_LIMIT_MESSAGES as LIMIT_MSG,
  type IdentifyPhoneResult,
  type JoinQuickQueueInput,
  type JoinQuickQueueResult,
  type LeaveQuickQueueResult,
  type QuickQueueOptionsResult,
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

type IdentifyCode =
  | "KNOWN"
  | "NEED_NAME"
  | "CREATED"
  | "NO_PENDING"
  | "LIMIT"
  | "INVALID"
  | "CLOSED"
  // #148 (schema-64): tetos POR BARBEARIA com resultado próprio; para o cliente, o mesmo aviso.
  | "TENANT_ATTEMPTS"
  | "TENANT_NEW_DEVICES"
  | "TENANT_NEW_CLIENTS";

/** Resultado de limite → tipo na contagem do dia (os de barbearia ligam o alerta ao dono). */
const IDENTIFY_LIMIT_KIND: Partial<Record<IdentifyCode, IdentifyLimitKind>> = {
  LIMIT: "IDENTIFY",
  TENANT_ATTEMPTS: "IDENTIFY_TENANT",
  TENANT_NEW_DEVICES: "NEW_DEVICES_TENANT",
  TENANT_NEW_CLIENTS: "NEW_CLIENTS_TENANT",
};


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
  const limitKind = IDENTIFY_LIMIT_KIND[row?.result as IdentifyCode];
  if (limitKind) {
    await recordLimit(tenantId, limitKind);
    // Teto da barbearia: marcador fixo no log (sem dado de cliente), como no totem.
    if (limitKind !== "IDENTIFY") console.error(`[quick-queue][teto-barbearia] identificação tenant=${tenantId}`);
  }
  if (row?.new_device && fresh) await writeDeviceToken(slug, fresh);
  else if (current && row?.result !== "NO_PENDING") await writeDeviceToken(slug, current); // renova a validade
  return (row?.result as IdentifyCode | undefined) ?? null;
}

/** Soma 1 na contagem do dia (alerta ao dono). Falha aqui não muda a resposta ao cliente. */
type IdentifyLimitKind = "IDENTIFY" | "IDENTIFY_TENANT" | "NEW_DEVICES_TENANT" | "NEW_CLIENTS_TENANT";

async function recordLimit(tenantId: string, kind: IdentifyLimitKind): Promise<void> {
  const { error } = await createSupabaseAdminClient().rpc("quick_queue_record_limit", { p_tenant_id: tenantId, p_kind: kind });
  if (error) console.error(`[quick-queue] registro de limite indisponível (${error.code ?? "sem código"})`);
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
    case "TENANT_ATTEMPTS":
    case "TENANT_NEW_DEVICES":
    case "TENANT_NEW_CLIENTS":
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
    case "TENANT_ATTEMPTS":
    case "TENANT_NEW_DEVICES":
    case "TENANT_NEW_CLIENTS":
      return fail(MSG.limited);
    case "INVALID":
      return fail(MSG.invalidName, "name");
    case "CLOSED":
      return fail(new QuickQueueClosedError().message);
    default:
      return fail(MSG.failed);
  }
}

/*
 * #97 — serviço com preço e entrada na fila.
 * O cliente vem só da credencial do aparelho (cookie HttpOnly) ligada no passo do telefone.
 */

/** Opções da tela "O que vai ser hoje?". restart = voltar ao telefone. */
export async function loadQuickQueueOptions(slug: string): Promise<QuickQueueOptionsResult> {
  const parsed = LoadQuickQueueOptionsInput.safeParse({ slug });
  if (!parsed.success) return fail(MSG.failed);

  let tenantId: string;
  try {
    ({ tenantId } = await requireQuickQueueOpen(parsed.data.slug));
  } catch (e) {
    return guardFailure(e);
  }

  const token = await readDeviceToken();
  if (!token) return { ok: false, error: MSG.restart, restart: true };
  const bound = await deviceHasClient(tenantId, hashDeviceToken(token));
  if (bound === null) return fail(MSG.failed);
  if (!bound) return { ok: false, error: MSG.restart, restart: true };

  const options = await readOptions(tenantId);
  if (!options) {
    console.error("[quick-queue] opções da fila indisponíveis");
    return fail(MSG.failed);
  }
  return { ok: true, options };
}

type JoinCode =
  | "OK"
  | "EXISTING"
  | "CLOSED"
  | "NO_CLIENT"
  | "SERVICE_CHANGED"
  | "INVALID"
  | "PHONE_BUSY"
  | "DEVICE_LIMIT"
  | "RATE_LIMIT"
  | "TENANT_CAP";

const JL = QUICK_QUEUE_JOIN_LIMITS;

/**
 * "Entrar na fila". O cliente vem da credencial do aparelho; serviço, barbeiro e preço são
 * conferidos dentro de quick_queue_join (schema-53), que também numera a senha com trava.
 * Preço, número da senha e cliente nunca vêm do aparelho: priceCents só confere a lista vista.
 * Travas da #99 (schema-54) dentro da mesma função; os valores vêm de QUICK_QUEUE_JOIN_LIMITS.
 */
export async function joinQuickQueue(slug: string, input: JoinQuickQueueInput): Promise<JoinQuickQueueResult> {
  const generic: JoinQuickQueueResult = { ok: false, code: "GENERIC", error: MSG.failed };
  const parsed = JoinQuickQueueInputSchema.safeParse({
    slug,
    serviceId: input?.serviceId,
    priceCents: input?.priceCents,
    barberId: input?.barberId,
  });
  if (!parsed.success) return generic;

  let tenantId: string;
  try {
    ({ tenantId } = await requireQuickQueueOpen(parsed.data.slug));
  } catch (e) {
    return e instanceof QuickQueueClosedError ? { ok: false, code: "CLOSED", error: e.message } : generic;
  }

  const token = await readDeviceToken();
  if (!token) return { ok: false, code: "RESTART", error: MSG.restart };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("quick_queue_join", {
    p_tenant_id: tenantId,
    p_device_hash: hashDeviceToken(token),
    p_service_id: parsed.data.serviceId,
    p_price_cents: parsed.data.priceCents,
    p_barber_id: parsed.data.barberId ?? null,
    p_window_seconds: JL.windowSeconds,
    p_join_per_device: JL.perDevice,
    p_active_per_device: JL.activePerDevice,
    p_tenant_active_cap: JL.tenantActiveCap,
    p_device_ttl_days: QUICK_QUEUE_DEVICE_TTL_DAYS,
  });
  if (error) {
    console.error(`[quick-queue] entrada na fila indisponível (${error.code ?? "sem código"})`);
    return generic;
  }

  switch (data as JoinCode | null) {
    case "OK":
    case "EXISTING":
      await writeDeviceToken(parsed.data.slug, token); // renova a validade
      return { ok: true };
    case "NO_CLIENT":
      return { ok: false, code: "RESTART", error: MSG.restart };
    case "PHONE_BUSY":
      return { ok: false, code: "LIMIT", error: LIMIT_MSG.phoneBusy };
    case "DEVICE_LIMIT":
      return { ok: false, code: "LIMIT", error: LIMIT_MSG.deviceLimit };
    case "RATE_LIMIT":
      return { ok: false, code: "LIMIT", error: LIMIT_MSG.tooMany };
    case "TENANT_CAP":
      // Marcador fixo para o log (sem dado de cliente), como o teto do totem.
      console.error(`[quick-queue][teto-barbearia] tenant=${tenantId}`);
      return { ok: false, code: "LIMIT", error: LIMIT_MSG.tenantCap };
    case "CLOSED":
      return { ok: false, code: "CLOSED", error: new QuickQueueClosedError().message };
    case "SERVICE_CHANGED": {
      const options = await readOptions(tenantId);
      if (!options) return generic;
      return { ok: false, code: "SERVICE_CHANGED", error: JOIN_MSG.serviceChanged, options };
    }
    default:
      return generic;
  }
}

/**
 * "Sair da fila" (#98). Só a senha deste aparelho (credencial do cookie), só em espera e ainda
 * não chamada. Repetir depois de cancelada responde ok sem efeito novo. Guard da senha já
 * criada (#102): continua valendo com a fila rápida desligada.
 */
export async function leaveQuickQueue(slug: string): Promise<LeaveQuickQueueResult> {
  const generic: LeaveQuickQueueResult = { ok: false, code: "GENERIC", error: TICKET_MSG.failed };
  const parsed = LoadQuickQueueOptionsInput.safeParse({ slug });
  if (!parsed.success) return generic;

  let tenantId: string;
  try {
    ({ tenantId } = await requireQuickQueueTicketAccess(parsed.data.slug));
  } catch (e) {
    return e instanceof QuickQueueClosedError ? { ok: false, code: "CLOSED", error: e.message } : generic;
  }

  // Sem credencial (ou credencial de outro aparelho/barbearia): a mesma resposta de "não há
  // senha em espera", sem dizer o motivo.
  const notWaiting: LeaveQuickQueueResult = { ok: false, code: "NOT_WAITING", error: TICKET_MSG.failed };
  const token = await readDeviceToken();
  if (!token) return notWaiting;

  const admin = createSupabaseAdminClient();
  const deviceId = await resolveDevice(admin, tenantId, hashDeviceToken(token));
  if (deviceId === "error") return generic;
  if (!deviceId) return notWaiting;

  const SL = QUICK_QUEUE_STATUS_LIMITS;
  const { data: allowed, error: limitError } = await admin.rpc("rate_limit_hit", {
    p_scope: "qq_leave",
    p_key: deviceId,
    p_window_seconds: SL.leaveWindowSeconds,
    p_limit: SL.leavePerDevice,
  });
  if (limitError) return generic;
  if (allowed === false) return { ok: false, code: "LIMIT", error: LIMIT_MSG.tooMany };

  switch (await cancelDeviceTicket(admin, tenantId, deviceId)) {
    case "cancelled":
    case "already":
      return { ok: true };
    case "not_waiting":
      return notWaiting;
    default:
      console.error("[quick-queue] saída da fila indisponível");
      return generic;
  }
}
