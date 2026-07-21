import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { codeInput } from "@sanity/code-input";
import { schemaTypes } from "./sanity/schemas";

/**
 * Configuração do Sanity Studio embutido, servido em /studio.
 * Permite ao formador criar e manter Cursos, Módulos e Lições visualmente.
 */
export default defineConfig({
  name: "mozai-studio",
  title: "MOZAI — Gestão de Cursos",
  basePath: "/studio",
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || process.env.SANITY_PROJECT_ID || "dummy-project-id",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || process.env.SANITY_DATASET || "production",
  schema: {
    types: schemaTypes,
  },
  plugins: [structureTool(), visionTool(), codeInput()],
});
