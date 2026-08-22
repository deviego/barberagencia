// Content-Security-Policy compatível com o app:
// - script inline do tema + hidratação do Next → 'unsafe-inline' (e 'unsafe-eval' p/ dev)
// - next/font é self-hosted (sem fonts.googleapis); estilos inline (Tailwind/styled-jsx)
// - Supabase: REST/Storage (https) + Realtime (wss); QR/canvas usam data:/blob:
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Logos/branding e avatares vêm do Supabase Storage (URLs públicas).
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  experimental: {
    // Server Actions are enabled by default in Next 15
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async rewrites() {
    // URL limpa para a documentação (arquivo estático em /public).
    return [{ source: "/documentacao", destination: "/documentacao.html" }];
  },
};

export default nextConfig;
