/**
 * Copy da página /distribuidoras (CMO, 10/11/2026 — MarcFlow/relatorios/2026-11-10-plano-modulo-distribuidora.md, seção 4).
 * Fora da página até o Diego decidir: preço (D1), "transportadora" (D2), benefício por indicação (D3) e fidelidade.
 * FAQ de planilha também fica fora por enquanto (muda com a story #76).
 */

export const DIST_FEATURES: { icon: string; title: string; desc: string }[] = [
  {
    icon: "users",
    title: "Carteira de clientes",
    desc: "Cada barbearia com responsável, WhatsApp e endereço. Acabou o cadastro no caderno.",
  },
  {
    icon: "package",
    title: "Catálogo com estoque",
    desc: "Seus produtos num lugar só. Confirmou o pedido, o estoque baixa sozinho.",
  },
  {
    icon: "clipboard-list",
    title: "Pedidos com status",
    desc: "A barbearia pede pelo painel dela. Você confirma, marca enviado e entregue.",
  },
  {
    icon: "wallet",
    title: "Extrato",
    desc: "Entradas, saídas e saldo do mês, separados por forma de pagamento.",
  },
];

export const DIST_STEPS: { num: string; title: string }[] = [
  { num: "01", title: "A gente cria a sua conta e você cadastra produtos e clientes." },
  { num: "02", title: "Suas barbearias pedem pelo painel da Barber Agência." },
  { num: "03", title: "Você acompanha cada pedido até a entrega." },
];

export const DIST_FAQS: { q: string; a: string }[] = [
  {
    q: "Minhas barbearias precisam usar a Barber Agência?",
    a: "Para pedir pelo painel, sim. Você pode cadastrar qualquer cliente na sua carteira.",
  },
  {
    q: "Quanto custa?",
    a: "Fale com a gente pelo WhatsApp e o Diego te passa a condição.",
  },
];

