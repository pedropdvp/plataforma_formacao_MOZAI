import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // pdf-parse/pdfjs-dist resolvem o worker dinamicamente em runtime (import() relativo
  // ao próprio pacote) — deixá-los fora do bundling do Turbopack/webpack evita que esse
  // caminho relativo fique quebrado (erro "Setting up fake worker failed: Cannot find
  // module ...pdf.worker.mjs"), usando a resolução nativa de módulos do Node em runtime.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  // O diagnóstico de variáveis lê o catálogo do `.env.example` em runtime. Um ficheiro que
  // ninguém importa não entra no bundle da função serverless — sem isto, a página
  // funcionaria em desenvolvimento e ficaria sem lista nenhuma em produção.
  outputFileTracingIncludes: {
    "/api/admin/env-check": ["./.env.example"],
  },
  // @vercel/blob importa fetch de "undici" (só Node) sem nenhuma condição "browser" no seu
  // package.json — no bundle do cliente isso ficava pendurado para sempre em vez de fazer o
  // pedido real, impedindo silenciosamente o upload de PDF/PPTX. Substitui-se "undici" pelo
  // fetch nativo só no lado do browser; no servidor mantém-se o pacote real (necessário para
  // o jsdom usado em import-url/route.ts). Ver lib/undici-browser-fetch-shim.ts.
  turbopack: {
    resolveAlias: {
      undici: {
        browser: "./lib/undici-browser-fetch-shim.ts",
      },
    },
  },
  // O cabeçalho que anuncia "Next.js" em cada resposta não ajuda quem usa a plataforma e
  // ajuda quem procura alvos por versão de framework.
  poweredByHeader: false,
  // Da Vercel só vinha o HSTS. O /widget existe para ser embebido noutros sites, por isso é o
  // único caminho onde o embebimento continua permitido.
  async headers() {
    const baseline = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
    ];
    return [
      {
        source: "/widget/:path*",
        headers: [...baseline, { key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
      {
        source: "/((?!widget).*)",
        headers: [
          ...baseline,
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
  // "Perfil de Empresa & Vagas" foi dividido em duas páginas (tab "Perfil da Empresa" em
  // /dashboard/admin, e o novo submenu "Vagas de Emprego" em /dashboard/admin/job-postings) —
  // este redirecionamento evita que marcadores/links antigos para a página combinada fiquem
  // partidos (404).
  async redirects() {
    return [
      {
        source: "/dashboard/admin/company-profile",
        destination: "/dashboard/admin",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
