import Link from "next/link";
import { AuthScreen } from "@/components/auth-screen";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata = { title: "Acesso da barbearia" };

export default function AdminLoginPage() {
  return (
    <AuthScreen subtitle="Área da barbearia">
      <div className="mx-auto flex w-[400px] max-w-full flex-col gap-6">
        <div className="text-center">
          <h1 className="font-display text-h2 uppercase leading-none text-text">Área da barbearia</h1>
          <p className="mt-2 text-body text-text-2">Acesso da equipe e do administrador.</p>
        </div>
        <LoginForm showSignup={false} showForgot={false} dest="/admin" basePath="/admin" />
        <p className="text-center text-caption text-text-muted">
          É cliente?{" "}
          <Link href="/client/login" className="font-semibold text-accent hover:underline">
            Entrar aqui
          </Link>
        </p>
      </div>
    </AuthScreen>
  );
}
