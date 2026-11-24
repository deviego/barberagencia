import "@/styles/globals.css";
import type { Metadata } from "next";
import { inter, bigShoulders } from "./fonts";
import { ThemeScript } from "@/components/theme/theme-script";
import { Providers } from "@/components/providers";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { brandingStyle } from "@/lib/tenant/branding-style";
import { headers } from "next/headers";
import { NEUTRAL_BRAND_HEADER } from "@/lib/supabase/area";

export const metadata: Metadata = {
  title: "Barbearia — Agendamento",
  description: "Plataforma white-label de agendamento e fidelização para barbearias.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Landing (/): sempre a marca neutra, mesmo com cookie bb_tenant ou sessão de uma barbearia.
  const neutral = (await headers()).get(NEUTRAL_BRAND_HEADER) === "1";
  const tenant = neutral ? null : await getCurrentTenant();

  return (
    <html
      lang="pt-BR"
      data-theme="dark"
      style={tenant ? brandingStyle(tenant.branding) : undefined}
      className={`${inter.variable} ${bigShoulders.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
