import "server-only";
import { timingSafeEqual } from "crypto";

/**
 * Compara duas strings em tempo constante (mitiga timing attack).
 * Retorna false se algum lado for vazio/ausente ou os tamanhos diferirem.
 */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
