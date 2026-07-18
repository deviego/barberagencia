/** Dados mock da plataforma (Master) e da Rede (M8/M9). */

export const TENANTS = [
  { id: "t1", name: "Barbearia Oliveira 01", logo: "BO", color: "#C9A24B", logoFg: "#171717", domain: "oliveira01.barber.app", plan: "advanced", units: 3, status: "ACTIVE" as const },
  { id: "t2", name: "Vintage Club", logo: "VC", color: "#5556EE", logoFg: "#ffffff", domain: "vintageclub.barber.app", plan: "profissional", units: 1, status: "ACTIVE" as const },
  { id: "t3", name: "Navalha de Ouro", logo: "NO", color: "#08D48B", logoFg: "#171717", domain: "navalhadeouro.barber.app", plan: "profissional", units: 2, status: "PAYMENT_PENDING" as const },
  { id: "t4", name: "Barba Negra", logo: "BN", color: "#171717", logoFg: "#C9A24B", domain: "barbanegra.barber.app", plan: "essencial", units: 1, status: "ONBOARDING" as const },
  { id: "t5", name: "Estúdio Kombi", logo: "EK", color: "#FF385C", logoFg: "#ffffff", domain: "kombi.barber.app", plan: "essencial", units: 1, status: "SUSPENDED" as const },
];

export const BILLING = {
  mrr: 4870,
  tenants: 27,
  overdue: 2,
  churnPct: 3.4,
  invoices: [
    { id: "i1", tenant: "Barbearia Oliveira 01", plan: "Advanced", amountBRL: 349, status: "PAID" as const, due: "05 Set" },
    { id: "i2", tenant: "Corte Fino", plan: "Profissional", amountBRL: 199, status: "PAID" as const, due: "05 Set" },
    { id: "i3", tenant: "Navalha de Ouro", plan: "Profissional", amountBRL: 199, status: "OVERDUE" as const, due: "01 Set" },
    { id: "i4", tenant: "Studio Barber", plan: "Essencial", amountBRL: 99, status: "TRIAL" as const, due: "12 Set" },
    { id: "i5", tenant: "Barba & Cia", plan: "Essencial", amountBRL: 99, status: "PENDING" as const, due: "08 Set" },
  ],
};

export const THEME_TOKENS = [
  { name: "--accent", value: "#C9A24B" },
  { name: "--accent-hover", value: "#DDB86A" },
  { name: "--bg", value: "#0D0D0D" },
  { name: "--surface", value: "#171717" },
  { name: "--text", value: "#F5F1E8" },
  { name: "--pole-red", value: "#B31935" },
  { name: "--pole-blue", value: "#5556EE" },
];

// Rede
export const NETWORK_UNITS = [
  { id: "u1", name: "Centro", revenue: 18420, appointments: 312, subscribers: 31, occupancy: 78, ticket: 62, barColor: "var(--bb-accent)" },
  { id: "u2", name: "Zona Sul", revenue: 14200, appointments: 214, subscribers: 22, occupancy: 65, ticket: 58, barColor: "var(--bb-pole-blue)" },
  { id: "u3", name: "Barra", revenue: 9800, appointments: 148, subscribers: 14, occupancy: 52, ticket: 55, barColor: "var(--bb-n700)" },
];

export const NETWORK_ADMINS = [
  { id: "a1", name: "Rodrigo Alves", unit: "Centro", role: "dono", color: "#C9A24B", fg: "#171717", status: "ACTIVE" as const },
  { id: "a2", name: "Marcos Souza", unit: "Zona Sul", role: "gerente", color: "#5556EE", fg: "#ffffff", status: "ACTIVE" as const },
  { id: "a3", name: "Bruno Dias", unit: "Barra", role: "gerente", color: "#08D48B", fg: "#171717", status: "INVITED" as const },
];
