import { Badge } from "@/components/ui/badge";
import { CrudTable } from "@/features/admin/components/crud-table";
import { STAFF } from "@/features/admin/mock-data";

export default function BarbeirosPage() {
  return (
    <CrudTable
      title="Barbeiros"
      newLabel="Novo barbeiro"
      rows={STAFF}
      searchKeys={["name", "specialties"]}
      columns={[
        { key: "name", label: "Nome" },
        { key: "specialties", label: "Especialidades" },
        { key: "commissionPct", label: "Comissão", render: (r) => `${r.commissionPct}%` },
        {
          key: "active",
          label: "Status",
          render: (r) => (r.active ? <Badge variant="success">Ativo</Badge> : <Badge>Inativo</Badge>),
        },
      ]}
      fields={[
        { name: "name", label: "Nome completo" },
        { name: "specialties", label: "Especialidades" },
        { name: "commissionPct", label: "Comissão (%)", type: "number" },
      ]}
    />
  );
}
