"use client";

import React, { useEffect, useState } from "react";
import { Cloud, Loader2, Database, Server, Calculator, CheckCircle2, XCircle, Info } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

interface AwsStatus {
  configured: boolean;
  valid?: boolean;
  account?: string;
  arn?: string;
  region?: string;
  error?: string;
}

interface Bucket {
  name: string;
  createdAt: string;
}
interface Instance {
  id: string;
  type: string;
  state: string;
  az: string;
}

export default function CloudLabPage() {
  const { showToast } = useToast();
  const [status, setStatus] = useState<AwsStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [saving, setSaving] = useState(false);

  const [buckets, setBuckets] = useState<Bucket[] | null>(null);
  const [instances, setInstances] = useState<Instance[] | null>(null);
  const [loadingResources, setLoadingResources] = useState(false);

  const [pricing, setPricing] = useState<Record<string, number>>({});
  const [costInstanceType, setCostInstanceType] = useState("t3.medium");
  const [costQuantity, setCostQuantity] = useState(1);
  const [costResult, setCostResult] = useState<{ monthlyUsd: number; note: string } | null>(null);
  const [calculatingCost, setCalculatingCost] = useState(false);

  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/cloud-lab/aws/credentials");
      const data = await res.json();
      if (res.ok) setStatus(data);
    } catch {
      // silencioso
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadStatus();
    fetch("/api/cloud-lab/cost-estimate")
      .then((res) => res.json())
      .then((data) => setPricing(data.pricing || {}))
      .catch(() => {});
  }, []);

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessKeyId.trim() || !secretAccessKey.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/cloud-lab/aws/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessKeyId: accessKeyId.trim(), secretAccessKey: secretAccessKey.trim(), region }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Credenciais AWS guardadas.", "success");
        setAccessKeyId("");
        setSecretAccessKey("");
        loadStatus();
      } else {
        showToast(data.error || "Erro ao guardar as credenciais.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao guardar as credenciais.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleLoadResources = async () => {
    setLoadingResources(true);
    setBuckets(null);
    setInstances(null);
    try {
      const res = await fetch("/api/cloud-lab/aws/resources");
      const data = await res.json();
      if (res.ok) {
        setBuckets(data.buckets);
        setInstances(data.instances);
        if (data.bucketsError) showToast(`S3: ${data.bucketsError}`, "error");
        if (data.instancesError) showToast(`EC2: ${data.instancesError}`, "error");
      } else {
        showToast(data.error || "Erro ao listar recursos.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao listar recursos.", "error");
    } finally {
      setLoadingResources(false);
    }
  };

  const handleCalculateCost = async () => {
    setCalculatingCost(true);
    setCostResult(null);
    try {
      const res = await fetch("/api/cloud-lab/cost-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceType: costInstanceType, quantity: costQuantity }),
      });
      const data = await res.json();
      if (res.ok) {
        setCostResult(data);
      } else {
        showToast(data.error || "Erro ao calcular o custo.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao calcular o custo.", "error");
    } finally {
      setCalculatingCost(false);
    }
  };

  return (
    <div className="space-y-8 workspace-page-container">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Cloud className="h-6 w-6 text-sky-400" />
          Cloud Lab
        </h1>
        <p className="text-sm text-slate-400">
          Ligue a sua própria conta AWS (só leitura) para explorar recursos reais e estime custos com preços de referência publicados.
        </p>
      </div>

      <div className="border border-amber-500/20 bg-amber-500/5 rounded-2xl p-4 flex items-start gap-2.5">
        <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-200 leading-relaxed">
          <strong>Nota de segurança:</strong> use sempre um utilizador IAM dedicado com permissões
          <strong> só de leitura</strong> (ex: política gerida <code>ReadOnlyAccess</code>), nunca as
          credenciais raiz da sua conta AWS. Este laboratório nunca cria, altera nem apaga recursos.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-5 space-y-3">
          <h3 className="font-bold text-sm text-white">Ligação AWS</h3>
          {loadingStatus ? (
            <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
          ) : status?.configured ? (
            <div className="space-y-1.5">
              {status.valid ? (
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Credenciais válidas</span>
              ) : (
                <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5"><XCircle className="h-4 w-4" /> Credenciais inválidas</span>
              )}
              {status.account && <span className="text-[10px] text-slate-500 block">Conta: {status.account}</span>}
              {status.arn && <span className="text-[10px] text-slate-500 block break-all">{status.arn}</span>}
              <span className="text-[10px] text-slate-500 block">Região: {status.region}</span>
              {status.error && <span className="text-[10px] text-rose-400 block">{status.error}</span>}
            </div>
          ) : (
            <form onSubmit={handleSaveCredentials} className="space-y-2">
              <input
                value={accessKeyId}
                onChange={(e) => setAccessKeyId(e.target.value)}
                placeholder="Access Key ID"
                className="w-full h-9 px-3 rounded-lg border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
              />
              <input
                type="password"
                value={secretAccessKey}
                onChange={(e) => setSecretAccessKey(e.target.value)}
                placeholder="Secret Access Key"
                className="w-full h-9 px-3 rounded-lg border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
              />
              <input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Região (ex: us-east-1)"
                className="w-full h-9 px-3 rounded-lg border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={saving}
                className="w-full h-9 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ligar Conta"}
              </button>
            </form>
          )}
        </div>

        <div className="lg:col-span-2 border border-slate-900 bg-slate-950/40 rounded-3xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-white">Recursos Reais</h3>
            <button
              onClick={handleLoadResources}
              disabled={loadingResources || !status?.configured}
              className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[11px] font-semibold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loadingResources ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Listar Recursos"}
            </button>
          </div>

          {buckets !== null && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Database className="h-3.5 w-3.5" /> Buckets S3 ({buckets.length})</span>
              {buckets.length === 0 ? (
                <span className="text-[11px] text-slate-600 italic">Nenhum bucket encontrado nesta conta.</span>
              ) : (
                buckets.map((b) => (
                  <div key={b.name} className="text-[11px] text-slate-300 px-2.5 py-1.5 rounded-lg bg-slate-900/40 flex justify-between">
                    <span>{b.name}</span>
                    <span className="text-slate-500">{new Date(b.createdAt).toLocaleDateString("pt-PT")}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {instances !== null && (
            <div className="space-y-1.5 pt-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Server className="h-3.5 w-3.5" /> Instâncias EC2 ({instances.length})</span>
              {instances.length === 0 ? (
                <span className="text-[11px] text-slate-600 italic">Nenhuma instância encontrada nesta região.</span>
              ) : (
                instances.map((i) => (
                  <div key={i.id} className="text-[11px] text-slate-300 px-2.5 py-1.5 rounded-lg bg-slate-900/40 flex justify-between">
                    <span>{i.id} ({i.type})</span>
                    <span className={i.state === "running" ? "text-emerald-400" : "text-slate-500"}>{i.state}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-5 space-y-3">
        <h3 className="font-bold text-sm text-white flex items-center gap-2"><Calculator className="h-4.5 w-4.5 text-indigo-400" /> Calculadora de Custos (referência)</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <select
            value={costInstanceType}
            onChange={(e) => setCostInstanceType(e.target.value)}
            className="h-9 px-3 rounded-lg border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
          >
            {Object.keys(pricing).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={1000}
            value={costQuantity}
            onChange={(e) => setCostQuantity(parseInt(e.target.value) || 1)}
            className="h-9 px-3 rounded-lg border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={handleCalculateCost}
            disabled={calculatingCost}
            className="h-9 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
          >
            {calculatingCost ? <Loader2 className="h-4 w-4 animate-spin" /> : "Calcular"}
          </button>
        </div>
        {costResult && (
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-900 space-y-1">
            <span className="text-lg font-bold text-emerald-400">${costResult.monthlyUsd} / mês</span>
            <p className="text-[10px] text-slate-500">{costResult.note}</p>
          </div>
        )}
      </div>
    </div>
  );
}
