import { CrudTable, type CrudColumn } from "@/features/admin/components/crud-table";
import { getServices } from "@/features/admin/data";

const columns: CrudColumn[] = [
  { key: "name", label: "Serviço" },
  { key: "duration_min", label: "Duração", format: "minutes" },
  { key: "price_brl", label: "Preço", format: "price" },
  { key: "active", label: "Status", format: "activeBadge" },
];

export default async function ServicosAdminPage() {
  const rows = await getServices();
  return (
    <CrudTable
      table="services"
      title="Serviços"
      newLabel="Novo serviço"
      rows={rows}
      searchKeys={["name"]}
      columns={columns}
      fields={[
        { name: "name", label: "Nome do serviço" },
        { name: "duration_min", label: "Duração (min)", type: "number" },
        { name: "price_brl", label: "Preço (R$)", type: "number" },
        { name: "category", label: "Categoria" },
      ]}
    />
  );
}
