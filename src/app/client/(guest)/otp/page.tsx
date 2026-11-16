import { ShieldCheck } from "lucide-react";
import { OtpForm } from "@/features/auth/components/otp-form";

export default function OtpPage() {
  return (
    <div className="mx-auto flex w-[400px] max-w-full flex-col gap-5 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-wash">
        <ShieldCheck size={28} className="text-accent" />
      </div>
      <div>
        <h1 className="font-display text-h2 uppercase leading-none text-text">
          Validação de acesso
        </h1>
        <p className="mt-2 text-body text-text-2">
          Digite o código de 6 dígitos para continuar.
        </p>
      </div>
      <OtpForm />
    </div>
  );
}
