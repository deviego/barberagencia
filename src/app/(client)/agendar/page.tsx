import { AgendarForm } from "@/features/client/components/agendar-form";
import { PaymentNotice } from "@/features/client/components/payment-notice";
import { getCatalog, getClientHome, getProducts, getWorkingHours } from "@/features/client/data";

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

export default async function AgendarPage() {
  const [catalog, home, workingHours, products] = await Promise.all([
    getCatalog(),
    getClientHome(),
    getWorkingHours(),
    getProducts(),
  ]);

  const sub = home?.sub as
    | { combo_plan_id: string; saldo_cortes: number; combo_plans: unknown }
    | null
    | undefined;
  const combo = one(sub?.combo_plans as { name: string }[] | { name: string });

  const plan =
    sub && combo
      ? { comboPlanId: sub.combo_plan_id, name: combo.name, saldo: sub.saldo_cortes }
      : null;

  return (
    <div className="flex flex-col gap-5">
      <PaymentNotice />
      <AgendarForm
        barbers={catalog.barbers}
        services={catalog.services}
        products={products}
        workingHours={workingHours}
        plan={plan}
      />
    </div>
  );
}
