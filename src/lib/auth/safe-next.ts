/**
 * Destino depois do login/confirmação (`next` dos callbacks de auth). Só aceita caminho interno
 * da própria área (ex.: "/client/..."); qualquer outra coisa volta para o início da área.
 * Pura: sem servidor nem navegador, para ser testada sozinha.
 */
export type AuthArea = "client" | "admin" | "master" | "distributor";

export function safeNext(next: string | null | undefined, origin: string, area: AuthArea): string {
  const home = `/${area}`;
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return home;
  // Só caminho relativo simples: começa com uma barra só, sem barra invertida, sem "@" e sem
  // caractere de controle.
  if (!next.startsWith("/") || next.startsWith("//") || /[\\@]/.test(next) || /[\u0000-\u001f\u007f]/.test(next)) {
    return home;
  }
  let url: URL;
  try {
    url = new URL(next, origin);
  } catch {
    return home;
  }
  if (url.origin !== new URL(origin).origin) return home;
  // Dentro da própria área: "/client", "/client/...", "/client?..." (não "/clientes").
  const path = url.pathname;
  if (path !== home && !path.startsWith(`${home}/`)) return home;
  return `${path}${url.search}${url.hash}`;
}
