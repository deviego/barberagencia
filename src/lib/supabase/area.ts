/**
 * Isolamento de sessão por ÁREA do app.
 *
 * Cada área (cliente / admin / master) usa um cookie de sessão com NOME e PATH
 * próprios, para que cliente e equipe possam ficar logados ao mesmo tempo no
 * mesmo navegador, sem uma sessão sobrescrever a outra.
 */
export type AreaKey = "client" | "admin" | "master";

export interface AreaCookie {
  name: string;
  path: string;
}

export const AREAS: Record<AreaKey, AreaCookie> = {
  client: { name: "sb-cli", path: "/client" },
  admin: { name: "sb-adm", path: "/admin" },
  master: { name: "sb-mst", path: "/master" },
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
