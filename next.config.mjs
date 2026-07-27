/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Actions are enabled by default in Next 15
  },
  async rewrites() {
    // URL limpa para a documentação (arquivo estático em /public).
    return [{ source: "/documentacao", destination: "/documentacao.html" }];
  },
};

export default nextConfig;
