import { AgendarForm } from "@/features/client/components/agendar-form";
import type { Child } from "@/features/client/components/child-modal";
import { PaymentNotice } from "@/features/client/components/payment-notice";
import { getCatalog, getClientHome, getMyChildren, getProducts, getWorkingHours, getSlotStep } from "@/features/client/data";

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

export default async function AgendarPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const { service: preselectId } = await searchParams;
  const [catalog, home, workingHours, products, children, slotStep] = await Promise.all([
    getCatalog(),
    getClientHome(),
    getWorkingHours(),
    getProducts(),
    getMyChildren(),
    getSlotStep(),
  ]);

  const sub = home?.sub as
    | {
        combo_plan_id: string;
        saldo_cortes: number;
        fixed_weekday: number | null;
        fixed_start_min: number | null;
        fixed_barber_id: string | null;
        combo_plans: unknown;
      }
    | null
    | undefined;
  const combo = one(sub?.combo_plans as { name: string; booking_mode?: string }[] | { name: string; booking_mode?: string });
  const bookingMode = combo?.booking_mode ?? "FLEXIBLE";
  const fixedBarberName =
    sub?.fixed_barber_id ? catalog.barbers.find((b) => b.id === sub.fixed_barber_id)?.name ?? null : null;

  const plan =
    sub && combo
      ? {
          comboPlanId: sub.combo_plan_id,
          name: combo.name,
          saldo: sub.saldo_cortes,
          bookingMode,
          fixed:
            bookingMode === "FIXED"
              ? { weekday: sub.fixed_weekday, startMin: sub.fixed_start_min, barberName: fixedBarberName }
              : null,
        }
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
        preselectId={preselectId ?? null}
        children={children as Child[]}
        stepMin={slotStep}
      />
    </div>
  );
}
