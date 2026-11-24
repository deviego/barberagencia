import { SignupForm } from "@/features/auth/components/signup-form";
import { GoogleButton, OrDivider } from "@/features/auth/components/google-button";
import { isGoogleLoginEnabled } from "@/lib/auth/google-flag";
import { getCurrentTenant } from "@/lib/tenant/resolve";

export default async function CadastroPage() {
  const tenant = await getCurrentTenant();
  const google = isGoogleLoginEnabled();
  return (
    <div className="mx-auto flex w-[440px] max-w-full flex-col gap-5">
      <div className="text-center">
        <h1 className="font-display text-h1 uppercase leading-none text-text">Criar conta</h1>
        <p className="mt-2 text-body text-text-2">
          Falta pouco para agendar seu próximo corte na {tenant.name}.
        </p>
      </div>
      {google && (
        <>
          <GoogleButton label="Criar conta com Google" />
          <OrDivider />
        </>
      )}
      <SignupForm tenantName={tenant.name} tenantSubdomain={tenant.subdomain} />
    </div>
  );
}
