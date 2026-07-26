"use client";

import { useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AvatarUpload } from "@/components/avatar-upload";
import { cancelClientSubscription, fetchClientDetail, updateClientAvatar } from "@/features/admin/actions";
import { formatBRL, getInitials } from "@/lib/utils";

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

interface Detail {
  client: { id: string; name: string; email: string | null; phone: string | null; active: boolean; avatar_url: string | null } | null;
  sub: { saldo_cortes: number; combo_plans: unknown } | null;
  history: { id: string; start_at: string; status: string; consumed_from_plan: boolean; services: unknown; combo_plans: unknown }[];
}

const STATUS: Record<string, string> = {
  REQUESTED: "Aguardando",
  CONFIRMED: "Confirmado",
  ALT_OFFERED: "Outro horário",
  DONE: "Atendido",
  CANCELLED: "Cancelado",
  EXPIRED: "Expirado",
};

export function ClientDetail({ clientId }: { clientId: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function reload() {
    fetchClientDetail(clientId).then((d) => setData(d as Detail));
  }

  useEffect(() => {
    let alive = true;
    fetchClientDetail(clientId).then((d) => {
      if (alive) setData(d as Detail);
    });
    return () => {
      alive = false;
    };
  }, [clientId]);

  function doCancel() {
    setErr(null);
    startTransition(async () => {
      const res = await cancelClientSubscription(clientId);
      if (res.ok) {
        setConfirming(false);
        reload();
      } else {
        setErr(res.error);
      }
    });
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-10 text-text-muted">
        <Loader2 className="animate-spin" size={22} />
      </div>
    );
  }

  const client = data.client;
  if (!client) return <p className="text-text-muted">Cliente não encontrado.</p>;

  const combo = one(data.sub?.combo_plans as { name: string; cuts: number; price_brl: number }[] | { name: string; cuts: number; price_brl: number });

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho + foto */}
      <div className="flex items-center gap-3">
        <AvatarUpload
          current={client.avatar_url}
          fallback={getInitials(client.name)}
          folder={`clients/${client.id}`}
          onChange={(url) => updateClientAvatar(client.id, url)}
        />
        <div>
          <div className="text-body font-semibold text-text">{client.name}</div>
          <div className="text-caption text-text-muted">{client.email || client.phone || "—"}</div>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between rounded-md border border-border-subtle px-4 py-3">
        <span className="text-caption text-text-muted">Status</span>
        {client.active ? <Badge variant="success">Ativo</Badge> : <Badge>Inativo</Badge>}
      </div>

      {/* Plano */}
      <div className="rounded-md border border-border-subtle px-4 py-3">
        <div className="text-overline uppercase text-text-muted">Plano</div>
        {combo ? (
          <>
            <div className="mt-1 flex items-center justify-between">
              <div>
                <div className="text-body font-semibold text-text">{combo.name}</div>
                <div className="text-caption text-text-muted">{formatBRL(combo.price_brl)}/mês</div>
              </div>
              <Badge variant="accent">
                {data.sub?.saldo_cortes ?? 0}/{combo.cuts} cortes
              </Badge>
            </div>
            {confirming ? (
              <div className="mt-3 rounded-md border border-danger bg-danger-bg px-3 py-2.5">
                <p className="text-caption text-danger-strong">
                  Cancelar o plano de <strong>{client.name}</strong>? O cliente perde o saldo de cortes.
                </p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="danger" loading={pending} onClick={doCancel}>
                    Sim, cancelar plano
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                    Voltar
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="mt-3 text-caption font-medium text-danger hover:underline"
              >
                Cancelar plano do cliente
              </button>
            )}
            {err && <p className="mt-2 text-caption text-danger">{err}</p>}
          </>
        ) : (
          <p className="mt-1 text-body text-text-2">Sem plano ativo.</p>
        )}
      </div>

      {/* Histórico */}
      <div className="flex flex-col gap-2">
        <div className="text-overline uppercase text-text-muted">Histórico de serviços</div>
        {data.history.length === 0 && <p className="text-caption text-text-muted">Nenhum atendimento ainda.</p>}
        {data.history.map((h) => {
          const svc = one(h.services as { name: string }[] | { name: string }) ?? one(h.combo_plans as { name: string }[] | { name: string });
          return (
            <div key={h.id} className="flex items-center justify-between rounded-md border border-border-subtle px-3 py-2.5">
              <div>
                <div className="text-body text-text">{svc?.name ?? "Corte"}</div>
                <div className="text-caption text-text-muted tabular">
                  {format(new Date(h.start_at), "dd MMM yyyy · HH:mm", { locale: ptBR })}
                </div>
              </div>
              <span className="text-caption text-text-muted">{STATUS[h.status] ?? h.status}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
