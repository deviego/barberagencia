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
  async rewrites() {
    // URL limpa para a documentação (arquivo estático em /public).
    return [{ source: "/documentacao", destination: "/documentacao.html" }];
  },
};

export default nextConfig;
