import { adapterMapping, countPresent, findHeader } from "./helpers";
import type { SourceAdapter } from "./types";

/**
 * Booksy — Booksy Biz (desktop) → Clientes → Mais opções → Exportar → CSV.
 * Colunas conhecidas (documentação pública): nome, e-mail, telefone, nascimento.
 *
 * TODO(arquivo-real): confirmar com um CSV REAL do Booksy — se vem "nome" único ou
 * "nome"/"sobrenome" separados, se o telefone vem com +55, o formato da data de
 * nascimento e o idioma dos cabeçalhos (pt/en). Ajustar KNOWN, detect() e transform().
 */
const KNOWN = {
  clients: {
    name: ["nome", "nome completo", "full name", "name"],
    phone: ["telefone", "celular", "phone", "telefone celular"],
    email: ["e-mail", "email"],
    birth_date: ["nascimento", "data de nascimento", "aniversário", "birthday"],
  },
};

const FIRST = ["nome", "primeiro nome", "first name"];
const LAST = ["sobrenome", "ultimo nome", "last name"];

export const booksySource: SourceAdapter = {
  id: "booksy",
  label: "Booksy",
  guide: "Booksy Biz (desktop) → Clientes → Mais opções → Exportar → CSV (nome, e-mail, telefone, nascimento).",
  entities: ["clients"],
  detect(headers) {
    if (findHeader(headers, ["cpf"])) return 0; // CPF é assinatura da Trinks
    const n = countPresent(headers, [["nome", "primeiro nome", "first name"], ["e-mail", "email"], ["telefone", "phone"], ["nascimento", "birthday"]]);
    if (n < 4) return 0;
    // Cabeçalhos todos minúsculos, como na documentação do Booksy.
    const lower = headers.every((h) => h === h.toLowerCase());
    return lower ? 0.7 : 0.45;
  },
  mapping: (entity, headers) => adapterMapping(entity, headers, KNOWN),
  transform(entity, raw) {
    if (entity !== "clients") return raw;
    // Nome e sobrenome em colunas separadas → junta em "nome".
    const headers = Object.keys(raw);
    const first = findHeader(headers, FIRST);
    const last = findHeader(headers, LAST);
    if (first && last) {
      const full = `${String(raw[first] ?? "").trim()} ${String(raw[last] ?? "").trim()}`.trim();
      return { ...raw, [first]: full };
    }
    return raw;
  },
};
