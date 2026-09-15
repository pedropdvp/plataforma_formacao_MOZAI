"use client";

import React, { useEffect, useState } from "react";
import { KeyRound, Loader2, AlertTriangle, Eye, Copy, ShieldAlert } from "lucide-react";
import { useAccess } from "@/hooks/use-access";
import { useToast } from "@/components/ui/toast-provider";

interface EnvVarReport {
  key: string;
  status: "definida" | "vazia" | "em-falta";
  publicToBrowser: boolean;
  preview: string | null;
  length: number;
  avisos: string[];
}

/** Ao fim de quantos segundos um valor revelado desaparece do ecrã. Um segredo não fica
 *  atrás numa aba esquecida enquanto o computador anda pela sala. */
const SEGUNDOS_VISIVEL = 30;

const CORES: Record<EnvVarReport["status"], string> = {
  definida: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  vazia: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "em-falta": "text-rose-400 bg-rose-500/10 border-rose-500/20",
};

export default function EnvCheckPage() {
  const { activeRole } = useAccess();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [variaveis, setVariaveis] = useState<EnvVarReport[]>([]);
  const [ambiente, setAmbiente] = useState("");
  const [origem, setOrigem] = useState("");
  const [revelacaoDisponivel, setRevelacaoDisponivel] = useState(false);
  const [revelada, setRevelada] = useState<{ key: string; value: string } | null>(null);
  const [aRevelar, setARevelar] = useState<string | null>(null);

  const isAdmin = activeRole === "ADMIN";

  useEffect(() => {
    // Sem sair do estado de carregamento de propósito: quem não é ADMIN vê a mensagem de
    // acesso negado antes de o `loading` ser sequer consultado no render.
    if (!isAdmin) return;
    fetch("/api/admin/env-check")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setVariaveis(data.variaveis || []);
        setAmbiente(data.ambiente || "");
        setOrigem(data.origem || "");
        setRevelacaoDisponivel(!!data.revelacaoDisponivel);
      })
      .catch(() => showToast("Erro ao ler as variáveis de ambiente.", "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // O valor revelado apaga-se sozinho — ver SEGUNDOS_VISIVEL.
  useEffect(() => {
    if (!revelada) return;
    const timer = setTimeout(() => setRevelada(null), SEGUNDOS_VISIVEL * 1000);
    return () => clearTimeout(timer);
  }, [revelada]);

  const revelar = async (key: string) => {
    const confirmado = window.confirm(
      `Revelar o valor completo de ${key}?\n\n` +
        `Fica registado em auditoria quem o revelou e quando. Se estiver num computador ` +
        `que não é seu, rode esta chave depois da apresentação.`
    );
    if (!confirmado) return;

    setARevelar(key);
    try {
      const res = await fetch(`/api/admin/env-check/${key}/reveal`, { method: "POST" });
      const data = await res.json();
      if (res.ok && typeof data.value === "string") {
        setRevelada({ key, value: data.value });
      } else {
        showToast(data.error || "Não foi possível revelar o valor.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao revelar o valor.", "error");
    } finally {
      setARevelar(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-4 workspace-page-container">
        <p className="text-xs text-slate-500 italic py-4">
          Esta página é exclusiva do perfil Administrador.
        </p>
      </div>
    );
  }

  const comAvisos = variaveis.filter((v) => v.avisos.length > 0);
  const emFalta = variaveis.filter((v) => v.status === "em-falta");

  return (
    <div className="space-y-6 workspace-page-container">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <KeyRound className="h-6 w-6 text-indigo-400" />
          Variáveis de Ambiente
        </h1>
        <p className="text-sm text-slate-400">
          Diagnóstico do ambiente <strong className="text-slate-300">{ambiente}</strong>. Mostra o
          estado de cada variável e uma máscara do valor — os valores completos nunca são
          listados. Catálogo lido de {origem}.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">A inspecionar o ambiente...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Cartao label="Variáveis" valor={variaveis.length} />
            <Cartao label="Definidas" valor={variaveis.filter((v) => v.status === "definida").length} />
            <Cartao label="Em falta" valor={emFalta.length} destaque={emFalta.length > 0} />
            <Cartao label="Com avisos" valor={comAvisos.length} destaque={comAvisos.length > 0} />
          </div>

          {comAvisos.length > 0 && (
            <div className="border border-amber-500/20 bg-amber-500/5 rounded-2xl p-4 space-y-2">
              <h2 className="text-xs font-bold text-amber-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Problemas detetados
              </h2>
              {comAvisos.map((v) => (
                <div key={v.key} className="text-[11px] text-slate-300">
                  <span className="font-mono font-bold">{v.key}</span>
                  {v.avisos.map((a) => (
                    <p key={a} className="text-slate-400 ml-1">
                      — {a}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}

          {revelada && (
            <div className="border border-rose-500/30 bg-rose-500/5 rounded-2xl p-4 space-y-2">
              <h2 className="text-xs font-bold text-rose-400 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" /> {revelada.key} — visível durante {SEGUNDOS_VISIVEL}s
              </h2>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[11px] text-white bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 break-all font-mono">
                  {revelada.value}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(revelada.value);
                    showToast("Valor copiado.", "success");
                  }}
                  className="h-9 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                Esta revelação ficou registada em auditoria. Se estiver num computador que não é
                seu, rode esta chave depois de terminar.
              </p>
            </div>
          )}

          <div className="border border-slate-900 bg-slate-950/40 rounded-2xl overflow-hidden">
            {variaveis.map((v) => (
              <div
                key={v.key}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-900 last:border-b-0"
              >
                <span className="font-mono text-[11px] text-slate-200 flex-1 truncate" title={v.key}>
                  {v.key}
                </span>
                {v.publicToBrowser && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded border border-slate-800 text-slate-500 shrink-0">
                    browser
                  </span>
                )}
                <span className="font-mono text-[10px] text-slate-500 w-32 truncate text-right shrink-0">
                  {v.preview ?? "—"}
                </span>
                <span
                  className={`text-[9px] px-2 py-0.5 rounded-full border shrink-0 w-16 text-center ${CORES[v.status]}`}
                >
                  {v.status}
                </span>
                {revelacaoDisponivel && v.status === "definida" && !v.publicToBrowser && (
                  <button
                    onClick={() => revelar(v.key)}
                    disabled={aRevelar === v.key}
                    title={`Revelar o valor de ${v.key}`}
                    className="h-6 px-2 rounded-lg text-[10px] text-slate-500 hover:text-rose-400 flex items-center gap-1 cursor-pointer disabled:opacity-55 shrink-0"
                  >
                    {aRevelar === v.key ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                    Revelar
                  </button>
                )}
              </div>
            ))}
          </div>

          {!revelacaoDisponivel && (
            <p className="text-[11px] text-slate-500">
              Para poder revelar valores completos, defina <code className="font-mono">VERCEL_API_TOKEN</code> e{" "}
              <code className="font-mono">VERCEL_PROJECT_ID</code>. Cada revelação é individual, limitada a
              uma por minuto e registada em auditoria.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Cartao({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div
      className={`border rounded-2xl p-3.5 ${
        destaque ? "border-amber-500/20 bg-amber-500/5" : "border-slate-900 bg-slate-950/40"
      }`}
    >
      <span className={`block text-lg font-extrabold ${destaque ? "text-amber-400" : "text-white"}`}>
        {valor}
      </span>
      <span className="block text-[10px] text-slate-500 mt-0.5">{label}</span>
    </div>
  );
}
