import { waLink } from "@/lib/contact";

/** WhatsApp comercial que recebe os leads da landing. Defina NEXT_PUBLIC_SALES_WHATSAPP na Vercel. */
export const SALES_WHATSAPP = process.env.NEXT_PUBLIC_SALES_WHATSAPP || "";

/** Monta um link wa.me para o WhatsApp comercial com uma mensagem pronta. */
export function salesWaLink(message: string) {
  return waLink(SALES_WHATSAPP || "", message);
}

export const WA_MESSAGES = {
  trial: "Olá! Quero testar a barberagencia (15 dias grátis). Pode me ajudar?",
  specialist: "Olá! Gostaria de falar com um especialista sobre a barberagencia.",
  demo: (v: { name: string; phone: string; email: string }) =>
    `Olá! Quero uma demonstração da barberagencia.\n\n` +
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
  { value: "+38%", label: "de ocupação média da agenda no 3º mês" },
  { value: "−72%", label: "de faltas com lembretes automáticos" },
  { value: "4 min", label: "para o cliente assinar um combo mensal" },
  { value: "10 min", label: "é o prazo para confirmar uma solicitação" },
];

export const SECTORS: { icon: string; title: string; desc: string; points: string[] }[] = [
  {
    icon: "calendar",
    title: "Agenda e solicitações",
    desc: "Grade por profissional, bloqueios e confirmação em 10 minutos — aceite ou ofereça outro horário sem sair da tela.",
    points: ["Agenda por barbeiro, dia e semana", "Timer de 10 min para responder o cliente", "Reagendamento e lista de espera"],
  },
  {
    icon: "star",
    title: "Mensalistas e fidelização",
    desc: "Combos mensais com saldo de cortes, renovação automática e cobrança recorrente no cartão.",
    points: ["Planos e combos configuráveis", "Saldo de cortes visível ao cliente", "Renovação e cobrança automáticas"],
  },
  {
    icon: "wallet",
    title: "Financeiro e caixa",
    desc: "Receitas, despesas, comissões e fechamento do mês com análise por método de pagamento.",
    points: ["Relatórios de venda e fechamento", "Comissão por profissional", "PIX, cartão, dinheiro e plano"],
  },
  {
    icon: "package",
    title: "Produtos e venda direta",
    desc: "Vitrine virtual, controle de estoque e lançamento de venda no balcão em poucos toques.",
    points: ["Display virtual de produtos", "Lançar venda de serviço ou produto", "Estoque e alerta de reposição"],
  },
  {
    icon: "megaphone",
    title: "Marketing e recuperação",
    desc: "Campanhas segmentadas por WhatsApp e e-mail, com recuperação de cadastros abandonados.",
    points: ["Segmentos: inativos, assinantes, aniversariantes", "Disparos automatizados de WhatsApp", "Integração com redes sociais"],
  },
  {
    icon: "message-circle",
    title: "Atendimento",
    desc: "Chat humano com apoio de bot IA para tirar dúvidas, reagendar e resgatar clientes parados.",
    points: ["Atendimento humanizado", "Bot IA para dúvidas frequentes", "Histórico completo por cliente"],
  },
];

export const BEFORE: string[] = [
  "Agenda no caderno ou no WhatsApp, sempre com furo de horário",
  "Cliente liga para saber se tem vaga — e desiste quando não atendem",
  "Mensalidade cobrada na mão, esquecida ou atrasada",
  "Ninguém sabe quanto entrou no mês sem somar no papel",
  "Cliente some e não há como saber quem parou de voltar",
];

export const AFTER: string[] = [
  "Agenda única por profissional, com bloqueios e confirmação rápida",
  "Cliente agenda sozinho pelo site da sua barbearia, 24h por dia",
  "Combos mensais com cobrança recorrente automática",
  "Faturamento, comissão e método de pagamento em tempo real",
  "Campanha automática para quem está há 60 dias sem cortar",
];

export const CLIENT_FEATURES: { icon: string; title: string; desc: string }[] = [
  { icon: "scissors", title: "Agendamento em 3 toques", desc: "Serviço, barbeiro e horário" },
  { icon: "star", title: "Saldo de cortes", desc: "Ele vê quanto ainda tem no mês" },
  { icon: "bell", title: "Lembretes", desc: "WhatsApp, SMS e e-mail" },
  { icon: "credit-card", title: "Pagamento", desc: "PIX, cartão ou na unidade" },
  { icon: "package", title: "Produtos", desc: "Reserva e retira no balcão" },
  { icon: "calendar-x", title: "Cancelamento", desc: "Corte volta ao saldo na hora" },
];

export const STEPS: { num: string; title: string; desc: string; strong: boolean }[] = [
  { num: "01", title: "Cadastro da barbearia", desc: "CNPJ, endereço e horários de funcionamento em poucos minutos.", strong: true },
  { num: "02", title: "Sua marca aplicada", desc: "Logo, cores e domínio — a plataforma vira a cara da sua barbearia.", strong: true },
  { num: "03", title: "Serviços e equipe", desc: "Cadastre serviços, produtos, combos mensais e profissionais.", strong: false },
  { num: "04", title: "Convite aos clientes", desc: "Importe a base e envie o link para cada cliente criar o próprio acesso.", strong: false },
];

export type Plan = {
  name: string;
  price: string;
  cycle: string;
  highlight: boolean;
  desc: string;
  features: { ok: boolean; text: string }[];
};

