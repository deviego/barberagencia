import { CrudTable, type CrudColumn } from "@/features/admin/components/crud-table";
import { AssignCombo } from "@/features/admin/components/assign-combo";
import { InviteButton } from "@/features/admin/components/invite-button";
import { getClients, getCombos } from "@/features/admin/data";

const columns: CrudColumn[] = [
  { key: "name", label: "Nome" },
  { key: "phone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "active", label: "Status", format: "activeBadge" },
];

export default async function ClientesPage() {
  const [rows, combos] = await Promise.all([getClients(), getCombos()]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-end gap-3">
        <InviteButton />
        <AssignCombo clients={rows as { id: string; name: string }[]} combos={combos as { id: string; name: string }[]} />
      </div>
      <CrudTable
        table="clients"
        title="Clientes"
        newLabel="Novo cliente"
        rows={rows}
        searchKeys={["name", "phone", "email"]}
        columns={columns}
        fields={[
          { name: "name", label: "Nome completo" },
          { name: "phone", label: "Telefone", placeholder: "(11) 91234-5678" },
          { name: "email", label: "E-mail", type: "email" },
        ]}
      />
    </div>
  );
}
