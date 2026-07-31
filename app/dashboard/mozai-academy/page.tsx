"use client";

import { useToast } from "@/components/ui/toast-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Compass, CheckCircle2, Play, Loader2, Smartphone, XCircle } from "lucide-react";

interface AcademyCourse {
  id: string;
  title: string;
  category: string;
  minutes: number;
  lessonsCount: number;
  firstLesson: string;
}

export default function MozaiAcademyPage() {
  const { showToast } = useToast();
  const confirmDialog = useConfirm();
  const [subActive, setSubActive] = useState(true);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  useEffect(() => {
    fetch("/api/catalog")
      .then((res) => res.json())
      .then((data) => setCourses(data.courses || []))
      .catch(() => showToast("Erro ao carregar o catálogo de cursos.", "error"))
      .finally(() => setLoadingCourses(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancelSub = async () => {
    const confirmed = await confirmDialog({
      title: "Cancelar Subscrição",
      message: "Tem a certeza de que deseja cancelar a sua subscrição?",
      confirmLabel: "Cancelar Subscrição",
      cancelLabel: "Manter Subscrição",
      destructive: true,
    });
    if (confirmed) {
      setSubActive(false);
      showToast("A subscrição foi agendada para cancelamento. Terá acesso até ao final do período pago.", "info");
    }
  };

  const handleReactivateSub = () => {
    setSubActive(true);
    showToast("Subscrição reativada com sucesso!", "success");
  };

  const handleInstallApp = () => {
    showToast("Instalação do PWA iniciada! Adicione a MOZAI ao ecrã inicial do seu telemóvel ou computador.", "info");
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <Compass className="h-7 w-7 text-indigo-400" />
          Mozai Academy
        </h1>
        <p className="text-sm text-slate-400">
          Gerencie a sua subscrição ativa, aceda ao catálogo integral de cursos e instale a aplicação.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        {/* Left Side: Subscription Manager Card & Notes */}
        <div className="space-y-6">
          {/* Subscription Status Card */}
          <div className="border border-slate-900 bg-[#070b13] rounded-3xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Subscrição Ativa</span>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                subActive
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-amber-500/10 border-amber-500/20 text-amber-400"
              }`}>
                {subActive ? "Ativa" : "Cancelamento Agendado"}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-2xl font-extrabold text-white">MOZAI – Basic</span>
              <span className="block text-xs text-slate-400">19,90 € / mês</span>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-900/60 text-xs text-slate-350">
              <div className="flex justify-between">
                <span className="text-slate-500">Próximo débito:</span>
                <span className="font-semibold text-white">12/08/2026</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Acesso garantido até:</span>
                <span className="font-semibold text-white">12/08/2026</span>
              </div>
            </div>

            {/* Cancel Button Flow */}
            <div className="space-y-2 pt-2">
              {subActive ? (
                <button
                  onClick={handleCancelSub}
                  className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-xl bg-slate-950 hover:bg-rose-950/15 border border-rose-500/20 hover:border-rose-500/40 text-xs font-semibold text-rose-400 transition-all cursor-pointer"
                >
                  <XCircle className="h-4 w-4" />
                  Cancelar subscrição
                </button>
              ) : (
                <button
                  onClick={handleReactivateSub}
                  className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Reativar Subscrição
                </button>
              )}
              <span className="text-[10px] text-slate-500 text-center block leading-relaxed px-2">
                O acesso mantém-se até ao fim do período pago. Podes reactivar a qualquer momento.
              </span>
            </div>
          </div>

          {/* O que está incluído list */}
          <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider">O que está incluído</h3>
            <ul className="space-y-3 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                <span>Acesso imediato a todos os cursos MOZAI</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                <span>50% de desconto em cursos fora da MOZAI</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                <span>Cancelas quando quiseres, sem custos</span>
              </li>
            </ul>
          </div>

          {/* Install App Box */}
          <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider">Instalar App</h3>
            <button
              onClick={handleInstallApp}
              className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white transition-colors"
            >
              <Smartphone className="h-4 w-4 text-indigo-400" />
              Instalar Aplicação PWA
            </button>
            <span className="text-[10px] text-slate-500 text-center block">
              Acesso rápido no ecrã inicial
            </span>
          </div>
        </div>

        {/* Right Side: List of 10 Mozai Courses */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-slate-900">
            <h3 className="font-bold text-lg text-white">Os Teus Cursos Mozai</h3>
            <span className="text-xs text-slate-500 font-medium">
              {loadingCourses ? "A carregar..." : `Total de ${courses.length} cursos disponíveis`}
            </span>
          </div>

          {/* Catálogo real (Sanity + cursos gerados por IA), nunca uma lista fixa */}
          {loadingCourses ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
            </div>
          ) : courses.length === 0 ? (
            <div className="border border-slate-900 border-dashed rounded-2xl p-8 text-center">
              <span className="text-xs text-slate-500">Ainda não há cursos publicados no catálogo.</span>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="border border-slate-900 bg-slate-950/40 rounded-2xl p-4 flex items-center justify-between hover:border-slate-800 transition-colors"
                >
                  <div className="space-y-1 min-w-0 pr-3">
                    <span className="text-[9px] text-indigo-400 font-semibold uppercase tracking-wider block">
                      {course.category}
                    </span>
                    <h4 className="font-bold text-sm text-white truncate">{course.title}</h4>
                    <div className="flex gap-4 text-[10px] text-slate-500">
                      <span>{Math.round((course.minutes || 0) / 60)}h de conteúdo</span>
                      <span>{course.lessonsCount} lições</span>
                    </div>
                  </div>

                  <Link
                    href={course.firstLesson ? `/dashboard/courses/${course.id}/lessons/${course.firstLesson}` : `/dashboard/catalog`}
                    className="h-8 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-white flex items-center gap-1 flex-shrink-0 transition-colors"
                  >
                    Aceder
                    <Play className="h-3 w-3 fill-white" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
