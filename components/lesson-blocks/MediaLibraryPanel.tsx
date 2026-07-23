"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useDraggable } from "@dnd-kit/core";
import { ImageIcon, Video, Upload, Loader2, GripVertical, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

export interface MediaItem {
  _id: string;
  type: "image" | "video";
  url?: string;
  alt?: string;
  filename?: string;
  muxUploadId?: string;
  muxPlaybackId?: string | null;
  status?: "processing" | "ready" | "error";
  provider?: "mux";
}

/**
 * Painel lateral com a Biblioteca de Media do tenant: imagens e vídeos já
 * carregados, disponíveis para arrastar para dentro da lista de blocos
 * (usado dentro do mesmo DndContext que o BlockEditor).
 */
export function MediaLibraryPanel() {
  const { showToast } = useToast();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const pollTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/media");
      const data = await res.json();
      if (res.ok) setItems(data.items || []);
    } catch {
      // silencioso — biblioteca vazia é um estado normal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
    return () => {
      Object.values(pollTimers.current).forEach(clearInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pollUploadStatus = useCallback((uploadId: string) => {
    if (pollTimers.current[uploadId]) return;
    pollTimers.current[uploadId] = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/media/mux-upload?uploadId=${uploadId}`);
        const data = await res.json();
        if (data.status === "ready" || data.status === "error") {
          clearInterval(pollTimers.current[uploadId]);
          delete pollTimers.current[uploadId];
          fetchItems();
        }
      } catch {
        // tenta novamente no próximo ciclo
      }
    }, 5000);
  }, [fetchItems]);

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/media", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        showToast("Imagem adicionada à Biblioteca de Media.", "success");
        setItems((prev) => [data.item, ...prev]);
      } else {
        showToast(data.error || "Erro ao carregar imagem.", "error");
      }
    } catch {
      showToast("Erro de comunicação ao carregar imagem.", "error");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleVideoUpload = async (file: File) => {
    setUploadingVideo(true);
    try {
      const startRes = await fetch("/api/admin/media/mux-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) {
        showToast(startData.error || "Erro ao iniciar upload de vídeo.", "error");
        return;
      }

      setItems((prev) => [startData.item, ...prev]);

      const putRes = await fetch(startData.uploadUrl, { method: "PUT", body: file });
      if (!putRes.ok) {
        showToast("Falha ao enviar o ficheiro de vídeo para o Mux.", "error");
        return;
      }

      showToast("Vídeo enviado — a processar no Mux (pode demorar alguns minutos).", "success");
      pollUploadStatus(startData.item.muxUploadId);
    } catch {
      showToast("Erro de comunicação ao carregar vídeo.", "error");
    } finally {
      setUploadingVideo(false);
    }
  };

  return (
    <div className="w-64 shrink-0 border-l border-slate-900 flex flex-col h-full">
      <div className="p-3 border-b border-slate-900 space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Biblioteca de Media</span>
        <p className="text-[10px] text-slate-600 leading-relaxed">Arraste uma imagem ou vídeo para a lista de blocos.</p>
        <div className="flex gap-1.5">
          <button
            onClick={() => imageInputRef.current?.click()}
            disabled={uploadingImage}
            className="flex-1 h-8 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-300 text-[10px] font-semibold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
          >
            {uploadingImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Imagem
          </button>
          <button
            onClick={() => videoInputRef.current?.click()}
            disabled={uploadingVideo}
            className="flex-1 h-8 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-300 text-[10px] font-semibold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
          >
            {uploadingVideo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Vídeo
          </button>
        </div>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageUpload(file);
            e.target.value = "";
          }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/x-matroska,.mov,.mp4,.mxf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleVideoUpload(file);
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-[10px] text-slate-600 text-center py-6 px-2">Ainda sem media. Carregue uma imagem ou vídeo acima.</p>
        ) : (
          items.map((item) => <DraggableMediaItem key={item._id} item={item} />)
        )}
      </div>
    </div>
  );
}

function DraggableMediaItem({ item }: { item: MediaItem }) {
  const isReady = item.type === "image" || item.status === "ready";
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `media-${item._id}`,
    data: { source: "media-library", item },
    disabled: !isReady,
  });

  return (
    <div
      ref={setNodeRef}
      {...(isReady ? listeners : {})}
      {...(isReady ? attributes : {})}
      className={`group flex items-center gap-2 p-1.5 rounded-lg border border-slate-900 bg-slate-900/20 transition-opacity ${
        isReady ? "cursor-grab active:cursor-grabbing hover:border-indigo-500/30" : "opacity-60 cursor-not-allowed"
      } ${isDragging ? "opacity-30" : ""}`}
      title={isReady ? "Arraste para a lista de blocos" : "Ainda a processar"}
    >
      {item.type === "image" ? (
        <img src={item.url} alt={item.alt || ""} className="h-9 w-9 rounded object-cover border border-slate-800 shrink-0" />
      ) : (
        <div className="h-9 w-9 rounded bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
          <Video className="h-3.5 w-3.5 text-slate-500" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-slate-300 truncate font-medium">{item.filename || item.alt || (item.type === "image" ? "Imagem" : "Vídeo")}</p>
        <div className="flex items-center gap-1">
          {item.type === "video" && item.status === "processing" && (
            <><Clock className="h-2.5 w-2.5 text-amber-500" /><span className="text-[9px] text-amber-500">A processar</span></>
          )}
          {item.type === "video" && item.status === "ready" && (
            <><CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" /><span className="text-[9px] text-emerald-500">Pronto</span></>
          )}
          {item.type === "video" && item.status === "error" && (
            <><XCircle className="h-2.5 w-2.5 text-rose-500" /><span className="text-[9px] text-rose-500">Erro</span></>
          )}
          {item.type === "image" && <ImageIcon className="h-2.5 w-2.5 text-slate-600" />}
        </div>
      </div>
      {isReady && <GripVertical className="h-3.5 w-3.5 text-slate-700 shrink-0 opacity-0 group-hover:opacity-100" />}
    </div>
  );
}
