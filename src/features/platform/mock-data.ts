/** Dados mock da plataforma (Master) e da Rede (M8/M9). */

export const TENANTS = [
  { id: "t1", name: "Barbearia Oliveira 01", logo: "BO", color: "#C9A24B", logoFg: "#171717", domain: "oliveira01", plan: "advance", units: 1, status: "ACTIVE" as const },
];

export const BILLING = {
  mrr: 249.9,
  tenants: 1,
  overdue: 0,
  churnPct: 0,
  invoices: [
    { id: "i1", tenant: "Barbearia Oliveira 01", plan: "Advance", amountBRL: 249.9, status: "PAID" as const, due: "05 Jul" },
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
