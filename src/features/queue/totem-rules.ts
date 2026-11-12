import { z } from "zod";
import type { RateRule } from "@/lib/rate-limit";

/** Regras do totem (puras, testáveis sem banco). */

/**
 * Limites por IP da hospedagem + barbearia. O totem é um aparelho só atendendo a fila
 * inteira, então os valores precisam caber num pico de movimento.
 */
export const TOTEM_LIMITS = {
  lookup: { limit: 20, windowSeconds: 10 * 60 },
  register: { limit: 10, windowSeconds: 10 * 60 },
  join: { limit: 20, windowSeconds: 10 * 60 },
  /** Teto de convites por barbearia (todas as origens do totem somadas). */
  invitesPerTenantDay: { limit: 30, windowSeconds: 24 * 60 * 60 },
} as const satisfies Record<string, RateRule>;

/**
 * Tetos por barbearia, somando todas as origens. Valem mesmo quando a camada por IP é pulada.
 * Valores provisórios: ajustar quando houver o pico real de movimento das barbearias.
 */
export const TOTEM_TENANT_CAPS = {
  lookup: { limit: 120, windowSeconds: 60 * 60 },
  register: { limit: 60, windowSeconds: 24 * 60 * 60 },
  /** Mesmo valor da busca: cada atendimento faz uma busca e gera uma senha. */
  join: { limit: 120, windowSeconds: 60 * 60 },
} as const satisfies Record<string, RateRule>;

/** Marcador fixo da linha de log de teto por barbearia (igual nas três ações; fácil de buscar). */
export const TOTEM_TENANT_CAP_LOG = "[totem][teto-barbearia]";

export const TOTEM_RATE_SCOPES = {
  lookup: "totem_lookup",
  register: "totem_register",
  join: "totem_join",
  invite: "totem_invite",
  lookupTenant: "totem_lookup_tenant",
  registerTenant: "totem_register_tenant",
  joinTenant: "totem_join_tenant",
} as const;

export const TOTEM_ERRORS = {
  invalidTotem: "Totem inválido.",
  invalidPhone: "Telefone inválido.",
  invalidName: "Informe o nome.",
  invalidNameChars: "Digite o nome só com letras.",
  invalidNameLong: "Nome muito longo. Use até 60 letras.",
  invalidDate: "Data de nascimento inválida.",
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

/**
 * Telefone a gravar, sempre derivado dos dígitos validados (nunca o texto digitado).
 * DDD + número sai no formato padrão "(21) 99999-0000"; com 55 na frente ficam só os dígitos.
 * Nos dois casos os dígitos gravados são os mesmos que a busca recebe.
 */
export function totemPhoneToStore(digits: string): string {
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return digits;
}

export const TOTEM_NAME_MAX = 60;
/** Letras (com acento), espaço, apóstrofo, hífen e ponto. O nome entra no texto do convite. */
const TOTEM_NAME_RE = /^[\p{L}\p{M} '.-]+$/u;
/**
 * Ponto só como abreviação: logo depois de uma letra e seguido de espaço ou do fim do nome
 * ("Jr.", "Sra. Ana"). Ponto no meio do texto ("a.b") vira link em aplicativos de mensagem.
 */
const TOTEM_NAME_BAD_DOT_RE = /(^|[^\p{L}\p{M}])\.|\.(?! |$)/u;

/**
 * Nome do cadastro normalizado (NFC, espaços simples, apóstrofo tipográfico vira ') ou o motivo
 * da recusa. Quebra de linha e tab são recusados.
 */
export function totemName(
  name: unknown
): { ok: true; name: string } | { ok: false; reason: "empty" | "chars" | "long" } {
  if (typeof name !== "string") return { ok: false, reason: "empty" };
  const clean = name
    .normalize("NFC")
    .replace(/[\u2018\u2019]/g, "'") // teclado de tablet troca ' por ’
    .replace(/^ +| +$/g, "")
    .replace(/ {2,}/g, " ");
  if (!clean) return { ok: false, reason: "empty" };
  if (!TOTEM_NAME_RE.test(clean) || !/\p{L}/u.test(clean) || TOTEM_NAME_BAD_DOT_RE.test(clean)) {
    return { ok: false, reason: "chars" };
  }
  if (clean.length > TOTEM_NAME_MAX) return { ok: false, reason: "long" };
  return { ok: true, name: clean };
}

/** Mensagem fixa para cada motivo de recusa do nome. */
export function totemNameError(reason: "empty" | "chars" | "long"): string {
  if (reason === "empty") return TOTEM_ERRORS.invalidName;
  return reason === "long" ? TOTEM_ERRORS.invalidNameLong : TOTEM_ERRORS.invalidNameChars;
}

/** true se "AAAA-MM-DD" é um dia que existe (31/02 não passa) e não está no futuro. */
export function isRealIsoDate(v: string, today: Date = new Date()): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return false;
  return y >= 1900 && date.getTime() <= today.getTime();
}

export const TotemRegisterSchema = z.object({
  phone: z.string().max(30),
  name: z.string().max(200),
  birthDate: z.string().refine((v) => isRealIsoDate(v)).nullish(),
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
