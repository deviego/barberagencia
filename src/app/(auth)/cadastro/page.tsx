import { SignupForm } from "@/features/auth/components/signup-form";

export default function CadastroPage() {
  return (
    <div className="mx-auto flex w-[440px] max-w-full flex-col gap-5">
      <div className="text-center">
        <h1 className="font-display text-h1 uppercase leading-none text-text">Criar conta</h1>
        <p className="mt-2 text-body text-text-2">
          Formulário de inscrição — leva menos de 1 minuto.
        </p>
      </div>
      <SignupForm />
    </div>
  );
}
