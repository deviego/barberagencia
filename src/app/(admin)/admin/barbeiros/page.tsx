import { CrudTable, type CrudColumn } from "@/features/admin/components/crud-table";
import { getBarbers } from "@/features/admin/data";

const columns: CrudColumn[] = [
  { key: "name", label: "Nome" },
  { key: "active", label: "Status", format: "activeBadge" },
];

export default async function BarbeirosPage() {
  const rows = await getBarbers();
  return (
    <CrudTable
      table="barbers"
      title="Barbeiros"
      newLabel="Novo barbeiro"
      rows={rows}
      searchKeys={["name"]}
      columns={columns}
      fields={[{ name: "name", label: "Nome completo" }]}
    />
  );
}
