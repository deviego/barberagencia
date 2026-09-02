/** Cookie de indicação (link de afiliado ?ref=CODE). Não-httpOnly (lido no client). */
export const REF_COOKIE = "bb_ref";

/** Normaliza um ref_code (letras, números e hífen). */
export function normalizeRefCode(raw: string | null | undefined): string {
  return (raw ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
}
