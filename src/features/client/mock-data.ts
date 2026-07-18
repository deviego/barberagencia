/**
 * Dados mock do app do cliente (M2) — substituídos por queries reais (Prisma/Supabase)
 * quando o banco estiver conectado. Preços em reais, fiéis ao handoff.
 */

export interface ServiceItem {
  id: string;
  name: string;
  priceBRL: number;
  durationMin: number;
  icon: string;
}

export interface ComboItem {
  id: string;
  name: string;
  priceBRL: number;
  cuts: number;
  scope: string;
}

export const SERVICES: ServiceItem[] = [
  { id: "corte-simples", name: "Corte Simples", priceBRL: 40, durationMin: 45, icon: "scissors" },
  { id: "corte-infantil", name: "Corte Infantil", priceBRL: 35, durationMin: 30, icon: "scissors" },
  { id: "barba-simples", name: "Barba Simples", priceBRL: 30, durationMin: 30, icon: "scissors" },
  { id: "barba-especial", name: "Barba Especial", priceBRL: 80, durationMin: 60, icon: "scissors" },
];

export const COMBOS: ComboItem[] = [
  { id: "combo-infantil", name: "Combo Mensal Infantil", priceBRL: 120, cuts: 2, scope: "cabelo" },
  { id: "combo-adulto-01", name: "Combo Mensal 01 Adulto", priceBRL: 140, cuts: 2, scope: "cabelo" },
  {
    id: "combo-02",
    name: "Combo Mensal 02",
    priceBRL: 200,
    cuts: 4,
    scope: "cabelo+barba+sobrancelha",
  },
];

export const BARBERS = [
  { id: "rodrigo", name: "Rodrigo" },
  { id: "marcos", name: "Marcos" },
  { id: "any", name: "Sem preferência" },
];

export const CLIENT_PRODUCTS = [
  { id: "pomada", name: "Pomada Modeladora", priceBRL: 45 },
  { id: "oleo", name: "Óleo para Barba", priceBRL: 38 },
  { id: "shampoo", name: "Shampoo Anticaspa", priceBRL: 29 },
  { id: "balm", name: "Balm Pós-Barba", priceBRL: 42 },
  { id: "cera", name: "Cera Fixadora", priceBRL: 39 },
  { id: "kit", name: "Kit Barbearia Completo", priceBRL: 150 },
];

export const CURRENT_CLIENT = {
  name: "William",
  plan: COMBOS[2], // Combo Mensal 02
  cutsTotal: 4,
  cutsRemaining: 3,
  billingDay: 5,
  nextAppointment: {
    service: "Combo Mensal 02",
    barber: "Rodrigo",
    dateLabel: "Seg, 21 Set",
    timeLabel: "15:30",
    status: "CONFIRMED" as const,
  },
};

export const TIME_SLOTS = [
  { time: "09:00", busy: false },
  { time: "09:45", busy: true },
  { time: "10:30", busy: false },
  { time: "11:15", busy: false },
  { time: "14:00", busy: true },
  { time: "14:45", busy: false },
  { time: "15:30", busy: false },
  { time: "16:15", busy: false },
  { time: "17:00", busy: true },
];

export const MY_APPOINTMENTS = {
  upcoming: [
    {
      id: "a1",
      service: "Combo Mensal 02",
      barber: "Rodrigo",
      dateLabel: "Seg, 21 Set · 15:30",
      status: "CONFIRMED" as const,
    },
    {
      id: "a2",
      service: "Barba Especial",
      barber: "Marcos",
      dateLabel: "Qui, 24 Set · 10:30",
      status: "REQUESTED" as const,
    },
  ],
  past: [
    { id: "p1", service: "Combo Mensal 02", dateLabel: "07 Set · 16:15", status: "DONE" as const },
    { id: "p2", service: "Corte Simples", dateLabel: "24 Ago · 11:15", status: "CANCELLED" as const },
  ],
};
