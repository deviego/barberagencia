import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0);

export type CatalogProduct = { id: string; name: string; priceBrl: number; stock: number; imageUrl: string | null };
export type Supplier = { id: string; name: string };
export type OrderItem = { name: string; priceBrl: number; qty: number };
export type OrderView = {
  id: string;
  status: string;
  totalBrl: number;
  note: string | null;
  createdAt: string;
  counterpartName: string; // barbearia (visão distribuidor) ou distribuidor (visão barbearia)
  items: OrderItem[];
};

const mapItems = (rows: Row[]): OrderItem[] =>
  rows.map((i) => ({ name: i.name as string, priceBrl: num(i.price_brl), qty: num(i.qty) }));

async function tenantNames(admin: ReturnType<typeof createSupabaseAdminClient>, ids: string[]) {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return new Map<string, string>();
  const { data } = await admin.from("tenants").select("id, name").in("id", uniq);
  return new Map(((data ?? []) as Row[]).map((t) => [t.id as string, t.name as string]));
}

/** [Barbearia] Distribuidores que têm esta barbearia na carteira. */
export async function getSuppliers(): Promise<Supplier[]> {
  const user = await getSessionUser();
  if (!user?.tenantId) return [];
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("distributor_customers").select("tenant_id").eq("customer_tenant_id", user.tenantId).eq("active", true);
  const ids = [...new Set(((data ?? []) as Row[]).map((r) => r.tenant_id as string))];
  const names = await tenantNames(admin, ids);
  return ids.map((id) => ({ id, name: names.get(id) ?? "Distribuidor" }));
}

/** [Barbearia] Catálogo de um distribuidor (só se estiver na carteira). Sem expor custo. */
export async function getSupplierCatalog(distributorId: string): Promise<{ supplier: Supplier; products: CatalogProduct[] } | null> {
  const user = await getSessionUser();
  if (!user?.tenantId) return null;
  const admin = createSupabaseAdminClient();
  const { data: link } = await admin
    .from("distributor_customers")
    .select("id")
    .eq("tenant_id", distributorId)
    .eq("customer_tenant_id", user.tenantId)
    .eq("active", true)
    .maybeSingle();
  if (!link) return null;
  const { data: t } = await admin.from("tenants").select("name").eq("id", distributorId).maybeSingle();
  const { data: p } = await admin
    .from("products")
    .select("id, name, price_brl, stock, image_url")
    .eq("tenant_id", distributorId)
    .eq("active", true)
    .is("deleted_at", null)
    .order("name");
  return {
    supplier: { id: distributorId, name: (t?.name as string) ?? "Distribuidor" },
    products: ((p ?? []) as Row[]).map((r) => ({ id: r.id as string, name: r.name as string, priceBrl: num(r.price_brl), stock: num(r.stock), imageUrl: (r.image_url as string) ?? null })),
  };
}

async function ordersWith(admin: ReturnType<typeof createSupabaseAdminClient>, filter: { col: "distributor_id" | "customer_tenant_id"; id: string }, counterpartCol: "distributor_id" | "customer_tenant_id"): Promise<OrderView[]> {
  const { data: orders } = await admin
    .from("orders")
    .select("id, distributor_id, customer_tenant_id, status, total_brl, note, created_at")
    .eq(filter.col, filter.id)
    .order("created_at", { ascending: false });
  const rows = (orders ?? []) as Row[];
  if (!rows.length) return [];
  const names = await tenantNames(admin, rows.map((o) => o[counterpartCol] as string));
  const { data: items } = await admin.from("order_items").select("order_id, name, price_brl, qty").in("order_id", rows.map((o) => o.id as string));
  const itemsBy = new Map<string, Row[]>();
  for (const it of (items ?? []) as Row[]) {
    const k = it.order_id as string;
    itemsBy.set(k, [...(itemsBy.get(k) ?? []), it]);
  }
  return rows.map((o) => ({
    id: o.id as string,
    status: o.status as string,
    totalBrl: num(o.total_brl),
    note: (o.note as string) ?? null,
    createdAt: o.created_at as string,
    counterpartName: names.get(o[counterpartCol] as string) ?? "—",
    items: mapItems(itemsBy.get(o.id as string) ?? []),
  }));
}

/** [Distribuidor] Pedidos recebidos (barbearia como contraparte). */
export async function getDistributorOrders(): Promise<OrderView[]> {
  const user = await getSessionUser();
  if (!user?.tenantId) return [];
  const admin = createSupabaseAdminClient();
  return ordersWith(admin, { col: "distributor_id", id: user.tenantId }, "customer_tenant_id");
}

/** [Barbearia] Meus pedidos aos distribuidores. */
export async function getMySupplierOrders(): Promise<OrderView[]> {
  const user = await getSessionUser();
  if (!user?.tenantId) return [];
  const admin = createSupabaseAdminClient();
  return ordersWith(admin, { col: "customer_tenant_id", id: user.tenantId }, "distributor_id");
}
