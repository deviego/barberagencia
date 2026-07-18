/** Dados mock do painel do admin (M4/M5) — trocar por Prisma quando o banco conectar. */

export const KPIS = {
  revenue: 18420,
  revenueDelta: 12,
  appointmentsToday: 9,
  subscribers: 31,
  occupancy: 78,
};

export const REVENUE_6M = [
  { month: "Abr", value: 12800 },
  { month: "Mai", value: 14100 },
  { month: "Jun", value: 13500 },
  { month: "Jul", value: 16200 },
  { month: "Ago", value: 15800 },
  { month: "Set", value: 18420, current: true },
];

export const TODAY_AGENDA = [
  { time: "09:00", client: "Carlos M.", service: "Corte Simples", barber: "Rodrigo", status: "CONFIRMED" as const },
  { time: "10:30", client: "William O.", service: "Combo Mensal 02", barber: "Rodrigo", status: "PLAN" as const },
  { time: "11:15", client: "Diego P.", service: "Barba Especial", barber: "Marcos", status: "PENDING" as const },
  { time: "14:45", client: "João S.", service: "Corte + Barba", barber: "Marcos", status: "CONFIRMED" as const },
];

export const PAYMENT_QUEUE = [
  { id: "pq1", client: "Diego P.", service: "Barba Especial", amountBRL: 80, method: "PIX" },
  { id: "pq2", client: "André L.", service: "Corte Simples", amountBRL: 40, method: "Dinheiro" },
];

export const REQUESTS = [
  {
    id: "r1",
    client: "Pedro Henrique",
    service: "Combo Mensal 02",
    barber: "Rodrigo",
    slot: "Seg, 21 Set · 15:30",
    secondsLeft: 480,
    plan: true,
    balance: "3/4",
  },
  {
    id: "r2",
    client: "Lucas Ferreira",
    service: "Corte Simples",
    barber: "Marcos",
    slot: "Seg, 21 Set · 16:15",
    secondsLeft: 210,
    plan: false,
    balance: null,
  },
];

export const BARBERS = [
  { id: "rodrigo", name: "Rodrigo", count: 6 },
  { id: "marcos", name: "Marcos", count: 5 },
  { id: "bruno", name: "Bruno", count: 3 },
];

// Agenda: horários x barbeiros
export const AGENDA_HOURS = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];
export const AGENDA_SLOTS: Record<string, Record<string, { client: string; kind: "confirmed" | "pending" | "plan" } | "blocked" | null>> = {
  "09:00": { rodrigo: { client: "Carlos M.", kind: "confirmed" }, marcos: null, bruno: "blocked" },
  "10:00": { rodrigo: { client: "William O.", kind: "plan" }, marcos: { client: "Rafa", kind: "confirmed" }, bruno: null },
  "11:00": { rodrigo: null, marcos: { client: "Diego P.", kind: "pending" }, bruno: { client: "Igor", kind: "confirmed" } },
  "14:00": { rodrigo: { client: "João S.", kind: "confirmed" }, marcos: "blocked", bruno: null },
  "15:00": { rodrigo: { client: "Pedro H.", kind: "pending" }, marcos: { client: "Léo", kind: "plan" }, bruno: null },
  "16:00": { rodrigo: null, marcos: { client: "Lucas F.", kind: "pending" }, bruno: { client: "Tiago", kind: "confirmed" } },
};

export const CLIENTS = [
  { id: "c1", name: "William Oliveira", phone: "(11) 9****-4321", plan: "Combo Mensal 02", active: true },
  { id: "c2", name: "Carlos Mendes", phone: "(11) 9****-1187", plan: "Avulso", active: true },
  { id: "c3", name: "Diego Pereira", phone: "(11) 9****-3390", plan: "Combo 01 Adulto", active: true },
  { id: "c4", name: "André Lima", phone: "(11) 9****-7742", plan: "Avulso", active: false },
];

export const SERVICES = [
  { id: "s1", name: "Corte Simples", durationMin: 45, priceBRL: 40, active: true },
  { id: "s2", name: "Corte Infantil", durationMin: 30, priceBRL: 35, active: true },
  { id: "s3", name: "Barba Simples", durationMin: 30, priceBRL: 30, active: true },
  { id: "s4", name: "Barba Especial", durationMin: 60, priceBRL: 80, active: true },
];

export const PRODUCTS = [
  { id: "p1", name: "Pomada Modeladora", sku: "PM-001", priceBRL: 45, stock: 23, active: true },
  { id: "p2", name: "Óleo para Barba", sku: "OB-002", priceBRL: 38, stock: 12, active: true },
  { id: "p3", name: "Shampoo Anticaspa", sku: "SH-003", priceBRL: 29, stock: 0, active: false },
];

export const STAFF = [
  { id: "b1", name: "Rodrigo Alves", specialties: "Corte, Barba", commissionPct: 40, active: true },
  { id: "b2", name: "Marcos Souza", specialties: "Corte, Sobrancelha", commissionPct: 35, active: true },
  { id: "b3", name: "Bruno Dias", specialties: "Barba", commissionPct: 30, active: true },
];

export const FINANCE = {
  revenue: 18420,
  expenses: 6240,
  closing: 12180,
  withdrawals: 4000,
  byMethod: [
    { method: "PIX", pct: 44, color: "var(--bb-success)" },
    { method: "Cartão", pct: 28, color: "var(--bb-accent)" },
    { method: "Dinheiro", pct: 18, color: "var(--bb-info)" },
    { method: "Outros", pct: 10, color: "var(--bb-n500)" },
  ],
  receipts: [
    { id: "f1", client: "William O.", method: "PIX", amountBRL: 200, date: "18 Set" },
    { id: "f2", client: "Carlos M.", method: "Cartão", amountBRL: 40, date: "18 Set" },
    { id: "f3", client: "Diego P.", method: "Dinheiro", amountBRL: 80, date: "17 Set" },
  ],
};

export const CAMPAIGNS = [
  { id: "cp1", name: "Volte a nos visitar", segment: "Inativos 60+ dias", status: "ACTIVE" as const, reach: 84 },
  { id: "cp2", name: "Promo de aniversário", segment: "Aniversariantes", status: "SCHEDULED" as const, reach: 22 },
  { id: "cp3", name: "Combo de inverno", segment: "Avulsos", status: "ENDED" as const, reach: 156 },
];
