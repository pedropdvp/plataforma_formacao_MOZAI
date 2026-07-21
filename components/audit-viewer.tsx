"use client";

import React, { useState, useEffect } from "react";
import { 
  Search, 
  Calendar, 
  User, 
  ShieldAlert, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Activity, 
  Building2, 
  Globe
} from "lucide-react";

interface AuditLog {
  _id: string;
  userId: string;
  userName: string;
  userEmail: string;
  tenantId: string;
  companyName: string;
  action: string;
  description: string;
  metadata: {
    ip?: string;
    userAgent?: string;
    [key: string]: any;
  };
  timestamp: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export function AuditViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);

  // Carregar os logs da API de Auditoria
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "15"
      });
      if (search.trim()) params.append("search", search);
      if (actionFilter) params.append("action", actionFilter);

      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setPagination(data.pagination || null);
      }
    } catch (error) {
      console.error("Erro ao obter logs de auditoria:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("pt-PT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes("CREATE") || action.includes("CREATED")) {
      return "bg-emerald-500/10 border-emerald-500/20 text-emerald-450";
    }
    if (action.includes("UPDATE") || action.includes("UPDATED") || action.includes("REPLIED")) {
      return "bg-amber-500/10 border-amber-500/20 text-amber-500";
    }
    if (action.includes("DELETE") || action.includes("DELETED")) {
      return "bg-rose-500/10 border-rose-500/20 text-rose-455";
    }
    return "bg-indigo-500/10 border-indigo-500/20 text-indigo-400";
  };

  return (
    <div className="space-y-6">
      {/* Filtros e Barra de Pesquisa */}
      <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-center gap-4 bg-slate-950/40 border border-slate-900 rounded-3xl p-5">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Pesquisar por utilizador, e-mail, ação ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-900 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="flex-1 md:flex-none px-4 py-3 bg-slate-950 border border-slate-900 rounded-2xl text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">Todas as Ações</option>
            <option value="COMPANY_CREATED">Criação de Empresa</option>
            <option value="COMPANY_UPDATED">Atualização de Empresa</option>
            <option value="COMPANY_DELETED">Eliminação de Empresa</option>
            <option value="COMPANY_USER_CREATED">Novo Colaborador</option>
            <option value="COMPANY_USER_UPDATED">Alteração de Cargo</option>
            <option value="COMPANY_USER_DELETED">Remoção de Colaborador</option>
            <option value="SUPPORT_TICKET_CREATED">Ticket de Suporte Criado</option>
            <option value="SUPPORT_TICKET_REPLIED">Ticket de Suporte Respondido</option>
            <option value="GLOBAL_SUPPORT_USER_CREATED">Criar Acesso Suporte</option>
          </select>

          <button
            type="submit"
            className="h-10 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            Filtrar
          </button>
        </div>
      </form>

      {/* Tabela de Logs */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
          <span className="text-xs font-semibold">A carregar logs de auditoria...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="p-12 text-center border border-slate-900 border-dashed rounded-3xl text-xs text-slate-500 space-y-2">
          <ShieldAlert className="h-8 w-8 text-slate-600 mx-auto" />
          <p>Nenhum registo de auditoria encontrado.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto bg-slate-950/40 border border-slate-900 rounded-3xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900/60 bg-slate-950/60">
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Data</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Ação</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Utilizador</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Empresa</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Descrição da Operação</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Rede/Contexto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/40 text-xs">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-950/20 transition-colors">
                    <td className="p-4 whitespace-nowrap text-slate-400 font-mono text-[10px]">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-600" />
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getActionBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white flex items-center gap-1">
                          <User className="h-3 w-3 text-slate-500" />
                          {log.userName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">{log.userEmail}</span>
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className="text-slate-350 flex items-center gap-1 font-semibold">
                        <Building2 className="h-3 w-3 text-slate-500" />
                        {log.companyName}
                      </span>
                    </td>
                    <td className="p-4 text-slate-300 leading-relaxed font-semibold">
                      {log.description}
                    </td>
                    <td className="p-4 whitespace-nowrap text-slate-500 text-[10px] font-mono">
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3 text-slate-600" />
                          IP: {log.metadata?.ip || "127.0.0.1"}
                        </span>
                        <span className="truncate max-w-[150px]" title={log.metadata?.userAgent}>
                          Agente: {log.metadata?.userAgent || "browser"}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-slate-900/60 pt-4">
              <span className="text-xs text-slate-500 font-semibold">
                Total: <span className="text-slate-300">{pagination.total}</span> logs registados
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-xl bg-slate-950 border border-slate-900 text-slate-400 hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs text-slate-400 font-bold px-2">
                  Página {page} de {pagination.pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={page === pagination.pages}
                  className="p-2 rounded-xl bg-slate-950 border border-slate-900 text-slate-400 hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
