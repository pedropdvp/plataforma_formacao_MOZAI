"use client";

import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  courseProgressData: { name: string; progresso: number }[];
  statusChartData: { name: string; valor: number }[];
}

const TOOLTIP_STYLE = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 11 };
const TOOLTIP_LABEL_STYLE = { color: "#fff" };
const AXIS_TICK = { fill: "#94a3b8", fontSize: 10 };

export default function DashboardCharts({ courseProgressData, statusChartData }: Props) {
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Progresso dos Cursos</h3>
        <div className="h-64 border border-slate-900 rounded-2xl bg-slate-900/10 p-3">
          {courseProgressData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500">
              Ainda sem cursos iniciados para mostrar progresso.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={courseProgressData} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" tick={AXIS_TICK} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={AXIS_TICK} domain={[0, 100]} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
                <Bar dataKey="progresso" name="Progresso (%)" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">
          Estado dos Cursos, Certificados e Diplomas
        </h3>
        <div className="h-64 border border-slate-900 rounded-2xl bg-slate-900/10 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statusChartData} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" tick={AXIS_TICK} />
              <YAxis tick={AXIS_TICK} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
              <Bar dataKey="valor" name="Quantidade" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
