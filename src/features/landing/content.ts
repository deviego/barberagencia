import { BARBERAGENCIA_WHATSAPP, waLink } from "@/lib/contact";

/** WhatsApp comercial que recebe os leads da landing. NEXT_PUBLIC_SALES_WHATSAPP pode sobrescrever. */
export const SALES_WHATSAPP = process.env.NEXT_PUBLIC_SALES_WHATSAPP || BARBERAGENCIA_WHATSAPP;

/** Monta um link wa.me para o WhatsApp comercial com uma mensagem pronta. */
export function salesWaLink(message: string) {
  return waLink(SALES_WHATSAPP || "", message);
}

export const WA_MESSAGES = {
  start: "Olá! Quero contratar a Barber Agência. Pode me ajudar?",
  specialist: "Olá! Gostaria de falar com um especialista sobre a Barber Agência.",
  demo: (v: { name: string; phone: string; email: string }) =>
    `Olá! Quero uma demonstração da Barber Agência.\n\n` +
    `Barbearia: ${v.name || "-"}\nWhatsApp: ${v.phone || "-"}\nE-mail: ${v.email || "-"}`,
};

export type Device = {
  id: "laptop" | "tablet" | "phone";
  icon: string;
  label: string;
  caption: string;
  image: string;
};

export const DEVICES: Device[] = [
  {
    id: "laptop",
    icon: "monitor",
    label: "Notebook",
    caption: "Painel completo da barbearia — agenda, financeiro e clientes em uma tela.",
    image: "/screens/dashboard-desktop.png",
  },
  {
    id: "tablet",
    icon: "tablet",
    label: "Tablet",
    caption: "No balcão: recepção lança vendas e confirma presença com um toque.",
    image: "/screens/dashboard-tablet.png",
  },
  {
    id: "phone",
    icon: "smartphone",
    label: "Celular",
    caption: "Na palma da mão: aceite solicitações e acompanhe o caixa de qualquer lugar.",
    image: "/screens/dashboard-mobile.png",
  },
];

export const CLIENT_APP_IMAGE = "/screens/app-cliente-mobile.png";

export const METRICS: { value: string; label: string }[] = [
  { value: "R$ 0", label: "de adesão, setup e migração da sua base" },
  { value: "1 dia", label: "para a nossa equipe deixar a sua barbearia pronta" },
  { value: "10 min", label: "é o prazo para confirmar uma solicitação" },
  { value: "até 8", label: "profissionais na mesma agenda" },
];

export const SECTORS: { icon: string; title: string; desc: string; points: string[] }[] = [
  {
    icon: "calendar",
    title: "Agenda e solicitações",
    desc: "Grade por profissional, bloqueios e confirmação em 10 minutos — aceite ou libere o horário sem sair da tela.",
    points: ["Agenda por barbeiro, dia e semana", "Timer de 10 min para responder o cliente", "Bloqueios, folgas e intervalos"],
  },
  {
    icon: "star",
    title: "Mensalistas e fidelização",
    desc: "Combos mensais com saldo de cortes, no modo livre ou com dia, hora e barbeiro fixos toda semana.",
    points: ["Planos e combos configuráveis", "Saldo de cortes visível ao cliente", "Plano fixo com reserva automática na agenda"],
  },
  {
    icon: "wallet",
    title: "Financeiro e caixa",
    desc: "Receitas, despesas, comissões e fechamento do mês com análise por método de pagamento.",
    points: ["Relatórios de venda e fechamento", "Comissão por profissional", "PIX, cartão, dinheiro e plano"],
  },
  {
    icon: "package",
    title: "Produtos e balcão",
    desc: "Vitrine no app do cliente, controle de estoque e lançamento de venda no balcão em poucos toques.",
    points: ["Vitrine de produtos no app do cliente", "Lançar venda de serviço ou produto", "Foto, preço, custo e estoque"],
  },
  {
    icon: "megaphone",
    title: "WhatsApp da barbearia",
    desc: "Avisos automáticos pelo WhatsApp da própria barbearia: solicitação recebida, confirmação, início e fim do atendimento.",
    points: ["Convite de acesso por WhatsApp ou e-mail", "Relatório mensal em PDF no WhatsApp do dono", "Mensagens prontas para chamar quem sumiu"],
  },
  {
    icon: "message-circle",
    title: "Atendimento",
    desc: "Suporte humano em português, com quem já foi barbeiro, e o histórico de cada cliente na mão.",
    points: ["Atendimento humanizado", "Documentação e vídeos tutoriais", "Histórico completo por cliente"],
  },
];

