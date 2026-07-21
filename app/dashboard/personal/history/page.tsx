"use client";

import React, { useState, useEffect } from "react";
import { Clock, GraduationCap, Loader2, Play, Search, Download, Calendar, Filter } from "lucide-react";
import { exportToCSV } from "@/lib/export-utils";

interface HistoryLogRaw {
  _id: string;
  courseId: string;
  lessonId: string;
  action: string;
  timestamp: string;
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<HistoryLogRaw[]>([]);
  const [courseTitles, setCourseTitles] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Estados de filtragem
  const [filterDate, setFilterDate] = useState("");
  const [filterCompleted, setFilterCompleted] = useState("all"); // "all" | "completed" | "started"
  const [filterLessonType, setFilterLessonType] = useState("all"); // "all" | "video" | "lab"
  const [filterCourse, setFilterCourse] = useState("all");

  useEffect(() => {
    async function fetchHistoryAndCatalog() {
      try {
        const [historyRes, catalogRes] = await Promise.all([
          fetch("/api/history"),
          fetch("/api/catalog"),
        ]);
        
        let logsData = [];
        if (historyRes.ok) {
          const data = await historyRes.json();
          logsData = data.logs || [];
        }

        const titlesMap: Record<string, string> = {
          "course-1": "Engenharia de IA e RAG Avançado",
          "course-2": "Next.js 16 e Arquiteturas Composable SaaS",
          "course-3": "Smart Contracts e Criptografia com Solidity",
          "course-4": "Curso de Criptomoedas: Fundamentos",
        };

        if (catalogRes.ok) {
          const cdata = await catalogRes.json();
          const courses = cdata.courses || [];
          courses.forEach((c: any) => {
            titlesMap[c._id] = c.title;
          });
        }

        setLogs(logsData);
        setCourseTitles(titlesMap);
      } catch (error) {
        console.error("Erro ao ler histórico e catálogo:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchHistoryAndCatalog();
  }, []);

  const getCourseTitle = (id: string) => {
    return courseTitles[id] || id;
  };

  const getLessonName = (lessonId: string) => {
    if (lessonId === "lesson-1-1") return "Introdução & Fundamentos";
    if (lessonId === "lesson-1-2") return "Pipelines e Embeddings";
    if (lessonId === "lesson-1-3") return "Pesquisa & Persistência";
    
    return lessonId
      .split("-")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getLessonType = (lessonId: string) => {
    // Se conter "coding-lab", "lab", "pratica" ou "desafio", é prático. Outros teóricos.
    const lid = lessonId.toLowerCase();
    if (lid.includes("lab") || lid.includes("coding") || lid.includes("solidity") || lid.includes("smart")) {
      return "Prático (Laboratório)";
    }
    return "Teórica / Vídeo";
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString("pt-PT", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }) + " " + date.toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString("pt-PT", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatHour = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Filtragem dos logs em memória
  const filteredLogs = logs.filter((log) => {
    // 1. Filtrar por data
    if (filterDate) {
      const logDay = new Date(log.timestamp).toISOString().split("T")[0];
      if (logDay !== filterDate) return false;
    }

    // 2. Filtrar por lição concluída ou não
    const isCompleted = log.action === "completed_lesson";
    if (filterCompleted === "completed" && !isCompleted) return false;
    if (filterCompleted === "started" && isCompleted) return false;

    // 3. Filtrar por tipo de lição
    const typeStr = getLessonType(log.lessonId);
    if (filterLessonType === "video" && typeStr.includes("Prático")) return false;
    if (filterLessonType === "lab" && !typeStr.includes("Prático")) return false;

    // 4. Filtrar por curso
    if (filterCourse !== "all" && log.courseId !== filterCourse) return false;

    return true;
  });

  // Exportar histórico filtrado para CSV utilizando o picker de arquivos
  const handleExportHistory = async () => {
    const headers = ["Data e Hora", "Curso", "Lição", "Tipo", "Estado da Lição"];
    const rows = filteredLogs.map((log) => {
      const isCompleted = log.action === "completed_lesson";
      return [
        formatTime(log.timestamp),
        getCourseTitle(log.courseId),
        getLessonName(log.lessonId),
        getLessonType(log.lessonId),
        isCompleted ? "Concluída" : "Iniciada"
      ];
    });
    await exportToCSV(headers, rows, `historico_aprendizagem_${new Date().toISOString().split("T")[0]}`);
  };

  return (
    <div className="space-y-8 max-w-5xl report-page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-900/40 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2.5">
            <Clock className="h-7 w-7 text-indigo-400" />
            Histórico
          </h1>
          <p className="text-sm text-slate-400">
            Acompanhe o diário das suas lições concluídas e atividades práticas.
          </p>
        </div>

        {filteredLogs.length > 0 && (
          <button
            onClick={handleExportHistory}
            className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Guardar Histórico
          </button>
        )}
      </div>

      {/* Barra de Filtros */}
      <div className="bg-slate-950/40 border border-slate-900 rounded-3xl p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Calendar className="h-3 w-3 text-indigo-400" />
            Filtrar por Data
          </label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-full h-10 px-3 bg-slate-950 border border-slate-900 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <GraduationCap className="h-3 w-3 text-indigo-400" />
            Estado da Lição
          </label>
          <select
            value={filterCompleted}
            onChange={(e) => setFilterCompleted(e.target.value)}
            className="w-full h-10 px-3 bg-slate-950 border border-slate-900 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">Todas as Lições</option>
            <option value="completed">Apenas Concluídas</option>
            <option value="started">Apenas Iniciadas</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Filter className="h-3 w-3 text-indigo-400" />
            Tipo de Lição
          </label>
          <select
            value={filterLessonType}
            onChange={(e) => setFilterLessonType(e.target.value)}
            className="w-full h-10 px-3 bg-slate-950 border border-slate-900 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">Todos os Tipos</option>
            <option value="video">Teórica / Vídeo</option>
            <option value="lab">Prática (Laboratório)</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Search className="h-3 w-3 text-indigo-400" />
            Filtrar por Curso
          </label>
          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="w-full h-10 px-3 bg-slate-950 border border-slate-900 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">Todos os Cursos</option>
            {Object.entries(courseTitles).map(([id, title]) => (
              <option key={id} value={id}>{title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Conteúdo Principal */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <span className="text-xs font-medium">A carregar diário de bordo...</span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-8 text-center space-y-3">
          <div className="h-10 w-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto">
            <Clock className="h-5 w-5 text-indigo-400" />
          </div>
          <p className="text-slate-400 text-xs font-medium">
            Nenhuma atividade corresponde aos filtros selecionados.
          </p>
        </div>
      ) : (
        /* History Horizontal List Table */
        <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-900 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  <th className="p-3">Data</th>
                  <th className="p-3">Hora</th>
                  <th className="p-3">Curso</th>
                  <th className="p-3">Lição</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Tipo da Lição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/40 text-slate-350">
                {filteredLogs.map((log) => {
                  const isCompleted = log.action === "completed_lesson";
                  return (
                    <tr key={log._id} className="hover:bg-slate-950/20 transition-colors">
                      {/* Coluna 1: Data */}
                      <td className="p-3 whitespace-nowrap text-slate-300 font-mono text-[11px]">
                        {formatDate(log.timestamp)}
                      </td>
                      
                      {/* Coluna 2: Hora */}
                      <td className="p-3 whitespace-nowrap text-slate-300 font-mono text-[11px]">
                        {formatHour(log.timestamp)}
                      </td>

                      {/* Coluna 3: Curso */}
                      <td className="p-3 text-[11.5px] font-medium text-slate-400">
                        {getCourseTitle(log.courseId)}
                      </td>

                      {/* Coluna 4: Lição */}
                      <td className="p-3 text-[12px] font-semibold text-white">
                        {getLessonName(log.lessonId)}
                      </td>

                      {/* Coluna 5: Estado */}
                      <td className="p-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          isCompleted 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                            : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                        }`}>
                          {isCompleted ? "Concluída" : "Iniciada"}
                        </span>
                      </td>

                      {/* Coluna 6: Tipo da Lição */}
                      <td className="p-3 whitespace-nowrap text-[11px] text-slate-400">
                        {getLessonType(log.lessonId)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
