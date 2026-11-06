import { adapterMapping, countPresent } from "./helpers";
import type { SourceAdapter } from "./types";

/**
 * BestBarbers — em geral a exportação só sai pelo suporte (CSV/Excel).
 *
 * TODO(arquivo-real): NÃO há amostra real ainda. Nomes de coluna abaixo são palpites a
 * confirmar; por isso detect() nunca passa de 0.35 (não auto-seleciona — o Master escolhe
 * manualmente na etapa “Fonte”). Ajustar quando chegar um arquivo real.
 */
const KNOWN = {
  clients: {
    name: ["Nome", "Cliente", "Nome do cliente"],
    phone: ["Celular", "Telefone", "WhatsApp"],
    email: ["E-mail", "Email"],
    birth_date: ["Data de nascimento", "Nascimento", "Aniversário"],
  },
  products: {
    name: ["Produto", "Nome"],
    price_brl: ["Preço", "Valor", "Preço de venda"],
    cost_brl: ["Custo", "Preço de custo"],
    stock: ["Estoque", "Quantidade"],
  },
  services: {
    name: ["Serviço", "Nome"],
    duration_min: ["Duração", "Tempo"],
    price_brl: ["Preço", "Valor"],
  },
};

export const bestbarbersSource: SourceAdapter = {
  id: "bestbarbers",
  label: "BestBarbers",
  guide:
    "A exportação costuma sair só pelo suporte: peça o “export de clientes/produtos/serviços em CSV ou Excel”. Pela LGPD, a barbearia tem direito à portabilidade dos próprios dados.",
  entities: ["clients", "products", "services"],
  detect(headers) {
    const n = countPresent(headers, [["nome", "cliente"], ["celular", "whatsapp"], ["data de nascimento"]]);
    return n === 3 ? 0.35 : 0;
  },
  mapping: (entity, headers) => adapterMapping(entity, headers, KNOWN),
};
