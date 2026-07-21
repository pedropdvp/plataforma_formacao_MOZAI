"use client";

/**
 * Rota que serve o Sanity Studio embutido em /studio.
 * O `[[...tool]]` (catch-all opcional) permite ao Studio gerir a sua própria navegação interna.
 */
import { NextStudio } from "next-sanity/studio";
import config from "../../../sanity.config";

export const dynamic = "force-static";

export default function StudioPage() {
  return <NextStudio config={config} />;
}
