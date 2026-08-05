/**
 * Isolamento de sessão por ÁREA do app.
 *
 * Duas sessões coexistem no mesmo navegador: a do CLIENTE (`sb-cli`, /client) e a
 * da EQUIPE (`sb-stf`, /). Admin e Master compartilham a MESMA sessão de equipe —
 * assim uma conta MASTER logada no /admin acessa o /master sem logar de novo
 * (reaproveita a permissão). Cliente e equipe seguem separados.
 */
export type AreaKey = "client" | "admin" | "master";

export interface AreaCookie {
  name: string;
  path: string;
}

export const STAFF: AreaCookie = { name: "sb-stf", path: "/" };

export const AREAS: Record<AreaKey, AreaCookie> = {
  client: { name: "sb-cli", path: "/client" },
  admin: STAFF,
  master: STAFF,
};

/** Header injetado pelo middleware para os Server Components saberem a área. */
export const AREA_HEADER = "x-bb-area";

/** Deriva a área a partir do caminho da rota. */
export function areaKeyFor(pathname: string): AreaKey {
  if (pathname.startsWith("/admin") || pathname.startsWith("/rede")) return "admin";
  if (pathname.startsWith("/master")) return "master";
  return "client";
}

export function areaFromKey(key: string | null | undefined): AreaCookie {
  return AREAS[(key as AreaKey) ?? "client"] ?? AREAS.client;
}
