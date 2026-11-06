import { normHeader } from "../core/fields";
import { isBlank } from "../core/parse-file";
import { adapterMapping, countPresent, isReportFooter } from "./helpers";
import type { SourceAdapter } from "./types";

/**
 * AppBarber — WebAdmin → Relatórios → clientes/produtos → Gerar → exportar para Excel.
 * O Excel vem "de relatório": título (nome da barbearia, período, data de emissão) ANTES
 * do cabeçalho e, às vezes, linha de total no fim → locateHeader + transform.
 *
 * TODO(arquivo-real): confirmar com um export REAL do AppBarber — texto do título, nomes
 * das colunas de clientes e de produtos/serviços, células mescladas e linha de total.
 */
const NAME = ["cliente", "nome", "nome do cliente"];
const PHONE = ["celular", "telefone", "fone", "whatsapp"];
const PRODUCT = ["produto", "descricao", "servico"];
const PRICE = ["preco", "valor", "valor de venda", "preco de venda"];

const KNOWN = {
  clients: {
    name: ["Cliente", "Nome", "Nome do cliente"],
    phone: ["Celular", "Telefone", "Fone"],
    email: ["E-mail", "Email"],
    birth_date: ["Data de nascimento", "Nascimento", "Aniversário", "Dt. Nasc."],
  },
  products: {
    name: ["Produto", "Descrição"],
    price_brl: ["Preço de venda", "Valor de venda", "Preço", "Valor"],
    cost_brl: ["Preço de custo", "Custo"],
    stock: ["Estoque", "Estoque atual", "Qtd"],
    sku: ["Código", "Cód.", "Código de barras"],
  },
  services: {
    name: ["Serviço", "Descrição"],
    duration_min: ["Duração", "Tempo"],
    price_brl: ["Preço", "Valor"],
    category: ["Categoria", "Grupo"],
  },
};

const rowHas = (row: unknown[], names: string[]) => {
  const set = new Set(names.map(normHeader));
  return row.some((c) => set.has(normHeader(c)));
};

export const appbarberSource: SourceAdapter = {
  id: "appbarber",
  label: "AppBarber",
  guide:
    "WebAdmin → Relatórios → clientes/produtos → Gerar → exportar para Excel. O arquivo vem em formato de relatório (título antes do cabeçalho); o importador acha o cabeçalho sozinho — confira na etapa “Fonte”.",
  entities: ["clients", "products", "services"],
  locateHeader(aoa) {
    const limit = Math.min(aoa.length, 30);
    for (let i = 0; i < limit; i++) {
      const row = aoa[i] ?? [];
      if (row.filter((c) => !isBlank(c)).length < 2) continue;
      if ((rowHas(row, NAME) && rowHas(row, PHONE)) || (rowHas(row, PRODUCT) && rowHas(row, PRICE))) return i;
    }
    return -1;
  },
  detect(headers, _sample, ctx) {
    const clients = countPresent(headers, [NAME, PHONE]) === 2;
    const catalog = countPresent(headers, [PRODUCT, PRICE]) === 2;
    if (!clients && !catalog) return 0;
    // Assinatura: título de relatório antes do cabeçalho.
    const titled = (ctx?.headerRow ?? 0) > 0;
    const usesCliente = headers.some((h) => normHeader(h) === "cliente");
    return (titled ? 0.45 : 0) + (usesCliente ? 0.15 : 0.05);
  },
  mapping: (entity, headers) => adapterMapping(entity, headers, KNOWN),
  transform: (_entity, raw) => (isReportFooter(raw) ? null : raw),
};
