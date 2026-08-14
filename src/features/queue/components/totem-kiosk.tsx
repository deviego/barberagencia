"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Delete, Printer, Scissors, User, Ticket, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { maskPhoneBR, maskDate } from "@/lib/masks";
import { totemLookup, totemRegister, totemJoinQueue } from "../totem-actions";

type Svc = { id: string; name: string; priceBrl: number };
type Barber = { id: string; name: string };
type Step = "idle" | "phone" | "register" | "service" | "ticket";

type Client = { id: string; name: string; hasPlan: boolean; planName: string | null };

export function TotemKiosk({
  slug,
  token,
  name: tenantName,
  pickBarber,
  planRequiresService,
  services,
  barbers,
}: {
  slug: string;
  token: string;
  name: string;
  pickBarber: boolean;
  planRequiresService: boolean;
  services: Svc[];
  barbers: Barber[];
}) {
  const [step, setStep] = useState<Step>("idle");
  const [phone, setPhone] = useState("");
  const [client, setClient] = useState<Client | null>(null);
  const [regName, setRegName] = useState("");
  const [regBirth, setRegBirth] = useState("");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [ticket, setTicket] = useState<{ n: number; service: string | null; barber: string | null } | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const printedRef = useRef(false);

  function reset() {
    setStep("idle");
    setPhone("");
    setClient(null);
    setRegName("");
    setRegBirth("");
    setServiceId(null);
    setBarberId(null);
    setTicket(null);
    setError(null);
    printedRef.current = false;
  }

  // Imprime automaticamente ao gerar a senha.
  useEffect(() => {
    if (step === "ticket" && ticket && !printedRef.current) {
      printedRef.current = true;
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [step, ticket]);

  const digits = phone.replace(/\D/g, "");

  function press(d: string) {
    setError(null);
    setPhone((p) => maskPhoneBR(p.replace(/\D/g, "") + d));
  }
  function backspace() {
    setPhone((p) => maskPhoneBR(p.replace(/\D/g, "").slice(0, -1)));
  }

  function lookup() {
    setError(null);
    startTransition(async () => {
      const res = await totemLookup(slug, token, phone);
      if (!res.ok) return setError(res.error);
      if (res.found) {
        const c: Client = { id: res.clientId, name: res.name, hasPlan: res.hasPlan, planName: res.planName };
        setClient(c);
        if (c.hasPlan && !planRequiresService) join(c, null, null);
        else setStep("service");
      } else {
        setStep("register");
      }
    });
  }

  function register() {
    setError(null);
    if (!regName.trim()) return setError("Informe o nome.");
    startTransition(async () => {
      const res = await totemRegister(slug, token, { phone, name: regName, birthDate: toISO(regBirth) });
      if (!res.ok) return setError(res.error);
      setClient({ id: res.clientId, name: res.name, hasPlan: false, planName: null });
      setStep("service");
    });
  }

  function join(c: Client, svc: string | null, brb: string | null) {
    setError(null);
    startTransition(async () => {
      const res = await totemJoinQueue(slug, token, c.id, svc, brb);
      if (!res.ok) return setError(res.error);
      setTicket({
        n: res.ticket,
        service: services.find((s) => s.id === svc)?.name ?? (c.hasPlan ? `Plano ${c.planName ?? ""}`.trim() : null),
        barber: barbers.find((b) => b.id === brb)?.name ?? null,
      });
      setStep("ticket");
    });
  }

  // Auto-retorna ao início após a senha (kiosk).
  useEffect(() => {
    if (step === "ticket") {
      const t = setTimeout(reset, 20000);
      return () => clearTimeout(t);
    }
  }, [step]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-8">
      {/* ---------- IDLE ---------- */}
      {step === "idle" && (
        <div className="flex flex-col items-center gap-8 text-center">
          <div>
            <div className="font-display text-h1 uppercase text-text">{tenantName}</div>
            <p className="mt-2 text-h5 text-text-2">Toque para pegar sua senha</p>
          </div>
          <button
            onClick={() => setStep("phone")}
            className="rounded-2xl bg-accent px-16 py-10 font-display text-h2 font-black uppercase text-text-inverse shadow-lg transition-transform active:scale-95"
          >
            Pegar senha
          </button>
        </div>
      )}

      {/* ---------- PHONE ---------- */}
      {step === "phone" && (
        <div className="flex w-full max-w-sm flex-col items-center gap-5">
          <h1 className="text-h4 font-bold text-text">Digite seu telefone</h1>
          <div className="w-full rounded-xl border-2 border-border bg-surface px-4 py-4 text-center font-display text-h3 tabular text-text">
            {phone || <span className="text-text-muted">(DDD) número</span>}
          </div>
          <Keypad onPress={press} onBackspace={backspace} />
          {error && <p className="text-body text-danger">{error}</p>}
          <div className="flex w-full gap-3">
            <Button variant="outline" className="flex-1" onClick={reset}>
              Cancelar
            </Button>
            <Button className="flex-1" loading={pending} disabled={digits.length < 10} onClick={lookup}>
              Continuar
            </Button>
          </div>
        </div>
      )}

      {/* ---------- REGISTER ---------- */}
      {step === "register" && (
        <div className="flex w-full max-w-sm flex-col gap-4">
          <h1 className="text-h4 font-bold text-text">Cadastro rápido</h1>
          <p className="text-body text-text-2">Seu telefone {phone} ainda não está cadastrado aqui. Preencha para entrar na fila.</p>
          <Field label="Nome">
            <input
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              placeholder="Seu nome"
              className="h-14 w-full rounded-xl border-2 border-border bg-surface px-4 text-h5 text-text focus:border-accent focus:outline-none"
            />
          </Field>
          <Field label="Data de nascimento (opcional)">
            <input
              value={regBirth}
              onChange={(e) => setRegBirth(maskDate(e.target.value))}
              inputMode="numeric"
              placeholder="DD/MM/AAAA"
              className="h-14 w-full rounded-xl border-2 border-border bg-surface px-4 text-h5 text-text focus:border-accent focus:outline-none"
            />
          </Field>
          {error && <p className="text-body text-danger">{error}</p>}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={reset}>
              Cancelar
            </Button>
            <Button className="flex-1" loading={pending} onClick={register}>
              Cadastrar e continuar
            </Button>
          </div>
        </div>
      )}

      {/* ---------- SERVICE ---------- */}
      {step === "service" && client && (
        <div className="flex w-full max-w-lg flex-col gap-4">
          <div>
            <h1 className="text-h4 font-bold text-text">Olá, {client.name.split(" ")[0]}!</h1>
            {client.hasPlan && (
              <span className="mt-1 inline-block rounded-pill bg-accent-wash px-3 py-1 text-caption font-semibold text-accent">
                Plano {client.planName ?? ""}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-caption font-semibold text-text-2">
              <Scissors size={14} /> Escolha o serviço
            </div>
            <div className="grid grid-cols-2 gap-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setServiceId(serviceId === s.id ? null : s.id)}
                  className={`rounded-xl border-2 px-4 py-4 text-left transition-colors ${
                    serviceId === s.id ? "border-accent bg-accent-wash" : "border-border bg-surface"
                  }`}
                >
                  <div className="text-body font-semibold text-text">{s.name}</div>
                </button>
              ))}
            </div>
          </div>

          {pickBarber && barbers.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-caption font-semibold text-text-2">
                <User size={14} /> Barbeiro (opcional)
              </div>
              <div className="flex flex-wrap gap-2">
                {barbers.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBarberId(barberId === b.id ? null : b.id)}
                    className={`rounded-pill border-2 px-4 py-2 text-body transition-colors ${
                      barberId === b.id ? "border-accent bg-accent-wash text-accent" : "border-border text-text-2"
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-body text-danger">{error}</p>}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={reset}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              loading={pending}
              disabled={!client.hasPlan && !serviceId}
              onClick={() => join(client, serviceId, barberId)}
            >
              Confirmar senha
            </Button>
          </div>
        </div>
      )}

      {/* ---------- TICKET ---------- */}
      {step === "ticket" && ticket && (
        <>
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex items-center gap-2 text-h5 text-text-2">
              <Ticket size={22} /> Sua senha
            </div>
            <div className="font-display text-[140px] font-black leading-none text-accent">#{ticket.n}</div>
            {client && <div className="text-h4 text-text">{client.name}</div>}
            {ticket.service && <div className="text-body text-text-2">{ticket.service}</div>}
            <div className="mt-2 flex gap-3">
              <Button variant="outline" onClick={() => window.print()}>
                <Printer size={16} /> Imprimir de novo
              </Button>
              <Button onClick={reset}>
                <RotateCcw size={16} /> Nova senha
              </Button>
            </div>
          </div>

          {/* Comprovante para impressão (só aparece na impressão) */}
          <div id="totem-print" className="totem-print">
            <div className="tp-shop">{tenantName}</div>
            <div className="tp-label">SENHA</div>
            <div className="tp-num">#{ticket.n}</div>
            {client && <div className="tp-name">{client.name}</div>}
            {ticket.service && <div className="tp-svc">{ticket.service}</div>}
            {ticket.barber && <div className="tp-svc">{ticket.barber}</div>}
          </div>
          <style>{`
            .totem-print { display: none; }
            @media print {
              body * { visibility: hidden !important; }
              #totem-print, #totem-print * { visibility: visible !important; }
              #totem-print {
                display: block !important; position: absolute; left: 0; top: 0;
                width: 80mm; text-align: center; font-family: monospace; color: #000;
                padding: 6mm 2mm;
              }
              .tp-shop { font-size: 16pt; font-weight: 800; text-transform: uppercase; margin-bottom: 4mm; }
              .tp-label { font-size: 10pt; letter-spacing: 3px; }
              .tp-num { font-size: 48pt; font-weight: 900; line-height: 1; margin: 2mm 0 4mm; }
              .tp-name { font-size: 12pt; }
              .tp-svc { font-size: 10pt; }
            }
          `}</style>
        </>
      )}
    </div>
  );
}

function Keypad({ onPress, onBackspace }: { onPress: (d: string) => void; onBackspace: () => void }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];
  return (
    <div className="grid w-full grid-cols-3 gap-2">
      {keys.map((k, i) =>
        k === "" ? (
          <span key={i} />
        ) : k === "back" ? (
          <button
            key={i}
            onClick={onBackspace}
            className="flex h-16 items-center justify-center rounded-xl border-2 border-border bg-surface text-text-2 active:bg-inset"
          >
            <Delete size={24} />
          </button>
        ) : (
          <button
            key={i}
            onClick={() => onPress(k)}
            className="h-16 rounded-xl border-2 border-border bg-surface font-display text-h3 font-bold text-text active:bg-accent-wash"
          >
            {k}
          </button>
        )
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-caption font-semibold text-text-2">{label}</span>
      {children}
    </label>
  );
}

/** "DD/MM/AAAA" → ISO "AAAA-MM-DD" (ou null). */
function toISO(v: string): string | null {
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}
