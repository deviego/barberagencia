/**
 * URL pública do NOSSO Supabase Storage (getPublicUrl → /storage/v1/object/public/<bucket>/<key>).
 * É o mesmo recorte liberado em next.config (images.remotePatterns): host exato do projeto
 * + caminho público. O projeto é o do ambiente (src/lib/supabase/env.ts): preview usa só o de
 * homologação. Fail closed: sem URL válida do projeto, nada é aceito.
 */
import { supabasePublicEnv } from "@/lib/supabase/env";

const PUBLIC_PATH = "/storage/v1/object/public/";

export function isPublicStorageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const expected = new URL(supabasePublicEnv().url);
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