export const PLANS: Plan[] = [
  {
    name: "Personal",
    price: "R$ 69,90",
    cycle: "nos 3 primeiros meses · depois R$ 129,90/mês",
    highlight: false,
    desc: "Para continuar a organizar a sua barbearia. Aqui você controla o seu negócio em todas as camadas.",
    features: [
      { ok: true, text: "Plataforma personalizada para o administrador (1 admin por CNPJ)" },
      { ok: true, text: "Inscrições para até 20 clientes mensalistas" },
      { ok: true, text: "Cadastro de até 3 profissionais" },
      { ok: true, text: "Relatórios de vendas" },
      { ok: true, text: "300 agendamentos/mês (~10/dia) com alertas WhatsApp/e-mail/SMS" },
      { ok: true, text: "Atendimento humanizado" },
      { ok: false, text: "Atendimento por chat com auxílio de bot IA" },
      { ok: false, text: "Recuperação de cadastros abandonados" },
      { ok: false, text: "Display virtual para produtos" },
      { ok: false, text: "Campanhas via e-mkt + integração de redes sociais" },
      { ok: false, text: "Emissão de nota fiscal via plataforma" },
      { ok: false, text: "Serviços de venda direta via plataforma" },
      { ok: false, text: "Gateway de pagamento via API / Webhooks" },
    ],
  },
  {
    name: "Essencial",
    price: "R$ 189,90",
    cycle: "por mês",
    highlight: true,
    desc: "Excelente para quem precisa eliminar gargalos de forma eficaz. Gerencie o negócio com inteligência e versatilidade.",
    features: [
      { ok: true, text: "Plataforma personalizada para o administrador (3 admins por CNPJ)" },
      { ok: true, text: "Inscrições para até 90 clientes mensalistas" },
      { ok: true, text: "Cadastro de até 5 profissionais" },
      { ok: true, text: "Relatórios de vendas" },
      { ok: true, text: "1.500 agendamentos/mês (~50/dia) com alertas WhatsApp/e-mail/SMS" },
      { ok: true, text: "Atendimento humanizado + auxílio de bot IA" },
      { ok: true, text: "Recuperação de cadastros abandonados" },
      { ok: true, text: "Display virtual para produtos personalizados" },
      { ok: true, text: "Campanhas via e-mkt + integração de redes sociais" },
      { ok: false, text: "Emissão de nota fiscal via plataforma" },
      { ok: false, text: "Serviços de venda direta via plataforma" },
      { ok: false, text: "Gateway de pagamento via API / Webhooks" },
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
      { ok: true, text: "Relatórios de vendas" },
      { ok: true, text: "3.000 agendamentos/mês (~100/dia) com alertas WhatsApp/e-mail/SMS" },
      { ok: true, text: "Atendimento humanizado + auxílio de bot IA" },
      { ok: true, text: "Recuperação de cadastros abandonados" },
      { ok: true, text: "Display virtual para produtos personalizados" },
      { ok: true, text: "Campanhas via e-mkt + integração de redes sociais" },
      { ok: true, text: "Emissão de nota fiscal via plataforma" },
      { ok: true, text: "Serviços de venda direta via plataforma" },
      { ok: true, text: "Gateway de pagamento via API / Webhooks" },
    ],
  },
];

export const PLAN_TABLE: { label: string; a: string; b: string; c: string }[] = [
  { label: "Administradores por CNPJ", a: "1", b: "3", c: "4" },
  { label: "Clientes mensalistas", a: "20", b: "90", c: "Ilimitados" },
  { label: "Profissionais", a: "3", b: "5", c: "8" },
  { label: "Relatórios de vendas", a: "Sim", b: "Sim", c: "Sim" },
  { label: "Agendamentos por mês", a: "300", b: "1.500", c: "3.000" },
  { label: "Alertas WhatsApp / e-mail / SMS", a: "Sim", b: "Sim", c: "Sim" },
  { label: "Atendimento humanizado", a: "Sim", b: "Sim", c: "Sim" },
  { label: "Chat com bot IA", a: "—", b: "Sim", c: "Sim" },
  { label: "Recuperação de cadastros", a: "—", b: "Sim", c: "Sim" },
  { label: "Display virtual de produtos", a: "—", b: "Sim", c: "Sim" },
  { label: "Campanhas e-mkt + redes sociais", a: "—", b: "Sim", c: "Sim" },
  { label: "Nota fiscal via plataforma", a: "—", b: "—", c: "Sim" },
  { label: "Venda direta via plataforma", a: "—", b: "—", c: "Sim" },
  { label: "Gateway (API) / Webhooks", a: "—", b: "—", c: "Sim" },
  { label: "Mensalidade", a: "R$ 69,90*", b: "R$ 189,90", c: "a partir de R$ 249,90" },
];

export const FAQS: { q: string; a: string }[] = [
  { q: "Preciso de cartão de crédito para testar?", a: "Não. São 15 dias de experimentação sem adesão e sem cartão. A cobrança só inicia após 7 dias corridos e o cancelamento é livre nesse período." },
  { q: "A plataforma leva a marca da minha barbearia?", a: "Sim. Logo, cores e domínio são seus — o cliente nunca vê a marca da plataforma. No Advance você usa domínio próprio." },
  { q: "Como funciona o limite de agendamentos?", a: "Cada plano tem um teto mensal (300, 1.500 ou 3.000). Ao se aproximar do limite avisamos no painel e você pode subir de plano na hora, com ajuste proporcional na fatura." },
  { q: "Consigo migrar meus clientes atuais?", a: "Sim. Você importa a base por planilha e a plataforma envia o convite para cada cliente confirmar os dados e criar a própria senha." },
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
