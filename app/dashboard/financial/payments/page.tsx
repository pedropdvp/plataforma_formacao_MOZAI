"use client";

import { useToast } from "@/components/ui/toast-provider";

import React from "react";
import { CreditCard, Download, Receipt, ShieldCheck } from "lucide-react";

interface PaymentInvoice {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: "Pago" | "Pendente";
  invoiceUrl: string;
}

const INVOICES: PaymentInvoice[] = [
  { id: "inv-1", date: "12/07/2026", description: "Subscrição MOZAI - Basic", amount: "19,90 €", status: "Pago", invoiceUrl: "#" },
  { id: "inv-2", date: "12/06/2026", description: "Subscrição MOZAI - Basic", amount: "19,90 €", status: "Pago", invoiceUrl: "#" },
];

export default function PaymentsPage() {
  const { showToast } = useToast();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2.5">
          <CreditCard className="h-7 w-7 text-indigo-400" />
          Histórico de Pagamentos
        </h1>
        <p className="text-sm text-slate-400">
          Consulte as faturas geradas e os recibos de liquidação de subscrições.
        </p>
      </div>

      {/* Invoices List */}
      <div className="border border-slate-900 bg-slate-950/20 rounded-3xl p-6">
        <div className="space-y-3">
          {INVOICES.map((inv) => (
            <div
              key={inv.id}
              className="border border-slate-900 bg-[#070b13] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-white">{inv.description}</h4>
                  <span className="text-[10px] text-slate-500 font-mono">{inv.date}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                <span className="text-sm font-bold text-white">{inv.amount}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-450">
                  {inv.status}
                </span>
                
                <button
                  onClick={() => showToast(`A descarregar PDF da fatura ${inv.id}...`, "info")}
                  className="p-2 rounded-xl bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white border border-slate-900 transition-colors"
                  title="Descarregar Fatura"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
