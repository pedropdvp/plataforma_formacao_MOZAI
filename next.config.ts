import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // pdf-parse/pdfjs-dist resolvem o worker dinamicamente em runtime (import() relativo
  // ao próprio pacote) — deixá-los fora do bundling do Turbopack/webpack evita que esse
  // caminho relativo fique quebrado (erro "Setting up fake worker failed: Cannot find
  // module ...pdf.worker.mjs"), usando a resolução nativa de módulos do Node em runtime.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
