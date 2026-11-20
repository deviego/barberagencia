import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isQuickQueueSlug,
  quickQueueRoute,
  quickQueueStatus,
  quickQueueViewer,
  type QuickQueueTenantState,
} from "./rules";
import { hashDeviceToken, readDeviceToken } from "./device";
import { deviceHasActiveTicket } from "./ticket";
import type { QuickQueueBrand, QuickQueueEntry, QuickQueueRoute } from "./types";

/*
 * Leituras da fila rápida. Por que service role: a página é pública (visitante sem sessão) e a
 * RLS de tenants/tenant_settings/branding só deixa ler o próprio tenant. A barbearia vem só do
 * endereço, resolvida aqui; nada vem do navegador além do slug, que é validado antes da consulta.
 * Este arquivo nunca devolve linha crua: só o estado (que fica no servidor) e a marca.
 */

type Admin = ReturnType<typeof createSupabaseAdminClient>;

function adminOrNull(): Admin | null {
  try {
    return createSupabaseAdminClient();
  } catch {
    return null;
  }
}

/**
 * Lê tenants com a coluna nova; se a schema-51 ainda não foi aplicada, lê sem ela e a fila
 * rápida fica desligada (o link segue exatamente como hoje).
 */
async function loadTenantRow(admin: Admin, slug: string) {
  const withFlag = await admin
    .from("tenants")
    .select("id, kind, saas_plan, queue_enabled, quick_queue_enabled")
    .eq("subdomain", slug)
    .limit(1)
    .maybeSingle();
  if (!withFlag.error) return withFlag.data as Record<string, unknown> | null;

  const without = await admin
    .from("tenants")
    .select("id, kind, saas_plan, queue_enabled")
    .eq("subdomain", slug)
    .limit(1)
    .maybeSingle();
  if (without.error) throw new Error("[quick-queue] leitura da barbearia indisponível");
  return without.data ? { ...(without.data as Record<string, unknown>), quick_queue_enabled: false } : null;
}

/** Estado da barbearia do endereço (null = não existe). Só para uso no servidor. */
export const loadQuickQueueTenantState = cache(async (slug: string): Promise<QuickQueueTenantState | null> => {
  if (!isQuickQueueSlug(slug)) return null;
  const admin = adminOrNull();
  if (!admin) return null;

  const t = await loadTenantRow(admin, slug);
  if (!t) return null;
  const id = t.id as string;

  const [{ data: s, error: settingsError }, { data: c, error: contractError }] = await Promise.all([
    admin.from("tenant_settings").select("queue_mode").eq("tenant_id", id).maybeSingle(),
    admin.from("tenant_contracts").select("trial_ends_at").eq("tenant_id", id).maybeSingle(),
  ]);

  const mode = s?.queue_mode as string | undefined;
  return {
    id,
    kind: t.kind === "DISTRIBUTOR" ? "DISTRIBUTOR" : "BARBERSHOP",
    saasPlan: (t.saas_plan as string | null) ?? null,
    trialEndsAt: (c?.trial_ends_at as string | null) ?? null,
    queueEnabled: t.queue_enabled === true,
    // Mesmo padrão de getQueueConfig: sem linha em tenant_settings, o modo é APP.
    queueMode: mode === "TOTEM" || mode === "BOTH" ? mode : "APP",
    quickQueueEnabled: t.quick_queue_enabled === true,
    // Erro nessas leituras = UNAVAILABLE (nunca abre a jornada sem saber o modo e o plano).
    readFailed: Boolean(settingsError || contractError),
  };
});

/** Marca da barbearia (nome, logo e cores). Só chamada quando a fila rápida está OPEN. */
export async function loadQuickQueueBrand(tenantId: string): Promise<QuickQueueBrand> {
  const admin = createSupabaseAdminClient();
  const [{ data: t }, { data: b }] = await Promise.all([
    admin.from("tenants").select("name").eq("id", tenantId).maybeSingle(),
    admin
      .from("branding")
      .select("logo_text, logo_url, accent, accent_hover, accent_down, accent_wash, focus")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ]);
  return {
    name: (t?.name as string | undefined) ?? "",
    logoText: (b?.logo_text as string | null) ?? "BO",
    logoUrl: (b?.logo_url as string | null) ?? null,
    accent: (b?.accent as string | null) ?? null,
    accentHover: (b?.accent_hover as string | null) ?? null,
    accentDown: (b?.accent_down as string | null) ?? null,
    accentWash: (b?.accent_wash as string | null) ?? null,
    focus: (b?.focus as string | null) ?? null,
  };
}

/**
 * Barbearias em que a sessão atual tem vínculo de CLIENTE (sob RLS: memberships_self).
 * Não usa getSessionUser().tenantId, que escolhe um vínculo só e segue o "atuar como" do master.
 */
export async function loadSessionClientTenantIds(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from("memberships").select("tenant_id").eq("user_id", user.id).eq("role", "CLIENT");
  return ((data ?? []) as { tenant_id: string | null }[]).map((m) => m.tenant_id).filter((v): v is string => Boolean(v));
}

/**
 * Tela inicial da fila rápida (/b/<slug>/fila/rapida). Chamada no servidor (página).
 * Fora de OPEN não devolve marca nem olha a sessão.
 */
export async function getQuickQueueEntry(slug: string): Promise<QuickQueueEntry> {
  const state = await loadQuickQueueTenantState(slug);
  const status = quickQueueStatus(state, new Date());
  if (status !== "OPEN" || !state) return { status: status === "OPEN" ? "NOT_FOUND" : status, viewer: "VISITOR" };

  const [brand, clientTenantIds, hasTicket] = await Promise.all([
    loadQuickQueueBrand(state.id),
    loadSessionClientTenantIds(),
    deviceTicketOpen(state.id),
  ]);
  // HAS_TICKET: este aparelho tem senha ativa hoje (credencial do cookie) → "Minha senha" (#98).
  return { status: "OPEN", brand, viewer: hasTicket ? "HAS_TICKET" : quickQueueViewer(clientTenantIds, state.id) };
}

/** Senha ativa hoje criada neste aparelho? Falha de leitura = não (a tela começa pelo telefone). */
async function deviceTicketOpen(tenantId: string): Promise<boolean> {
  const token = await readDeviceToken();
  const admin = adminOrNull();
  if (!token || !admin) return false;
  return deviceHasActiveTicket(admin, tenantId, hashDeviceToken(token));
}

/** Despachante de /b/<slug>/fila: LEGACY = exatamente o fluxo de hoje. */
export async function getQuickQueueRoute(slug: string): Promise<QuickQueueRoute> {
  try {
    return quickQueueRoute(await loadQuickQueueTenantState(slug));
  } catch {
    return "LEGACY"; // leitura indisponível: segue o fluxo de hoje
  }
}
