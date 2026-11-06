import { autoMap } from "../core/fields";
import type { SourceAdapter } from "./types";

/** Planilha qualquer (ou modelo CSV): auto-map genérico por alias. É o fallback. */
export const genericSource: SourceAdapter = {
  id: "generic",
  label: "Planilha genérica / outro sistema",
  guide:
    "Exporte a lista em CSV ou Excel (ou baixe o modelo abaixo e preencha). Muitos sistemas só liberam a exportação pelo suporte: peça o “export de clientes/produtos/serviços em CSV ou Excel”. Pela LGPD, a barbearia tem direito à portabilidade dos próprios dados.",
  entities: ["clients", "products", "services"],
  detect: () => 0.2,
  mapping: (entity, headers) => autoMap(headers, entity),
};
