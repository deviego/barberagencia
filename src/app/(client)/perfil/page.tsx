import { redirect } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { LogoutButton } from "@/components/nav/logout-button";
import { PerfilForm } from "@/features/client/components/perfil-form";
import { getProfile } from "@/features/client/data";

export default async function PerfilPage() {
  const data = await getProfile();
  if (!data) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h3 font-bold text-text">Meu perfil</h1>
        <LogoutButton />
      </div>

      <PerfilForm
        userId={data.userId}
        fullName={data.fullName}
        phone={data.phone}
        email={data.email}
        avatarUrl={data.avatarUrl}
      />

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
