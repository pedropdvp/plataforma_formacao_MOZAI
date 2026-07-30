"use client";

import React, { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { Boxes, Loader2, Play, Rocket, Wallet, CheckCircle2, XCircle, Info, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

const DEFAULT_CODE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MeuArmazem {
    uint256 public valor;
    address public dono;

    event ValorAlterado(uint256 novoValor);

    constructor() {
        dono = msg.sender;
        valor = 0;
    }

    function definirValor(uint256 novoValor) public {
        valor = novoValor;
        emit ValorAlterado(novoValor);
    }
}`;

interface CompileResult {
  success: boolean;
  contractName?: string;
  abi?: any[];
  bytecode?: string;
  errors: string[];
  warnings: string[];
}

interface WalletStatus {
  configured: boolean;
  address?: string;
  balanceEth?: string;
  network?: string;
  faucetUrl?: string;
}

export default function BlockchainLabPage() {
  const { showToast } = useToast();
  const [code, setCode] = useState(DEFAULT_CODE);
  const [compiling, setCompiling] = useState(false);
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);

  const [wallet, setWallet] = useState<WalletStatus | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [privateKeyInput, setPrivateKeyInput] = useState("");
  const [savingWallet, setSavingWallet] = useState(false);

  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ contractAddress: string; explorerAddressUrl: string; explorerTxUrl: string | null } | null>(null);

  const [callFunction, setCallFunction] = useState("");
  const [callArgs, setCallArgs] = useState("");
  const [callResult, setCallResult] = useState<string | null>(null);
  const [calling, setCalling] = useState(false);

  const loadWallet = async () => {
    setLoadingWallet(true);
    try {
      const res = await fetch("/api/blockchain-lab/wallet");
      const data = await res.json();
      if (res.ok) setWallet(data);
    } catch {
      // silencioso
    } finally {
      setLoadingWallet(false);
    }
  };

  useEffect(() => {
    loadWallet();
  }, []);

  const handleCompile = async () => {
    setCompiling(true);
    setCompileResult(null);
    setDeployResult(null);
    try {
      const res = await fetch("/api/blockchain-lab/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (res.ok) {
        setCompileResult(data);
      } else {
        showToast(data.error || "Erro ao compilar.", "error");
      }
    } catch {
      showToast("Erro de comunicação com o compilador.", "error");
    } finally {
      setCompiling(false);
    }
  };

  const handleSaveWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!privateKeyInput.trim()) return;
    setSavingWallet(true);
    try {
      const res = await fetch("/api/blockchain-lab/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privateKey: privateKeyInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Carteira de testnet guardada.", "success");
        setPrivateKeyInput("");
        loadWallet();
      } else {
        showToast(data.error || "Erro ao guardar a carteira.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao guardar a carteira.", "error");
    } finally {
      setSavingWallet(false);
    }
  };

  const handleDeploy = async () => {
    if (!compileResult?.abi || !compileResult?.bytecode) return;
    setDeploying(true);
    setDeployResult(null);
    try {
      const res = await fetch("/api/blockchain-lab/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ abi: compileResult.abi, bytecode: compileResult.bytecode }),
      });
      const data = await res.json();
      if (res.ok) {
        setDeployResult(data);
        showToast("Contrato implantado na Sepolia!", "success");
        loadWallet();
      } else {
        showToast(data.error || "Erro ao implantar o contrato.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao implantar o contrato.", "error");
    } finally {
      setDeploying(false);
    }
  };

  const handleCallFunction = async (isReadOnly: boolean) => {
    if (!deployResult || !compileResult?.abi || !callFunction.trim()) return;
    setCalling(true);
    setCallResult(null);
    try {
      const parsedArgs = callArgs.trim() ? callArgs.split(",").map((a) => a.trim()) : [];
      const res = await fetch("/api/blockchain-lab/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          abi: compileResult.abi,
          contractAddress: deployResult.contractAddress,
          functionName: callFunction.trim(),
          args: parsedArgs,
          isReadOnly,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCallResult(isReadOnly ? data.result : `Transação confirmada: ${data.txHash}`);
        if (!isReadOnly) loadWallet();
      } else {
        showToast(data.error || "Erro ao chamar a função.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao chamar a função.", "error");
    } finally {
      setCalling(false);
    }
  };

  return (
    <div className="space-y-8 workspace-page-container">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Boxes className="h-6 w-6 text-indigo-400" />
          Blockchain Lab
        </h1>
        <p className="text-sm text-slate-400">
          Escreva, compile e implante contratos Solidity reais numa testnet pública (Sepolia).
        </p>
      </div>

      <div className="border border-amber-500/20 bg-amber-500/5 rounded-2xl p-4 flex items-start gap-2.5">
        <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-200/80 leading-relaxed">
          <strong>Nota de âmbito:</strong> este laboratório usa exclusivamente a testnet pública
          Sepolia — nunca a mainnet (dinheiro real). Use uma carteira criada só para testes, com
          ETH gratuito de um faucet público, nunca uma carteira com fundos verdadeiros. A
          compilação (solc) e a implantação são reais e verificáveis no Etherscan Sepolia.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Editor Solidity</span>
              <button
                onClick={handleCompile}
                disabled={compiling}
                className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              >
                {compiling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Compilar
              </button>
            </div>
            <CodeMirror value={code} height="320px" theme="dark" onChange={setCode} basicSetup={{ lineNumbers: true, foldGutter: true }} />
          </div>

          {compileResult && (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-2">
              {compileResult.success ? (
                <>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Compilado com sucesso: {compileResult.contractName}
                  </div>
                  {compileResult.warnings.length > 0 && (
                    <div className="text-[10px] text-amber-400 space-y-1">
                      {compileResult.warnings.map((w, i) => (
                        <pre key={i} className="whitespace-pre-wrap font-mono">{w}</pre>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={handleDeploy}
                    disabled={deploying || !wallet?.configured}
                    className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {deploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                    {deploying ? "A implantar..." : "Implantar na Sepolia"}
                  </button>
                  {!wallet?.configured && <span className="text-[10px] text-slate-500 block">Configure a carteira de testnet ao lado primeiro.</span>}
                </>
              ) : (
                <div className="space-y-1">
                  {compileResult.errors.map((e, i) => (
                    <pre key={i} className="text-[10px] text-rose-400 font-mono whitespace-pre-wrap">{e}</pre>
                  ))}
                </div>
              )}
            </div>
          )}

          {deployResult && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Contrato implantado
              </div>
              <span className="text-[11px] text-slate-300 font-mono block">{deployResult.contractAddress}</span>
              <div className="flex gap-3 text-[10px]">
                <a href={deployResult.explorerAddressUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline flex items-center gap-1">
                  Ver no Etherscan <ExternalLink className="h-3 w-3" />
                </a>
                {deployResult.explorerTxUrl && (
                  <a href={deployResult.explorerTxUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline flex items-center gap-1">
                    Ver transação <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              <div className="pt-3 border-t border-emerald-500/10 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chamar Função</span>
                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    value={callFunction}
                    onChange={(e) => setCallFunction(e.target.value)}
                    placeholder="Nome da função (ex: valor, definirValor)"
                    className="h-9 px-3 rounded-lg border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                  />
                  <input
                    value={callArgs}
                    onChange={(e) => setCallArgs(e.target.value)}
                    placeholder="Argumentos separados por vírgula (opcional)"
                    className="h-9 px-3 rounded-lg border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCallFunction(true)}
                    disabled={calling}
                    className="h-8 px-3 rounded-lg border border-slate-800 hover:bg-slate-900 text-[11px] font-semibold text-slate-300 cursor-pointer disabled:opacity-55"
                  >
                    Ler (grátis)
                  </button>
                  <button
                    onClick={() => handleCallFunction(false)}
                    disabled={calling}
                    className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[11px] font-semibold text-white cursor-pointer disabled:opacity-55"
                  >
                    {calling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Escrever (transação real)"}
                  </button>
                </div>
                {callResult && <pre className="text-[11px] text-slate-200 bg-black rounded-lg p-2.5 font-mono whitespace-pre-wrap">{callResult}</pre>}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-5 space-y-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Wallet className="h-4.5 w-4.5 text-indigo-400" /> Carteira de Testnet
            </h3>
            {loadingWallet ? (
              <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
            ) : wallet?.configured ? (
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500 block">Endereço</span>
                <span className="text-[11px] text-white font-mono break-all block">{wallet.address}</span>
                <span className="text-[10px] text-slate-500 block mt-2">Saldo ({wallet.network})</span>
                <span className="text-sm font-bold text-emerald-400">{wallet.balanceEth} ETH</span>
                {parseFloat(wallet.balanceEth || "0") === 0 && (
                  <a href={wallet.faucetUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-400 underline block">
                    Obter ETH de teste grátis (faucet)
                  </a>
                )}
              </div>
            ) : (
              <form onSubmit={handleSaveWallet} className="space-y-2">
                <span className="text-[10px] text-slate-500 block leading-relaxed">
                  Cole a chave privada de uma carteira <strong>só de testes</strong> (ex: criada no
                  MetaMask exclusivamente para a Sepolia).
                </span>
                <input
                  type="password"
                  value={privateKeyInput}
                  onChange={(e) => setPrivateKeyInput(e.target.value)}
                  placeholder="0x..."
                  className="w-full h-9 px-3 rounded-lg border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={savingWallet}
                  className="w-full h-9 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
                >
                  {savingWallet ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                  Guardar Carteira
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
