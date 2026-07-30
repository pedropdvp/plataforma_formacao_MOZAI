"use client";

import React, { useEffect, useState } from "react";
import { Network, Loader2, Search, UserPlus, CheckCircle2, XCircle, Clock, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

interface Member {
  userId: string;
  name: string;
  headline: string;
  skills: string[];
  connectionStatus: "none" | "pending" | "accepted" | "declined";
  connectionId: string | null;
  isRequester: boolean;
}

interface ConnectionItem {
  id: string;
  otherName: string;
  status: string;
  requestedAt: string;
}

export default function NetworkingPage() {
  const { showToast } = useToast();

  const [visible, setVisible] = useState(false);
  const [headline, setHeadline] = useState("");
  const [skillsInput, setSkillsInput] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [search, setSearch] = useState("");
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const [sent, setSent] = useState<ConnectionItem[]>([]);
  const [received, setReceived] = useState<ConnectionItem[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const loadProfile = async () => {
    setLoadingProfile(true);
    try {
      const res = await fetch("/api/community/network/profile");
      const data = await res.json();
      if (res.ok) {
        setVisible(data.profile.visible);
        setHeadline(data.profile.headline);
        setSkillsInput((data.profile.skills || []).join(", "));
      }
    } catch {
      // silencioso
    } finally {
      setLoadingProfile(false);
    }
  };

  const loadMembers = async (query: string) => {
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/community/network/members?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (res.ok) setMembers(data.members || []);
    } catch {
      showToast("Erro ao carregar o diretório.", "error");
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadConnections = async () => {
    try {
      const res = await fetch("/api/community/network/connections");
      const data = await res.json();
      if (res.ok) {
        setSent(data.sent || []);
        setReceived(data.received || []);
      }
    } catch {
      // silencioso
    }
  };

  useEffect(() => {
    loadProfile();
    loadMembers("");
    loadConnections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch("/api/community/network/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visible,
          headline,
          skills: skillsInput.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (res.ok) {
        showToast("Perfil de Networking atualizado.", "success");
        loadMembers(search);
      } else {
        const data = await res.json();
        showToast(data.error || "Erro ao guardar o perfil.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao guardar o perfil.", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleConnect = async (member: Member) => {
    setConnectingId(member.userId);
    try {
      const res = await fetch("/api/community/network/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: member.userId }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Pedido de ligação enviado!", "success");
        loadMembers(search);
        loadConnections();
      } else {
        showToast(data.error || "Erro ao enviar o pedido.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao enviar o pedido.", "error");
    } finally {
      setConnectingId(null);
    }
  };

  const handleRespond = async (connectionId: string, action: "accept" | "decline") => {
    setRespondingId(connectionId);
    try {
      const res = await fetch(`/api/community/network/connections/${connectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        loadConnections();
        loadMembers(search);
      } else {
        showToast(data.error || "Erro ao responder ao pedido.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao responder ao pedido.", "error");
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <div className="space-y-8 workspace-page-container">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Network className="h-6 w-6 text-indigo-400" />
          Networking
        </h1>
        <p className="text-sm text-slate-400">Diretório de membros da comunidade — ative o seu perfil para aparecer e ligar-se a outros.</p>
      </div>

      <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-3">
        <h3 className="font-bold text-sm text-white">O Meu Perfil de Networking</h3>
        {loadingProfile ? (
          <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
        ) : (
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="h-4 w-4 accent-indigo-500" />
              <span className="text-xs text-slate-300 flex items-center gap-1.5">
                {visible ? <Eye className="h-3.5 w-3.5 text-emerald-400" /> : <EyeOff className="h-3.5 w-3.5 text-slate-500" />}
                Visível no Diretório de Networking (desativado por definição)
              </span>
            </label>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Cabeçalho curto (ex: Dev Full-Stack à procura de projetos)" className="w-full h-9 px-3 rounded-lg border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
            <input value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} placeholder="Competências, separadas por vírgula" className="w-full h-9 px-3 rounded-lg border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none" />
            <button type="submit" disabled={savingProfile} className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-55">
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
            </button>
          </form>
        )}
      </div>

      {(sent.length > 0 || received.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-2">
            <h3 className="font-bold text-sm text-white">Pedidos Recebidos</h3>
            {received.length === 0 ? <span className="text-xs text-slate-500">Sem pedidos recebidos.</span> : received.map((c) => (
              <div key={c.id} className="p-2.5 rounded-lg bg-slate-900/40 flex items-center justify-between">
                <span className="text-xs text-white">{c.otherName}</span>
                {c.status === "pending" ? (
                  <div className="flex gap-1.5">
                    <button onClick={() => handleRespond(c.id, "decline")} disabled={respondingId === c.id} className="h-7 w-7 rounded-lg border border-slate-800 hover:bg-slate-900 text-slate-400 flex items-center justify-center cursor-pointer"><XCircle className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleRespond(c.id, "accept")} disabled={respondingId === c.id} className="h-7 w-7 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center cursor-pointer"><CheckCircle2 className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-500">{c.status === "accepted" ? "Ligado" : "Recusado"}</span>
                )}
              </div>
            ))}
          </div>
          <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-2">
            <h3 className="font-bold text-sm text-white">Pedidos Enviados</h3>
            {sent.length === 0 ? <span className="text-xs text-slate-500">Sem pedidos enviados.</span> : sent.map((c) => (
              <div key={c.id} className="p-2.5 rounded-lg bg-slate-900/40 flex items-center justify-between">
                <span className="text-xs text-white">{c.otherName}</span>
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  {c.status === "pending" && <Clock className="h-3 w-3" />} {c.status === "pending" ? "Pendente" : c.status === "accepted" ? "Ligado" : "Recusado"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border border-slate-900 bg-slate-950/40 rounded-3xl p-6 space-y-4">
        <h3 className="font-bold text-sm text-white flex items-center gap-2"><Search className="h-4.5 w-4.5 text-indigo-400" /> Diretório de Membros</h3>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); loadMembers(e.target.value); }}
          placeholder="Pesquisar por nome, cabeçalho ou competência..."
          className="w-full h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:border-indigo-500 focus:outline-none"
        />
        {loadingMembers ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 text-indigo-500 animate-spin" /></div>
        ) : members.length === 0 ? (
          <span className="text-xs text-slate-500">Ainda não há membros visíveis no diretório para esta pesquisa.</span>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {members.map((m) => (
              <div key={m.userId} className="border border-slate-900 bg-slate-950/60 rounded-2xl p-4 space-y-2">
                <h4 className="font-bold text-xs text-white">{m.name}</h4>
                {m.headline && <p className="text-[11px] text-slate-400">{m.headline}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {m.skills.map((s) => (
                    <span key={s} className="text-[9px] font-mono font-bold text-indigo-400 bg-indigo-500/5 border border-indigo-500/10 px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
                {m.connectionStatus === "none" ? (
                  <button onClick={() => handleConnect(m)} disabled={connectingId === m.userId} className="w-full h-8 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-[11px] font-semibold text-indigo-400 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-55">
                    {connectingId === m.userId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />} Ligar-me
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    {m.connectionStatus === "pending" ? "Pedido pendente" : m.connectionStatus === "accepted" ? "Ligado" : "Pedido recusado"}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
