import { z } from "zod";
import type { RateRule } from "@/lib/rate-limit";

/** Regras do totem (puras, testáveis sem banco). */

/**
 * Limites por IP da hospedagem + barbearia. O totem é um aparelho só atendendo a fila
 * inteira, então os valores precisam caber num pico de movimento.
 * PROPOSTA: valores a fechar na revisão de segurança.
 */
export const TOTEM_LIMITS = {
  lookup: { limit: 20, windowSeconds: 10 * 60 },
  register: { limit: 10, windowSeconds: 10 * 60 },
  join: { limit: 20, windowSeconds: 10 * 60 },
  /** Teto de convites por barbearia (todas as origens do totem somadas). */
  invitesPerTenantDay: { limit: 30, windowSeconds: 24 * 60 * 60 },
} as const satisfies Record<string, RateRule>;

export const TOTEM_RATE_SCOPES = {
  lookup: "totem_lookup",
  register: "totem_register",
  join: "totem_join",
  invite: "totem_invite",
} as const;

export const TOTEM_ERRORS = {
  invalidTotem: "Totem inválido.",
  invalidPhone: "Telefone inválido.",
  invalidName: "Informe o nome.",
  invalidChoice: "Opção indisponível. Escolha de novo.",
  clientNotFound: "Não encontramos seu cadastro. Comece de novo.",
  rateLimited: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  unavailable: "Totem indisponível no momento. Chame um atendente.",
  registerFailed: "Não foi possível cadastrar. Tente de novo.",
  joinFailed: "Não foi possível gerar a senha. Tente de novo.",
} as const;

/** Só dígitos; aceita DDD + número, com ou sem 55 (10 a 13 dígitos). null = inválido. */
export function totemPhoneDigits(phone: unknown): string | null {
  if (typeof phone !== "string" || phone.length > 30) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13 ? digits : null;
}

export const TotemRegisterSchema = z.object({
  phone: z.string().max(30),
  name: z.string().trim().min(1).max(80),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((v) => !Number.isNaN(Date.parse(v)))
    .nullish(),
});

/** Traduz o erro de join_queue_totem para uma mensagem fixa. Nunca repassa o texto do banco. */
export function totemJoinErrorMessage(dbMessage: string | null | undefined): string {
  const m = dbMessage ?? "";
  if (m.includes("TOTEM_CLIENT_NOT_IN_TENANT")) return TOTEM_ERRORS.clientNotFound;
  if (m.includes("TOTEM_SERVICE_NOT_IN_TENANT") || m.includes("TOTEM_BARBER_NOT_IN_TENANT")) {
    return TOTEM_ERRORS.invalidChoice;
  }
  return TOTEM_ERRORS.joinFailed;
}
