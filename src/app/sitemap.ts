import type { MetadataRoute } from "next";
import { CONTENT_UPDATED, SITE_URL } from "@/features/seo/site";

/** Só páginas públicas da Barber Agência (nada de áreas logadas nem apps das barbearias clientes). */
export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date(`${CONTENT_UPDATED}T00:00:00-03:00`);
  return [
    { url: `${SITE_URL}/`, lastModified: updated, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/documentacao`, lastModified: updated, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/llms.txt`, lastModified: updated, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/termos`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacidade`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
