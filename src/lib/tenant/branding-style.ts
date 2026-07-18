import type { CSSProperties } from "react";
import type { TenantBranding } from "./types";

/**
 * Converte os overrides de branding do tenant em CSS custom properties.
 * Aplicado como inline style no <html> (maior prioridade que a folha de tokens),
 * então só os tokens definidos pelo tenant sobrescrevem o default do tema.
 */
export function brandingStyle(branding: TenantBranding): CSSProperties {
  const style: Record<string, string> = {};
  if (branding.accent) style["--bb-accent"] = branding.accent;
  if (branding.accentHover) style["--bb-accent-hover"] = branding.accentHover;
  if (branding.accentDown) style["--bb-accent-down"] = branding.accentDown;
  if (branding.accentWash) style["--bb-accent-wash"] = branding.accentWash;
  if (branding.focus) style["--bb-focus"] = branding.focus;
  return style as CSSProperties;
}
