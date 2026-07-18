import { LogoMark } from "@/components/brand/logo";
import { LoginForm } from "@/features/auth/components/login-form";
import { getCurrentTenant } from "@/lib/tenant/resolve";

export default async function LoginPage() {
  const tenant = await getCurrentTenant();
  return (
    <div className="mx-auto flex w-[400px] max-w-full flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <LogoMark text={tenant.branding.logoText} size={64} className="rounded-lg shadow-lg" />
        <h1 className="font-display text-h1 uppercase leading-none text-text">{tenant.name}</h1>
        <p className="text-body text-text-2">Entre para agendar seu próximo corte.</p>
      </div>
      <LoginForm />
    </div>
  );
}
