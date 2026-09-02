"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PartnersTable } from "./partners-table";
import { PartnerForm } from "./partner-form";
import type { PartnerRow } from "../data";

export function PartnersManager({ partners, tenants, origin }: { partners: PartnerRow[]; tenants: { id: string; name: string }[]; origin: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h3 font-bold text-text">Parceiros</h1>
          <p className="text-caption text-text-muted">Embaixadores, divulgadores e distribuidores que trazem barbearias.</p>
        </div>
        <Button variant={open ? "outline" : "primary"} onClick={() => setOpen((o) => !o)}>
          {open ? <><X size={16} /> Fechar</> : <><Plus size={16} /> Novo parceiro</>}
        </Button>
      </div>

      {open && <PartnerForm tenants={tenants} onSaved={() => setOpen(false)} />}

      <PartnersTable partners={partners} origin={origin} />
    </div>
  );
}
