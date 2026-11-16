import type { Metadata } from "next";
import { SITE_URL } from "@/features/seo/site";
import { LegalDoc } from "@/components/legal-doc";
import { PRIVACY, PRIVACY_PLATFORM } from "@/lib/legal/content";
import { getCurrentTenant } from "@/lib/tenant/resolve";

export const metadata: Metadata = {
  title: "Política de Privacidade — Barber Agência",
  description:
    "Política de privacidade da plataforma Barber Agência: dados coletados dos clientes das barbearias, base legal, armazenamento, compartilhamento e direitos do titular pela LGPD.",
  alternates: { canonical: `${SITE_URL}/privacidade` },
};

export default async function PrivacidadePage() {
  // Mesmo critério do layout (legal): sem barbearia no contexto (sessão ou cookie bb_tenant) = página da plataforma.
  // Em contexto de barbearia (white-label) a política fica sem a seção da Barber Agência.
  const tenant = await getCurrentTenant();
  return <LegalDoc doc={tenant.id ? PRIVACY : PRIVACY_PLATFORM} />;
}
