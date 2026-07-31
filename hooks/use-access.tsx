"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

interface AccessContextProps {
  activeRole: string | null;
  assignedRoles: string[];
  permissions: string[];
  isLoading: boolean;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  changeActiveRole: (role: string) => Promise<boolean>;
}

const AccessContext = createContext<AccessContextProps | undefined>(undefined);

export function AccessProvider({ children }: { children: React.ReactNode }) {
  // userId do Clerk (não confundir com o nosso userId de BD, guardado à parte no estado
  // abaixo) — serve só de "gatilho" para saber quando o estado de autenticação mudou.
  const { userId: clerkUserId, isLoaded: isClerkLoaded } = useAuth();
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [assignedRoles, setAssignedRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Carregar dados de sessão do utilizador
  const fetchSession = async () => {
    try {
      const res = await fetch("/api/auth/session");
      if (res.ok) {
        const data = await res.json();
        setActiveRole(data.activeRole || null);
        setAssignedRoles(data.assignedRoles || []);
        setPermissions(data.permissions || []);
        setUserId(data.userId || null);
        setUserName(data.userName || null);
        setUserEmail(data.userEmail || null);
      } else {
        // Sem sessão válida (ex: acabou de terminar sessão) — limpa tudo em vez de deixar
        // dados da conta anterior presos no estado.
        setActiveRole(null);
        setAssignedRoles([]);
        setPermissions([]);
        setUserId(null);
        setUserName(null);
        setUserEmail(null);
      }
    } catch (error) {
      console.error("Erro ao carregar permissões da sessão:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Volta a pedir a sessão sempre que o estado de autenticação do Clerk mudar (login,
  // logout, troca de conta) — antes só corria uma vez ao montar, o que deixava o nome/e-mail
  // presos no fallback genérico ("Utilizador MOZAI") quando o login acontecia depois do
  // primeiro render (ex: registo novo, ou sessão que arranca antes do Clerk carregar), já
  // que o AccessProvider vive no layout raiz e nunca desmonta entre páginas.
  useEffect(() => {
    if (!isClerkLoaded) return;
    fetchSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClerkLoaded, clerkUserId]);

  // Verificar se o utilizador possui determinada permissão
  const hasPermission = (permission: string) => {
    // ADMIN e SUPORTE têm acesso total de segurança
    if (activeRole === "ADMIN" || activeRole === "SUPORTE") return true;
    return permissions.includes(permission);
  };

  // Verificar se o utilizador possui determinado perfil ativo
  const hasRole = (role: string) => {
    return activeRole === role;
  };

  // Alterar o perfil de acesso ativo
  const changeActiveRole = async (role: string) => {
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role })
      });
      if (res.ok) {
        setActiveRole(role);
        // Atualizar permissões após a troca de papel
        await fetchSession();
        return true;
      }
    } catch (error) {
      console.error("Erro ao alterar papel ativo:", error);
    }
    return false;
  };

  return (
    <AccessContext.Provider
      value={{
        activeRole,
        assignedRoles,
        permissions,
        isLoading,
        userId,
        userName,
        userEmail,
        hasPermission,
        hasRole,
        changeActiveRole
      }}
    >
      {children}
    </AccessContext.Provider>
  );
}

export function useAccess() {
  const context = useContext(AccessContext);
  if (context === undefined) {
    throw new Error("useAccess tem de ser utilizado dentro de um AccessProvider");
  }
  return context;
}
