import type { Metadata } from "next";
import { SITE_URL } from "@/features/seo/site";
import { LegalDoc } from "@/components/legal-doc";
import { PRIVACY } from "@/lib/legal/content";

export const metadata: Metadata = {
  title: "Política de Privacidade — Barber Agência",
  description:
    "Política de privacidade da plataforma Barber Agência: dados coletados dos clientes das barbearias, base legal, armazenamento, compartilhamento e direitos do titular pela LGPD.",
  alternates: { canonical: `${SITE_URL}/privacidade` },
};

export default function PrivacidadePage() {
  return <LegalDoc doc={PRIVACY} />;
}
