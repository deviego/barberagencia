import type { Entity } from "./core/types";

export const ENTITY_LABEL: Record<Entity, string> = {
  clients: "Clientes",
  products: "Produtos",
  services: "Serviços",
};

/** Modelo CSV (cabeçalho + 1 linha de exemplo) para o cliente que não consegue exportar limpo. */
export const CSV_TEMPLATE: Record<Entity, string> = {
  clients: "Nome;Telefone;E-mail;Nascimento\nJoão da Silva;(11) 91234-5678;joao@email.com;15/03/1990\n",
  products: "Nome;Preço;Custo;Estoque;SKU\nPomada Modeladora 120g;45,00;20,00;30;POM-001\n",
  services: "Nome;Duração;Preço;Categoria\nCorte Masculino;30;50,00;Cabelo\n",
};
