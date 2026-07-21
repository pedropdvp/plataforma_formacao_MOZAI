import React from "react";
import { headers, cookies } from "next/headers";
import { GraduationCap } from "lucide-react";
import UserProfileButton from "@/components/user-profile-button";
import SidebarNav from "@/components/sidebar-nav";
import UIControls from "@/components/ui-controls";
import { getActiveTenantBranding } from "@/lib/tenant";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const db = await getDb();
  let userRecord = await db.collection("users").findOne({ _id: userId });

  // Se não existir o registo com o ID do Clerk, procuramos pelo e-mail
  if (!userRecord) {
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress;
    if (userEmail) {
      userRecord = await db.collection("users").findOne({ email: userEmail.toLowerCase().trim() });
      if (userRecord) {
        // Vincula a conta no MongoDB apagando e inserindo com o novo _id do Clerk
        await db.collection("users").deleteOne({ _id: userRecord._id });
        userRecord = {
          ...userRecord,
          _id: userId,
          firstName: user?.firstName || userRecord.firstName,
          lastName: user?.lastName || userRecord.lastName,
          updatedAt: new Date()
        };
        await db.collection("users").insertOne(userRecord);
      } else {
        // É um Aluno Individual auto-registado, criamos a conta na BD!
        userRecord = {
          _id: userId,
          email: userEmail.toLowerCase().trim(),
          firstName: user?.firstName || "Aluno",
          lastName: user?.lastName || "Individual",
          tenants: [
            {
              tenantId: "root",
              roles: ["ALUNO"]
            }
          ],
          globalAdmin: false,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        await db.collection("users").insertOne(userRecord);
      }
    }
  }

  // Se mesmo assim o utilizador não existir na base de dados, barramos o acesso!
  if (!userRecord) {
    redirect("/unauthorized");
  }

  // Ler o tenant_id injetado no middleware
  const headersList = await headers();
  const tenantId = headersList.get("x-tenant-id") || "root";
  
  // Ler o perfil ativo da sessão nos cookies
  const cookiesList = await cookies();
  const activeRole = cookiesList.get("active-role")?.value || "ALUNO";
  const language = cookiesList.get("language")?.value || "PT";

  // Obter papéis atribuídos ao utilizador no tenant ativo
  const tenantMapping = userRecord.tenants?.find((t: any) => t.tenantId === tenantId);
  const assignedRoles: string[] = tenantMapping ? tenantMapping.roles : ["ALUNO"];
  const hasMultipleRoles = assignedRoles.length > 1;

  const getProfileLabel = (role: string, lang: string) => {
    if (lang === "EN") {
      switch (role) {
        case "ADMIN": return "Platform Admin";
        case "GESTOR_EMPRESA": return "Company Manager";
        case "FUNCIONARIO": return "Company Staff";
        case "ALUNO": return "Student";
        case "GESTOR_ACADEMICO": return "Academic Manager";
        case "PROFESSOR": return "Professor";
        case "FORMADOR": return "Trainer";
        case "TUTOR": return "Tutor";
        case "FINANCEIRO": return "Finance Officer";
        case "SUPORTE": return "Tech Support";
        default: return role;
      }
    } else if (lang === "FR") {
      switch (role) {
        case "ADMIN": return "Admin de la Plateforme";
        case "GESTOR_EMPRESA": return "Gestionnaire d'Entreprise";
        case "FUNCIONARIO": return "Employé d'Entreprise";
        case "ALUNO": return "Étudiant";
        case "GESTOR_ACADEMICO": return "Gestionnaire Académique";
        case "PROFESSOR": return "Professeur";
        case "FORMADOR": return "Formateur";
        case "TUTOR": return "Tuteur";
        case "FINANCEIRO": return "Financier";
        case "SUPORTE": return "Support Technique";
        default: return role;
      }
    } else {
      switch (role) {
        case "ADMIN": return "Administrador";
        case "GESTOR_EMPRESA": return "Gestor Empresa";
        case "FUNCIONARIO": return "Funcionário";
        case "ALUNO": return "Aluno";
        case "GESTOR_ACADEMICO": return "Gestor Académico";
        case "PROFESSOR": return "Professor";
        case "FORMADOR": return "Formador";
        case "TUTOR": return "Tutor";
        case "FINANCEIRO": return "Financeiro";
        case "SUPORTE": return "Suporte Técnico";
        default: return role;
      }
    }
  };

  const getWorkspaceTitle = (lang: string) => {
    if (lang === "EN") return "Workspace";
    if (lang === "FR") return "Espace de Travail";
    return "Área de Trabalho";
  };

  const getChangeProfileLabel = (lang: string) => {
    if (lang === "EN") return "Change Profile";
    if (lang === "FR") return "Changer de Profil";
    return "Alterar Perfil";
  };

  // Obter as configurações de branding reais do tenant no banco
  const branding = await getActiveTenantBranding(tenantId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Folha de Estilos Dinâmica para Custom Branding do Inquilino B2B */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --brand-color: ${branding.brandColor};
        }
        .text-indigo-400 {
          color: ${branding.brandColor} !important;
        }
        .bg-indigo-600 {
          background-color: ${branding.brandColor} !important;
        }
        .bg-indigo-500 {
          background-color: ${branding.brandColor} !important;
        }
        .border-indigo-500 {
          border-color: ${branding.brandColor} !important;
        }
        .shadow-indigo-500\\/10 {
          box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.1), 0 2px 4px -2px rgba(99, 102, 241, 0.1) !important;
        }
      `}} />

      {/* Sidebar Fica Fixo à Esquerda */}
      <aside className="w-64 border-r border-slate-900 bg-slate-950 flex flex-col justify-between p-6 h-screen flex-shrink-0">
        <div className="space-y-6 flex flex-col min-h-0 flex-1">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt="Logo" className="h-8 w-auto rounded-lg object-contain" />
            ) : (
              <GraduationCap className="h-8 w-8 text-indigo-400" />
            )}
            <span className="text-xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">
              {branding.companyName.split(" ")[0]}
            </span>
          </div>

          {/* Org Selector Badge */}
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs flex-shrink-0">
            <span className="text-slate-400 font-medium">Empresa Ativa:</span>
            <span className="text-indigo-400 font-semibold truncate max-w-[100px]" title={branding.companyName}>
              {branding.companyName}
            </span>
          </div>

          {/* Collapsible Sidebar Nav Client Component */}
          <SidebarNav />
        </div>

        {/* User Account Custom Profile Popover Button */}
        <div className="pt-4 border-t border-slate-900 flex-shrink-0 flex items-center justify-between">
          <UserProfileButton />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar do Dashboard */}
        <header className="h-16 border-b border-slate-900 bg-slate-950/40 backdrop-blur-md flex items-center justify-between px-8 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-white">{getWorkspaceTitle(language)}</h2>
            
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                {language === "EN" ? "Profile" : language === "FR" ? "Profil" : "Perfil"}: {getProfileLabel(activeRole, language)}
              </span>
              {hasMultipleRoles && (
                <a
                  href="/choose-role"
                  className="text-[10px] font-semibold text-slate-400 hover:text-white transition-colors underline decoration-dotted"
                >
                  {getChangeProfileLabel(language)}
                </a>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <UIControls />
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
              Versão Alpha V1.0
            </span>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-8 overflow-y-auto bg-slate-950/20">{children}</main>
      </div>
    </div>
  );
}
