import type { Metadata } from "next";
import { SITE_URL } from "@/features/seo/site";
import { LegalDoc } from "@/components/legal-doc";
import { PRIVACY_PLATFORM } from "@/lib/legal/content";

export const metadata: Metadata = {
  title: "Política de Privacidade — Barber Agência",
  description:
    "Política de privacidade da plataforma Barber Agência, incluindo o formulário para distribuidoras: dados coletados, finalidade, retenção e direitos do titular pela LGPD.",
  alternates: { canonical: `${SITE_URL}/privacidade/distribuidoras` },
};

/** Sempre a política da plataforma (com a seção do formulário de distribuidoras), sem depender de sessão ou cookie. */
export default function PrivacidadeDistribuidorasPage() {
  return <LegalDoc doc={PRIVACY_PLATFORM} />;
}
