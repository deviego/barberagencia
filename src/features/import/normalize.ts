/**
 * Helpers de importação — compartilhados entre o preview (client) e o
 * server action (revalidação). SEM "server-only": roda dos dois lados.
 */
import { maskPhoneBR } from "@/lib/masks";

export type Entity = "clients" | "products" | "services";

export type FieldType = "text" | "email" | "phone" | "money" | "int" | "date";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Aliases de cabeçalho (minúsculos) para o auto-map. */
  aliases: string[];
}

/** Campos-alvo por entidade (espelha a whitelist do CRUD do admin). */
export const FIELD_MAP: Record<Entity, FieldDef[]> = {
  clients: [
    { key: "name", label: "Nome", type: "text", required: true, aliases: ["nome", "name", "cliente", "nome completo", "nome do cliente", "razao social", "razão social"] },
    { key: "phone", label: "Telefone", type: "phone", aliases: ["telefone", "celular", "fone", "whatsapp", "phone", "tel", "contato", "numero", "número", "telefone/celular", "mobile"] },
    { key: "email", label: "E-mail", type: "email", aliases: ["email", "e-mail", "mail", "correio"] },
    { key: "birth_date", label: "Nascimento", type: "date", aliases: ["nascimento", "aniversario", "aniversário", "data de nascimento", "data nasc", "birth", "birthday", "dob", "data de aniversario"] },
  ],
  products: [
    { key: "name", label: "Nome", type: "text", required: true, aliases: ["nome", "name", "produto", "descricao", "descrição", "item", "titulo", "título"] },
    { key: "price_brl", label: "Preço", type: "money", required: true, aliases: ["preco", "preço", "valor", "price", "preco de venda", "preço de venda", "valor de venda", "venda", "preco venda"] },
    { key: "cost_brl", label: "Custo", type: "money", aliases: ["custo", "cost", "preco de custo", "preço de custo", "valor de custo", "custo unitario", "custo unitário"] },
    { key: "stock", label: "Estoque", type: "int", aliases: ["estoque", "stock", "qtd", "quantidade", "qtde", "qty", "saldo"] },
    { key: "sku", label: "SKU / Código", type: "text", aliases: ["sku", "codigo", "código", "cod", "codigo de barras", "código de barras", "barcode", "ean", "referencia", "referência", "ref"] },
  ],
  services: [
    { key: "name", label: "Nome", type: "text", required: true, aliases: ["nome", "name", "servico", "serviço", "service", "descricao", "descrição", "procedimento"] },
    { key: "duration_min", label: "Duração (min)", type: "int", required: true, aliases: ["duracao", "duração", "tempo", "duration", "minutos", "min", "tempo (min)", "duracao (min)", "duração (min)", "tempo medio", "tempo médio"] },
    { key: "price_brl", label: "Preço", type: "money", required: true, aliases: ["preco", "preço", "valor", "price", "preco de venda", "preço de venda", "valor de venda"] },
    { key: "category", label: "Categoria", type: "text", aliases: ["categoria", "category", "grupo", "tipo", "familia", "família"] },
  ],
};

const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");

/** Mapeia automaticamente os cabeçalhos do arquivo para nossos campos. */
export function autoMap(headers: string[], entity: Entity): Record<string, string> {
  const map: Record<string, string> = {};
  const used = new Set<string>();
  for (const f of FIELD_MAP[entity]) {
    // 1) match exato de alias
    let found = headers.find((h) => h && !used.has(h) && f.aliases.includes(norm(h)));
    // 2) match por conteúdo (cabeçalho contém alias ou vice-versa)
    if (!found) found = headers.find((h) => h && !used.has(h) && f.aliases.some((a) => norm(h).includes(a)));
    if (found) {
      map[f.key] = found;
      used.add(found);
    }
  }
  return map;
}

export const cleanStr = (v: unknown): string => String(v ?? "").trim();

