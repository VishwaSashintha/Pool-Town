/**
 * MonthEndPage — Month-End closing checklist, period locking controls, and authorized reopening workflow.
 */
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarCheck,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  X,
} from "lucide-react";
import { apiClient } from "@/api/client";
import type { AccountingPeriod } from "@/types";

export const MonthEndPage: React.FC = () => {
  const queryClient = useQueryClient();
  const today = new Date();
  const [selectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth] = useState<number>(today.getMonth() + 1);

  const [periodToClose, setPeriodToClose] = useState<{ year: number; month: number } | null>(null);
  const [periodToReopen, setPeriodToReopen] = useState<{ year: number; month: number } | null>(null);
  const [closedByName, setClosedByName] = useState("Admin");
  const [reopenReason, setReopenReason] = useState("");
  const [reopenedByName, setReopenedByName] = useState("Admin");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Checklist local states
  const [checklist, setChecklist] = useState({
    cashReconciled: false,
    bankReconciled: false,
    stockCountVerified: false,
    expensesEntered: false,
    damageSettled: false,
    savingsAllocated: false,
    partnersApproved: false,
  });

  const { data: periods = [], isLoading: periodsLoading } = useQuery<AccountingPeriod[]>({
    queryKey: ["accountingPeriods"],
    queryFn: apiClient.accounts.listPeriods,
  });

  const closePeriodMutation = useMutation({
    mutationFn: ({ year, month, closed_by }: { year: number; month: number; closed_by: string }) =>
      apiClient.accounts.closePeriod(year, month, closed_by),
    onSuccess: (data: AccountingPeriod) => {
      queryClient.invalidateQueries({ queryKey: ["accountingPeriods"] });
      setSuccessMsg(`Period ${data.year}-${String(data.month).padStart(2, "0")} successfully locked and closed!`);
      setPeriodToClose(null);
      setTimeout(() => setSuccessMsg(""), 5000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to close period");
    },
  });

  const reopenPeriodMutation = useMutation({
    mutationFn: ({ year, month, reason, reopened_by }: { year: number; month: number; reason: string; reopened_by: string }) =>
      apiClient.accounts.reopenPeriod(year, month, reason, reopened_by),
    onSuccess: (data: AccountingPeriod) => {
      queryClient.invalidateQueries({ queryKey: ["accountingPeriods"] });
      setSuccessMsg(`Period ${data.year}-${String(data.month).padStart(2, "0")} reopened for authorized adjustments.`);
      setPeriodToReopen(null);
      setReopenReason("");
      setTimeout(() => setSuccessMsg(""), 5000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to reopen period");
    },
  });

  const allChecked = Object.values(checklist).every(Boolean);

  const toggleChecklist = (key: keyof typeof checklist) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCloseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodToClose) return;
    closePeriodMutation.mutate({
      year: periodToClose.year,
      month: periodToClose.month,
      closed_by: closedByName.trim() || "Admin",
    });
  };

  const handleReopenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodToReopen) return;
    if (!reopenReason.trim()) {
      setErrorMsg("A documented business reason is required to reopen a closed period.");
      return;
    }
    reopenPeriodMutation.mutate({
      year: periodToReopen.year,
      month: periodToReopen.month,
      reason: reopenReason.trim(),
      reopened_by: reopenedByName.trim() || "Admin",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <CalendarCheck className="w-6 h-6 text-emerald-400" />
            Month-End Closing & Period Locking
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Perform monthly reconciliations, enforce accounting period locks, and safeguard historical books
          </p>
        </div>

        <button
          onClick={() => {
            setPeriodToClose({ year: selectedYear, month: selectedMonth });
            setErrorMsg("");
          }}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition flex items-center gap-2 shadow-sm self-start sm:self-auto"
        >
          <Lock className="w-4 h-4" /> Lock Current Month ({selectedYear}-{String(selectedMonth).padStart(2, "0")})
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Month-End Closing Checklist */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Month-End Accounting Closing Checklist
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Verify all operational accounts before locking the books for {selectedYear}-{String(selectedMonth).padStart(2, "0")}
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
            allChecked ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
          }`}>
            {Object.values(checklist).filter(Boolean).length} / 7 Completed
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-700/60 cursor-pointer hover:bg-slate-900 transition">
            <input
              type="checkbox"
              checked={checklist.cashReconciled}
              onChange={() => toggleChecklist("cashReconciled")}
              className="mt-0.5 rounded text-emerald-500 focus:ring-emerald-500"
            />
            <div className="text-xs">
              <span className="font-semibold text-white">1. Cash Reconciliation (1001)</span>
              <p className="text-slate-400 mt-0.5">Physical cash in drawer verified against book balance.</p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-700/60 cursor-pointer hover:bg-slate-900 transition">
            <input
              type="checkbox"
              checked={checklist.bankReconciled}
              onChange={() => toggleChecklist("bankReconciled")}
              className="mt-0.5 rounded text-emerald-500 focus:ring-emerald-500"
            />
            <div className="text-xs">
              <span className="font-semibold text-white">2. Bank Statement Reconciliation (1002)</span>
              <p className="text-slate-400 mt-0.5">Commercial Bank monthly statement reconciled with general ledger.</p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-700/60 cursor-pointer hover:bg-slate-900 transition">
            <input
              type="checkbox"
              checked={checklist.stockCountVerified}
              onChange={() => toggleChecklist("stockCountVerified")}
              className="mt-0.5 rounded text-emerald-500 focus:ring-emerald-500"
            />
            <div className="text-xs">
              <span className="font-semibold text-white">3. Soft Drinks Physical Stock Count</span>
              <p className="text-slate-400 mt-0.5">End-of-month bottles in cooler counted and recorded.</p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-700/60 cursor-pointer hover:bg-slate-900 transition">
            <input
              type="checkbox"
              checked={checklist.expensesEntered}
              onChange={() => toggleChecklist("expensesEntered")}
              className="mt-0.5 rounded text-emerald-500 focus:ring-emerald-500"
            />
            <div className="text-xs">
              <span className="font-semibold text-white">4. All Expense Bills Entered</span>
              <p className="text-slate-400 mt-0.5">Rent, electricity, salaries, and maintenance bills recorded.</p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-700/60 cursor-pointer hover:bg-slate-900 transition">
            <input
              type="checkbox"
              checked={checklist.damageSettled}
              onChange={() => toggleChecklist("damageSettled")}
              className="mt-0.5 rounded text-emerald-500 focus:ring-emerald-500"
            />
            <div className="text-xs">
              <span className="font-semibold text-white">5. Equipment Damage Recoveries</span>
              <p className="text-slate-400 mt-0.5">Outstanding customer damage charges reviewed and resolved.</p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-700/60 cursor-pointer hover:bg-slate-900 transition">
            <input
              type="checkbox"
              checked={checklist.savingsAllocated}
              onChange={() => toggleChecklist("savingsAllocated")}
              className="mt-0.5 rounded text-emerald-500 focus:ring-emerald-500"
            />
            <div className="text-xs">
              <span className="font-semibold text-white">6. 40% Savings Allocated</span>
              <p className="text-slate-400 mt-0.5">40% net profit transferred to Account 1003 reserve fund.</p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-700/60 cursor-pointer hover:bg-slate-900 transition md:col-span-2">
            <input
              type="checkbox"
              checked={checklist.partnersApproved}
              onChange={() => toggleChecklist("partnersApproved")}
              className="mt-0.5 rounded text-emerald-500 focus:ring-emerald-500"
            />
            <div className="text-xs">
              <span className="font-semibold text-white">7. Partner Review & Sign-Off</span>
              <p className="text-slate-400 mt-0.5">Akash, Pasan, and Vishwa reviewed monthly profit figures.</p>
            </div>
          </label>
        </div>
      </div>

      {/* Accounting Periods Table */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Accounting Periods Ledger</h2>
          <span className="text-xs text-slate-400">Locking prevents unauthorized modifications</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Closed By</th>
                <th className="py-3 px-4">Closed Timestamp</th>
                <th className="py-3 px-4">Reopen Reason</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-sm">
              {periodsLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading period status...
                  </td>
                </tr>
              ) : periods.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No closed periods yet. All current periods remain open.
                  </td>
                </tr>
              ) : (
                periods.map((p: AccountingPeriod) => (
                  <tr key={p.id} className="hover:bg-slate-750/30 transition">
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {p.year}-{String(p.month).padStart(2, "0")}
                    </td>
                    <td className="py-3 px-4">
                      {p.is_closed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <Lock className="w-3 h-3" /> Locked & Closed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Unlock className="w-3 h-3" /> Open
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-300 text-xs">
                      {p.closed_by || "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs whitespace-nowrap">
                      {p.closed_at ? new Date(p.closed_at).toLocaleString() : "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs max-w-xs truncate">
                      {p.reopen_reason || "—"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {p.is_closed ? (
                        <button
                          onClick={() => {
                            setPeriodToReopen({ year: p.year, month: p.month });
                            setErrorMsg("");
                          }}
                          className="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition"
                        >
                          Reopen
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setPeriodToClose({ year: p.year, month: p.month });
                            setErrorMsg("");
                          }}
                          className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition"
                        >
                          Lock
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Close Period Confirmation Modal */}
      {periodToClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setPeriodToClose(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-400" />
              Lock Period {periodToClose.year}-{String(periodToClose.month).padStart(2, "0")}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Closing this accounting period prevents any further transactions from being created or backdated into this month.
            </p>

            <form onSubmit={handleCloseSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Closed By (Your Name / Role) *
                </label>
                <input
                  type="text"
                  value={closedByName}
                  onChange={e => setClosedByName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPeriodToClose(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={closePeriodMutation.isPending}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition shadow-sm disabled:opacity-50"
                >
                  {closePeriodMutation.isPending ? "Locking..." : "Confirm & Lock Period"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reopen Period Modal */}
      {periodToReopen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setPeriodToReopen(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Unlock className="w-5 h-5 text-amber-400" />
              Reopen Period {periodToReopen.year}-{String(periodToReopen.month).padStart(2, "0")}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Reopening allows adjustments. Per accounting regulations, you must document the authorized business reason.
            </p>

            <form onSubmit={handleReopenSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Authorized Reason for Reopening *
                </label>
                <textarea
                  rows={3}
                  value={reopenReason}
                  onChange={e => setReopenReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                  placeholder="e.g. Correcting missing January supplier invoice for table felt..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Reopened By *
                </label>
                <input
                  type="text"
                  value={reopenedByName}
                  onChange={e => setReopenedByName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPeriodToReopen(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reopenPeriodMutation.isPending}
                  className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition shadow-sm disabled:opacity-50"
                >
                  {reopenPeriodMutation.isPending ? "Reopening..." : "Authorize & Reopen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
