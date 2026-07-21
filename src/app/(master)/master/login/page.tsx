import { AuthScreen } from "@/components/auth-screen";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata = { title: "Admin Master" };

export default function MasterLoginPage() {
  return (
    <AuthScreen logoText="B✦" name="Barber Platform" subtitle="Admin Master">
      <div className="mx-auto flex w-[400px] max-w-full flex-col gap-6">
        <div className="text-center">
          <h1 className="font-display text-h2 uppercase leading-none text-text">Admin Master</h1>
          <p className="mt-2 text-body text-text-2">Painel da plataforma.</p>
        </div>
        <LoginForm showSignup={false} />
      </div>
    </AuthScreen>
  );
}
