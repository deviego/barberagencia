import type { Metadata } from "next";
import { BARBERAGENCIA_EMAIL, BARBERAGENCIA_WHATSAPP } from "@/lib/contact";

/**
 * Fatos públicos da Barber Agência usados por metadados, JSON-LD, FAQ e /llms.txt.
 * Fonte única: skills barber-agencia-base (produto.md, planos-e-precos.md, condicoes-aprovadas.md, provas.md).
 * Não inclua aqui nada que o produto não faça (lembrete prévio, SMS, pagamento online, NF-e, API, bot IA, campanhas,
 * rede/franquia, teste grátis) nem números de resultado.
 *
 * TODO(Diego): quando a promoção de fim de ano acabar, atualizar PROMO_* e as respostas do FAQ que a citam
 * (e public/llms.txt).
 */

export const SITE_URL = "https://www.barberagencia.com";
export const SITE_NAME = "Barber Agência";
export const LOGO_URL = `${SITE_URL}/barber-agencia-logo.jpeg`;
export const OG_IMAGE_URL = `${SITE_URL}/screens/dashboard-desktop.png`;
export const CONTENT_UPDATED = "2026-10-27";

export const CONTACT = {
  whatsapp: `+${BARBERAGENCIA_WHATSAPP}`,
  whatsappUrl: `https://wa.me/${BARBERAGENCIA_WHATSAPP}`,
  email: BARBERAGENCIA_EMAIL,
};

/** Frase-resumo (answer-first) reaproveitada em meta description, JSON-LD e llms.txt. */
export const SUMMARY =
  "A Barber Agência é uma plataforma white-label para barbearias no Brasil: agenda online, fila por QR code com painel na TV, mensalidade com saldo de cortes, comanda e financeiro por barbeiro, tudo com a marca da sua barbearia. O cliente agenda pelo link, sem baixar aplicativo.";

export const META_DESCRIPTION =
  "Plataforma white-label para barbearias: agenda online, fila por QR code com painel na TV, mensalidade com saldo de cortes, comanda e financeiro por barbeiro. Sem adesão e sem custo de setup.";

export type PlanFact = {
  name: string;
  professionals: number;
  monthlyMembers: string;
  bookingsPerMonth: number;
  regularPrice: number;
  /** "a partir de" (Advance). */
  priceFrom?: boolean;
  promoPrice?: number;
  queue: boolean;
};

export const PLAN_FACTS: PlanFact[] = [
  { name: "Personal", professionals: 3, monthlyMembers: "20", bookingsPerMonth: 300, regularPrice: 129.9, promoPrice: 69.9, queue: false },
  { name: "Essencial", professionals: 5, monthlyMembers: "90", bookingsPerMonth: 1500, regularPrice: 189.9, promoPrice: 89.9, queue: true },
  { name: "Advance", professionals: 8, monthlyMembers: "ilimitados", bookingsPerMonth: 3000, regularPrice: 249.9, priceFrom: true, queue: true },
];

export const FEATURES = [
  "Fila por ordem de chegada com QR code, totem e painel de chamada na TV (Essencial e Advance)",
  "Agenda por barbeiro com solicitação e confirmação em até 10 minutos",
  "App do cliente com a marca da barbearia, pelo navegador, sem baixar nada",
  "Mensalidade e combos com saldo de cortes e horário fixo semanal",
  "Comanda ao vivo e venda de balcão",
  "Financeiro por barbeiro, por dia e por serviço, com comissão",
  "Relatório mensal em PDF no WhatsApp do dono",
  "Avisos automáticos pelo WhatsApp da própria barbearia",
  "Produtos com estoque e reserva para retirar no balcão",
  "Importação da base de clientes de Trinks, Booksy, AppBarber e BestBarbers/Belasis",
];

/** Metadados extras da landing (canonical, Open Graph, Twitter). Espalhados no `metadata` de src/app/page.tsx. */
export const LANDING_SEO_METADATA: Metadata = {
  alternates: { canonical: `${SITE_URL}/` },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: `${SITE_URL}/`,
    siteName: SITE_NAME,
    title: "Barber Agência — sistema para barbearia com agenda, fila por QR e mensalidade",
    description: META_DESCRIPTION,
    images: [{ url: OG_IMAGE_URL, alt: "Painel da Barber Agência: agenda, financeiro e clientes da barbearia" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Barber Agência — sistema para barbearia",
    description: META_DESCRIPTION,
    images: [OG_IMAGE_URL],
  },
};

export function brl(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}
