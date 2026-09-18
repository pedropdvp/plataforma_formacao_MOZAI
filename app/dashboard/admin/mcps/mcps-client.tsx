"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Plug, RefreshCw, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { isStale, reportAgeMinutes, summarize, type McpProbe } from "@/lib/mcp-status";

interface Relatorio {
  host: string;
  checkedAt: string;
  receivedAt: string;
  servers: McpProbe[];
}

const ESTADO = {
  ok: { texto: "A responder", cor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", Icone: CheckCircle2 },
  falhou: { texto: "Falhou", cor: "text-rose-400 bg-rose-500/10 border-rose-500/20", Icone: XCircle },
  ignorado: { texto: "Ignorado", cor: "text-slate-400 bg-slate-500/10 border-slate-500/20", Icone: AlertTriangle },
} as const;

function descreveIdade(minutos: number | null): string {
  if (minutos === null) return "data desconhecida";
  if (minutos < 1) return "agora mesmo";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

export default function McpsClient() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [relatorios, setRelatorios] = useState<Relatorio[]>([]);
  const [configurado, setConfigurado] = useState(true);

  const carregar = (silencioso = false) => {
    if (!silencioso) setLoading(true);
    fetch("/api/admin/mcp-status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setRelatorios(data.reports || []);
        setConfigurado(!!data.configured);
      })
      .catch(() => showToast("Erro ao ler o estado dos MCP.", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Plug className="h-5 w-5 text-orange-400" />
            <h1 className="text-xl font-bold text-white">Servidores MCP</h1>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            Estado dos servidores MCP configurados nas máquinas de quem desenvolve. A plataforma
            corre em serverless e não vê essas máquinas: quem verifica é o comando{" "}
            <code className="text-slate-300">npm run mcp:check -- --publish</code>, que arranca cada
            servidor, faz o handshake do protocolo e envia para aqui o resultado. O que chega são
            nomes, versões e erros — nunca comandos nem chaves.
          </p>
        </div>
        <button
          onClick={() => carregar(true)}
          className="h-9 px-4 rounded-xl border border-slate-800 hover:bg-slate-900 text-xs font-semibold text-slate-300 flex items-center gap-2 transition-colors cursor-pointer shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Recarregar
        </button>
      </header>

      {!configurado && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-1.5">
          <p className="text-xs font-semibold text-amber-400">Recolha por configurar</p>
          <p className="text-[11px] leading-relaxed text-slate-400">
            Falta a variável <code className="text-slate-300">MCP_STATUS_TOKEN</code> no servidor. Sem
            ela, a rota que recebe os relatórios responde 503 e esta página fica sempre vazia.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
          <span className="text-xs font-semibold">A carregar...</span>
        </div>
      ) : relatorios.length === 0 ? (
        <div className="rounded-2xl border border-slate-900 bg-slate-950/40 p-8 text-center space-y-3">
          <p className="text-sm text-slate-300 font-semibold">Ainda não chegou nenhum relatório</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Na máquina onde os MCP estão configurados, correr{" "}
            <code className="text-slate-300">npm run mcp:check -- --publish</code>. Sem argumentos, o
            mesmo comando mostra a tabela no terminal sem enviar nada.
          </p>
        </div>
      ) : (
        relatorios.map((relatorio) => {
          const resumo = summarize(relatorio.servers);
          const idade = reportAgeMinutes(relatorio.checkedAt);
          const velho = isStale(relatorio.checkedAt);

          return (
            <section key={relatorio.host} className="rounded-2xl border border-slate-900 bg-slate-950/40 overflow-hidden">
              <div className="p-5 border-b border-slate-900 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-white">{relatorio.host}</h2>
                  <p className={`text-[11px] ${velho ? "text-amber-400" : "text-slate-500"}`}>
                    Verificado {descreveIdade(idade)}
                    {velho && " — o estado pode já não ser este"}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="text-emerald-400 font-semibold">{resumo.ok} a responder</span>
                  {resumo.falhou > 0 && <span className="text-rose-400 font-semibold">{resumo.falhou} a falhar</span>}
                  {resumo.ignorado > 0 && <span className="text-slate-400">{resumo.ignorado} ignorados</span>}
                </div>
              </div>

              <div className="divide-y divide-slate-900/60">
                {relatorio.servers.map((servidor) => {
                  const estado = ESTADO[servidor.state] ?? ESTADO.falhou;
                  const Icone = estado.Icone;
                  return (
                    <div key={servidor.name} className="p-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider shrink-0 ${estado.cor}`}>
                        <Icone className="h-3 w-3" />
                        {estado.texto}
                      </span>
                      <span className="font-mono text-xs text-white font-semibold min-w-[10rem]">{servidor.name}</span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">{servidor.transport}</span>
                      {servidor.tools !== null && (
                        <span className="text-[11px] text-slate-400">{servidor.tools} ferramentas</span>
                      )}
                      {servidor.durationMs !== null && (
                        <span className="text-[11px] text-slate-600">{(servidor.durationMs / 1000).toFixed(1)}s</span>
                      )}
                      {servidor.detail && (
                        <span className="text-[11px] text-slate-500 basis-full sm:basis-auto sm:ml-auto sm:text-right break-words">
                          {servidor.detail}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
