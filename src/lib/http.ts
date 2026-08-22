import "server-only";
import { headers } from "next/headers";

/**
 * Origin da requisição atual (ex.: "https://www.barberagencia.com"), derivado do
 * header Host. Usa http para localhost, https caso contrário. Retorna "" se sem host.
 * Centraliza o padrão antes duplicado em várias actions/páginas.
 */
export async function getRequestOrigin(): Promise<string> {
  const host = (await headers()).get("host") ?? "";
  if (!host) return "";
  const proto = host.includes("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}
