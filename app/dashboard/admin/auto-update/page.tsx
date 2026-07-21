"use client";

import React, { useState } from "react";
import { RefreshCw, GitBranch, Terminal, Shield, ArrowRight, Loader2, Check, ExternalLink } from "lucide-react";

const MOCK_SCAN_SOURCES = [
  { name: "GitHub Releases: vercel/next.js", lastScan: "há 23 minutos", status: "online" },
  { name: "arXiv AI Preprints (cs.LG)", lastScan: "há 2 horas", status: "online" },
  { name: "GitHub Releases: solidity/solidity", lastScan: "há 1 hora", status: "online" },
];

const INITIAL_DETECTED_UPDATES = [
  {
    id: "update-1",
    source: "vercel/next.js",
    title: "Next.js 16.3.0 - Otimização de Server Actions e Proxying",
    description: "Lançamento de suporte aprimorado a proxies de middleware no edge, reduzindo latência de encaminhamento em 15%.",
    generatedModule: "Atualizações Next.js 16.3: Otimizações no Edge",
    status: "pending",
  },
  {
    id: "update-2",
    source: "solidity/solidity",
    title: "Solidity v0.8.28 - Novos Opcodes de Criptografia",
    description: "Introdução de validação otimizada de assinaturas criptográficas nativas na EVM, reduzindo consumo de gas em transações Web3.",
    generatedModule: "Solidity 0.8.28: Técnicas de Otimização de Gas",
    status: "pending",
  },
];

export default function AutoUpdatePage() {
  const [scanning, setScanning] = useState(false);
  const [updates, setUpdates] = useState(INITIAL_DETECTED_UPDATES);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const handleScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
    }, 2000);
  };

  const handleGenerateAndPublish = (id: string) => {
    setGeneratingId(id);
    setTimeout(() => {
      // Marcar o status como publicado
      setUpdates((prev) =>
        prev.map((up) => (up.id === id ? { ...up, status: "published" } : up))
      );
      setGeneratingId(null);
    }, 2000);
  };

  return (
    <div className="space-y-8 workspace-page-container">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-indigo-400" />
            Atualização Automática (Daily Engine)
          </h1>
          <p className="text-sm text-slate-400">
            A IA monitoriza repositórios de código e publicações científicas diariamente, sugerindo e gerando novas aulas práticas.
          </p>
        </div>

        <button
          onClick={handleScan}
          disabled={scanning}
          className="inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all disabled:opacity-50"
        >
          {scanning ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              A Scanear Fontes...
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              Scanear Agora
            </>
          )}
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Fontes Monitorizadas */}
        <div className="border border-slate-900 bg-slate-900/10 rounded-3xl p-6 space-y-4 self-start">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <GitBranch className="h-4.5 w-4.5 text-indigo-400" />
            Fontes Ativas (Scanners)
          </h3>

          <div className="space-y-3">
            {MOCK_SCAN_SOURCES.map((source, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-slate-950 border border-slate-900 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-200 block">{source.name}</span>
                  <span className="text-[10px] text-slate-500">Último scan: {source.lastScan}</span>
                </div>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
            ))}
          </div>
        </div>

        {/* Novidades Detetadas */}
        <div className="lg:col-span-2 border border-slate-900 bg-slate-900/10 rounded-3xl p-6 space-y-6">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Terminal className="h-4.5 w-4.5 text-cyan-400" />
            Novidades Pendentes de Verificação
          </h3>

          <div className="space-y-4">
            {updates.map((update) => (
              <div key={update.id} className="p-5 rounded-2xl bg-slate-950 border border-slate-900 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[9px] px-2 py-0.5 rounded bg-slate-900 text-indigo-400 border border-slate-800 font-mono">
                    {update.source}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-white cursor-pointer">
                    Release Oficial
                    <ExternalLink className="h-3 w-3" />
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-white">{update.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{update.description}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Módulo Gerado por IA</span>
                    <span className="block font-bold text-slate-200">{update.generatedModule}</span>
                  </div>

                  {update.status === "published" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/10 text-emerald-400 font-semibold">
                      <Check className="h-4 w-4" />
                      Publicado
                    </span>
                  ) : (
                    <button
                      onClick={() => handleGenerateAndPublish(update.id)}
                      disabled={generatingId !== null}
                      className="inline-flex items-center justify-center gap-1 h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors"
                    >
                      {generatingId === update.id ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          A Publicar...
                        </>
                      ) : (
                        <>
                          Validar & Publicar
                          <ArrowRight className="h-3.5 w-3.5" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
