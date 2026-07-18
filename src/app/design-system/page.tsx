import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { PLANS } from "@/lib/entitlements";

export default async function Home() {
  const tenant = await getCurrentTenant();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {/* Topbar */}
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent font-display text-h5 font-black text-text-inverse">
            {tenant.branding.logoText}
          </div>
          <div>
            <div className="font-display text-h4 font-extrabold uppercase tracking-wide text-text">
              {tenant.name}
            </div>
            <div className="text-caption text-text-muted">
              M0 · Fundação — Design System white-label
            </div>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <h1 className="mb-2 font-display text-h1 uppercase text-text">Fundação pronta</h1>
      <p className="mb-8 max-w-2xl text-body-lg text-text-2">
        Next.js 15 + Tailwind com tokens <code className="text-accent">--bb-*</code>, tema
        dark/light, resolução de tenant e as 3 camadas de permissão (RBAC, entitlements por plano
        SaaS, regras por combo). Troque o tema no canto para ver os tokens reagirem.
      </p>

      {/* Botões */}
      <Card className="mb-6">
        <CardTitle>Botões</CardTitle>
        <CardDescription className="mb-4">5 variantes usando só tokens.</CardDescription>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Agendar</Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Cancelar</Button>
          <Button loading>Carregando</Button>
        </div>
      </Card>

      {/* Form + Badges */}
      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <Card>
          <CardTitle>Input</CardTitle>
          <div className="mt-4">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" placeholder="william@gmail.com" />
          </div>
        </Card>
        <Card>
          <CardTitle>Status</CardTitle>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="accent">Selecionado</Badge>
            <Badge variant="success">Confirmado</Badge>
            <Badge variant="warning">Aguardando</Badge>
            <Badge variant="danger">Cancelado</Badge>
            <Badge variant="info">Info</Badge>
            <Badge>Neutro</Badge>
          </div>
        </Card>
      </div>

      {/* Planos SaaS (entitlements) */}
      <Card>
        <CardTitle>Planos SaaS (entitlements)</CardTitle>
        <CardDescription className="mb-4">
          Tenant atual: <span className="text-accent">{tenant.name}</span> · plano{" "}
          <span className="uppercase text-accent">{tenant.saasPlan}</span>
        </CardDescription>
        <div className="grid gap-4 sm:grid-cols-3">
          {Object.entries(PLANS).map(([key, plan]) => (
            <div
              key={key}
              className="rounded-md border border-border bg-elevated p-4 tabular"
            >
              <div className="font-display text-h5 uppercase text-text">{plan.label}</div>
              <div className="text-h3 text-accent">R$ {plan.priceBRL}</div>
              <div className="mt-2 text-caption text-text-muted">
                {plan.limits["clients.limit"] === -1
                  ? "Clientes ilimitados"
                  : `${plan.limits["clients.limit"]} clientes`}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}
