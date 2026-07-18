/** Branding/white-label de um tenant (barbearia). */
export interface TenantBranding {
  /** Iniciais/placeholder do logo (ex.: "BO") até haver imagem. */
  logoText: string;
  /** URL do logo (Supabase Storage) — opcional. */
  logoUrl?: string | null;
  /** Overrides de tokens de accent (white-label). Se ausente, usa o default do tema. */
  accent?: string | null;
  accentHover?: string | null;
  accentDown?: string | null;
  accentWash?: string | null;
  focus?: string | null;
  /** Links sociais. */
  instagram?: string | null;
}

export type SaasPlanKey = "essencial" | "profissional" | "advanced";

/** Tenant resolvido a partir do host da requisição. */
export interface ResolvedTenant {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string | null;
  networkId?: string | null;
  saasPlan: SaasPlanKey;
  branding: TenantBranding;
}
