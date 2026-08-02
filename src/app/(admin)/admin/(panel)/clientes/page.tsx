import { CrudTable, type CrudColumn } from "@/features/admin/components/crud-table";
import { AssignCombo } from "@/features/admin/components/assign-combo";
import { InviteButton } from "@/features/admin/components/invite-button";
import { getClients, getCombos } from "@/features/admin/data";
import { getCurrentTenant } from "@/lib/tenant/resolve";

const columns: CrudColumn[] = [
  { key: "name", label: "Nome" },
  { key: "phone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "children_count", label: "Crianças", format: "childrenBadge" },
  { key: "active", label: "Situação", format: "clientStatusBadge" },
];

export default async function ClientesPage() {
  const [rows, combos, tenant] = await Promise.all([getClients(), getCombos(), getCurrentTenant()]);
  // Convidados (ainda não registrados) não podem receber plano.
  const registered = (rows as { id: string; name: string; status?: string }[]).filter((r) => r.status !== "INVITED");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-end gap-3">
        <InviteButton tenantName={tenant.name} />
        <AssignCombo clients={registered as { id: string; name: string }[]} combos={combos as { id: string; name: string }[]} />
      </div>
      <CrudTable
        table="clients"
        title="Clientes"
        newLabel="Novo cliente"
        hideNew
        rows={rows}
        detail="client"
        searchKeys={["name", "phone", "email"]}
        columns={columns}
        fields={[
          { name: "name", label: "Nome completo" },
          { name: "phone", label: "Telefone", type: "phone", placeholder: "(11) 91234-5678" },
          { name: "email", label: "E-mail", type: "email" },
        ]}
      />
    </div>
  );
}
