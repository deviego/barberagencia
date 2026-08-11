/**
 * Partes fixas do contrato (lado da plataforma) e metadados.
 * Edite os CPFs/localização quando tiver os dados finais — o restante do contrato
 * é preenchido com os dados do ASSINANTE (barbearia) gravados em tenant_contracts.
 */

export const PLATFORM_NAME = "BARBER AGÊNCIA";

/** Versão vigente do contrato — muda quando o texto muda (congela quem assinou qual versão). */
export const CONTRACT_VERSION = "2026-08-v1";

/** Foro de eleição (sede da BARBER AGÊNCIA). */
export const CONTRACT_FORO = "Rio de Janeiro";

/** Texto do aceite (assinatura eletrônica — MP 2.200-2/2001, art. 10, §2º). */
export const ACCEPT_TEXT = "Li e aceito os Termos de Uso e Contrato de Assinatura";

/** Multa por difamação (cláusula 10) e demais valores citados no contrato. */
export const DEFAMATION_FINE = "R$ 5.000,00 (cinco mil reais)";

/** Desenvolvedores/responsáveis pela plataforma (lado CONTRATADA). */
export const DEVELOPERS: { name: string; cpf: string; city: string; cep?: string }[] = [
  { name: "WILLIAM FERREIRA DOMINGUES", cpf: "XXX.XXX.XXX-XX", city: "Rio de Janeiro/RJ", cep: "22730-120" },
  { name: "DIEGO DOMINGUES PEREIRA", cpf: "187.370.077-69", city: "[CIDADE/UF]" },
];
