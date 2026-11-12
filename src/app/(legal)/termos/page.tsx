import type { Metadata } from "next";
import { SITE_URL } from "@/features/seo/site";
import { LegalDoc } from "@/components/legal-doc";
import { TERMS } from "@/lib/legal/content";

export const metadata: Metadata = {
  title: "Termos de Uso — Barber Agência",
  description:
    "Termos de uso do agendamento nas barbearias que usam a plataforma Barber Agência: como funciona o agendamento, compromisso com o horário e regras de cancelamento.",
  alternates: { canonical: `${SITE_URL}/termos` },
};

export default function TermosPage() {
  return <LegalDoc doc={TERMS} />;
}