export const BEFORE: string[] = [
  "Agenda no caderno ou no WhatsApp, sempre com furo de horário",
  "Cliente liga para saber se tem vaga — e desiste quando não atendem",
  "Mensalidade anotada na mão, sem saber quantos cortes cada um já usou",
  "Ninguém sabe quanto entrou no mês sem somar no papel",
  "Cliente some e não há como saber quem parou de voltar",
];

export const AFTER: string[] = [
  "Agenda única por profissional, com bloqueios e confirmação rápida",
  "Cliente agenda sozinho pelo site da sua barbearia, 24h por dia",
  "Combos mensais com saldo de cortes que o próprio cliente acompanha",
  "Faturamento, comissão e método de pagamento em tempo real",
  "Histórico de cada cliente e mensagens prontas para chamar quem sumiu",
];

export const CLIENT_FEATURES: { icon: string; title: string; desc: string }[] = [
  { icon: "scissors", title: "Agendamento em 3 toques", desc: "Serviço, barbeiro e horário" },
  { icon: "star", title: "Saldo de cortes", desc: "Ele vê quanto ainda tem no mês" },
  { icon: "bell", title: "Avisos no WhatsApp", desc: "Pedido recebido, confirmação, início e fim" },
  { icon: "credit-card", title: "Pagamento", desc: "Na unidade: PIX, cartão ou dinheiro" },
  { icon: "package", title: "Produtos", desc: "Reserva e retira no balcão" },
  { icon: "calendar-x", title: "Cancelamento", desc: "Corte volta ao saldo na hora" },
];

export const STEPS: { num: string; title: string; desc: string; strong: boolean }[] = [
  { num: "01", title: "Cadastro da barbearia", desc: "CNPJ, endereço e horários de funcionamento em poucos minutos.", strong: true },
  { num: "02", title: "Sua marca aplicada", desc: "Logo e cores aplicados — a plataforma vira a cara da sua barbearia.", strong: true },
  { num: "03", title: "Serviços e equipe", desc: "Cadastre serviços, produtos, combos mensais e profissionais.", strong: false },
  { num: "04", title: "Convite aos clientes", desc: "Trazemos a sua base do sistema antigo, sem custo, e enviamos o link para cada cliente criar o próprio acesso.", strong: false },
];

/** Benefícios da oferta em evidência (o que muita empresa cobra e a gente não). */
export const OFFER_PERKS: { icon: string; title: string; desc: string }[] = [
  { icon: "database", title: "Sem custo de migração", desc: "Trazemos a sua base de clientes do sistema antigo ou da planilha, sem cobrar nada." },
  { icon: "wrench", title: "Sem custo de adesão e setup", desc: "Montamos a sua barbearia em 1 dia, com logo, cores, serviços e barbeiros." },
  { icon: "wallet", title: "Entrada facilitada", desc: "Metade da 1ª mensalidade no fechamento e o restante em até 15 dias." },
];

/** Fila de atendimento (Essencial e Advance): como o cliente usa. */
export const QUEUE_STEPS: { icon: string; title: string; desc: string }[] = [
  { icon: "qr-code", title: "Escaneia o QR ou usa o totem", desc: "Na chegada, o cliente entra na fila sozinho, sem precisar chamar ninguém no balcão." },
  { icon: "ticket", title: "Pega a senha, como no banco", desc: "Ele recebe a senha na hora e pode escolher o serviço e, se você permitir, o barbeiro." },
  { icon: "tv", title: "Acompanha pelo celular ou pela TV", desc: "Vê quem está na vez e as próximas senhas no celular ou no painel da TV, que toca um sino a cada chamada." },
];

export type Plan = {
  name: string;
  price: string;
  /** Preço cheio (riscado) quando há desconto inicial. */
  fullPrice?: string;
  /** Selo da promoção inicial (ex.: "Fim de ano"). */
  discountBadge?: string;
  cycle: string;
  highlight: boolean;
  desc: string;
  features: { ok: boolean; text: string }[];
};

