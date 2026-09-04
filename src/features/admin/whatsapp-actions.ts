"use server";

import { getSessionUser } from "@/lib/auth/session";

interface WaStatus {
  ok: boolean;
  status?: "connecting" | "qr" | "connected" | "disconnected";
  qr?: string | null;
  number?: string | null;
  error?: string;
}

async function gateway(path: string, init?: RequestInit): Promise<{ res?: Response; error?: string }> {
  const base = process.env.WA_SERVICE_URL;
  const token = process.env.WA_SERVICE_TOKEN;
  if (!base || !token) return { error: "Gateway de WhatsApp não configurado (WA_SERVICE_URL)." };
  const user = await getSessionUser();
  if (!user?.tenantId) return { error: "Sem tenant" };
  try {
    const res = await fetch(`${base}/sessions/${user.tenantId}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", "x-wa-token": token, ...(init?.headers || {}) },
      cache: "no-store",
    });
    return { res };
  } catch {
    return { error: "Não foi possível falar com o gateway." };
  }
}

export async function waStatus(): Promise<WaStatus> {
  const { res, error } = await gateway("/status");
  if (error) return { ok: false, error };
  const data = (await res!.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res!.ok) return { ok: false, error: (data.error as string) ?? `Gateway respondeu ${res!.status}.` };
  return { ok: true, ...data };
}

export async function waConnect(): Promise<WaStatus> {
  const { res, error } = await gateway("/connect", { method: "POST" });
  if (error) return { ok: false, error };
  const data = (await res!.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res!.ok) return { ok: false, error: (data.error as string) ?? `Falha ao conectar (${res!.status}).` };
  return { ok: true, ...data };
}

export async function waLogout(): Promise<{ ok: boolean; error?: string }> {
  const { res, error } = await gateway("/logout", { method: "POST" });
  if (error) return { ok: false, error };
  return { ok: res!.ok };
}

export async function waSend(phone: string): Promise<{ ok: boolean; error?: string }> {
  if (!phone.trim()) return { ok: false, error: "Informe um número." };
  const message = "✂️ Teste da Barbearia — seu WhatsApp está conectado e pronto para os avisos! ✅";
  const { res, error } = await gateway("/send", { method: "POST", body: JSON.stringify({ phone, message }) });
  if (error) return { ok: false, error };
  if (res!.status === 409) return { ok: false, error: "WhatsApp não está conectado. Conecte primeiro." };
  if (!res!.ok) return { ok: false, error: "Falha ao enviar o teste." };
  return { ok: true };
}
