import Link from "next/link";
import { MailCheck } from "lucide-react";
import { CONTACT_SCREEN_COPY } from "@/features/auth/contact-screen-copy";

/** Aviso logo depois do cadastro com e-mail (#177): o link de confirmação já saiu na boas-vindas. */
export function ContactEmailNotice() {
  return (
    <div role="status" className="flex items-start gap-2.5 rounded-md border border-accent bg-accent-wash px-3.5 py-3">
      <MailCheck size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
      <div className="text-caption text-text-2">
        <p className="font-semibold text-text">Confirme seu e-mail</p>
        <p className="mt-0.5">
          {CONTACT_SCREEN_COPY.signupNotice}{" "}
          <Link href="/client/perfil" className="font-semibold text-accent hover:underline">
            Ver no perfil
          </Link>
        </p>
      </div>
    </div>
  );
}
