import Link from "next/link";
import { MessageCircle } from "lucide-react";

/** Botão flutuante de suporte via WhatsApp (verde da marca WhatsApp). */
export function FabWhatsApp() {
  return (
    <Link
      href="/suporte"
      aria-label="Suporte via WhatsApp"
      className="fixed bottom-20 right-5 z-drawer flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-[1.06] md:bottom-6"
      style={{ background: "#25D366" }}
    >
      <MessageCircle size={26} />
    </Link>
  );
}
