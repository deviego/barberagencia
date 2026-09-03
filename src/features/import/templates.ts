import type { Entity } from "./normalize";

export const ENTITY_LABEL: Record<Entity, string> = {
  clients: "Clientes",
  products: "Produtos",
  services: "Serviços",
};

/** Modelo CSV (cabeçalho + 1 linha de exemplo) para o cliente que não consegue exportar limpo. */
export const CSV_TEMPLATE: Record<Entity, string> = {
  clients: "Nome,Telefone,E-mail,Nascimento\nJoão da Silva,(11) 91234-5678,joao@email.com,15/03/1990\n",
  products: "Nome,Preço,Custo,Estoque,SKU\nPomada Modeladora 120g,45.00,20.00,30,POM-001\n",
  services: "Nome,Duração,Preço,Categoria\nCorte Masculino,30,50.00,Cabelo\n",
};

/** Passo a passo de como tirar os dados de cada plataforma concorrente. */
export const PLATFORM_GUIDES: { name: string; steps: string }[] = [
  {
    name: "Trinks",
    steps: "Relatórios → lista de clientes → botão “Exportar/Excel”. Exporta CSV/Excel com Nome e Telefone (obrigatórios) + Email, CPF e Gênero.",
  },
  {
    name: "Booksy",
    steps: "Booksy Biz (desktop) → Clientes → Mais opções → Exportar → CSV (nome, e-mail, telefone, nascimento).",
  },
  {
    name: "AppBarber",
    steps: "WebAdmin → Relatórios → clientes/produtos → Gerar → exportar para Excel. As colunas vêm em formato de relatório — use o mapeamento aqui.",
  },
  {
    name: "BestBarbers / Belasis / outros",
    steps: "Muitos só liberam a exportação pelo suporte. Peça o “export de clientes/produtos em CSV ou Excel”. Pela LGPD, a barbearia tem direito à portabilidade dos próprios dados.",
  },
];
