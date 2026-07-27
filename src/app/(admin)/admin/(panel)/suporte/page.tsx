import { SupportForm } from "@/features/admin/components/support-form";

export default function SuportePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h3 font-bold text-text">Suporte</h1>
        <p className="text-body text-text-2">
          Precisa de ajuda? Envie sua mensagem — o time de suporte responde por e-mail.
        </p>
      </div>
      <SupportForm />
    </div>
  );
}