/** "R$ 1.234,56" / "45,00" / "1,234.56" / "45.00" / "45" / 45 → número em reais. */
export function parseMoneyCell(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[R$\s]/gi, "");
  if (!s) return null;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // separador decimal = o último que aparece
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasComma) {
    s = s.replace(",", ".");
  } else if (hasDot) {
    // só ponto: se a última parte tem 3 dígitos, é separador de milhar (ex.: "1.234")
    const last = s.slice(s.lastIndexOf(".") + 1);
    if (last.length === 3) s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Telefone → { display mascarado, digits para dedup }. */
export function parsePhoneCell(v: unknown): { display: string; digits: string } {
  const display = maskPhoneBR(String(v ?? ""));
  return { display, digits: display.replace(/\D/g, "") };
}

const pad = (s: string | number) => String(s).padStart(2, "0");

/** Data → ISO "YYYY-MM-DD" a partir de DD/MM/AAAA, ISO, ou serial do Excel. */
export function parseDateCell(v: unknown): string | null {
  if (v == null || v === "") return null;
  // serial do Excel (epoch 1899-12-30)
  if (typeof v === "number" && v > 0 && v < 60000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return valid(Number(m[1]), Number(m[2]), Number(m[3])) ? `${m[1]}-${pad(m[2])}-${pad(m[3])}` : null;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    let y = m[3];
    if (y.length === 2) y = Number(y) > 30 ? "19" + y : "20" + y;
    return valid(Number(y), Number(m[2]), Number(m[1])) ? `${y}-${pad(m[2])}-${pad(m[1])}` : null;
  }
  return null;
}
const valid = (y: number, mo: number, d: number) => y >= 1900 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31;

/** Inteiro tolerante ("30 min" → 30, "" → null). */
export function parseIntCell(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : null;
  const digits = String(v).replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

export interface NormalizedRow {
  values: Record<string, unknown>;
  phoneDigits: string;
  errors: string[];
}

/** Aplica o mapeamento + normalização a uma linha crua; retorna valores + erros. */
export function normalizeRow(raw: Record<string, unknown>, mapping: Record<string, string>, entity: Entity): NormalizedRow {
  const values: Record<string, unknown> = {};
  const errors: string[] = [];
  let phoneDigits = "";
  for (const f of FIELD_MAP[entity]) {
    const col = mapping[f.key];
    const cell = col ? raw[col] : undefined;
    let out: unknown;
    switch (f.type) {
      case "text":
      case "email":
        out = cleanStr(cell) || undefined;
        break;
      case "phone": {
        const p = parsePhoneCell(cell);
        out = p.display || undefined;
        phoneDigits = p.digits;
        break;
      }
      case "money":
        out = parseMoneyCell(cell) ?? undefined;
        break;
      case "int":
        out = parseIntCell(cell) ?? undefined;
        break;
      case "date":
        out = parseDateCell(cell) ?? undefined;
        break;
    }
    if (out !== undefined) values[f.key] = out;
    if (f.required && (out === undefined || out === "")) errors.push(`${f.label} obrigatório`);
  }
  return { values, phoneDigits, errors };
}

/** Chaves de deduplicação de uma linha normalizada (para casar com o que já existe). */
export function dedupKeys(entity: Entity, n: NormalizedRow): string[] {
  const keys: string[] = [];
  const name = (n.values.name as string | undefined)?.toLowerCase();
  if (entity === "clients") {
    if (n.phoneDigits) keys.push("p:" + n.phoneDigits);
    const email = (n.values.email as string | undefined)?.toLowerCase();
    if (email) keys.push("e:" + email);
  } else if (entity === "products") {
    const sku = (n.values.sku as string | undefined)?.toLowerCase();
    if (sku) keys.push("s:" + sku);
    if (name) keys.push("n:" + name);
  } else {
    if (name) keys.push("n:" + name);
  }
  return keys;
}
