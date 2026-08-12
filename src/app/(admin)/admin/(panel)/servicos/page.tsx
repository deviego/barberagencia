import { CrudTable, type CrudColumn } from "@/features/admin/components/crud-table";
import { getComboPlans, getServices } from "@/features/admin/data";

const serviceColumns: CrudColumn[] = [
  { key: "name", label: "Serviço" },
  { key: "duration_min", label: "Duração", format: "minutes" },
  { key: "price_brl", label: "Preço", format: "price" },
  { key: "is_child_service", label: "Infantil", format: "childService" },
  { key: "active", label: "Status", format: "activeBadge" },
];

const planColumns: CrudColumn[] = [
  { key: "name", label: "Plano" },
  { key: "booking_mode", label: "Modo", format: "planMode" },
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
          { name: "is_child_service", label: "Serviço infantil", type: "switch" },
        ]}
      />

      <div className="border-t border-border-subtle pt-2">
        <p className="mb-2 text-caption text-text-muted">
          Planos mensais (combos) que o cliente assina e o admin pode atribuir. No modo <strong>Fixo</strong>, o cliente
          tem dia/horário/barbeiro fixos toda semana (você define ao ativar) e o sistema já reserva os cortes.
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
            {
              name: "booking_mode",
              label: "Modo de agendamento",
              type: "select",
              options: [
                { value: "FLEXIBLE", label: "Livre — cliente marca em qualquer horário" },
                { value: "FIXED", label: "Fixo — dia/horário/barbeiro fixos toda semana" },
              ],
            },
            {
              name: "service_id",
              label: "Serviço do plano (usado no plano fixo)",
              type: "select",
              options: [
                { value: "", label: "— (nenhum)" },
                ...services.map((s) => ({ value: (s as { id: string }).id, label: (s as { name: string }).name })),
              ],
            },
            { name: "forfeit_on_noshow", label: "Fixo: perde o corte em caso de falta", type: "switch" },
          ]}
        />
      </div>
    </div>
  );
}
