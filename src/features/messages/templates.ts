/**
 * Modelos de mensagem (WhatsApp / in-app) — fiéis aos documentos da Barbearia
 * Oliveira 01. Placeholders: {nome}, {link}. Use fillTemplate() para preencher.
 */

export const APP_LINK = "https://barberagencia.vercel.app/";

export interface MessageTemplate {
  id: string;
  title: string;
  channel: "whatsapp" | "in-app";
  body: string;
}

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: "welcome",
    title: "Boas-vindas",
    channel: "whatsapp",
    body: `👋 Olá! Bem-vindo à Barbearia Oliveira 01! ✂️🔥
Que bom ter você em contato conosco.

Se quer garantir o seu horário agora de forma rápida, é só clicar no nosso link de agendamento online:
📲 {link}

⏱️ Horário de funcionamento:
Segunda a Sábado: das 9h às 20h.
Abrimos também nos dois primeiros domingos de cada mês, das 8h às 12h!

💵 Pagamento: feito direto no local após o serviço (Dinheiro, PIX ou Cartão). Se for pagar em dinheiro e precisar de troco, avise por aqui!

Se preferir agendar por aqui ou tiver dúvida, mande seu nome e o serviço desejado. 💺💈`,
  },
  {
    id: "winback",
    title: "Contatos ausentes (retorno)",
    channel: "whatsapp",
    body: `👋 Fala, {nome}! Beleza?
Vimos aqui no sistema que já faz um tempo desde o seu último corte na Barbearia Oliveira 01. O visual já deve estar pedindo aquele trato, hein? ✂️💥

Já estamos com a cadeira pronta esperando por você esta semana. Que tal garantir seu horário agora para não ficar sem vaga?
📲 {link}

Se preferir agendar por aqui ou for pagar em dinheiro e precisar de troco, é só avisar! Tamo junto! 💈`,
  },
  {
    id: "post-signup",
    title: "Agendamento após a inscrição (in-app)",
    channel: "in-app",
    body: `👋 Bem-vindo à Barbearia Oliveira 01! Que bom ter você por aqui. Escolha o barbeiro de preferência, o serviço e o melhor horário para o seu atendimento.

⚠️ Pagamento: realizado diretamente no local após o atendimento. Aceitamos dinheiro, PIX e cartões. Vai pagar em dinheiro? Se precisar de troco, avise o seu barbeiro ao chegar. Aproveite a experiência! ✂️💈`,
  },
  {
    id: "confirmed",
    title: "Agendamento confirmado",
    channel: "whatsapp",
    body: `💈 Agendamento confirmado — Barbearia Oliveira 01
Olá, {nome}! Seu horário está garantido!

Regras de cancelamento:
• Cancelamento pelo aplicativo: prazo mínimo de 10 minutos antes do horário.
• Imprevisto em cima da hora? Avise aqui no WhatsApp com até 30 minutos de antecedência.
• Evite faltar sem avisar para não perder o direito de agendar online.

Se precisar falar com a gente, é só responder esta mensagem. Nos vemos em breve! ✂️🔥
{link}`,
  },
  {
    id: "absence",
    title: "Ausência (fora do expediente)",
    channel: "whatsapp",
    body: `🌙 Olá! Obrigado por entrar em contato com a Barbearia Oliveira 01! 💈
No momento estamos com as tesouras guardadas e a barbearia fechada. Nosso atendimento retorna no próximo dia útil!

Nosso agendamento online funciona 24h — garanta sua vaga agora:
📲 {link}

⏱️ Horários na loja:
Segunda a Sábado: das 9h às 20h.
Dois primeiros domingos do mês: das 8h às 12h.

Deixe seu nome e o que precisa que, assim que abrirmos, nossa equipe responde por aqui. Tenha um excelente descanso! ✂️🔥`,
  },
];

export function fillTemplate(body: string, vars: { nome?: string; link?: string }): string {
  return body
    .replaceAll("{nome}", vars.nome ?? "")
    .replaceAll("{link}", vars.link ?? APP_LINK);
}

export function getTemplate(id: string): MessageTemplate | undefined {
  return MESSAGE_TEMPLATES.find((t) => t.id === id);
}
