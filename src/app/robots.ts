import type { MetadataRoute } from "next";
import { SITE_URL } from "@/features/seo/site";

/** Áreas logadas, apps white-label das barbearias clientes e rotas técnicas: fora do índice. */
const PRIVATE = [
  "/admin",
  "/master",
  "/distributor",
  "/client",
  "/rede",
  "/b/",
  "/convite/",
  "/design-system",
  "/api/",
];

/** Buscadores e crawlers de IA liberados explicitamente para as páginas públicas. */
const BOTS = [
  "Googlebot",
  "Bingbot",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot",
  "Applebot-Extended",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: BOTS, allow: "/", disallow: PRIVATE },
      { userAgent: "*", allow: "/", disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
