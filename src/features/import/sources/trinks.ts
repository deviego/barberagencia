import { adapterMapping, countPresent, findHeader } from "./helpers";
import type { SourceAdapter } from "./types";

/**
 * Trinks — lista de clientes exportada em CSV/Excel.
 * Colunas conhecidas (documentação pública da Trinks): Nome, Telefone (obrigatórios), Email, CPF, Gênero.
 *
 * TODO(arquivo-real): validar com um export REAL da Trinks — nomes exatos das colunas,
 * se o telefone vem com DDD separado, formato da data de nascimento (se existir) e
 * se há export de serviços/produtos. Ajustar KNOWN e detect().
 */
const KNOWN = {
  clients: {
    name: ["Nome", "Nome do cliente", "Cliente"],
    phone: ["Telefone", "Celular", "Telefone celular"],
    email: ["Email", "E-mail"],
    birth_date: ["Data de nascimento", "Nascimento", "Aniversário"],
  },
};

export const trinksSource: SourceAdapter = {
  id: "trinks",
  label: "Trinks",
  guide:
    "Relatórios → lista de clientes → botão “Exportar/Excel”. O arquivo vem com Nome e Telefone (obrigatórios) + Email, CPF e Gênero. CPF e Gênero não são importados.",
  entities: ["clients"],
  detect(headers) {
    // Assinatura: Nome + Telefone + (CPF e/ou Gênero). Sem CPF/Gênero é uma planilha qualquer.
    const base = countPresent(headers, [["nome", "nome do cliente", "cliente"], ["telefone", "celular"]]);
    if (base < 2) return 0;
    const extra = countPresent(headers, [["cpf"], ["genero", "sexo"]]);
    if (extra === 0) return 0;
    return Math.min(1, 0.45 + 0.2 * extra + (findHeader(headers, ["email", "e-mail"]) ? 0.1 : 0));
  },
  mapping: (entity, headers) => adapterMapping(entity, headers, KNOWN),
};
