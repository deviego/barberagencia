/**
 * URL pública do NOSSO Supabase Storage (getPublicUrl → /storage/v1/object/public/<bucket>/<key>).
 * É o mesmo recorte liberado em next.config (images.remotePatterns): host exato do projeto
 * + caminho público. Fail closed: sem NEXT_PUBLIC_SUPABASE_URL válida, nada é aceito.
 */
const PUBLIC_PATH = "/storage/v1/object/public/";

export function isPublicStorageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return false;
  try {
    const expected = new URL(base);
    // new URL normaliza "..", então o caminho não escapa de /object/public/.
    const u = new URL(url);
    return (
      u.protocol === expected.protocol &&
      u.host === expected.host &&
      u.username === "" &&
      u.password === "" &&
      u.pathname.startsWith(PUBLIC_PATH)
    );
  } catch {
    return false;
  }
}
