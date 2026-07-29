"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

/**
 * Callback do SSO Enterprise (SAML/OIDC) do Clerk — para onde o Identity Provider da
 * empresa (Okta, Azure AD, Google Workspace, etc.) redireciona depois de autenticar o
 * utilizador. O Clerk valida a resposta e cria a sessão real aqui; nada disto é simulado.
 */
export default function SsoCallbackPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 gap-4">
      <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
      <p className="text-sm text-slate-400">A concluir a autenticação SSO...</p>
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/dashboard"
        signUpFallbackRedirectUrl="/dashboard"
      />
    </div>
  );
}
