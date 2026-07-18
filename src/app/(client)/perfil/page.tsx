import { CreditCard } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { LogoutButton } from "@/features/client/components/logout-button";

export default function PerfilPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h3 font-bold text-text">Meu perfil</h1>
        <LogoutButton />
      </div>

      {/* Dados */}
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
        <div className="text-overline uppercase text-text-muted">Dados pessoais</div>
        <div className="flex flex-col gap-1.5">
          <Label>Nome completo</Label>
          <Input defaultValue="William Santos de Oliveira" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>E-mail</Label>
            <Input type="email" defaultValue="william@email.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Telefone</Label>
            <Input defaultValue="+55 (11) 9____-4321" />
          </div>
        </div>
        <Button className="self-start">Salvar alterações</Button>
      </section>

      {/* Cartões */}
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
        <div className="text-overline uppercase text-text-muted">Cartões salvos</div>
        <div className="flex items-center gap-3 rounded-md border border-border px-4 py-3">
          <CreditCard size={20} className="text-accent" />
          <span className="text-body text-text tabular">Visa •••• 4321</span>
        </div>
      </section>

      {/* Notificações */}
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
        <div className="text-overline uppercase text-text-muted">Preferências de notificação</div>
        <PrefRow label="E-mail" defaultChecked />
        <PrefRow label="SMS" defaultChecked />
        <PrefRow label="WhatsApp" defaultChecked />
      </section>
    </div>
  );
}

function PrefRow({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-body text-text">{label}</span>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
