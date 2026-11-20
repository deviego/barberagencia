/**
 * Regra única de quem pode receber mensagem de MARKETING (promoção, retorno de cliente sumido,
 * campanha) por WhatsApp. Mensagens sobre o atendimento (senha, chamada, confirmação, acesso)
 * não passam por aqui.
 *
 * LGPD (#100, decisão do CTO de 20/11): a ficha criada pela fila rápida (signup_origin =
 * 'QUICK_QUEUE') só recebe marketing com consentimento separado. A fila rápida não coleta esse
 * consentimento e ainda não existe campo para ele: até existir, essas fichas ficam de fora.
 *
 * Hoje nenhum caminho do sistema envia marketing automaticamente (campanhas são só registro e os
 * modelos abrem o WhatsApp do próprio dono). Todo envio de marketing que nascer deve filtrar por
 * esta função.
 */
export type MarketingAudienceClient = {
  signup_origin?: string | null;
};

export function canReceiveMarketing(client: MarketingAudienceClient): boolean {
  return client.signup_origin !== "QUICK_QUEUE";
}
