import { AgendarForm } from "@/features/client/components/agendar-form";
import { getCatalog, getClientHome } from "@/features/client/data";

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

export default async function AgendarPage() {
  const [catalog, home] = await Promise.all([getCatalog(), getClientHome()]);

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
      <div className="rounded-lg border border-border bg-inset p-4 text-caption text-text-2">
        ⚠️ O pagamento é feito no local após o atendimento (dinheiro, PIX ou cartão). Vai pagar em
        dinheiro? Se precisar de troco, avise o barbeiro ao chegar. Aproveite! ✂️
      </div>
      <AgendarForm barbers={catalog.barbers} services={catalog.services} plan={plan} />
    </div>
  );
}
