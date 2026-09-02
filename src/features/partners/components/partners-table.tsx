"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Power } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/utils";
import { CopyLink } from "./copy-link";
import { setPartnerActive, deletePartner } from "../actions";
import type { PartnerRow, PartnerType } from "../data";

const TYPE_LABEL: Record<PartnerType, string> = { EMBAIXADORA: "Embaixadora", DIVULGADORA: "Divulgadora", DISTRIBUIDOR: "Distribuidor" };
const TYPE_VARIANT: Record<PartnerType, React.ComponentProps<typeof Badge>["variant"]> = {
  EMBAIXADORA: "accent",
  DIVULGADORA: "info",
  DISTRIBUIDOR: "neutral",
};

function commissionLabel(kind: string, value: number) {
  if (kind === "PCT") return `${value}% / mês`;
  if (kind === "FIXED") return `${formatBRL(value)} / indicação`;
  return "—";
}

export function PartnersTable({ partners, origin }: { partners: PartnerRow[]; origin: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle(id: string, active: boolean) {
    startTransition(async () => {
      await setPartnerActive(id, active);
      router.refresh();
    });
  }
  function remove(id: string, name: string) {
    if (!confirm(`Remover o parceiro "${name}"? As barbearias indicadas perdem a atribuição.`)) return;
    startTransition(async () => {
      await deletePartner(id);
      router.refresh();
    });
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-body">
        <thead>
          <tr className="border-b border-border bg-surface text-left text-caption uppercase text-text-muted">
            <th className="px-4 py-3 font-semibold">Parceiro</th>
            <th className="px-4 py-3 font-semibold">Tipo</th>
            <th className="px-4 py-3 font-semibold">Barbearia</th>
            <th className="px-4 py-3 text-right font-semibold">Indicados</th>
            <th className="px-4 py-3 font-semibold">Comissão</th>
            <th className="px-4 py-3 font-semibold">Link afiliado</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Ações</th>
          </tr>
        </thead>
        <tbody>
          {partners.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-text-muted">
                Nenhum parceiro cadastrado ainda.
              </td>
            </tr>
          ) : (
            partners.map((p) => (
              <tr key={p.id} className="border-b border-border-subtle hover:bg-accent-wash/40">
                <td className="px-4 py-3">
                  <Link href={`/master/parceiros/${p.id}`} className="font-semibold text-text hover:text-accent">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-3"><Badge variant={TYPE_VARIANT[p.type]}>{TYPE_LABEL[p.type]}</Badge></td>
                <td className="px-4 py-3 text-text-2">{p.tenantName ?? (p.isBarbershop ? "— (não cadastrada)" : "—")}</td>
                <td className="px-4 py-3 text-right text-text tabular">{p.referred}</td>
                <td className="px-4 py-3 text-text-2">{commissionLabel(p.commissionKind, p.commissionValue)}</td>
                <td className="px-4 py-3"><CopyLink value={`${origin}/?ref=${p.refCode}`} /></td>
                <td className="px-4 py-3"><Badge variant={p.active ? "success" : "neutral"}>{p.active ? "Ativo" : "Inativo"}</Badge></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggle(p.id, !p.active)} disabled={pending} title={p.active ? "Desativar" : "Ativar"} className="text-text-muted hover:text-accent">
                      <Power size={16} />
                    </button>
                    <button onClick={() => remove(p.id, p.name)} disabled={pending} title="Remover" className="text-text-muted hover:text-danger">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
