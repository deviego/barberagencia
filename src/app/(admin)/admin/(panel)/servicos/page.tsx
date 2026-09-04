import { CrudTable, type CrudColumn } from "@/features/admin/components/crud-table";
import { PlanManager } from "@/features/admin/components/plan-manager";
import { getPlansManage, getServices } from "@/features/admin/data";

const serviceColumns: CrudColumn[] = [
  { key: "name", label: "Serviço" },
  { key: "duration_min", label: "Duração", format: "minutes" },
  { key: "price_brl", label: "Preço", format: "price" },
  { key: "is_child_service", label: "Infantil", format: "childService" },
  { key: "active", label: "Status", format: "activeBadge" },
];

export default async function ServicosAdminPage() {
  const [services, plans] = await Promise.all([getServices(), getPlansManage()]);
  const serviceOpts = (services as { id: string; name: string }[]).map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="flex flex-col gap-10">
      <CrudTable
        table="services"
        title="Serviços"
        newLabel="Novo serviço"
        rows={services}
        searchKeys={["name"]}
        columns={serviceColumns}
        fields={[
          { name: "name", label: "Nome do serviço" },
          { name: "duration_min", label: "Duração (min)", type: "number" },
          { name: "price_brl", label: "Preço (R$)", type: "currency" },
          { name: "category", label: "Categoria" },
          { name: "is_child_service", label: "Serviço infantil", type: "switch" },
        ]}
      />

      <div className="flex flex-col gap-3 border-t border-border-subtle pt-6">
        <p className="text-caption text-text-muted">
          Planos mensais (combos) que o cliente assina. Um plano pode cobrir <strong>vários serviços</strong> (o combo
          inteiro por visita). No modo <strong>Fixo</strong>, o cliente tem dia/horário/barbeiro fixos toda semana.
        </p>
        <PlanManager plans={plans} services={serviceOpts} />
      </div>
    </div>
  );
}
