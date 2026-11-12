import { FileSignature, Lock, MessageCircle } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ContractSection } from "@/features/contract/components/contract-section";
import type { ContractDataValue, ContractView } from "@/features/contract/view";
import { BARBERAGENCIA_WHATSAPP, waLink } from "@/lib/contact";

/** Moldura mínima das telas de bloqueio: sem menu e sem nenhum dado do painel. */
function BlockedFrame({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-sticky flex items-center justify-between gap-2 border-b border-border bg-surface px-4 py-3 md:px-6">
        <span className="truncate text-body font-semibold text-text">{title ?? "Barber Agência"}</span>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 justify-center p-4 md:p-6">
        <div className="flex w-full max-w-3xl flex-col gap-5">{children}</div>
      </main>
    </div>
  );
}

/** Contrato pendente: o painel só libera depois de assinar. */
export function DistributorContractGate({
  tenantName,
  view,
  initial,
}: {
  tenantName: string;
  view: ContractView | null;
  initial: ContractDataValue;
}) {
  return (
    <BlockedFrame title={tenantName}>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-wash text-accent">
          <FileSignature size={20} />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-h4 font-bold text-text">Assine o contrato para liberar o painel</h1>
          <p className="text-caption text-text-2">
            Complete os dados que faltarem, leia o contrato e assine. Depois disso, pedidos, produtos, clientes e extrato
            ficam liberados.
          </p>
        </div>
      </div>
      {view ? (
        <ContractSection view={view} initial={initial} />
      ) : (
        <p className="rounded-lg border border-border bg-surface p-5 text-body text-text-2">
          Seu contrato ainda está sendo preparado. Fale com a Barber Agência pelo WhatsApp.
        </p>
      )}
    </BlockedFrame>
  );
}

/** Conta suspensa: nenhuma informação do painel, só o caminho para falar com a Barber Agência. */
export function DistributorSuspended() {
  return (
    <DistributorStatusBlocked
      message="Sua conta está suspensa. Fale com a Barber Agência pelo WhatsApp."
      waText="Olá! Minha conta de distribuidor está suspensa e quero falar sobre isso."
    />
  );
}

/** Conta ainda não ativa (qualquer status diferente de ACTIVE e de SUSPENDED, com contrato assinado). */
export function DistributorInactive() {
  return (
    <DistributorStatusBlocked
      message="Sua conta ainda não está ativa. Fale com a gente pelo WhatsApp."
      waText="Olá! Minha conta de distribuidor ainda não está ativa e quero falar sobre isso."
    />
  );
}

function DistributorStatusBlocked({ message, waText }: { message: string; waText: string }) {
  return (
    <BlockedFrame>
      <div className="mt-10 flex flex-col items-center gap-4 rounded-lg border border-border bg-surface p-8 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-danger-bg text-danger">
          <Lock size={22} />
        </span>
        <p className="m-0 max-w-md text-body font-semibold text-text">
          {message}
        </p>
        <a
          href={waLink(BARBERAGENCIA_WHATSAPP, waText)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-body font-bold text-text-inverse transition-colors hover:bg-accent-hover"
        >
          <MessageCircle size={16} /> Chamar no WhatsApp
        </a>
      </div>
    </BlockedFrame>
  );
}
