import { LogoMark } from "@/components/brand/logo";
import { LoginForm } from "@/features/auth/components/login-form";
import { GoogleButton, OrDivider } from "@/features/auth/components/google-button";
import { callbackErrorMessage } from "@/features/auth/google-errors";
import { isGoogleLoginEnabled } from "@/lib/auth/google-flag";
import { getCurrentTenant } from "@/lib/tenant/resolve";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const [tenant, params] = await Promise.all([getCurrentTenant(), searchParams]);
  const google = isGoogleLoginEnabled();
  const callbackError = callbackErrorMessage(params.error);
  return (
    <div className="mx-auto flex w-[400px] max-w-full flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <LogoMark
          text={tenant.branding.logoText}
          src={tenant.branding.logoUrl}
          size={96}
          className="rounded-lg shadow-lg"
        />
        <h1 className="font-display text-h1 uppercase leading-none text-text">{tenant.name}</h1>
        <p className="text-body text-text-2">Entre para agendar seu próximo corte.</p>
      </div>
      {callbackError && (
        <p role="alert" className="rounded-md border border-danger bg-danger-bg px-4 py-3 text-caption text-danger">
          {callbackError}
        </p>
      )}
      {google && (
        <>
          <GoogleButton />
          <OrDivider />
        </>
      )}
      <LoginForm />
    </div>
  );
}
