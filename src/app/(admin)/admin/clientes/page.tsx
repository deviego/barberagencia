import { Badge } from "@/components/ui/badge";
import { CrudTable } from "@/features/admin/components/crud-table";
import { CLIENTS } from "@/features/admin/mock-data";

export default function ClientesPage() {
  return (
    <CrudTable
      title="Clientes"
      newLabel="Novo cliente"
      rows={CLIENTS}
      searchKeys={["name", "phone", "plan"]}
      columns={[
        { key: "name", label: "Nome" },
        { key: "phone", label: "Telefone" },
        { key: "plan", label: "Plano" },
        {
          key: "active",
          label: "Status",
          render: (r) =>
            r.active ? <Badge variant="success">Ativo</Badge> : <Badge>Inativo</Badge>,
        },
      ]}
      fields={[
        { name: "name", label: "Nome completo" },
        { name: "phone", label: "Telefone", placeholder: "+55 (11) 9____-____" },
        { name: "email", label: "E-mail", type: "email" },
        { name: "plan", label: "Plano" },
      ]}
    />
  );
}
