/**
 * Perguntas frequentes extras, escritas para responder as perguntas que donos de barbearia fazem às IAs
 * (llm-seo/DESCOBERTA.md §7). Resposta direta na 1ª frase. Só fatos de barber-agencia-base.
 * Aparecem no FAQ da landing (depois de FAQS) e no JSON-LD FAQPage.
 */
export const SEO_FAQS: { q: string; a: string }[] = [
  {
    q: "O que é a Barber Agência?",
    a: "A Barber Agência é uma plataforma white-label para barbearias no Brasil. Reúne agenda online, fila por QR code com painel na TV, mensalidade com saldo de cortes, comanda, produtos e financeiro por barbeiro. O cliente usa um app com o nome, o logo e as cores da barbearia, e não vê a marca Barber Agência.",
  },
  {
    q: "Como funciona a fila por QR code na barbearia?",
    a: "Funciona como senha de banco. O cliente chega, escaneia o QR code na parede ou pega a senha no totem do balcão e entra na fila. Ele acompanha pelo celular quem está em atendimento e quem é o próximo, e a TV da barbearia mostra as próximas senhas com som a cada chamada. A fila está nos planos Essencial e Advance.",
  },
  {
    q: "Meu cliente precisa baixar aplicativo para agendar?",
    a: "Não. O cliente abre o link da barbearia no navegador do celular, cria o acesso com telefone ou e-mail e agenda escolhendo barbeiro, serviços, data e horário. O pedido chega como solicitação no painel e a barbearia tem 10 minutos para confirmar. Quem não quer usar o celular pode ser agendado pelo próprio dono no painel.",
  },
  {
    q: "Dá para controlar mensalidade ou clube do corte?",
    a: "Sim. Você cria planos com quantidade de cortes por mês e vários serviços, e o cliente assina pelo app e vê quantos cortes ainda tem. O plano pode ser livre ou fixo, com o mesmo dia, horário e barbeiro toda semana e reserva automática. Quando o cliente cancela um horário, o corte volta para o saldo.",
  },
  {
    q: "Quanto custa um sistema para barbearia na Barber Agência?",
    a: "Depende do número de profissionais. Personal, até 3: R$ 129,90 por mês. Essencial, até 5, com fila: R$ 189,90 por mês. Advance, até 8 e mensalistas ilimitados: a partir de R$ 249,90 por mês. Na promoção de fim de ano, Personal sai R$ 69,90 e Essencial R$ 89,90 nos 2 primeiros meses. Sem adesão e sem custo de setup.",
  },
  {
    q: "Tem fidelidade, multa ou taxa de adesão?",
    a: "Não. Não há taxa de adesão, custo de setup nem multa. Você pode cancelar a qualquer momento e usa a plataforma até o fim do período já pago. A mensalidade é paga por PIX, com o dia de vencimento combinado com a equipe. Também dá para trocar de plano depois, para cima ou para baixo.",
  },
  {
    q: "Como migrar meus clientes do AppBarber, Trinks, Booksy ou BestBarbers?",
    a: "A equipe da Barber Agência importa a sua base de clientes por planilha (CSV ou Excel) exportada do sistema antigo, sem custo de migração. Há guia para Trinks, Booksy, AppBarber e BestBarbers/Belasis, e também dá para trazer de planilha própria. Depois, cada cliente recebe um convite para confirmar os dados e criar a própria senha, sem recadastro.",
  },
  {
    q: "A barbearia manda mensagens automáticas pelo WhatsApp?",
    a: "Sim, pelo número da própria barbearia. Depois de conectar o WhatsApp no painel por QR code, o cliente recebe aviso quando pede um horário, quando a barbearia confirma, quando o atendimento começa e quando termina, com o total. Cancelamentos e convites de acesso também saem automáticos. O dono recebe o relatório do mês em PDF todo dia 21.",
  },
  {
    q: "Como acompanhar o faturamento e a comissão de cada barbeiro?",
    a: "Pelo financeiro do painel. Cada comanda fechada registra a forma de pagamento (PIX, cartão ou dinheiro) e entra nas receitas, separadas por barbeiro, por dia e por serviço, com a comissão de cada profissional. Também há despesas, saque do caixa e estornos, e o relatório mensal em PDF chega no WhatsApp do dono.",
  },
  {
    q: "Quanto tempo leva para começar a usar?",
    a: "Um dia. A equipe da Barber Agência cria a barbearia, aplica logo e cores, cadastra serviços e barbeiros e entrega o acesso do painel e o link para os clientes, sem cobrar setup. O suporte é humano, em português, pelo WhatsApp.",
  },
  {
    q: "O cliente paga pelo app?",
    a: "Não. O pagamento é feito na barbearia, por PIX, cartão ou dinheiro. Ao fechar a comanda, você escolhe a forma de pagamento e o valor já entra no financeiro.",
  },
];
