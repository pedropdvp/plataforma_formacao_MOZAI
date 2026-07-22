"use client";

import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";

import React, { useState, useEffect } from "react";
import { 
  Building, Paintbrush, Link2, ShieldCheck, Save, Loader2, CheckCircle2, BookOpen,
  ArrowUpRight, Plus, Mail, User, ShieldAlert, Globe, Edit2, Trash2
} from "lucide-react";
import { useAccess } from "@/hooks/use-access";

interface Company {
  _id: string;
  name: string;
  subdomain: string;
  brandColor: string;
  employeesCount: number;
  gestorEmail: string;
  gestorName: string;
}

export default function AdminSettingsPage() {
  const { showToast } = useToast();
  const confirmDialog = useConfirm();
  const { activeRole } = useAccess();
  const isGlobalAdmin = activeRole === "ADMIN" || activeRole === "SUPORTE";

  const [activeTab, setActiveTab] = useState("companies");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Estados das Definições de Inquilino
  const [companyName, setCompanyName] = useState("");
  const [brandColor, setBrandColor] = useState("#6366f1");
  const [customDomain, setCustomDomain] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [ssoActive, setSsoActive] = useState(false);

  // Estados de Gestão de Empresas (para global admins)
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  
  // Form de Criar/Editar Nova Empresa
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newSubdomain, setNewSubdomain] = useState("");
  const [newGestorName, setNewGestorName] = useState("");
  const [newGestorEmail, setNewGestorEmail] = useState("");
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [companyError, setCompanyError] = useState("");
  const [companySuccess, setCompanySuccess] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);

  // Carregar configurações do tenant e empresas (caso seja admin)
  useEffect(() => {
    async function loadInitialData() {
      try {
        const res = await fetch("/api/tenant-settings");
        if (res.ok) {
          const data = await res.json();
          setCompanyName(data.companyName || "");
          setBrandColor(data.brandColor || "#6366f1");
          setCustomDomain(data.customDomain || "");
          setLogoUrl(data.logoUrl || "");
          setSsoActive(!!data.ssoActive);
        }
      } catch (err) {
        console.error("Erro ao carregar configurações do tenant:", err);
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  // Carregar empresas
  const fetchCompanies = async () => {
    if (!isGlobalAdmin) return;
    setLoadingCompanies(true);
    try {
      const res = await fetch("/api/admin/companies");
      if (res.ok) {
        const data = await res.json();
        setCompanies(data);
      }
    } catch (err) {
      console.error("Erro ao ler empresas:", err);
    } finally {
      setLoadingCompanies(false);
    }
  };

  useEffect(() => {
    // isGlobalAdmin depende de activeRole, que carrega de forma assíncrona (useAccess).
    // Sem isto nas dependências, se a página montar antes do perfil estar carregado,
    // fetchCompanies() devolve de imediato (isGlobalAdmin ainda é false nesse instante)
    // e a lista de empresas fica vazia para sempre — mesmo sendo o utilizador ADMIN.
    if (activeTab === "companies" && isGlobalAdmin) {
      fetchCompanies();
    }
  }, [activeTab, isGlobalAdmin]);

  // Salvar configurações do tenant (branding)
  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    try {
      const res = await fetch("/api/tenant-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, brandColor, customDomain, logoUrl, ssoActive }),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3500);
      }
    } catch (err) {
      console.error("Erro ao salvar branding:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (comp: Company) => {
    setEditingCompanyId(comp._id);
    setNewCompanyName(comp.name);
    setNewSubdomain(comp.subdomain);
    setNewGestorName(comp.gestorName);
    setNewGestorEmail(comp.gestorEmail);
    setCompanyError("");
    setCompanySuccess(false);
  };

  const handleCancelEdit = () => {
    setEditingCompanyId(null);
    setNewCompanyName("");
    setNewSubdomain("");
    setNewGestorName("");
    setNewGestorEmail("");
    setCompanyError("");
    setCompanySuccess(false);
  };

  const handleDeleteCompany = async (companyId: string) => {
    const confirmed = await confirmDialog({
      title: "Eliminar Empresa",
      message: "Deseja mesmo eliminar esta empresa? Todos os acessos de funcionários e alunos, progressos e cursos atribuídos serão removidos de forma permanente.",
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/companies?id=${companyId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Erro ao eliminar empresa.", "error");
      } else {
        if (editingCompanyId === companyId) {
          handleCancelEdit();
        }
        await fetchCompanies();
      }
    } catch (err) {
      showToast("Falha na comunicação com o servidor.", "error");
    }
  };

  // Criar ou editar empresa e gestor
  const handleCreateOrUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingCompany(true);
    setCompanyError("");
    setCompanySuccess(false);

    try {
      const url = "/api/admin/companies";
      const method = editingCompanyId ? "PUT" : "POST";
      const bodyPayload = editingCompanyId 
        ? {
            companyId: editingCompanyId,
            companyName: newCompanyName,
            subdomain: newSubdomain,
            gestorName: newGestorName,
            gestorEmail: newGestorEmail
          }
        : {
            companyName: newCompanyName,
            subdomain: newSubdomain,
            gestorName: newGestorName,
            gestorEmail: newGestorEmail
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        setCompanyError(data.error || `Erro ao ${editingCompanyId ? "editar" : "criar"} empresa.`);
      } else {
        setCompanySuccess(true);
        setNewCompanyName("");
        setNewSubdomain("");
        setNewGestorName("");
        setNewGestorEmail("");
        setEditingCompanyId(null);
        await fetchCompanies();
        setTimeout(() => setCompanySuccess(false), 4000);
      }
    } catch (err) {
      setCompanyError("Falha na comunicação com o servidor.");
    } finally {
      setCreatingCompany(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8 workspace-page-container">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Configurar Empresa</h1>
        <p className="text-sm text-slate-400">
          Faça a gestão visual da sua empresa ou crie e administre novas organizações corporativas no sistema da MOZAI.
        </p>
      </div>

      {/* Tabs */}
      {isGlobalAdmin && (
        <div className="flex border-b border-slate-900 gap-6">
          <button
            onClick={() => setActiveTab("companies")}
            className={`pb-3 text-xs font-bold transition-all relative ${
              activeTab === "companies" ? "text-indigo-400 font-extrabold" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Gestão de Empresas
            {activeTab === "companies" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("branding")}
            className={`pb-3 text-xs font-bold transition-all relative ${
              activeTab === "branding" ? "text-indigo-400 font-extrabold" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Configurações de Branding
            {activeTab === "branding" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
            )}
          </button>
        </div>
      )}

      {/* TAB 1: BRANDING */}
      {activeTab === "branding" && (
        <div className="space-y-6">
          {/* Gestão de Conteúdos — link para o Sanity Studio */}
          <a
            href="/studio"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between gap-4 border border-slate-900 bg-slate-900/10 rounded-3xl p-6 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-white">Gestão de Conteúdos (Sanity Studio)</h2>
                <p className="text-xs text-slate-500 max-w-[480px]">
                  Criar e editar Cursos, Módulos e Lições. Após alterar uma lição, o Tutor de IA é reindexado automaticamente.
                </p>
              </div>
            </div>
            <ArrowUpRight className="h-5 w-5 text-slate-500 group-hover:text-indigo-400 transition-colors shrink-0" />
          </a>

          {success && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-sm font-semibold transition-all">
              <CheckCircle2 className="h-5 w-5" />
              Configurações guardadas com sucesso!
            </div>
          )}

          {/* Main Form */}
          <form onSubmit={handleSaveBranding} className="border border-slate-900 bg-slate-900/10 rounded-3xl p-8 space-y-6">
            {/* Company Name */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <Building className="h-4 w-4 text-indigo-400" />
                Nome da Organização / Empresa
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex: Universidade de Tecnologia"
                className="w-full h-11 px-4 rounded-xl border border-slate-800 bg-slate-950 text-white text-sm focus:border-indigo-500 focus:outline-none transition-colors"
                required
              />
            </div>

            {/* Brand Color */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <Paintbrush className="h-4 w-4 text-indigo-400" />
                Cor de Destaque da Marca (Brand Color)
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-11 w-16 p-1 rounded-xl border border-slate-800 bg-slate-950 cursor-pointer"
                />
                <input
                  type="text"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-slate-800 bg-slate-950 text-white text-sm focus:border-indigo-500 focus:outline-none transition-colors font-mono"
                />
              </div>
            </div>

            {/* Custom Domain */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <Link2 className="h-4 w-4 text-indigo-400" />
                Domínio Personalizado (Custom Domain)
              </label>
              <input
                type="text"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="Ex: formacao.minhaempresa.com"
                className="w-full h-11 px-4 rounded-xl border border-slate-800 bg-slate-950 text-white text-sm focus:border-indigo-500 focus:outline-none transition-colors"
              />
              <p className="text-[10px] text-slate-500">
                Configure apontamentos CNAME no seu DNS antes de mapear o domínio.
              </p>
            </div>

            {/* Logo URL */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <Link2 className="h-4 w-4 text-indigo-400" />
                URL do Logótipo (ou imagem PNG/SVG)
              </label>
              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="Ex: https://assets.minhaempresa.com/logo.png"
                className="w-full h-11 px-4 rounded-xl border border-slate-800 bg-slate-950 text-white text-sm focus:border-indigo-500 focus:outline-none transition-colors"
              />
            </div>

            {/* SSO Checkbox */}
            <div className="border border-slate-800 bg-slate-950/40 rounded-2xl p-4 flex items-center justify-between">
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-sm font-bold text-white">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Ativar Login SAML / SSO Enterprise
                </label>
                <p className="text-xs text-slate-500 max-w-[450px]">
                  Força os utilizadores a efetuarem autenticação integrada utilizando os credenciais de e-mail corporativo da empresa (via WorkOS).
                </p>
              </div>
              <input
                type="checkbox"
                checked={ssoActive}
                onChange={(e) => setSsoActive(e.target.checked)}
                className="h-5 w-5 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </div>

            {/* Action Button */}
            <button
              type="submit"
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-indigo-500/25"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  A guardar definições...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Guardar Configurações
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: COMPANIES (MULTI-TENANT MANAGER) */}
      {activeTab === "companies" && (
        <div className="grid md:grid-cols-3 gap-8">
          {/* List/Table of Companies */}
          <div className="md:col-span-2 space-y-4">
            <h3 className="font-extrabold text-white text-base flex items-center gap-2">
              <Building className="h-5 w-5 text-indigo-400" />
              Empresas Criadas ({companies.length})
            </h3>

            {loadingCompanies ? (
              <div className="flex items-center justify-center py-10 text-slate-500 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                <span className="text-xs font-semibold">A carregar listagem...</span>
              </div>
            ) : companies.length === 0 ? (
              <div className="border border-slate-900 border-dashed rounded-3xl p-10 text-center text-xs text-slate-500">
                Nenhuma empresa B2B criada no sistema. Use o formulário à direita para registar.
              </div>
            ) : (
              <div className="space-y-3">
                {companies.map((comp) => (
                  <div
                    key={comp._id}
                    className="border border-slate-900 bg-slate-950/40 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm text-white flex items-center gap-2">
                        {comp.name}
                        <span className="text-[9px] font-semibold px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono">
                          {comp.subdomain}
                        </span>
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        Gestor: <span className="text-slate-350 font-bold">{comp.gestorName}</span> ({comp.gestorEmail})
                      </p>
                    </div>

                    <div className="flex items-center gap-4 justify-between sm:justify-end border-t sm:border-t-0 border-slate-900 pt-3 sm:pt-0">
                      <div className="text-right">
                        <span className="text-[9px] text-slate-500 block">Colaboradores</span>
                        <span className="text-xs font-bold text-white">{comp.employeesCount || 0}</span>
                      </div>
                      
                      <div className="flex items-center gap-2.5 pl-4 border-l border-slate-900">
                        <button
                          onClick={() => handleEditClick(comp)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
                          title="Editar Empresa"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        
                        <button
                          onClick={() => handleDeleteCompany(comp._id)}
                          className="p-1.5 text-rose-500/80 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Apagar Empresa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form to Register/Edit Company */}
          <div className="space-y-4">
            <h3 className="font-extrabold text-white text-base flex items-center gap-2">
              {editingCompanyId ? <Edit2 className="h-5 w-5 text-indigo-400" /> : <Plus className="h-5 w-5 text-indigo-400" />}
              {editingCompanyId ? "Editar Empresa" : "Registar Nova Empresa"}
            </h3>

            {companyError && (
              <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-400 text-xs font-semibold flex items-center gap-2">
                <ShieldAlert className="h-4.5 w-4.5" />
                {companyError}
              </div>
            )}

            {companySuccess && (
              <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4.5 w-4.5" />
                {editingCompanyId ? "Alterações guardadas com sucesso!" : "Empresa e Acesso Gestor criados com sucesso!"}
              </div>
            )}

            <form onSubmit={handleCreateOrUpdateCompany} className="border border-slate-900 bg-slate-950/20 p-5 rounded-2xl space-y-4 text-xs font-medium text-slate-300">
              {/* Company Name */}
              <div className="space-y-1.5">
                <label className="block text-slate-400">Nome da Empresa</label>
                <div className="relative">
                  <Building className="absolute left-3 top-3 h-4 w-4 text-slate-550" />
                  <input
                    type="text"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="Ex: Condomínio Jardim"
                    className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-800 bg-slate-950 text-white focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Subdomain */}
              <div className="space-y-1.5">
                <label className="block text-slate-400">Subdomínio Identificador</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-3 h-4 w-4 text-slate-550" />
                  <input
                    type="text"
                    value={newSubdomain}
                    onChange={(e) => setNewSubdomain(e.target.value.replace(/[^A-Za-z0-9-]/g, ""))}
                    placeholder="Ex: condomínio-a"
                    className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-800 bg-slate-950 text-white font-mono focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="border-t border-slate-900/60 my-3" />

              {/* Gestor Name */}
              <div className="space-y-1.5">
                <label className="block text-slate-400">Nome do Gestor Empresa</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-550" />
                  <input
                    type="text"
                    value={newGestorName}
                    onChange={(e) => setNewGestorName(e.target.value)}
                    placeholder="Ex: Pedro Marques"
                    className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-800 bg-slate-950 text-white focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Gestor Email */}
              <div className="space-y-1.5">
                <label className="block text-slate-400">E-mail do Gestor</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-550" />
                  <input
                    type="email"
                    value={newGestorEmail}
                    onChange={(e) => setNewGestorEmail(e.target.value)}
                    placeholder="Ex: gestor@empresa.com"
                    className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-800 bg-slate-950 text-white focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={creatingCompany}
                  className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {creatingCompany ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {editingCompanyId ? "A guardar..." : "A Criar..."}
                    </>
                  ) : (
                    <>
                      {editingCompanyId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      {editingCompanyId ? "Guardar Alterações" : "Criar Empresa e Acesso"}
                    </>
                  )}
                </button>

                {editingCompanyId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="w-full h-10 rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-900 text-slate-400 hover:text-white font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    Cancelar Edição
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
