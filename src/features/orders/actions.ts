"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { isUuid } from "@/lib/auth/acting";
import { formatBRL } from "@/lib/utils";

const STATUS_MSG: Record<string, string> = {
  CONFIRMED: "foi ACEITO ✅",
  SHIPPED: "foi ENVIADO 🚚",
  DELIVERED: "foi ENTREGUE 📦",
  CANCELLED: "foi CANCELADO ❌",
};

/** Envia WhatsApp pela sessão do distribuidor (best-effort; ignora se não configurado/conectado). */
async function notify(senderTenantId: string, phone: string | null, message: string) {
  const base = process.env.WA_SERVICE_URL;
  const token = process.env.WA_SERVICE_TOKEN;
  if (!base || !token || !phone) return;
  try {
    await fetch(`${base}/sessions/${senderTenantId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-wa-token": token },
      body: JSON.stringify({ phone, message }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    /* notificação não bloqueia o fluxo */
  }
}

async function tenantPhone(admin: ReturnType<typeof createSupabaseAdminClient>, tenantId: string): Promise<string | null> {
  const { data } = await admin.from("tenant_settings").select("phone").eq("tenant_id", tenantId).maybeSingle();
  return (data?.phone as string) ?? null;
}
async function tenantName(admin: ReturnType<typeof createSupabaseAdminClient>, tenantId: string): Promise<string> {
  const { data } = await admin.from("tenants").select("name").eq("id", tenantId).maybeSingle();
  return (data?.name as string) ?? "—";
}

/** [Barbearia] Cria um pedido a um distribuidor (RPC transacional). */
export async function placeOrder(distributorId: string, items: { productId: string; qty: number }[], note?: string) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { ok: false as const, error: "Sessão inválida." };
  if (!isUuid(distributorId)) return { ok: false as const, error: "Distribuidor inválido." };
  const clean = items.filter((i) => isUuid(i.productId) && i.qty > 0).map((i) => ({ product_id: i.productId, qty: Math.floor(i.qty) }));
  if (!clean.length) return { ok: false as const, error: "Carrinho vazio." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("place_order", { p_distributor: distributorId, p_items: clean, p_note: note ?? null });
  if (error) return { ok: false as const, error: error.message };

  // Alerta o distribuidor (best-effort).
  try {
    const admin = createSupabaseAdminClient();
    const [phone, buyer] = await Promise.all([tenantPhone(admin, distributorId), tenantName(admin, user.tenantId)]);
    await notify(distributorId, phone, `📥 Novo pedido de *${buyer}* na Barber Agência. Acesse o painel para aceitar.`);
  } catch {
    /* ignore */
  }

  revalidatePath("/admin/fornecedores");
  return { ok: true as const, orderId: data as string };
}

/** [Distribuidor/Barbearia] Muda o status do pedido (RPC valida papel + estoque). */
export async function setOrderStatus(orderId: string, status: string) {
  const user = await getSessionUser();
  if (!user?.tenantId) return { ok: false as const, error: "Sessão inválida." };
  if (!isUuid(orderId)) return { ok: false as const, error: "Pedido inválido." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_order_status", { p_order_id: orderId, p_status: status });
  if (error) return { ok: false as const, error: error.message };

  // Notifica a barbearia compradora (best-effort, pela sessão do distribuidor).
  try {
    const admin = createSupabaseAdminClient();
    const { data: o } = await admin.from("orders").select("distributor_id, customer_tenant_id, total_brl").eq("id", orderId).maybeSingle();
    if (o && STATUS_MSG[status]) {
      const [phone, distName] = await Promise.all([
        tenantPhone(admin, o.customer_tenant_id as string),
        tenantName(admin, o.distributor_id as string),
      ]);
      await notify(o.distributor_id as string, phone, `Seu pedido no *${distName}* ${STATUS_MSG[status]}. Total: ${formatBRL(Number(o.total_brl))}.`);
    }
  } catch {
    /* ignore */
  }

  revalidatePath("/distributor/pedidos");
  revalidatePath("/admin/fornecedores");
  return { ok: true as const };
}
