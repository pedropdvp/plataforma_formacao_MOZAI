"use client";

import React from "react";
import { Download, ExternalLink } from "lucide-react";

interface PdfViewerProps {
  // URL da nossa própria API (proxy autenticado ao Blob privado) — nunca a URL do Blob
  // diretamente, que rejeita pedidos sem o token de leitura/escrita do servidor.
  src: string;
  downloadName?: string;
}

// Visualizador de PDF embutido: usa o motor nativo de PDF do browser (Chrome, Edge,
// Firefox e Safari todos sabem renderizar um PDF dentro de um <iframe>/<object>), sem
// precisar de nenhuma biblioteca extra — mantém o bundle leve e evita problemas de
// compatibilidade de bibliotecas de terceiros para PDF no cliente.
export function PdfViewer({ src, downloadName }: PdfViewerProps) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950 overflow-hidden shadow-xl">
      <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-b border-slate-900 bg-slate-950/60">
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-indigo-400 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir numa nova aba
        </a>
        <a
          href={src}
          download={downloadName || "material.pdf"}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-indigo-400 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Descarregar
        </a>
      </div>
      <object data={src} type="application/pdf" className="w-full h-[600px] bg-white">
        <div className="h-[600px] flex flex-col items-center justify-center gap-3 text-center px-6">
          <p className="text-xs text-slate-400">
            O seu navegador não consegue mostrar o PDF aqui. Use os links acima para o abrir ou descarregar.
          </p>
        </div>
      </object>
    </div>
  );
}
