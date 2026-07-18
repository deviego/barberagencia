import "@/styles/globals.css";
import type { Metadata } from "next";
import { inter, bigShoulders } from "./fonts";
import { ThemeScript } from "@/components/theme/theme-script";
import { getCurrentTenant } from "@/lib/tenant/resolve";
import { brandingStyle } from "@/lib/tenant/branding-style";

export const metadata: Metadata = {
  title: "Barbearia — Agendamento",
  description: "Plataforma white-label de agendamento e fidelização para barbearias.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await getCurrentTenant();

  return (
    <html
      lang="pt-BR"
      data-theme="dark"
      style={brandingStyle(tenant.branding)}
      className={`${inter.variable} ${bigShoulders.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}
