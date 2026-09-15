"use client";

import React, { useState, useEffect, useMemo } from "react";
import { SlidersHorizontal, Loader2, ShieldAlert, Save, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { useAccess } from "@/hooks/use-access";
import { MENU_GROUPS, MENU_ITEMS, NON_HIDEABLE_MENU_IDS } from "@/lib/menu-registry";

interface Company {
  tenantId: string;
  name: string;
}

export default function MenuVisibilityPage() {
  const { showToast } = useToast();
  const { activeRole, isLoading: loadingRole } = useAccess();
  const isGlobalAdmin = activeRole === "ADMIN" || activeRole === "SUPORTE";

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("root");
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchVisibility = async (tenantId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/menu-visibility?tenantId=${encodeURIComponent(tenantId)}`);
      if (res.ok) {
        const data = await res.json();
        setHiddenIds(new Set<string>(data.hiddenIds || []));
        setCompanies(data.companies || []);
      }
    } catch (err) {
      console.error("Erro ao ler a visibilidade de menus:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isGlobalAdmin) fetchVisibility(selectedTenantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGlobalAdmin, selectedTenantId]);

  const toggleItem = (id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/menu-visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: selectedTenantId, hiddenIds: [...hiddenIds] }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Visibilidade de menus guardada com sucesso.", "success");
        setHiddenIds(new Set<string>(data.hiddenIds || []));
      } else {
        showToast(data.error || "Erro ao guardar a visibilidade de menus.", "error");
      }
    } catch (err) {
      showToast("Erro de comunicação ao guardar a visibilidade de menus.", "error");
    } finally {
      setSaving(false);
    }
  };

  const groupedItems = useMemo(
    () => MENU_GROUPS.map((group) => ({ group, items: MENU_ITEMS.filter((i) => i.groupId === group.id) })),
    []
  );

  if (loadingRole) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <span className="text-sm font-semibold">A verificar permissões...</span>
      </div>
    );
  }

  if (!isGlobalAdmin) {
    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center text-center space-y-4 px-6">
        <div className="p-4 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-white">Acesso Restrito</h1>
        <p className="text-sm text-slate-400 max-w-[420px]">
          Só administradores globais (ADMIN ou SUPORTE) podem gerir a visibilidade dos menus.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl report-page-container">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2.5">
          <SlidersHorizontal className="h-6 w-6 text-orange-400" />
          Menus
        </h1>
        <p className="text-sm text-slate-400">
          Escolha quais os menus visíveis ou ocultos na plataforma ou em cada empresa. As alterações aplicam-se a
          todos os utilizadores desse âmbito.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <label className="text-xs font-bold text-slate-300 shrink-0">Âmbito:</label>
          <select
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            className="h-10 px-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          >
            <option value="root">Plataforma (todas as empresas por defeito)</option>
            {companies.map((c) => (
              <option key={c.tenantId} value={c.tenantId}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <span className="text-xs font-semibold">A carregar...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedItems.map(({ group, items }) => (
            <div key={group.id} className="border border-slate-900 bg-slate-950/40 rounded-2xl p-4 space-y-2.5">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-300">{group.label}</h2>
              <div className="space-y-1.5">
                {items.map((item) => {
                  const locked = NON_HIDEABLE_MENU_IDS.has(item.id);
                  const hidden = hiddenIds.has(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => !locked && toggleItem(item.id)}
                      disabled={locked}
                      className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                        locked
                          ? "border-transparent text-slate-600 cursor-not-allowed"
                          : hidden
                          ? "border-rose-500/20 bg-rose-500/5 text-rose-350 hover:bg-rose-500/10 cursor-pointer"
                          : "border-transparent text-slate-300 hover:bg-slate-900 cursor-pointer"
                      }`}
                    >
                      <span>{item.label}</span>
                      {locked ? (
                        <span className="text-[10px] text-slate-600">sempre visível</span>
                      ) : hidden ? (
                        <span className="flex items-center gap-1.5 text-[10px]">
                          <EyeOff className="h-3.5 w-3.5" /> Oculto
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-[10px] text-emerald-450">
                          <Eye className="h-3.5 w-3.5" /> Visível
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
