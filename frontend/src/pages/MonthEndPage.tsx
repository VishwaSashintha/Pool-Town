/**
 * MonthEndPage — Simplified 3-step guided month-end closing workflow.
 *
 * Step 1: Complete a plain-language verification checklist (7 items).
 * Step 2: Lock the current month with a clear "what this means" confirmation.
 * Step 3: View past closed months with reopen controls for Admin.
 *
 * No accounting lecture paragraphs. No jargon.
 * All backend API calls and data models are unchanged.
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
  ListChecks,
  History,
  ArrowRight,
  CircleDot,
} from "lucide-react";
import { apiClient } from "@/api/client";
import type { AccountingPeriod } from "@/types";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const MonthEndPage: React.FC = () => {
  const queryClient = useQueryClient();
  const today = new Date();
  const [selectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth] = useState<number>(today.getMonth() + 1);

  const monthLabel = `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;

  // Modal states
  const [periodToClose, setPeriodToClose] = useState<{ year: number; month: number } | null>(null);
  const [periodToReopen, setPeriodToReopen] = useState<{ year: number; month: number } | null>(null);
  const [closedByName, setClosedByName] = useState("Admin");
  const [reopenReason, setReopenReason] = useState("");
  const [reopenedByName, setReopenedByName] = useState("Admin");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Checklist state — 7 practical plain-language tasks
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
      setSuccessMsg(
        `${MONTH_NAMES[data.month]} ${data.year} has been locked. Historical records are now protected.`
      );
      setPeriodToClose(null);
      setTimeout(() => setSuccessMsg(""), 6000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to lock this period.");
    },
  });

  const reopenPeriodMutation = useMutation({
    mutationFn: ({ year, month, reason, reopened_by }: { year: number; month: number; reason: string; reopened_by: string }) =>
      apiClient.accounts.reopenPeriod(year, month, reason, reopened_by),
    onSuccess: (data: AccountingPeriod) => {
      queryClient.invalidateQueries({ queryKey: ["accountingPeriods"] });
      setSuccessMsg(
        `${MONTH_NAMES[data.month]} ${data.year} has been reopened. Make your adjustments, then re-lock when done.`
      );
      setPeriodToReopen(null);
      setReopenReason("");
      setTimeout(() => setSuccessMsg(""), 6000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to reopen this period.");
    },
  });

  const checkedCount = Object.values(checklist).filter(Boolean).length;
  const allChecked = checkedCount === 7;

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
      setErrorMsg("Please describe why you need to reopen this month.");
      return;
    }
    reopenPeriodMutation.mutate({
      year: periodToReopen.year,
      month: periodToReopen.month,
      reason: reopenReason.trim(),
      reopened_by: reopenedByName.trim() || "Admin",
    });
  };

  // Checklist item definitions — plain language, no jargon
  const checklistItems: { key: keyof typeof checklist; label: string; detail: string }[] = [
    {
      key: "cashReconciled",
      label: "Count and verify the cash in hand",
      detail: "Count all physical cash in the till or drawer and confirm it matches the system's expected balance.",
    },
    {
      key: "bankReconciled",
      label: "Match the bank statement",
      detail: "Check this month's bank statement against what the system shows. They should be the same.",
    },
    {
      key: "stockCountVerified",
      label: "Count soft drinks in the cooler",
      detail: "Count all remaining bottles and cans and check that the number matches what the system says is left.",
    },
    {
      key: "expensesEntered",
      label: "Enter all bills and expenses",
      detail: "Make sure rent, electricity, salaries, maintenance, and any other bills are recorded in the system.",
    },
    {
      key: "damageSettled",
      label: "Resolve any equipment damage charges",
      detail: "Check if any customers owe money for damaged cues or equipment and record or resolve those amounts.",
    },
    {
      key: "savingsAllocated",
      label: "Transfer the monthly savings portion",
      detail: "Move 40% of this month's net profit into the business savings reserve (cash or bank).",
    },
    {
      key: "partnersApproved",
      label: "Partners reviewed and agreed on the numbers",
      detail: "Akash, Pasan, and Vishwa confirmed that this month's income, expenses, and profit figures look correct.",
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <CalendarCheck className="w-6 h-6 text-emerald-400" />
          Month-End Closing
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Complete the checklist, lock the month, and protect your financial records
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="ml-auto text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ======================================== */}
      {/* STEP 1 — Verification Checklist           */}
      {/* ======================================== */}
      <div
        className="rounded-xl overflow-hidden shadow-sm"
        style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
      >
        {/* Step header */}
        <div
          className="px-5 py-4 border-b border-slate-700/60 flex items-center justify-between"
          style={{ backgroundColor: "#141E33" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-sky-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
              1
            </div>
            <div>
              <div className="flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-bold text-white">Verify Everything Before Closing</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                For <span className="text-white font-medium">{monthLabel}</span> — tick each item once you have confirmed it
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                allChecked
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              }`}
            >
              {checkedCount} of 7 done
            </span>
          </div>
        </div>

        {/* Checklist items */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          {checklistItems.map((item, i) => {
            const isChecked = checklist[item.key];
            return (
              <label
                key={item.key}
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                  isChecked
                    ? "bg-emerald-500/8 border-emerald-500/30"
                    : "bg-slate-900/50 border-slate-700/60 hover:bg-slate-900"
                } ${item.key === "partnersApproved" ? "md:col-span-2" : ""}`}
              >
                <div className="mt-0.5 shrink-0">
                  {isChecked ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <CircleDot className="w-5 h-5 text-slate-500" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <span className="text-slate-500 font-normal">{i + 1}.</span>
                    {item.label}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{item.detail}</p>
                </div>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleChecklist(item.key)}
                  className="sr-only"
                />
              </label>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="px-5 pb-5">
          <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(checkedCount / 7) * 100}%`,
                backgroundColor: allChecked ? "#10B981" : "#38BDF8",
              }}
            />
          </div>
        </div>
      </div>

      {/* ======================================== */}
      {/* STEP 2 — Lock the Month                  */}
      {/* ======================================== */}
      <div
        className={`rounded-xl p-5 shadow-sm transition-all ${
          allChecked ? "opacity-100" : "opacity-60"
        }`}
        style={{ backgroundColor: "#1E293B", border: allChecked ? "1px solid #10B981" : "1px solid #334155" }}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 ${
              allChecked ? "bg-emerald-500" : "bg-slate-700"
            }`}
          >
            2
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Lock className={`w-4 h-4 ${allChecked ? "text-emerald-400" : "text-slate-500"}`} />
              <h2 className="text-sm font-bold text-white">Lock & Finalize {monthLabel}</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Locking the month means the numbers for {monthLabel} are officially final. Nobody can add, edit, or delete any transaction from this month after locking. This protects your records from accidental changes.
            </p>
            <button
              disabled={!allChecked}
              onClick={() => {
                setPeriodToClose({ year: selectedYear, month: selectedMonth });
                setErrorMsg("");
              }}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition shadow-sm ${
                allChecked
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                  : "bg-slate-700 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Lock className="w-4 h-4" />
              Lock {monthLabel}
              {allChecked && <ArrowRight className="w-4 h-4" />}
            </button>
            {!allChecked && (
              <p className="text-[11px] text-amber-400 mt-2">
                Complete all {7 - checkedCount} remaining checklist item{7 - checkedCount !== 1 ? "s" : ""} above to enable locking.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ======================================== */}
      {/* STEP 3 — Past Closed Months              */}
      {/* ======================================== */}
      <div
        className="rounded-xl overflow-hidden shadow-sm"
        style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
      >
        <div
          className="px-5 py-4 border-b border-slate-700/60 flex items-center justify-between"
          style={{ backgroundColor: "#141E33" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              3
            </div>
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-bold text-white">Past Month History</h2>
            </div>
          </div>
          <span className="text-xs text-slate-400">
            {periods.length} period{periods.length !== 1 ? "s" : ""} on record
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700/60 bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Month</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Locked By</th>
                <th className="py-3 px-4">Locked On</th>
                <th className="py-3 px-4">Reopen Note</th>
                <th className="py-3 px-4 text-center">Admin Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-xs">
              {periodsLoading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400 text-xs">
                    Loading records…
                  </td>
                </tr>
              ) : periods.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500 text-xs">
                    No locked months yet. Once you lock a month, it will appear here.
                  </td>
                </tr>
              ) : (
                periods.map((p: AccountingPeriod) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-bold text-white whitespace-nowrap">
                      {MONTH_NAMES[p.month]} {p.year}
                    </td>
                    <td className="py-3 px-4">
                      {p.is_closed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 whitespace-nowrap">
                          <Lock className="w-3 h-3" /> Locked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                          <Unlock className="w-3 h-3" /> Open
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-300">{p.closed_by || "—"}</td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {p.closed_at ? new Date(p.closed_at).toLocaleString() : "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{p.reopen_reason || "—"}</td>
                    <td className="py-3 px-4 text-center">
                      {p.is_closed ? (
                        <button
                          onClick={() => {
                            setPeriodToReopen({ year: p.year, month: p.month });
                            setErrorMsg("");
                          }}
                          className="px-3 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold transition cursor-pointer whitespace-nowrap"
                        >
                          Reopen
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setPeriodToClose({ year: p.year, month: p.month });
                            setErrorMsg("");
                          }}
                          className="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition cursor-pointer whitespace-nowrap"
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

      {/* ======================================== */}
      {/* LOCK PERIOD CONFIRMATION MODAL            */}
      {/* ======================================== */}
      {periodToClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4"
            style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
          >
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-emerald-400" />
                Lock {MONTH_NAMES[periodToClose.month]} {periodToClose.year}?
              </h3>
              <button
                onClick={() => setPeriodToClose(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 text-xs space-y-2 text-slate-300">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Locking means all transactions in <strong className="text-white">{MONTH_NAMES[periodToClose.month]} {periodToClose.year}</strong> are finalized.
                  Nobody will be able to change those records without an authorized reopen.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>You can reopen it later if a correction is needed — but you must provide a written reason.</span>
              </div>
            </div>

            <form onSubmit={handleCloseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Your name *</label>
                <input
                  type="text"
                  value={closedByName}
                  onChange={e => setClosedByName(e.target.value)}
                  placeholder="e.g. Akash"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setPeriodToClose(null)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={closePeriodMutation.isPending}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {closePeriodMutation.isPending ? "Locking…" : "Confirm & Lock Month"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================== */}
      {/* REOPEN PERIOD MODAL                       */}
      {/* ======================================== */}
      {periodToReopen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4"
            style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
          >
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Unlock className="w-5 h-5 text-amber-400" />
                Reopen {MONTH_NAMES[periodToReopen.month]} {periodToReopen.year}?
              </h3>
              <button
                onClick={() => setPeriodToReopen(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-200">
              Reopening allows you to make corrections. After fixing the issue, remember to lock the month again.
            </div>

            <form onSubmit={handleReopenSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Why do you need to reopen this month? *
                </label>
                <textarea
                  rows={3}
                  value={reopenReason}
                  onChange={e => setReopenReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-amber-500"
                  placeholder="e.g. A supplier bill from January was missed — need to add it before reporting."
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Your name *</label>
                <input
                  type="text"
                  value={reopenedByName}
                  onChange={e => setReopenedByName(e.target.value)}
                  placeholder="e.g. Vishwa"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setPeriodToReopen(null)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reopenPeriodMutation.isPending}
                  className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {reopenPeriodMutation.isPending ? "Reopening…" : "Reopen This Month"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
