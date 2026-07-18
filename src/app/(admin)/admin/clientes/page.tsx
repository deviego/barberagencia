"use client";

import { MailCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CrudTable } from "@/features/admin/components/crud-table";
import { CLIENTS } from "@/features/admin/mock-data";

const InviteBlock = (
  <div className="flex flex-col gap-2 rounded-md border border-accent bg-accent-wash p-3">
    <div className="flex items-center gap-2 text-caption font-semibold text-accent">
      <MailCheck size={15} />
      Convite de acesso
    </div>
    <p className="text-caption text-text-2">
      Ao salvar, enviamos um link que expira em 48h para o cliente confirmar os dados e criar login e
      senha.
    </p>
    <div className="flex flex-wrap gap-2">
      {["WhatsApp ✓", "E-mail ✓", "SMS"].map((c) => (
        <span key={c} className="rounded-pill border border-border px-2.5 py-1 text-[11px] text-text-2">
          {c}
        </span>
      ))}
    </div>
  </div>
);

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
      inviteBlock={InviteBlock}
      saveLabel="Salvar e enviar convite"
    />
  );
}
