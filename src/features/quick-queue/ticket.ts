import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { QUICK_QUEUE_STATUS_LIMITS } from "./limits";
import { pickDeviceTicket, type QuickQueueSnapshot, type QuickQueueTicketRow } from "./rules";

/*
 * Leituras e escrita da tela "Minha senha" (#98). Por que service role: visitante sem sessão.
 * A barbearia vem do endereço (guard) e a senha só pela credencial do aparelho (resumo sha256 do
 * cookie HttpOnly): nada vem do navegador além do endereço. Nenhuma função aqui devolve nome,
 * telefone, serviço ou id de outro cliente.
 */

type Admin = ReturnType<typeof createSupabaseAdminClient>;
const TICKET_COLS = "id, ticket_number, status, called_at, left_by_client";
type TicketRowWithId = QuickQueueTicketRow & { id: string };

/** Dia de hoje em America/Sao_Paulo (mesma regra do banco para queue_entries.day). */
export function todaySaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

/** Credencial válida desta barbearia → id do aparelho. null = sem credencial; "error" = leitura falhou. */
export async function resolveDevice(admin: Admin, tenantId: string, deviceHash: string): Promise<string | null | "error"> {
  const { data, error } = await admin
    .from("quick_queue_devices")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("token_hash", deviceHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) return "error";
  return (data?.id as string | undefined) ?? null;
}

/**
 * Limite da consulta: 1 a cada QUICK_QUEUE_STATUS_LIMITS.minIntervalMs por aparelho, guardado no
 * próprio aparelho (last_used_at): atualiza só se a última vez já passou. Não grava linha nova.
 * "limited" = credencial válida, mas cedo demais.
 */
export async function claimStatusSlot(
  admin: Admin,
  tenantId: string,
  deviceHash: string
): Promise<{ deviceId: string } | "limited" | null | "error"> {
  const now = new Date();
  const { data, error } = await admin
    .from("quick_queue_devices")
    .update({ last_used_at: now.toISOString() })
    .eq("tenant_id", tenantId)
    .eq("token_hash", deviceHash)
    .gt("expires_at", now.toISOString())
    .lt("last_used_at", new Date(now.getTime() - QUICK_QUEUE_STATUS_LIMITS.minIntervalMs).toISOString())
    .select("id")
    .maybeSingle();
  if (error) return "error";
  if (data?.id) return { deviceId: data.id as string };
  const existing = await resolveDevice(admin, tenantId, deviceHash);
  if (existing === "error") return "error";
  return existing ? "limited" : null;
}

/** Senha de hoje deste aparelho que a tela mostra (ver pickDeviceTicket). */
export async function loadDeviceTicket(admin: Admin, tenantId: string, deviceId: string): Promise<TicketRowWithId | null | "error"> {
  const { data, error } = await admin
    .from("queue_entries")
    .select(TICKET_COLS)
    .eq("tenant_id", tenantId)
    .eq("device_id", deviceId)
    .eq("day", todaySaoPaulo());
  if (error) return "error";
  return pickDeviceTicket((data ?? []) as TicketRowWithId[]);
}

/*
 * Retrato da fila da barbearia, guardado por QUICK_QUEUE_STATUS_LIMITS.snapshotMs em memória da
 * instância: muitas telas abertas na mesma barbearia viram uma consulta a cada 2 s.
 */
const snapshots = new Map<string, { at: number; snap: QuickQueueSnapshot }>();
const SNAPSHOT_MAX_ENTRIES = 500;

export async function loadSnapshot(admin: Admin, tenantId: string): Promise<QuickQueueSnapshot | "error"> {
  const hit = snapshots.get(tenantId);
  if (hit && Date.now() - hit.at < QUICK_QUEUE_STATUS_LIMITS.snapshotMs) return hit.snap;

  const day = todaySaoPaulo();
  const [waiting, called] = await Promise.all([
    admin
      .from("queue_entries")
      .select("ticket_number")
      .eq("tenant_id", tenantId)
      .eq("day", day)
      .eq("status", "WAITING")
      .is("called_at", null)
      .order("ticket_number"),
    admin
      .from("queue_entries")
      .select("ticket_number")
      .eq("tenant_id", tenantId)
      .eq("day", day)
      .not("called_at", "is", null)
      .order("called_at", { ascending: false })
      .limit(1),
  ]);
  if (waiting.error || called.error) return "error";
  const snap: QuickQueueSnapshot = {
    waiting: ((waiting.data ?? []) as { ticket_number: number }[]).map((r) => r.ticket_number),
    nowServing: ((called.data ?? []) as { ticket_number: number }[])[0]?.ticket_number ?? null,
  };
  if (snapshots.size >= SNAPSHOT_MAX_ENTRIES) snapshots.clear();
  snapshots.set(tenantId, { at: Date.now(), snap });
  return snap;
}

/**
 * Sair da fila: só a senha que a tela mostra, só se ainda em espera e não chamada, só deste
 * aparelho. Repetir depois de cancelada não muda nada e responde "already".
 */
export async function cancelDeviceTicket(
  admin: Admin,
  tenantId: string,
  deviceId: string
): Promise<"cancelled" | "already" | "not_waiting" | "error"> {
  const mine = await loadDeviceTicket(admin, tenantId, deviceId);
  if (mine === "error") return "error";
  if (!mine) return "not_waiting";
  if (mine.status === "LEFT" && mine.left_by_client) return "already";
  if (mine.status !== "WAITING" || mine.called_at) return "not_waiting";

  const { data, error } = await admin
    .from("queue_entries")
    .update({ status: "LEFT", ended_at: new Date().toISOString(), left_by_client: true })
    .eq("id", mine.id)
    .eq("tenant_id", tenantId)
    .eq("device_id", deviceId)
    .eq("status", "WAITING")
    .is("called_at", null)
    .select("id");
  if (error) return "error";
  return (data ?? []).length ? "cancelled" : "not_waiting";
}

/** O aparelho tem senha ativa hoje? (para a página abrir direto em "Minha senha") */
export async function deviceHasActiveTicket(admin: Admin, tenantId: string, deviceHash: string): Promise<boolean> {
  const deviceId = await resolveDevice(admin, tenantId, deviceHash);
  if (!deviceId || deviceId === "error") return false;
  const mine = await loadDeviceTicket(admin, tenantId, deviceId);
  return !!mine && mine !== "error" && (mine.status === "WAITING" || mine.status === "IN_SERVICE");
}
