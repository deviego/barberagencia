import { LegalDoc } from "@/components/legal-doc";
import { PRIVACY } from "@/lib/legal/content";

export const metadata = { title: "Política de Privacidade" };

export default function PrivacidadePage() {
  return <LegalDoc doc={PRIVACY} />;
}
