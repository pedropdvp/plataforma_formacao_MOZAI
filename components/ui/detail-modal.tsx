"use client";

import React from "react";
import { X } from "lucide-react";

export interface DetailModalColumn {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
}

interface DetailModalProps {
  title: string;
  subtitle?: string;
  items: any[];
  columns?: DetailModalColumn[];
  renderItem?: (item: any, idx: number) => React.ReactNode;
  emptyMessage?: string;
  onClose: () => void;
}

export function DetailModal({
  title,
  subtitle,
  items,
  columns,
  renderItem,
  emptyMessage = "Nenhum registo encontrado.",
  onClose,
}: DetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col border border-slate-850 bg-slate-950 rounded-3xl p-6 shadow-2xl relative space-y-4 no-3d-effect">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-550 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="pb-3 border-b border-slate-900 pr-8">
          <h3 className="font-extrabold text-white text-base">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
          <p className="text-[10px] text-slate-550 mt-0.5">{items.length} {items.length === 1 ? "registo" : "registos"}</p>
        </div>

        <div className="overflow-y-auto flex-1 -mr-2 pr-2">
          {items.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-4">{emptyMessage}</p>
          ) : renderItem ? (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <React.Fragment key={idx}>{renderItem(item, idx)}</React.Fragment>
              ))}
            </div>
          ) : columns ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-900/60 bg-slate-950/40">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-900 text-[10px] text-slate-500 font-bold uppercase">
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        className={`p-2.5 ${col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"}`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/40">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-950/20 text-slate-300">
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`p-2.5 whitespace-nowrap ${col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"}`}
                        >
                          {item[col.key] ?? "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <button
          onClick={onClose}
          className="w-full h-10 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 font-semibold text-xs transition-colors cursor-pointer shrink-0"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
