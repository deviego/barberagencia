import { z } from "zod";

/** Validação das entradas da identificação (#96). Pura, sem dependência do servidor. */

export const QUICK_QUEUE_NAME_MAX = 60;
export const QUICK_QUEUE_NAME_MIN_LETTERS = 2;

/** Letras (com acento), espaço, apóstrofo, hífen e ponto. Nada de dígito, link ou HTML. */
const NAME_CHARS_RE = /^[\p{L}\p{M} '.-]+$/u;
/** Ponto só como abreviação ("Jr.", "Sra. Ana"); "a.b" vira link em aplicativo de mensagem. */
const NAME_BAD_DOT_RE = /(^|[^\p{L}\p{M}])\.|\.(?! |$)/u;

/**
 * Nome normalizado (NFC, espaços simples, apóstrofo tipográfico vira ') ou o motivo da recusa:
 * "empty" (vazio, menos de 2 letras ou mais de 60) · "chars" (número, link, HTML, símbolo).
 */
export function quickQueueName(raw: unknown): { ok: true; name: string } | { ok: false; reason: "empty" | "chars" } {
  if (typeof raw !== "string" || raw.length > 200) return { ok: false, reason: "empty" };
  const clean = raw
    .normalize("NFC")
    .replace(/[‘’]/g, "'")
    .replace(/^ +| +$/g, "")
    .replace(/ {2,}/g, " ");
  if (!clean) return { ok: false, reason: "empty" };
  if (!NAME_CHARS_RE.test(clean) || NAME_BAD_DOT_RE.test(clean)) return { ok: false, reason: "chars" };
  if (clean.length > QUICK_QUEUE_NAME_MAX) return { ok: false, reason: "empty" };
  if ((clean.match(/\p{L}/gu) ?? []).length < QUICK_QUEUE_NAME_MIN_LETTERS) return { ok: false, reason: "empty" };
  return { ok: true, name: clean };
}

export const IdentifyPhoneInput = z.object({ slug: z.string().max(80), phone: z.string().max(40) });
export const RegisterNameInput = z.object({ slug: z.string().max(80), name: z.string().max(200) });

/** Entrada de joinQuickQueue (#97). Ids são uuid; preço em centavos só para conferência. */
export const JoinQuickQueueInputSchema = z.object({
  slug: z.string().max(80),
  serviceId: z.string().uuid(),
  priceCents: z.number().int().min(0).max(100_000_00),
  barberId: z.string().uuid().nullish(),
});
export const LoadQuickQueueOptionsInput = z.object({ slug: z.string().max(80) });
