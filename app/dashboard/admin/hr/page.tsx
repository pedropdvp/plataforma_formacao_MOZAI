import React from "react";
import { getActiveTenantBranding } from "@/lib/tenant";
import { getDb } from "@/lib/mongodb";
import { requirePageAccess } from "@/lib/page-access";
import HRDashboardClient from "./hr-client";
import { getTenantId } from "@/lib/session";

export default async function HRDashboardPage() {
  // Antes de qualquer consulta: a página lê dados de todo o tenant — e, para a plataforma, de
  // todos os tenants —, por isso a guarda tem de correr primeiro.
  const { userId, activeRole } = await requirePageAccess("/dashboard/admin/hr");

  const tenantId = await getTenantId();
  const branding = await getActiveTenantBranding(tenantId);

  // 1. Conetar à Base de Dados e carregar dados reais do Inquilino
  const db = await getDb();
  
  // Converter cursor para objetos planos
  const progressRaw = await db.collection("user_progress").find({ tenant_id: tenantId }).toArray();
  const progressList = progressRaw.map((p: any) => ({
    ...p,
    _id: p._id.toString()
  }));

  const logsRaw = await db.collection("cognitive_logs").find({ tenant_id: tenantId }).toArray();
  const cognitiveLogs = logsRaw.map((l: any) => ({
    ...l,
    _id: l._id.toString()
  }));

  // Tentativas reais de quiz — alimentam o motor de pontuação contínua do Skills OS
  // (lib/skills-os.ts), reaproveitado aqui para o Gap Analysis deixar de usar números fixos.
  const quizAttemptsRaw = await db.collection("quiz_attempts").find({ tenant_id: tenantId }).toArray();
  const quizAttempts = quizAttemptsRaw.map((q: any) => ({ ...q, _id: q._id.toString() }));

  // 2. Estatísticas Globais de Acessos para ADMIN/SUPORTE (Requisito do Utilizador)
  const isAdminOrSupport = activeRole === "ADMIN" || activeRole === "SUPORTE";
  let globalStats: any = null;
  let globalTopTopics: string[] = [];

  if (isAdminOrSupport) {
    // Tendência real de dúvidas ao Tutor de IA em TODA a plataforma (todos os tenants) —
    // só calculada para quem tem visão global, para nunca misturar dados de outra empresa
    // na vista de um Gestor Empresa.
    const allCognitiveLogs = await db.collection("cognitive_logs").find({}).toArray();
    const globalTopicCounts: Record<string, number> = {};
    allCognitiveLogs.forEach((log: any) => {
      const topic = log.topic || (Array.isArray(log.topics) ? log.topics[0] : null);
      if (topic) globalTopicCounts[topic] = (globalTopicCounts[topic] || 0) + 1;
    });
    globalTopTopics = Object.entries(globalTopicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([topic]) => topic);
    const allUsers = await db.collection("users").find({}).toArray();
    const allCompanies = await db.collection("tenants").find({}).toArray();
    const rootSettings = await db.collection("tenant_settings").findOne({ tenant_id: "root" });
    const rootCompanyName = rootSettings?.companyName || "MOZAI Global";

    const mapUser = (u: any) => ({
      name: `${u.firstName} ${u.lastName}`.trim() || u.email,
      email: u.email
    });

    // Suporte da empresa dona da plataforma (perfil SUPORTE em tenantId 'root')
    const supportStaff = allUsers.filter((u: any) =>
      u.tenants?.some((t: any) => t.tenantId === "root" && t.roles.includes("SUPORTE"))
    ).map(mapUser);

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
    const academicManagers = allUsers.filter((u: any) =>
      u.tenants?.some((t: any) => t.roles.includes("GESTOR_ACADEMICO"))
    ).map(mapUser);

    // Professores
    const professors = allUsers.filter((u: any) =>
      u.tenants?.some((t: any) => t.roles.includes("PROFESSOR"))
    ).map(mapUser);

    // Formadores
    const trainers = allUsers.filter((u: any) =>
      u.tenants?.some((t: any) => t.roles.includes("FORMADOR"))
    ).map(mapUser);

    // Tutores
    const tutors = allUsers.filter((u: any) =>
      u.tenants?.some((t: any) => t.roles.includes("TUTOR"))
    ).map(mapUser);

    // Financeiro
    const finance = allUsers.filter((u: any) =>
      u.tenants?.some((t: any) => t.roles.includes("FINANCEIRO"))
    ).map(mapUser);

    globalStats = {
      supportUsersCount: supportStaff.length,
      supportStaff,
      gestoresEmpresa,
      academicManagersCount: academicManagers.length,
      academicManagers,
      professorsCount: professors.length,
      professors,
      trainersCount: trainers.length,
      trainers,
      tutorsCount: tutors.length,
      tutors,
      financeCount: finance.length,
      finance
    };
  }

  return (
    <HRDashboardClient
      initialProgress={progressList}
      initialCognitiveLogs={cognitiveLogs}
      initialQuizAttempts={quizAttempts}
      tenantId={tenantId}
      companyName={branding.companyName}
      brandColor={branding.brandColor}
      userId={userId || ""}
      globalStats={globalStats}
      globalTopTopics={globalTopTopics}
      activeRole={activeRole}
    />
  );
}
