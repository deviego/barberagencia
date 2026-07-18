"use client";

import { Badge } from "@/components/ui/badge";
import { CrudTable } from "@/features/admin/components/crud-table";
import { SERVICES } from "@/features/admin/mock-data";
import { formatBRL } from "@/lib/utils";

export default function ServicosAdminPage() {
  return (
    <CrudTable
      title="Serviços"
      newLabel="Novo serviço"
      rows={SERVICES}
      searchKeys={["name"]}
      columns={[
        { key: "name", label: "Serviço" },
        { key: "durationMin", label: "Duração", render: (r) => `${r.durationMin} min` },
        { key: "priceBRL", label: "Preço", render: (r) => formatBRL(r.priceBRL) },
        {
          key: "active",
          label: "Status",
          render: (r) => (r.active ? <Badge variant="success">Ativo</Badge> : <Badge>Inativo</Badge>),
        },
      ]}
      fields={[
        { name: "name", label: "Nome do serviço" },
        { name: "durationMin", label: "Duração (min)", type: "number" },
        { name: "priceBRL", label: "Preço (R$)", type: "number" },
        { name: "category", label: "Categoria" },
      ]}
    />
  );
}
