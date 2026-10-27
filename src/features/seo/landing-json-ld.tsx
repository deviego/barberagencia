import { SEO_FAQS } from "./faq";
import {
  CONTACT,
  CONTENT_UPDATED,
  FEATURES,
  LOGO_URL,
  META_DESCRIPTION,
  OG_IMAGE_URL,
  PLAN_FACTS,
  SITE_NAME,
  SITE_URL,
  SUMMARY,
} from "./site";

/**
 * JSON-LD da landing: Organization, WebSite, WebPage, SoftwareApplication (com os 3 planos) e FAQPage.
 * Só dados reais. Sem aggregateRating/review (não há avaliações públicas verificáveis).
 * TODO(Diego): sameAs (Instagram, YouTube, LinkedIn, Google Perfil da Empresa), CNPJ/razão social e fundador
 * (nome completo + perfil público) para Organization.
 */
export function LandingJsonLd() {
  const orgId = `${SITE_URL}/#organization`;
  const appId = `${SITE_URL}/#software`;

  const graph = [
    {
      "@type": "Organization",
      "@id": orgId,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: LOGO_URL,
      description: SUMMARY,
      email: CONTACT.email,
      areaServed: { "@type": "Country", name: "Brasil" },
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "sales",
        telephone: CONTACT.whatsapp,
        url: CONTACT.whatsappUrl,
        availableLanguage: "pt-BR",
        areaServed: "BR",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      inLanguage: "pt-BR",
      publisher: { "@id": orgId },
    },
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/#webpage`,
      url: `${SITE_URL}/`,
      name: "Barber Agência — sistema para barbearia com agenda, fila por QR e mensalidade",
      description: META_DESCRIPTION,
      inLanguage: "pt-BR",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": appId },
      dateModified: CONTENT_UPDATED,
      primaryImageOfPage: OG_IMAGE_URL,
    },
    {
      "@type": "SoftwareApplication",
      "@id": appId,
      name: SITE_NAME,
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Sistema de gestão e agendamento para barbearias",
      operatingSystem: "Web (navegador do celular, tablet ou computador)",
      description: SUMMARY,
      inLanguage: "pt-BR",
      url: `${SITE_URL}/`,
      image: OG_IMAGE_URL,
      featureList: FEATURES,
      publisher: { "@id": orgId },
      offers: PLAN_FACTS.map((p) => ({
        "@type": "Offer",
        name: `Plano ${p.name}`,
        description:
          `Até ${p.professionals} profissionais, ${p.monthlyMembers} clientes mensalistas, ` +
          `${p.bookingsPerMonth.toLocaleString("pt-BR")} agendamentos por mês` +
          (p.queue ? ", com fila por QR code, totem e painel na TV" : "") +
          (p.promoPrice
            ? `. Promoção de fim de ano: R$ ${p.promoPrice.toFixed(2).replace(".", ",")} por mês nos 2 primeiros meses.`
            : ".") +
          " Sem adesão e sem custo de setup.",
        price: p.regularPrice.toFixed(2),
        priceCurrency: "BRL",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: p.regularPrice.toFixed(2),
          ...(p.priceFrom ? { minPrice: p.regularPrice.toFixed(2) } : {}),
          priceCurrency: "BRL",
          unitText: "mês",
          referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
        },
        availability: "https://schema.org/InStock",
        url: `${SITE_URL}/#planos`,
        seller: { "@id": orgId },
      })),
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: SEO_FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
