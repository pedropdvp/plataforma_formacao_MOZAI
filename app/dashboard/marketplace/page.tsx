"use client";

import React, { useEffect, useState } from "react";
import { Store, Layers, Loader2, Download, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

interface MarketplaceListing {
  _id: string;
  title: string;
  description: string;
  sourceTenantName: string;
  lessonsCount: number;
}

export default function MarketplacePage() {
  const { showToast } = useToast();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [acquiringId, setAcquiringId] = useState<string | null>(null);
  const [acquiredIds, setAcquiredIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/marketplace");
        const data = await res.json();
        if (res.ok) setListings(data.listings || []);
      } catch {
        showToast("Erro ao carregar o marketplace.", "error");
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAcquire = async (listing: MarketplaceListing) => {
    setAcquiringId(listing._id);
    try {
      const res = await fetch("/api/marketplace/acquire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceCourseId: listing._id }),
      });
      const data = await res.json();
      if (res.ok) {
        setAcquiredIds((prev) => new Set(prev).add(listing._id));
        showToast(`"${listing.title}" adicionado ao seu catálogo.`, "success");
      } else {
        showToast(data.error || "Erro ao adquirir o curso.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao adquirir o curso.", "error");
    } finally {
      setAcquiringId(null);
    }
  };

  return (
    <div className="space-y-8 workspace-page-container">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Store className="h-6 w-6 text-indigo-400" />
          Marketplace de Cursos
        </h1>
        <p className="text-sm text-slate-400">
          Cursos publicados por outras organizações na plataforma. Adicionar um curso cria uma cópia independente no seu catálogo.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
        </div>
      ) : listings.length === 0 ? (
        <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-12 text-center">
          <span className="text-sm text-slate-500 italic">Ainda não há cursos publicados no marketplace.</span>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((listing) => {
            const acquired = acquiredIds.has(listing._id);
            return (
              <div key={listing._id} className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-4 flex flex-col">
                <div className="space-y-2 flex-1">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">{listing.sourceTenantName}</span>
                  <h3 className="text-sm font-bold text-white leading-snug">{listing.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{listing.description}</p>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Layers className="h-3 w-3" /> {listing.lessonsCount} lições
                  </span>
                </div>
                <button
                  onClick={() => handleAcquire(listing)}
                  disabled={acquiringId === listing._id || acquired}
                  className={`h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:cursor-default ${
                    acquired
                      ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                      : "bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                  }`}
                >
                  {acquiringId === listing._id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : acquired ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {acquired ? "Adicionado ao Catálogo" : "Adicionar ao Meu Catálogo"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
