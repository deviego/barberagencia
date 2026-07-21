import "server-only";
import { headers } from "next/headers";
import type { ResolvedTenant } from "./types";

/**
 * Tenant de referência (mock) enquanto o banco não está conectado.
 * No M3+ isto vira uma query Prisma por subdomain/customDomain, cacheada.
 */
export const REFERENCE_TENANT: ResolvedTenant = {
  id: "tenant_oliveira01",
  name: "Barbearia Oliveira 01",
  subdomain: "oliveira01",
  customDomain: null,
  networkId: null,
  saasPlan: "advance",
  branding: {
    logoText: "BO",
    logoUrl: "/logo-oliveira.jpeg",
    // null => herda o accent do tema (dourado). Um tenant white-label sobrescreve aqui.
    accent: null,
    accentHover: null,
    accentDown: null,
    accentWash: null,
    focus: null,
    instagram: "@barbeariaoliveira01",
  },
};

/** Extrai o subdomínio do host (ex.: "oliveira01.barber.app" -> "oliveira01"). */
export function subdomainFromHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const base = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "barber.app";
  const clean = host.split(":")[0];
  if (clean === "localhost" || clean.endsWith(".localhost")) {
    const parts = clean.split(".");
    return parts.length > 1 ? parts[0] : null;
  }
  if (clean.endsWith(`.${base}`)) {
    return clean.slice(0, -1 * (base.length + 1)).split(".")[0];
  }
  return null; // domínio próprio → resolver por customDomain (futuro)
}

/**
 * Resolve o tenant atual pelo host. Por ora retorna o tenant de referência;
 * a resolução real (Prisma + cache) entra quando o banco estiver conectado.
 */
export async function getCurrentTenant(): Promise<ResolvedTenant> {
  const h = await headers();
  const sub = subdomainFromHost(h.get("host"));
  // TODO(M3): buscar no banco por `sub`/customDomain e cachear.
  return { ...REFERENCE_TENANT, subdomain: sub ?? REFERENCE_TENANT.subdomain };
}
