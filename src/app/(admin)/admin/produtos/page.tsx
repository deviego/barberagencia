"use client";

import { Badge } from "@/components/ui/badge";
import { CrudTable } from "@/features/admin/components/crud-table";
import { PRODUCTS } from "@/features/admin/mock-data";
import { formatBRL } from "@/lib/utils";

export default function ProdutosPage() {
  return (
    <CrudTable
      title="Produtos"
      newLabel="Novo produto"
      rows={PRODUCTS}
      searchKeys={["name", "sku"]}
      columns={[
        { key: "name", label: "Produto" },
        { key: "sku", label: "SKU" },
        { key: "priceBRL", label: "Preço", render: (r) => formatBRL(r.priceBRL) },
        {
          key: "stock",
          label: "Estoque",
          render: (r) =>
            r.stock > 0 ? (
              <span className="tabular">{r.stock}</span>
            ) : (
              <Badge variant="danger">Sem estoque</Badge>
            ),
        },
        {
          key: "active",
          label: "Status",
          render: (r) => (r.active ? <Badge variant="success">Ativo</Badge> : <Badge>Inativo</Badge>),
        },
      ]}
      fields={[
        { name: "name", label: "Nome do produto" },
        { name: "sku", label: "SKU" },
        { name: "priceBRL", label: "Preço (R$)", type: "number" },
        { name: "stock", label: "Estoque", type: "number" },
      ]}
    />
  );
}
