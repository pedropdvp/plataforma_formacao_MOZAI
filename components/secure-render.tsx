"use client";

import React from "react";
import { useAccess } from "@/hooks/use-access";

interface SecureRenderProps {
  requiredPermission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function SecureRender({
  requiredPermission,
  children,
  fallback = null
}: SecureRenderProps) {
  const { hasPermission, isLoading } = useAccess();

  if (isLoading) {
    return null; // Oculta o elemento temporariamente durante o carregamento das credenciais
  }

  if (!hasPermission(requiredPermission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
