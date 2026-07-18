/** Dados mock da plataforma (Master) e da Rede (M8/M9). */

export const TENANTS = [
  { id: "t1", name: "Barbearia Oliveira 01", logo: "BO", color: "#C9A24B", domain: "oliveira01.barber.app", plan: "advanced", units: 3, status: "ACTIVE" as const },
  { id: "t2", name: "Corte Fino", logo: "CF", color: "#5556EE", domain: "cortefino.barber.app", plan: "profissional", units: 1, status: "ACTIVE" as const },
  { id: "t3", name: "Navalha de Ouro", logo: "NO", color: "#08D48B", domain: "navalhaouro.com.br", plan: "profissional", units: 2, status: "PAYMENT_PENDING" as const },
  { id: "t4", name: "Studio Barber", logo: "SB", color: "#FF385C", domain: "studiobarber.barber.app", plan: "essencial", units: 1, status: "ONBOARDING" as const },
  { id: "t5", name: "Barba & Cia", logo: "BC", color: "#FFC839", domain: "barbacia.barber.app", plan: "essencial", units: 1, status: "SUSPENDED" as const },
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
  { name: "--bb-accent", value: "#C9A24B" },
  { name: "--bb-accent-hover", value: "#DDB86A" },
  { name: "--bb-accent-down", value: "#A8842F" },
  { name: "--bb-bg", value: "#0D0D0D" },
  { name: "--bb-surface", value: "#171717" },
];

// Rede
export const NETWORK_UNITS = [
  { id: "u1", name: "Oliveira 01 — Centro", revenue: 18420, subscribers: 31, occupancy: 78, ticket: 62 },
  { id: "u2", name: "Oliveira 01 — Zona Sul", revenue: 14200, subscribers: 22, occupancy: 65, ticket: 58 },
  { id: "u3", name: "Oliveira 01 — Barra", revenue: 9800, subscribers: 14, occupancy: 52, ticket: 55 },
];

export const NETWORK_ADMINS = [
  { id: "a1", name: "Rodrigo Alves", unit: "Centro", status: "ACTIVE" as const },
  { id: "a2", name: "Marcos Souza", unit: "Zona Sul", status: "ACTIVE" as const },
  { id: "a3", name: "convite@enviado.com", unit: "Barra", status: "INVITED" as const },
];
