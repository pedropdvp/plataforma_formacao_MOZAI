"use client";

import React, { useState } from "react";
import { SignIn } from "@clerk/nextjs";
import { useSignIn } from "@clerk/nextjs/legacy";
import { ShieldCheck, Mail, Loader2, ArrowRight } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

export default function SignInPage() {
  const { signIn, isLoaded } = useSignIn();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"standard" | "sso">("standard");

  // Estados SSO
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const handleSsoCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@") || !isLoaded) return;

    setLoading(true);
    setStatusMessage("A pesquisar domínio nos registos do WorkOS...");

    try {
      // 1. Descoberta de organização por domínio (real, via WorkOS) — só para mostrar
      // ao utilizador a que empresa vai ligar-se e definir o tenant antes do redirecionamento.
      const res = await fetch("/api/auth/sso-discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast(data.message || "Este domínio não possui conexão SSO configurada.", "warning");
        setLoading(false);
        return;
      }

      // Guarda o tenant descoberto antes de sair para o IdP — a sessão real só é criada
      // no callback (/sso-callback), este cookie só define o isolamento de dados a usar
      // assim que o Clerk confirmar a sessão.
      document.cookie = `x-tenant-id=${data.tenantId}; path=/; max-age=86400`;
      setStatusMessage(`A redirecionar para o login da ${data.organizationName}...`);

      // 2. Login real via Enterprise SSO do Clerk (SAML/OIDC) — o Clerk redireciona para
      // o Identity Provider real da empresa (Okta, Azure AD, etc.) configurado no painel
      // do Clerk para este domínio, e volta a /sso-callback com uma sessão verdadeira.
      await signIn.authenticateWithRedirect({
        strategy: "enterprise_sso",
        identifier: email,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/dashboard",
      });
    } catch (err: any) {
      console.error(err);
      const message =
        err?.errors?.[0]?.message ||
        "Não foi possível iniciar o SSO. Verifique se a sua organização tem uma ligação Enterprise SSO configurada no Clerk para este domínio.";
      showToast(message, "error");
      setLoading(false);
    }
  };

  const handleResetSso = () => {
    // Reset para voltar a conta "root" global
    document.cookie = "x-tenant-id=root; path=/; max-age=86400";
    showToast("Empresa redefinida para MOZAI Global.", "info");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 flex flex-col items-center">
        {/* Brand */}
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-400">
            MOZAI
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Aceda ao seu Sistema Operativo de Aprendizagem
          </p>
        </div>

        {/* Tab Selection */}
        <div className="w-full grid grid-cols-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("standard")}
            className={`py-2 px-4 rounded-xl transition-all ${
              activeTab === "standard"
                ? "bg-slate-950 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Acesso Geral
          </button>
          <button
            onClick={() => setActiveTab("sso")}
            className={`py-2 px-4 rounded-xl transition-all ${
              activeTab === "sso"
                ? "bg-slate-950 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            SSO Corporativo
          </button>
        </div>

        <div className="w-full mt-6">
          {activeTab === "standard" ? (
            <SignIn
              appearance={{
                variables: {
                  colorPrimary: "#6366f1",
                  colorBackground: "#0f172a",
                },
              }}
            />
          ) : (
            <div className="border border-slate-900 bg-slate-900/10 rounded-3xl p-6 space-y-6">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="h-4.5 w-4.5 text-indigo-400" />
                  SSO Enterprise Login
                </h3>
                <p className="text-[11px] text-slate-500">
                  Faça login de forma segura utilizando as credenciais de e-mail da sua organização parceira.
                </p>
              </div>

              {!loading ? (
                <form onSubmit={handleSsoCheck} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      E-mail Corporativo
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nome@empresa.com"
                      className="w-full h-11 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none transition-colors"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !isLoaded}
                    className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all disabled:opacity-50"
                  >
                    Verificar Domínio SSO
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </form>
              ) : (
                <div className="p-8 text-center flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
                  <span className="block text-xs font-bold text-white">{statusMessage}</span>
                </div>
              )}

              {/* Botão de reset rápido do cookie */}
              <div className="pt-4 border-t border-slate-900/60 text-center">
                <button
                  onClick={handleResetSso}
                  className="text-[10px] text-slate-500 hover:text-slate-400 hover:underline"
                >
                  Limpar Empresa Ativa (Voltar à MOZAI Global)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
