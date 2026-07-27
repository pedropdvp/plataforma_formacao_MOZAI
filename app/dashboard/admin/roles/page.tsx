"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  UserCog,
  Loader2,
  ShieldAlert,
  RefreshCw,
  Trash2,
  Pencil,
  Eye,
  X,
  Save,
  Shield,
  BookOpen,
  GraduationCap,
  Users,
  Settings,
  Briefcase,
  Coins
} from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useAccess } from "@/hooks/use-access";

interface RoleDoc {
  _id: string;
  name: string;
  description?: string;
  permissions: string[];
  updatedAt?: string;
}

interface PermissionDoc {
  _id: string;
  name: string;
  module: string;
  description: string;
}

const ROLE_VISUALS: Record<string, { icon: React.ComponentType<any>; color: string }> = {
  ADMIN: { icon: Settings, color: "text-rose-455 bg-rose-500/10 border-rose-500/20" },
  GESTOR_EMPRESA: { icon: Briefcase, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  FUNCIONARIO: { icon: Users, color: "text-slate-300 bg-slate-500/10 border-slate-500/20" },
  ALUNO: { icon: BookOpen, color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" },
  GESTOR_ACADEMICO: { icon: GraduationCap, color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
  PROFESSOR: { icon: GraduationCap, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  FORMADOR: { icon: BookOpen, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  TUTOR: { icon: Users, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  FINANCEIRO: { icon: Coins, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  SUPORTE: { icon: Shield, color: "text-rose-455 bg-rose-500/10 border-rose-500/20" }
};
const DEFAULT_VISUAL = { icon: Shield, color: "text-slate-400 bg-slate-500/10 border-slate-500/20" };

/** Botão de ação com um pequeno texto descritivo que aparece ao ganhar foco (teclado) ou
 * ao passar o rato (acessível a ambos os modos de interação). */
function ActionButton({
  icon: Icon,
  label,
  tooltip,
  onClick,
  disabled,
  variant = "default"
}: {
  icon: React.ComponentType<any>;
  label: string;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className={`h-9 w-9 rounded-lg border flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
          variant === "danger"
            ? "border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-450"
            : "border-slate-800 bg-slate-900/40 hover:bg-slate-900 text-slate-300"
        }`}
      >
        <Icon className="h-4 w-4" />
      </button>
      {show && (
        <div
          role="tooltip"
          className="absolute z-20 top-full mt-2 left-1/2 -translate-x-1/2 w-max max-w-[220px] px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-200 text-center shadow-xl pointer-events-none"
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}

function PermissionChecklist({
  catalog,
  selected,
  onToggle,
  readOnly
}: {
  catalog: PermissionDoc[];
  selected: Set<string>;
  onToggle?: (permId: string) => void;
  readOnly?: boolean;
}) {
  const byModule = useMemo(() => {
    const groups: Record<string, PermissionDoc[]> = {};
    for (const p of catalog) {
      groups[p.module] = groups[p.module] || [];
      groups[p.module].push(p);
    }
    return groups;
  }, [catalog]);

  return (
    <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
      {Object.entries(byModule).map(([module, perms]) => {
        if (readOnly && perms.every((p) => !selected.has(p._id))) return null;
        return (
        <div key={module} className="space-y-1.5">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{module}</h4>
          <div className="space-y-1">
            {perms.map((p) => {
              const checked = selected.has(p._id);
              if (readOnly && !checked) return null;
              return (
                <label
                  key={p._id}
                  className={`flex items-start gap-2.5 px-2.5 py-1.5 rounded-lg text-xs ${
                    readOnly ? "" : "cursor-pointer hover:bg-slate-900"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={readOnly}
                    onChange={() => onToggle?.(p._id)}
                    className="mt-0.5 h-3.5 w-3.5 accent-indigo-500 shrink-0"
                  />
                  <span>
                    <span className="font-semibold text-slate-200">{p.name}</span>
                    <span className="block text-[10px] text-slate-500">{p.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
        );
      })}
      {readOnly && catalog.every((p) => !selected.has(p._id)) && (
        <p className="text-xs text-slate-500 italic">Este perfil não tem permissões atribuídas.</p>
      )}
    </div>
  );
}

export default function AccessProfilesPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const confirmDialog = useConfirm();
  const { activeRole, isLoading: loadingRole } = useAccess();
  const isAdmin = activeRole === "ADMIN" || activeRole === "SUPORTE";

  const [roles, setRoles] = useState<RoleDoc[]>([]);
  const [permissionsCatalog, setPermissionsCatalog] = useState<PermissionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingRole, setViewingRole] = useState<RoleDoc | null>(null);
  const [editingRole, setEditingRole] = useState<RoleDoc | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; description: string; permissions: Set<string> }>({
    name: "",
    description: "",
    permissions: new Set()
  });
  const [saving, setSaving] = useState(false);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/roles");
      if (res.ok) {
        const data = await res.json();
        const sorted = [...(data.roles || [])].sort((a: RoleDoc, b: RoleDoc) =>
          (a.name || a._id).localeCompare(b.name || b._id, "pt-PT")
        );
        setRoles(sorted);
        setPermissionsCatalog(data.permissionsCatalog || []);
      }
    } catch (err) {
      console.error("Erro ao ler perfis de acesso:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchRoles();
  }, [isAdmin]);

  // "Alterar" leva sempre à mesma página "Escolha o seu Perfil de Acesso" usada pelo botão
  // "Alterar Perfil" do cabeçalho — um único sítio para escolher o perfil ativo, em vez de
  // duplicar aqui uma mudança direta que poderia divergir desse fluxo já existente.
  const handleSwitch = () => {
    router.push("/choose-role");
  };

  const handleDelete = async (role: RoleDoc) => {
    const confirmed = await confirmDialog({
      title: "Apagar Perfil de Acesso",
      message: `Isto vai eliminar definitivamente o perfil "${role.name}". Utilizadores com este perfil atribuído deixam de ter permissões associadas até o perfil ser recriado. Tem a certeza?`,
      confirmLabel: "Apagar",
      destructive: true
    });
    if (!confirmed) return;

    setDeletingId(role._id);
    try {
      const res = await fetch(`/api/admin/roles?roleId=${encodeURIComponent(role._id)}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        showToast(`Perfil "${role.name}" eliminado.`, "success");
        await fetchRoles();
      } else {
        showToast(data.error || "Erro ao apagar o perfil.", "error");
      }
    } catch (err) {
      showToast("Erro de comunicação ao apagar o perfil.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (role: RoleDoc) => {
    setEditingRole(role);
    setEditForm({
      name: role.name || role._id,
      description: role.description || "",
      permissions: new Set(role.permissions || [])
    });
  };

  const togglePermission = (permId: string) => {
    setEditForm((prev) => {
      const next = new Set(prev.permissions);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return { ...prev, permissions: next };
    });
  };

  const handleSaveEdit = async () => {
    if (!editingRole) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: editingRole._id,
          name: editForm.name,
          description: editForm.description,
          permissions: [...editForm.permissions]
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Perfil de acesso atualizado.", "success");
        setEditingRole(null);
        await fetchRoles();
      } else {
        showToast(data.error || "Erro ao editar o perfil.", "error");
      }
    } catch (err) {
      showToast("Erro de comunicação ao editar o perfil.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loadingRole) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <span className="text-sm font-semibold">A verificar permissões...</span>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center text-center space-y-4 px-6">
        <div className="p-4 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-white">Acesso Restrito</h1>
        <p className="text-sm text-slate-400 max-w-[420px]">
          Só administradores globais (ADMIN ou SUPORTE) podem gerir os perfis de acesso.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl report-page-container">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2.5">
          <UserCog className="h-6 w-6 text-orange-400" />
          Perfis de acesso
        </h1>
        <p className="text-sm text-slate-400">
          Mude o seu próprio perfil ativo para testar o acesso de qualquer tipo de conta na sua empresa, ou
          visualize, edite e apague os perfis de acesso predefinidos da plataforma.
        </p>
      </div>

      <div className="border border-slate-900 bg-slate-950/40 rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-200">Perfis</h2>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-500 gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
            <span className="text-xs font-semibold">A carregar perfis...</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {roles.map((role) => {
              const visual = ROLE_VISUALS[role._id] || DEFAULT_VISUAL;
              const Icon = visual.icon;
              const isDeleting = deletingId === role._id;
              const isBusy = deletingId !== null;

              return (
                <div
                  key={role._id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-slate-900 bg-slate-950/30 rounded-2xl p-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${visual.color}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-extrabold text-white truncate">{role.name}</h3>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {role.description || "Sem descrição."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <ActionButton
                      icon={RefreshCw}
                      label="Alterar"
                      tooltip="Muda o perfil de acesso"
                      onClick={handleSwitch}
                      disabled={isBusy}
                    />
                    <ActionButton
                      icon={Eye}
                      label="Visualizar"
                      tooltip="Visualiza os perfis de acesso. Se for selecionado visualiza os acessos predefinidos de determinado perfil."
                      onClick={() => setViewingRole(role)}
                      disabled={isBusy}
                    />
                    <ActionButton
                      icon={Pencil}
                      label="Editar"
                      tooltip="Edita o perfil de acesso selecionado - predefinido"
                      onClick={() => openEdit(role)}
                      disabled={isBusy}
                    />
                    <ActionButton
                      icon={isDeleting ? Loader2 : Trash2}
                      label="Apagar"
                      tooltip="Apaga o perfil selecionado"
                      onClick={() => handleDelete(role)}
                      disabled={isBusy}
                      variant="danger"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Visualizar (só leitura) */}
      {viewingRole && (
        <div className="fixed inset-0 z-[9999] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md border border-slate-850 bg-slate-950 rounded-3xl p-6 shadow-2xl space-y-4 no-3d-effect">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-white text-sm">{viewingRole.name}</h3>
                <p className="text-[11px] text-slate-500">{viewingRole.description || "Sem descrição."}</p>
              </div>
              <button
                onClick={() => setViewingRole(null)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <PermissionChecklist
              catalog={permissionsCatalog}
              selected={new Set(viewingRole.permissions || [])}
              readOnly
            />
          </div>
        </div>
      )}

      {/* Modal: Editar */}
      {editingRole && (
        <div className="fixed inset-0 z-[9999] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg border border-slate-850 bg-slate-950 rounded-3xl p-6 shadow-2xl space-y-4 no-3d-effect">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-extrabold text-white text-sm">Editar Perfil de Acesso</h3>
              <button
                onClick={() => setEditingRole(null)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nome</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="mt-1 w-full h-10 px-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Descrição</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">
                  Permissões
                </label>
                <PermissionChecklist
                  catalog={permissionsCatalog}
                  selected={editForm.permissions}
                  onToggle={togglePermission}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-1">
              <button
                onClick={() => setEditingRole(null)}
                className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
