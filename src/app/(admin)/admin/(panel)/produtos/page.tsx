import { CrudTable, type CrudColumn } from "@/features/admin/components/crud-table";
import { getProducts } from "@/features/admin/data";

const columns: CrudColumn[] = [
  { key: "name", label: "Produto" },
  { key: "sku", label: "SKU" },
  { key: "price_brl", label: "Preço", format: "price" },
  { key: "stock", label: "Estoque", format: "stock" },
  { key: "active", label: "Status", format: "activeBadge" },
];

export default async function ProdutosPage() {
  const rows = await getProducts();
  return (
    <CrudTable
      table="products"
      title="Produtos"
      newLabel="Novo produto"
      rows={rows}
      searchKeys={["name", "sku"]}
      columns={columns}
      fields={[
        { name: "name", label: "Nome do produto" },
        { name: "sku", label: "SKU" },
        { name: "price_brl", label: "Preço (R$)", type: "number" },
        { name: "cost_brl", label: "Custo (R$)", type: "number" },
        { name: "stock", label: "Estoque", type: "number" },
      ]}
    />
  );
}
