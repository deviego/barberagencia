import { CrudTable, type CrudColumn } from "@/features/admin/components/crud-table";
import { getComboPlans, getServices } from "@/features/admin/data";

const serviceColumns: CrudColumn[] = [
  { key: "name", label: "Serviço" },
  { key: "duration_min", label: "Duração", format: "minutes" },
  { key: "price_brl", label: "Preço", format: "price" },
  { key: "active", label: "Status", format: "activeBadge" },
];

const planColumns: CrudColumn[] = [
  { key: "name", label: "Plano" },
  { key: "cuts", label: "Cortes/mês" },
  { key: "scope", label: "Escopo" },
  { key: "price_brl", label: "Preço", format: "price" },
  { key: "active", label: "Status", format: "activeBadge" },
];

export default async function ServicosAdminPage() {
  const [services, plans] = await Promise.all([getServices(), getComboPlans()]);

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
        ]}
      />

      <div className="border-t border-border-subtle pt-2">
        <p className="mb-2 text-caption text-text-muted">
          Planos mensais (combos) que o cliente assina e o admin pode atribuir.
        </p>
        <CrudTable
          table="combo_plans"
          title="Planos (combos)"
          newLabel="Novo plano"
          rows={plans}
          searchKeys={["name", "scope"]}
          columns={planColumns}
          fields={[
            { name: "name", label: "Nome do plano", placeholder: "Ex.: Combo Mensal 02" },
            { name: "cuts", label: "Cortes por mês", type: "number" },
            { name: "scope", label: "Escopo", placeholder: "Ex.: cabelo+barba+sobrancelha" },
            { name: "price_brl", label: "Preço (R$/mês)", type: "currency" },
          ]}
        />
      </div>
    </div>
  );
}
