import { LegalDoc } from "@/components/legal-doc";
import { TERMS } from "@/lib/legal/content";

export const metadata = { title: "Termos de Uso" };

export default function TermosPage() {
  return <LegalDoc doc={TERMS} />;
}
