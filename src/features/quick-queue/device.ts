import "server-only";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { QUICK_QUEUE_DEVICE_TTL_DAYS } from "./limits";

/*
 * Credencial do aparelho (#96). Valor aleatório de 256 bits gerado no servidor, em cookie que o
 * código da página não lê (HttpOnly), só em conexão segura, restrito ao caminho da fila da
 * barbearia. O banco guarda só o resumo (sha256). Nunca vai para endereço, QR ou log.
 * Dá acesso só ao que a jornada criou neste aparelho, nunca à conta do cliente.
 */

export const QUICK_QUEUE_DEVICE_COOKIE = "bb_qq";
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function newDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Caminho do cookie: um por barbearia (o navegador só manda o da barbearia do endereço). */
export function deviceCookiePath(slug: string): string {
  return `/b/${slug}/fila`;
}

/** Credencial do aparelho para esta barbearia, se houver uma com formato válido. */
export async function readDeviceToken(): Promise<string | null> {
  const v = (await cookies()).get(QUICK_QUEUE_DEVICE_COOKIE)?.value;
  return v && TOKEN_RE.test(v) ? v : null;
}

/** Grava (ou renova) o cookie. Chamado só por server action. */
export async function writeDeviceToken(slug: string, token: string): Promise<void> {
  (await cookies()).set(QUICK_QUEUE_DEVICE_COOKIE, token, {
    httpOnly: true,
    // Em "next dev" (http://localhost) o navegador não aceitaria; em qualquer build é sempre seguro.
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: deviceCookiePath(slug),
    maxAge: QUICK_QUEUE_DEVICE_TTL_DAYS * 24 * 60 * 60,
  });
}
