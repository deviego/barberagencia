import Link from "next/link";
import { AuthScreen } from "@/components/auth-screen";
import { LoginForm } from "@/features/auth/components/login-form";
import { getCurrentTenant } from "@/lib/tenant/resolve";

export const metadata = { title: "Acesso da barbearia" };

export default async function AdminLoginPage() {
  const tenant = await getCurrentTenant();
  return (
    <AuthScreen
      logoText={tenant.branding.logoText}
      logoUrl={tenant.branding.logoUrl}
      name={tenant.name}
      subtitle="Área da barbearia"
    >
      <div className="mx-auto flex w-[400px] max-w-full flex-col gap-6">
        <div className="text-center">
          <h1 className="font-display text-h2 uppercase leading-none text-text">Área da barbearia</h1>
          <p className="mt-2 text-body text-text-2">Acesso da equipe e do administrador.</p>
        </div>
        <LoginForm showSignup={false} />
        <p className="text-center text-caption text-text-muted">
          É cliente?{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Entrar aqui
          </Link>
        </p>
      </div>
    </AuthScreen>
  );
}
