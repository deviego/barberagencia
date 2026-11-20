/** Abas de Configurações (/admin/config), na ordem da tela (#136). */
export const CONFIG_TABS = [
  { key: "unidade", label: "Unidade" },
  { key: "marca", label: "Marca" },
  { key: "qr-fila", label: "QR e Fila" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "plano-contrato", label: "Plano e contrato" },
] as const;

export type ConfigTab = (typeof CONFIG_TABS)[number]["key"];

/** Parâmetro da URL com a aba aberta: /admin/config?aba=whatsapp */
export const CONFIG_TAB_PARAM = "aba";

/** Âncoras de seção (links antigos e atuais) e a aba onde cada seção mora. */
const SECTION_TAB: Record<string, ConfigTab> = {
  unidade: "unidade",
  "qr-cliente": "qr-fila",
  totem: "qr-fila",
  "meu-plano": "plano-contrato",
  contrato: "plano-contrato",
};

export function isConfigTab(v: string | null | undefined): v is ConfigTab {
  return !!v && CONFIG_TABS.some((t) => t.key === v);
}

export function configTabFromHash(hash: string): ConfigTab | null {
  return SECTION_TAB[hash.replace(/^#/, "")] ?? null;
}

/** Endereço de uma seção de Configurações: abre a aba certa e rola até a seção. */
export function configHref(tab: ConfigTab, section?: string) {
  return `/admin/config?${CONFIG_TAB_PARAM}=${tab}${section ? `#${section}` : ""}`;
}
