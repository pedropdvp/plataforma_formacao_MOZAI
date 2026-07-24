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
};

export default nextConfig;
