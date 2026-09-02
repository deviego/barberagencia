import { CrudTable, type CrudColumn } from "@/features/admin/components/crud-table";
import { getMyCustomers } from "@/features/distributor/data";

const columns: CrudColumn[] = [
  { key: "trade_name", label: "Barbearia" },
  { key: "contact_name", label: "Responsável" },
  { key: "contact_phone", label: "Telefone" },
  { key: "address_city", label: "Cidade" },
  { key: "address_state", label: "UF" },
  { key: "active", label: "Status", format: "activeBadge" },
];

/** Carteira de clientes (barbearias) do distribuidor. */
export default async function DistributorClientesPage() {
  const rows = await getMyCustomers();
  return (
    <CrudTable
      table="distributor_customers"
      title="Clientes"
      newLabel="Novo cliente"
      rows={rows}
      searchKeys={["trade_name", "contact_name", "contact_phone", "address_city"]}
      columns={columns}
      fields={[
        { name: "trade_name", label: "Nome da barbearia" },
        { name: "legal_name", label: "Razão social" },
        { name: "contact_name", label: "Responsável" },
        { name: "contact_phone", label: "Telefone / WhatsApp", type: "phone" },
        { name: "contact_email", label: "E-mail" },
        { name: "address_street", label: "Endereço (rua, número, bairro)" },
        { name: "address_city", label: "Cidade" },
        { name: "address_state", label: "UF" },
        { name: "address_zip", label: "CEP" },
      ]}
    />
  );
}
