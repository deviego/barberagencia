"use client";

import { useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Baby, Loader2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { AvatarUpload } from "@/components/avatar-upload";
import { adminAddChild, cancelClientSubscription, fetchClientDetail, updateClientAvatar } from "@/features/admin/actions";
import { formatBRL, getInitials } from "@/lib/utils";

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

interface Detail {
  client: { id: string; name: string; email: string | null; phone: string | null; active: boolean; avatar_url: string | null } | null;
  sub: { saldo_cortes: number; combo_plans: unknown } | null;
  history: { id: string; start_at: string; status: string; consumed_from_plan: boolean; services: unknown; combo_plans: unknown }[];
  children: { id: string; name: string; age: number | null; photo_url: string | null }[];
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
  // Cadastro de criança (admin)
  const [childOpen, setChildOpen] = useState(false);
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("");
  const [childPhoto, setChildPhoto] = useState<string | null>(null);
  const [childErr, setChildErr] = useState<string | null>(null);

  function reload() {
    fetchClientDetail(clientId).then((d) => setData(d as Detail));
  }

  function addChild() {
    setChildErr(null);
    if (!childName.trim()) return setChildErr("Informe o nome da criança.");
    startTransition(async () => {
      const res = await adminAddChild(clientId, {
        name: childName.trim(),
        age: childAge ? Number(childAge) : null,
        photoUrl: childPhoto,
      });
      if (res.ok) {
        setChildOpen(false);
        setChildName("");
        setChildAge("");
        setChildPhoto(null);
        reload();
      } else setChildErr(res.error);
    });
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
          <div className="flex items-center gap-2">
            <span className="text-body font-semibold text-text">{client.name}</span>
            {data.children.length > 0 && (
              <Badge variant="accent">
                <Baby size={12} /> {data.children.length}
              </Badge>
            )}
          </div>
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

      {/* Crianças */}
      <div className="rounded-md border border-border-subtle px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-overline uppercase text-text-muted">
            <Baby size={13} /> Crianças
          </div>
          {!childOpen && (
            <button
              onClick={() => setChildOpen(true)}
              className="flex items-center gap-1 text-caption font-semibold text-accent hover:underline"
            >
              <Plus size={13} /> Adicionar criança
            </button>
          )}
        </div>

        <div className="mt-2 flex flex-col gap-2">
          {data.children.length === 0 && !childOpen && (
            <p className="text-caption text-text-muted">Nenhuma criança cadastrada.</p>
          )}
          {data.children.map((c) => (
            <div key={c.id} className="flex items-center gap-3">
              {c.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.photo_url} alt={c.name} className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-inset text-accent">
                  <Baby size={16} />
                </span>
              )}
              <div>
                <div className="text-body text-text">{c.name}</div>
                {c.age != null && <div className="text-caption text-text-muted">{c.age} anos</div>}
              </div>
            </div>
          ))}
        </div>

        {childOpen && (
          <div className="mt-3 flex flex-col gap-3 rounded-md border border-border-subtle bg-inset p-3">
            <AvatarUpload
              current={childPhoto}
              fallback={getInitials(childName || "C")}
              folder="children"
              size={48}
              onChange={setChildPhoto}
            />
            <div className="flex flex-col gap-1.5">
              <Label>Nome da criança</Label>
              <Input value={childName} onChange={(e) => setChildName(e.target.value)} placeholder="Ex.: Miguel" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Idade</Label>
              <Input type="number" min={0} max={17} value={childAge} onChange={(e) => setChildAge(e.target.value)} placeholder="Ex.: 7" />
            </div>
            {childErr && <p className="text-caption text-danger">{childErr}</p>}
            <div className="flex gap-2">
              <Button size="sm" loading={pending} onClick={addChild}>
                Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setChildOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
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
