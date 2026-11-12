/**
 * Texto do aceite do formulário de leads. A Vitrine renderiza LEAD_CONSENT_TEXT
 * ao lado do checkbox (com link para LEAD_PRIVACY_HREF).
 * Mudou o texto? Suba a versão: ela é gravada junto com cada lead (consent_version).
 */
export const LEAD_CONSENT_VERSION = "2026-11-11";

export const LEAD_CONSENT_TEXT =
  "Concordo que a Barber Agência use estes dados para falar comigo sobre o sistema.";

/** Rota fixa da política da plataforma (não depende de sessão nem de barbearia no contexto). */
export const LEAD_PRIVACY_HREF = "/privacidade/distribuidoras";