export const PLANS: Plan[] = [
  {
    name: "Personal",
    price: "R$ 69,90",
    fullPrice: "R$ 129,90",
    discountBadge: "Fim de ano",
    cycle: "por mês nos 2 primeiros meses · depois R$ 129,90/mês",
    highlight: false,
    desc: "Para continuar a organizar a sua barbearia. Aqui você controla o seu negócio em todas as camadas.",
    features: [
      { ok: true, text: "Plataforma personalizada para o administrador (1 admin por CNPJ)" },
      { ok: true, text: "Inscrições para até 20 clientes mensalistas" },
      { ok: true, text: "Cadastro de até 3 profissionais" },
      { ok: true, text: "Relatórios de vendas e relatório mensal em PDF no WhatsApp" },
      { ok: true, text: "300 agendamentos/mês (~10/dia) com solicitação e confirmação em 10 min" },
      { ok: true, text: "Atendimento humanizado" },
      { ok: false, text: "Vitrine de produtos no app do cliente" },
      { ok: false, text: "Fila de atendimento com senha por QR/totem e painel na TV" },
      { ok: false, text: "Endereço próprio, com o nome da barbearia" },
      { ok: false, text: "Suporte por chamado" },
      { ok: false, text: "Domínio próprio" },
    ],
  },
  {
    name: "Essencial",
    price: "R$ 89,90",
    fullPrice: "R$ 189,90",
    discountBadge: "Fim de ano",
    cycle: "por mês nos 2 primeiros meses · depois R$ 189,90/mês",
    highlight: true,
    desc: "Excelente para quem precisa eliminar gargalos de forma eficaz. Gerencie o negócio com inteligência e versatilidade.",
    features: [
      { ok: true, text: "Plataforma personalizada para o administrador (3 admins por CNPJ)" },
      { ok: true, text: "Inscrições para até 90 clientes mensalistas" },
      { ok: true, text: "Cadastro de até 5 profissionais" },
      { ok: true, text: "Relatórios de vendas e relatório mensal em PDF no WhatsApp" },
      { ok: true, text: "1.500 agendamentos/mês (~50/dia) com solicitação e confirmação em 10 min" },
      { ok: true, text: "Atendimento humanizado" },
      { ok: true, text: "Vitrine de produtos no app do cliente" },
      { ok: true, text: "Fila de atendimento com senha por QR/totem e painel na TV" },
      { ok: true, text: "Endereço próprio, com o nome da barbearia" },
      { ok: true, text: "Suporte por chamado" },
      { ok: false, text: "Domínio próprio" },
    ],
  },
  {
    name: "Advance",
    price: "a partir de R$ 249,90",
    cycle: "por mês",
    highlight: false,
    desc: "Para quem busca o equilíbrio entre sofisticação no atendimento e controle total da operação. Eleve o padrão enquanto a tecnologia cuida do resto.",
    features: [
      { ok: true, text: "Plataforma personalizada para o administrador (4 admins por CNPJ)" },
      { ok: true, text: "Inscrições ILIMITADAS para clientes mensalistas" },
      { ok: true, text: "Cadastro de até 8 profissionais" },
      { ok: true, text: "Relatórios de vendas e relatório mensal em PDF no WhatsApp" },
      { ok: true, text: "3.000 agendamentos/mês (~100/dia) com solicitação e confirmação em 10 min" },
      { ok: true, text: "Atendimento humanizado" },
      { ok: true, text: "Vitrine de produtos no app do cliente" },
      { ok: true, text: "Fila de atendimento com senha por QR/totem e painel na TV" },
      { ok: true, text: "Endereço próprio, com o nome da barbearia" },
      { ok: true, text: "Suporte por chamado" },
      { ok: true, text: "Domínio próprio" },
    ],
  },
];

