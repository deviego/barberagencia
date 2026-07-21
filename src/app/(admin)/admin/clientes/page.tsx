import { CrudTable, type CrudColumn } from "@/features/admin/components/crud-table";
import { getClients } from "@/features/admin/data";

const columns: CrudColumn[] = [
  { key: "name", label: "Nome" },
  { key: "phone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "active", label: "Status", format: "activeBadge" },
];

export default async function ClientesPage() {
  const rows = await getClients();
  return (
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
  );
}
