import React from "react";
import { headers, cookies } from "next/headers";
import { getActiveTenantBranding } from "@/lib/tenant";
import { getDb } from "@/lib/mongodb";
import { auth } from "@clerk/nextjs/server";
import HRDashboardClient from "./hr-client";

export default async function HRDashboardPage() {
  const headersList = await headers();
  const tenantId = headersList.get("x-tenant-id") || "root";
  const branding = await getActiveTenantBranding(tenantId);
  const { userId } = await auth();

  // Ler o cookie de papel ativo
  const cookiesList = await cookies();
  const activeRole = cookiesList.get("active-role")?.value || "ALUNO";

  // 1. Conetar à Base de Dados e carregar dados reais do Inquilino
  const db = await getDb();
  
  // Converter cursor para objetos planos
  const progressRaw = await db.collection("user_progress").find({ tenantId }).toArray();
  const progressList = progressRaw.map((p: any) => ({
    ...p,
    _id: p._id.toString()
  }));

  const logsRaw = await db.collection("cognitive_logs").find({ tenantId }).toArray();
  const cognitiveLogs = logsRaw.map((l: any) => ({
    ...l,
    _id: l._id.toString()
  }));

  // 2. Estatísticas Globais de Acessos para ADMIN/SUPORTE (Requisito do Utilizador)
  const isAdminOrSupport = activeRole === "ADMIN" || activeRole === "SUPORTE";
  let globalStats: any = null;

  if (isAdminOrSupport) {
    const allUsers = await db.collection("users").find({}).toArray();
    const allCompanies = await db.collection("tenants").find({}).toArray();
    const rootSettings = await db.collection("tenant_settings").findOne({ tenant_id: "root" });
    const rootCompanyName = rootSettings?.companyName || "MOZAI Global";

    // Suporte da empresa dona da plataforma (perfil SUPORTE em tenantId 'root')
    const supportUsersCount = allUsers.filter((u: any) =>
      u.tenants?.some((t: any) => t.tenantId === "root" && t.roles.includes("SUPORTE"))
    ).length;

    // Gestores de Empresa
    const gestoresEmpresa = allUsers.filter((u: any) =>
      u.tenants?.some((t: any) => t.roles.includes("GESTOR_EMPRESA"))
    ).map((u: any) => {
      const tenantMap = u.tenants.find((t: any) => t.roles.includes("GESTOR_EMPRESA"));
      const companyId = tenantMap?.tenantId;
      const company = allCompanies.find((c: any) => c._id.toString() === companyId);
      return {
        userName: `${u.firstName} ${u.lastName}`.trim(),
        email: u.email,
        companyName: companyId === "root" ? rootCompanyName : (company?.name || `Empresa (${companyId || "Desconhecido"})`)
      };
    });

    // Gestores Académicos
    const academicManagersCount = allUsers.filter((u: any) =>
      u.tenants?.some((t: any) => t.roles.includes("GESTOR_ACADEMICO"))
    ).length;

    // Professores
    const professorsCount = allUsers.filter((u: any) =>
      u.tenants?.some((t: any) => t.roles.includes("PROFESSOR"))
    ).length;

    // Formadores
    const trainersCount = allUsers.filter((u: any) =>
      u.tenants?.some((t: any) => t.roles.includes("FORMADOR"))
    ).length;

    // Tutores
    const tutorsCount = allUsers.filter((u: any) =>
      u.tenants?.some((t: any) => t.roles.includes("TUTOR"))
    ).length;

    // Financeiro
    const financeCount = allUsers.filter((u: any) =>
      u.tenants?.some((t: any) => t.roles.includes("FINANCEIRO"))
    ).length;

    globalStats = {
      supportUsersCount,
      gestoresEmpresa,
      academicManagersCount,
      professorsCount,
      trainersCount,
      tutorsCount,
      financeCount
    };
  }

  return (
    <HRDashboardClient
      initialProgress={progressList}
      initialCognitiveLogs={cognitiveLogs}
      tenantId={tenantId}
      companyName={branding.companyName}
      brandColor={branding.brandColor}
      userId={userId || ""}
      globalStats={globalStats}
      activeRole={activeRole}
    />
  );
}