export const PLAN_TABLE: { label: string; a: string; b: string; c: string }[] = [
  { label: "Administradores por CNPJ", a: "1", b: "3", c: "4" },
  { label: "Clientes mensalistas", a: "20", b: "90", c: "Ilimitados" },
  { label: "Profissionais", a: "3", b: "5", c: "8" },
  { label: "Relatórios de vendas", a: "Sim", b: "Sim", c: "Sim" },
  { label: "Agendamentos por mês", a: "300", b: "1.500", c: "3.000" },
  { label: "Relatório mensal em PDF no WhatsApp", a: "Sim", b: "Sim", c: "Sim" },
  { label: "Atendimento humanizado", a: "Sim", b: "Sim", c: "Sim" },
  { label: "Vitrine de produtos no app", a: "—", b: "Sim", c: "Sim" },
  { label: "Fila (senha por QR/totem e TV)", a: "—", b: "Sim", c: "Sim" },
  { label: "Endereço próprio", a: "—", b: "Sim", c: "Sim" },
  { label: "Suporte por chamado", a: "—", b: "Sim", c: "Sim" },
  { label: "Domínio próprio", a: "—", b: "—", c: "Sim" },
  { label: "Mensalidade", a: "R$ 69,90*", b: "R$ 89,90*", c: "a partir de R$ 249,90" },
  { label: "Mensalidade a partir do 3º mês", a: "R$ 129,90", b: "R$ 189,90", c: "a partir de R$ 249,90" },
  { label: "Custo de adesão e setup", a: "Grátis", b: "Grátis", c: "Grátis" },
  { label: "Migração do sistema antigo", a: "Grátis", b: "Grátis", c: "Grátis" },
];

export const FAQS: { q: string; a: string }[] = [
  { q: "Como funciona a promoção de fim de ano?", a: "Nos 2 primeiros meses você paga o preço promocional: R$ 69,90/mês no Personal (depois R$ 129,90/mês) ou R$ 89,90/mês no Essencial (depois R$ 189,90/mês). O Advance segue a tabela normal, a partir de R$ 249,90/mês. Sem custo de adesão e sem custo de setup." },
  { q: "Preciso pagar a primeira mensalidade inteira para começar?", a: "Não. Na promoção de fim de ano você paga metade da 1ª mensalidade no fechamento e o restante em até 15 dias. Assim você já começa a usar e paga o resto com o próprio movimento." },
  { q: "Tem custo para montar a minha barbearia?", a: "Não. Muita empresa cobra instalação e setup; a gente não. Nossa equipe monta a sua barbearia em 1 dia, com logo, cores, serviços e barbeiros, sem cobrar nada por isso." },
  { q: "A plataforma leva a marca da minha barbearia?", a: "Sim. Logo e cores são seus — o cliente nunca vê a marca da plataforma. A partir do Essencial o app tem endereço próprio, com o nome da barbearia; no Advance você usa domínio próprio." },
  { q: "Como funciona o limite de agendamentos?", a: "Cada plano tem um teto mensal (300, 1.500 ou 3.000). Ao se aproximar do limite o painel avisa e você pode pedir para subir de plano, com ajuste proporcional na próxima fatura." },
  { q: "Consigo migrar meus clientes atuais?", a: "Sim, e sem custo de migração. Se você usa outro sistema ou planilha, nossa equipe traz a sua base de clientes sem cobrar nada, e a plataforma envia o convite para cada cliente confirmar os dados e criar a própria senha." },
  { q: "Posso trocar de plano depois?", a: "A qualquer momento, para cima ou para baixo. A diferença é calculada proporcionalmente na próxima fatura." },
];

export const FOOTER_COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Produto",
    links: [
      { label: "Benefícios", href: "#beneficios" },
      { label: "App do cliente", href: "#cliente" },
      { label: "Planos", href: "#planos" },
      { label: "Entrar", href: "/admin/login" },
    ],
  },
  {
    title: "Plataforma",
    links: [
      { label: "Termos de uso", href: "/termos" },
      { label: "Privacidade", href: "/privacidade" },
      { label: "Documentação", href: "/documentacao" },
    ],
  },
  {
    title: "Contato",
    links: [
      { label: "WhatsApp", href: "#contato" },
      { label: "Demonstração", href: "#contato" },
      { label: "Suporte", href: "#contato" },
    ],
  },
];

export const NAV_LINKS: { label: string; href: string }[] = [
  { label: "Produto", href: "#produto" },
  { label: "Benefícios", href: "#beneficios" },
  { label: "App do cliente", href: "#cliente" },
  { label: "Planos", href: "#planos" },
  { label: "Contato", href: "#contato" },
];
