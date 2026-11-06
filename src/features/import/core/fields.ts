import type { Entity, FieldDef, Mapping } from "./types";

/** Campos-alvo por entidade (espelha a whitelist do CRUD do admin). */
export const FIELD_MAP: Record<Entity, FieldDef[]> = {
  clients: [
    {
      key: "name",
      label: "Nome",
      type: "text",
      required: true,
      aliases: ["nome", "name", "cliente", "nome completo", "nome do cliente", "razao social", "full name"],
    },
    {
      key: "phone",
      label: "Telefone",
      type: "phone",
      aliases: ["telefone", "celular", "fone", "whatsapp", "phone", "tel", "contato", "numero", "telefone/celular", "mobile", "telefone celular", "celular/whatsapp"],
      exactOnly: ["tel", "fone", "contato", "numero", "mobile"],
    },
    { key: "email", label: "E-mail", type: "email", aliases: ["email", "e-mail", "mail", "correio", "endereco de email", "endereco de e-mail"], exactOnly: ["mail", "correio"] },
    {
      key: "birth_date",
      label: "Nascimento",
      type: "date",
      aliases: ["nascimento", "aniversario", "data de nascimento", "data nasc", "dt nasc", "birth", "birthday", "dob", "data de aniversario", "birth date", "date of birth"],
      exactOnly: ["dob", "birth"],
    },
  ],
  products: [
    {
      key: "name",
      label: "Nome",
      type: "text",
      required: true,
      aliases: ["nome", "name", "produto", "descricao", "item", "titulo", "nome do produto"],
      exactOnly: ["item", "titulo"],
    },
    {
      key: "price_brl",
      label: "Preço",
      type: "money",
      required: true,
      aliases: ["preco", "valor", "price", "preco de venda", "valor de venda", "venda", "preco venda", "preco unitario", "valor unitario"],
      exactOnly: ["venda"],
    },
    {
      key: "cost_brl",
      label: "Custo",
      type: "money",
      aliases: ["custo", "cost", "preco de custo", "valor de custo", "custo unitario", "preco custo"],
    },
    {
      key: "stock",
      label: "Estoque",
      type: "int",
      aliases: ["estoque", "stock", "qtd", "quantidade", "qtde", "qty", "saldo", "estoque atual", "quantidade em estoque"],
      exactOnly: ["qtd", "qtde", "qty", "saldo"],
    },
    {
      key: "sku",
      label: "SKU / Código",
      type: "text",
      aliases: ["sku", "codigo", "cod", "codigo de barras", "barcode", "ean", "referencia", "ref", "cod barras", "codigo do produto"],
      exactOnly: ["cod", "ean", "ref"],
    },
  ],
  services: [
    {
      key: "name",
      label: "Nome",
      type: "text",
      required: true,
      aliases: ["nome", "name", "servico", "service", "descricao", "procedimento", "nome do servico"],
    },
    {
      key: "duration_min",
      label: "Duração (min)",
      type: "duration",
      required: true,
      aliases: ["duracao", "tempo", "duration", "minutos", "min", "tempo (min)", "duracao (min)", "tempo medio", "duracao em minutos", "tempo de execucao"],
      exactOnly: ["min", "tempo"],
    },
    {
      key: "price_brl",
      label: "Preço",
      type: "money",
      required: true,
      aliases: ["preco", "valor", "price", "preco de venda", "valor de venda", "valor do servico", "preco do servico"],
    },
    {
      key: "category",
      label: "Categoria",
      type: "text",
      aliases: ["categoria", "category", "grupo", "tipo", "familia"],
      exactOnly: ["tipo", "grupo"],
    },
  ],
};

/** Remove acentos, minúsculas, colapsa espaços e tira pontuação das bordas. */
export function normHeader(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_\s]+/g, " ")
    .replace(/^[\s.:*#-]+|[\s.:*#-]+$/g, "")
    .trim();
}

const letters = (s: string) => s.replace(/[^a-z]/g, "").length;

/** O alias aparece no cabeçalho como palavra(s) inteira(s)? ("tel" não casa com "hotel"). */
function containsWord(header: string, alias: string): boolean {
  const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(header);
}

/**
 * Auto-map genérico por alias.
 *  1) match EXATO (sem acento) para todos os campos primeiro — evita que um campo
 *     "roube" por substring a coluna que é exata de outro (ex.: "Valor de custo").
 *  2) depois, match por palavra inteira só com aliases de 4+ letras que não sejam `exactOnly`.
 */
export function autoMap(headers: string[], entity: Entity, preset: Mapping = {}): Mapping {
  const map: Mapping = {};
  const used = new Set<string>();
  const normed = headers.map((h) => ({ raw: h, n: normHeader(h) })).filter((h) => h.n);

  for (const [k, h] of Object.entries(preset)) {
    if (h && headers.includes(h) && !used.has(h)) {
      map[k] = h;
      used.add(h);
    }
  }
  const fields = FIELD_MAP[entity].filter((f) => !map[f.key]);

  for (const f of fields) {
    const aliases = f.aliases.map(normHeader);
    // Respeita a ordem de prioridade dos aliases (o 1º alias que existir ganha).
    for (const a of aliases) {
      const hit = normed.find((h) => !used.has(h.raw) && h.n === a);
      if (hit) {
        map[f.key] = hit.raw;
        used.add(hit.raw);
        break;
      }
    }
  }
  for (const f of fields) {
    if (map[f.key]) continue;
    const exactOnly = new Set((f.exactOnly ?? []).map(normHeader));
    const aliases = f.aliases.map(normHeader).filter((a) => letters(a) >= 4 && !exactOnly.has(a));
    for (const a of aliases) {
      const hit = normed.find((h) => !used.has(h.raw) && containsWord(h.n, a));
      if (hit) {
        map[f.key] = hit.raw;
        used.add(hit.raw);
        break;
      }
    }
  }
  return map;
}

/** Quantos cabeçalhos casam exatamente com algum alias conhecido (qualquer entidade). */
export function knownHeaderScore(cells: unknown[]): number {
  const all = new Set<string>();
  for (const fs of Object.values(FIELD_MAP)) for (const f of fs) for (const a of f.aliases) all.add(normHeader(a));
  return cells.reduce<number>((acc, c) => acc + (all.has(normHeader(c)) ? 1 : 0), 0);
}
