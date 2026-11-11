import { z } from "zod";
import { BR_UFS } from "@/lib/br-ufs";

/**
 * Contrato compartilhado client/server do formulário "Para distribuidoras".
 * O servidor SEMPRE revalida com este schema (o client pode ser ignorado).
 */

export const ORDER_CHANNELS = ["whatsapp", "telefone", "representante", "visita", "outro"] as const;
export type OrderChannel = (typeof ORDER_CHANNELS)[number];

export const ORDER_CHANNEL_LABELS: Record<OrderChannel, string> = {
  whatsapp: "WhatsApp",
  telefone: "Telefone",
  representante: "Representante",
  visita: "Visita na barbearia",
  outro: "Outro",
};

/** Tamanhos máximos (iguais aos checks da tabela marketing_leads). */
export const LEAD_LIMITS = { name: 80, company: 120, city: 80 } as const;

/**
 * Normaliza WhatsApp BR para dígitos com DDI 55 (ex.: "(21) 99999-0000" → "5521999990000").
 * Retorna null se não for um número BR válido (DDD 11–99, fixo 8 dígitos ou celular 9 dígitos começando com 9).
 */
export function normalizeBrWhatsapp(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.length > 20) return null;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99 || d[0] === "0" || d[1] === "0") return null;
  const local = d.slice(2);
  if (local.length === 9 && local[0] !== "9") return null;
  if (local.length === 8 && !/^[2-5]/.test(local)) return null;
  return "55" + d;
}

const text = (label: string, max: number) =>
  z
    .string({ required_error: `Informe ${label}.`, invalid_type_error: `Informe ${label}.` })
    .trim()
    .min(2, `Informe ${label}.`)
    .max(max, `Use no máximo ${max} caracteres.`);

export const DistributorLeadSchema = z.object({
  name: text("seu nome", LEAD_LIMITS.name),
  company: text("o nome da distribuidora", LEAD_LIMITS.company),
  city: text("a cidade", LEAD_LIMITS.city),
  state: z
    .string({ required_error: "Escolha a UF.", invalid_type_error: "Escolha a UF." })
    .trim()
    .toUpperCase()
    .pipe(z.enum(BR_UFS, { errorMap: () => ({ message: "Escolha uma UF válida." }) })),
  whatsapp: z
    .string({ required_error: "Informe o WhatsApp.", invalid_type_error: "Informe o WhatsApp." })
    .max(30, "WhatsApp inválido.")
    .transform((v, ctx) => {
      const n = normalizeBrWhatsapp(v);
      if (!n) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "WhatsApp inválido. Use DDD + número." });
        return z.NEVER;
      }
      return n;
    }),
  barbershopsCount: z.coerce
    .number({ invalid_type_error: "Informe um número." })
    .int("Informe um número inteiro.")
    .min(0, "Informe um número de 0 a 100.000.")
    .max(100_000, "Informe um número de 0 a 100.000."),
  orderChannel: z.enum(ORDER_CHANNELS, { errorMap: () => ({ message: "Escolha como recebe pedidos hoje." }) }),
  consent: z.literal(true, { errorMap: () => ({ message: "Marque o aceite para continuar." }) }),
  /** Honeypot: campo escondido. Humano deixa vazio; o servidor finge sucesso se vier preenchido. */
  website: z.string().max(500).optional(),
});

/** O que o formulário envia (antes da normalização). */
export type DistributorLeadInput = z.input<typeof DistributorLeadSchema>;
/** Dados já validados/normalizados (uso no servidor). */
export type DistributorLeadData = z.output<typeof DistributorLeadSchema>;

export type DistributorLeadField = Exclude<keyof DistributorLeadInput, "website">;

export type LeadResult =
  | { ok: true }
  | { ok: false; fieldErrors?: Partial<Record<DistributorLeadField, string>>; error?: string };

/** Erro genérico para qualquer recusa que não seja de campo (rate limit, falha, configuração). */
export const LEAD_GENERIC_ERROR = "Não foi possível enviar agora. Tente de novo mais tarde ou chame a gente no WhatsApp.";

/** Primeira mensagem de erro por campo (útil no client e no servidor). */
export function leadFieldErrors(error: z.ZodError): Partial<Record<DistributorLeadField, string>> {
  const out: Partial<Record<DistributorLeadField, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as DistributorLeadField | undefined;
    if (key && key !== ("website" as string) && !out[key]) out[key] = issue.message;
  }
  return out;
}
