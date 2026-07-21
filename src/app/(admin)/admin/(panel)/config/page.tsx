import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogoMark } from "@/components/brand/logo";
import { Gate } from "@/components/gate";
import { BrandingForm } from "@/features/admin/components/branding-form";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { getBranding } from "@/features/admin/data";

export default async function ConfigPage() {
  const tenant = await getCurrentTenant();
  const branding = await getBranding();
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "barber.app";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 font-bold text-text">Configurações & Branding</h1>

      {/* Dados da unidade */}
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
        <div className="text-overline uppercase text-text-muted">Dados da unidade</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Nome da barbearia</Label>
            <Input defaultValue={tenant.name} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Telefone</Label>
            <Input defaultValue="+55 (21) 99088-3359" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Endereço</Label>
          <Input placeholder="Rua, número, bairro, cidade" />
        </div>
      </section>

      {/* Horários */}
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
        <div className="text-overline uppercase text-text-muted">Horário de funcionamento</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Segunda a Sexta</Label>
            <Input defaultValue="09:00 – 20:00" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Sábado</Label>
            <Input defaultValue="09:00 – 18:00" />
          </div>
        </div>
      </section>

      {/* White-label */}
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
        <div className="flex items-center gap-2">
          <div className="text-overline uppercase text-text-muted">White-label</div>
          <Badge variant="accent">Marca</Badge>
        </div>

        <div className="flex items-center gap-4">
          <LogoMark text={tenant.branding.logoText} size={56} className="rounded-lg" />
          <Button variant="outline" size="sm">
            Enviar logo
          </Button>
        </div>

        <BrandingForm
          initialAccent={branding?.accent ?? "#C9A24B"}
          initialInstagram={branding?.instagram ?? tenant.branding.instagram ?? ""}
        />

        <div className="flex flex-col gap-1.5">
          <Label>Subdomínio</Label>
          <div className="flex items-center">
            <Input defaultValue={tenant.subdomain} className="rounded-r-none" />
            <span className="flex h-10 items-center rounded-r-md border border-l-0 border-border bg-inset px-3 text-body text-text-muted">
              .{appDomain}
            </span>
          </div>
        </div>

        <Gate
          feature="site.customDomain"
          fallback={
            <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-inset px-3 py-2.5 text-caption text-text-muted">
              Domínio próprio disponível no plano <strong className="text-text-2">Advanced</strong>.
            </div>
          }
        >
          <div className="flex flex-col gap-1.5">
            <Label>Domínio próprio</Label>
            <Input placeholder="www.suabarbearia.com.br" />
          </div>
        </Gate>
      </section>
    </div>
  );
}
