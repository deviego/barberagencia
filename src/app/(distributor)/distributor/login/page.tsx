import { AuthScreen } from "@/components/auth-screen";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata = { title: "Acesso do distribuidor" };

export default function DistributorLoginPage() {
  return (
    <AuthScreen>
      <div className="mx-auto flex w-[400px] max-w-full flex-col gap-6">
        <div className="text-center">
          <h1 className="font-display text-h2 uppercase leading-none text-text">Área do distribuidor</h1>
          <p className="mt-2 text-body text-text-2">Gerencie seu catálogo, clientes e pedidos.</p>
        </div>
        <LoginForm showSignup={false} showForgot={false} dest="/distributor" basePath="/distributor" />
      </div>
    </AuthScreen>
  );
}
