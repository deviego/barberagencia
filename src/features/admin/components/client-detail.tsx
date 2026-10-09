"use client";

import { useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Baby, Check, Copy, Loader2, MessageCircle, Plus, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { AvatarUpload } from "@/components/avatar-upload";
import { addFixedMakeup, adjustClientCuts, adminAddChild, cancelClientSubscription, changeFixedPlanSlot, fetchClientDetail, reinviteClient, removeFixedCut, updateClientAvatar } from "@/features/admin/actions";
import { CutMeter } from "@/components/cut-meter";
import { FixedSlotFields, timeToMin, type FixedSlot } from "@/features/admin/components/fixed-slot-fields";
import { formatBRL, getInitials } from "@/lib/utils";

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

interface Detail {
  client: { id: string; name: string; email: string | null; phone: string | null; active: boolean; status?: string | null; avatar_url: string | null } | null;
  sub: {
    saldo_cortes: number;
    fixed_weekday?: number | null;
    fixed_start_min?: number | null;
    fixed_barber_id?: string | null;
    combo_plan_id?: string;
    combo_plans: unknown;
  } | null;
  history: { id: string; start_at: string; status: string; consumed_from_plan: boolean; services: unknown; combo_plans: unknown }[];
  children: { id: string; name: string; age: number | null; photo_url: string | null }[];
  barbers: { id: string; name: string }[];
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
  const [removingCut, setRemovingCut] = useState(false);
  // Reconvidar (cliente que ainda não criou acesso)
  const [invite, setInvite] = useState<{ link: string; whatsapp: "SENT" | "SKIPPED" | "FAILED" | null } | null>(null);
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  // Cadastro de criança (admin)
  const [childOpen, setChildOpen] = useState(false);
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("");
  const [childPhoto, setChildPhoto] = useState<string | null>(null);
  const [childErr, setChildErr] = useState<string | null>(null);
  // Alterar dia/horário do plano fixo
  const [slotOpen, setSlotOpen] = useState(false);
  const [slot, setSlot] = useState<FixedSlot>({ weekday: 1, time: "09:00", barberId: "" });

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

  function doMakeup() {
    setErr(null);
    startTransition(async () => {
      const res = await addFixedMakeup(clientId);
      if (res.ok) reload();
      else setErr(res.error);
    });
  }

  function doReinvite() {
    setInviteErr(null);
    setInvite(null);
    startTransition(async () => {
      const res = await reinviteClient(clientId);
      if (res.ok) setInvite({ link: `${window.location.origin}/convite/${res.token}`, whatsapp: res.whatsapp });
      else setInviteErr(res.error);
    });
  }

  function doRemoveCut() {
    setErr(null);
    startTransition(async () => {
      const res = await removeFixedCut(clientId);
      if (res.ok) {
        setRemovingCut(false);
        reload();
      } else setErr(res.error);
    });
  }

  function adjust(delta: number) {
    setErr(null);
    startTransition(async () => {
      const res = await adjustClientCuts(clientId, delta);
      if (res.ok) reload();
      else setErr(res.error);
    });
  }

  function openSlot() {
    const s = (data?.sub ?? {}) as { fixed_weekday?: number | null; fixed_start_min?: number | null; fixed_barber_id?: string | null };
    const m = s.fixed_start_min;
    const time = m != null ? `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}` : "09:00";
    setSlot({ weekday: s.fixed_weekday ?? 1, time, barberId: s.fixed_barber_id ?? "" });
    setSlotOpen(true);
  }

  function saveSlot() {
    setErr(null);
    startTransition(async () => {
      const res = await changeFixedPlanSlot(clientId, { weekday: slot.weekday, startMin: timeToMin(slot.time), barberId: slot.barberId });
      if (res.ok) {
        setSlotOpen(false);
        reload();
      } else setErr(res.error);
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

  const combo = one(
    data.sub?.combo_plans as
      | { name: string; cuts: number; price_brl: number; booking_mode?: string }[]
      | { name: string; cuts: number; price_brl: number; booking_mode?: string }
  );
  const subFixed = data.sub as { fixed_weekday?: number | null; fixed_start_min?: number | null } | null;
  const isFixed = combo?.booking_mode === "FIXED";
  const saldo = data.sub?.saldo_cortes ?? 0;
  const invited = client.status === "INVITED";
  const waPhone = (client.phone ?? "").replace(/\D/g, "");
  const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const hhmm = (m: number | null | undefined) =>
    m == null ? "" : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

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
      <div className="rounded-md border border-border-subtle px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-caption text-text-muted">Status</span>
          {invited ? (
            <Badge variant="warning">Convidado</Badge>
          ) : client.active ? (
            <Badge variant="success">Ativo</Badge>
          ) : (
            <Badge>Inativo</Badge>
          )}
        </div>
        {invited && (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-caption text-text-muted">Ainda não criou o acesso. Reconvidar gera um link novo (48h) e invalida o anterior.</p>
            <Button size="sm" variant="outline" className="self-start" loading={pending} onClick={doReinvite}>
              <Send size={14} />
              Reconvidar
            </Button>
            {inviteErr && <p className="text-caption text-danger">{inviteErr}</p>}
            {invite && (
              <div className="flex flex-col gap-2">
                {invite.whatsapp === "SENT" ? (
                  <div className="flex items-center gap-2 rounded-md border border-success bg-success-bg px-3 py-2 text-caption text-success-strong">
                    <Check size={15} /> Convite reenviado por WhatsApp.
                  </div>
                ) : (
                  <p className="text-caption text-warning">
                    {client.phone ? "Não foi possível enviar pelo WhatsApp." : "Cliente sem telefone."} Envie o link abaixo.
                  </p>
                )}
                <div className="rounded-md border border-accent bg-accent-wash p-3 text-caption text-text-2 break-all">{invite.link}</div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      navigator.clipboard.writeText(invite.link);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? "Copiado" : "Copiar link"}
                  </Button>
                  {waPhone && (
                    <a
                      href={`https://wa.me/${waPhone.startsWith("55") ? waPhone : "55" + waPhone}?text=${encodeURIComponent(`Olá! Crie seu acesso: ${invite.link}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-caption font-semibold text-white"
                      style={{ background: "#25D366" }}
                    >
                      <MessageCircle size={14} />
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Plano */}
      <div className="rounded-md border border-border-subtle px-4 py-3">
        <div className="text-overline uppercase text-text-muted">Plano</div>
        {combo ? (
          <>
            <div className="mt-2 flex items-start gap-4">
              {isFixed ? (
                <div className="flex flex-col items-center px-2">
                  <span className="font-display text-h2 leading-none text-accent tabular">{saldo}</span>
                  <span className="mt-1 text-overline uppercase text-text-muted">reservados</span>
                </div>
              ) : (
                <CutMeter remaining={saldo} total={combo.cuts} size={92} />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 text-body font-semibold text-text">
                  {combo.name}
                  {isFixed && <Badge variant="warning">Fixo</Badge>}
                </div>
                <div className="text-caption text-text-muted">
                  {formatBRL(combo.price_brl)}/mês
                  {isFixed && subFixed?.fixed_weekday != null
                    ? ` · ${WD[subFixed.fixed_weekday]} ${hhmm(subFixed.fixed_start_min)}`
                    : ""}
                </div>
                {!isFixed && (
                  <div className="mt-2 flex items-center gap-2">
                    <Button size="sm" variant="outline" disabled={pending || saldo <= 0} onClick={() => adjust(-1)}>
                      − corte
                    </Button>
                    <Button size="sm" variant="outline" disabled={pending || saldo >= combo.cuts} onClick={() => adjust(1)}>
                      + corte
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {isFixed && (
              <div className="mt-3 flex flex-col gap-2">
                {slotOpen ? (
                  <>
                    <FixedSlotFields barbers={data.barbers} value={slot} onChange={setSlot} />
                    <div className="flex gap-2">
                      <Button size="sm" loading={pending} onClick={saveSlot}>
                        Salvar dia/horário
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setSlotOpen(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-4">
                    <button onClick={openSlot} disabled={pending} className="text-caption font-medium text-accent hover:underline disabled:opacity-50">
                      Alterar dia/horário do plano
                    </button>
                    <button onClick={doMakeup} disabled={pending} className="text-caption font-medium text-accent hover:underline disabled:opacity-50">
                      + Repor um corte (falta)
                    </button>
                    <button
                      onClick={() => setRemovingCut(true)}
                      disabled={pending || saldo <= 0}
                      className="text-caption font-medium text-danger hover:underline disabled:opacity-50"
                    >
                      − Remover um corte
                    </button>
                  </div>
                )}
                {removingCut && (
                  <div className="rounded-md border border-danger bg-danger-bg px-3 py-2.5">
                    <p className="text-caption text-danger-strong">
                      {saldo > combo.cuts
                        ? "Remove a última reserva extra (desfaz uma reposição)."
                        : "Debita um corte já usado: a última reserva da fila é removida e não volta. As próximas datas continuam iguais."}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="danger" loading={pending} onClick={doRemoveCut}>
                        Sim, remover corte
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRemovingCut(false)}>
                        Voltar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
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
