import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // pdf-parse/pdfjs-dist resolvem o worker dinamicamente em runtime (import() relativo
  // ao próprio pacote) — deixá-los fora do bundling do Turbopack/webpack evita que esse
  // caminho relativo fique quebrado (erro "Setting up fake worker failed: Cannot find
  // module ...pdf.worker.mjs"), usando a resolução nativa de módulos do Node em runtime.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
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
