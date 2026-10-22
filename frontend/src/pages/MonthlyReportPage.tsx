/**
 * MonthlyReportPage — Official monthly income statement, expense ledger, and 40/20/20/20 profit allocation.
 */
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  DollarSign,
  CircleDot,
  Gamepad2,
  Coffee,
  Receipt,
  PiggyBank,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { apiClient } from "@/api/client";
import { formatLKR } from "@/lib/money";
import type { MonthlyReportData, ProfitAllocationPost } from "@/types";

export const MonthlyReportPage: React.FC = () => {
  const queryClient = useQueryClient();
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
  const [postingSuccess, setPostingSuccess] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const { data: report, isLoading } = useQuery<MonthlyReportData>({
    queryKey: ["monthlyReport", selectedYear, selectedMonth],
    queryFn: () => apiClient.reports.getMonthly(selectedYear, selectedMonth),
  });

  const postAllocationMutation = useMutation({
    mutationFn: (data: ProfitAllocationPost) => apiClient.owners.postProfitAllocation(data),
    onSuccess: (res: { message: string; reference: string; journal_reference: string }) => {
      queryClient.invalidateQueries({ queryKey: ["monthlyReport"] });
      queryClient.invalidateQueries({ queryKey: ["ownersList"] });
      queryClient.invalidateQueries({ queryKey: ["financialAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["trialBalance"] });
      setPostingSuccess(`Profit allocation posted under journal ref: ${res.journal_reference || res.reference}!`);
      setTimeout(() => setPostingSuccess(""), 5000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to post profit allocation");
    },
  });

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const handlePostAllocation = () => {
    if (!report || report.net_income_paise <= 0) {
      setErrorMsg("No net profit available to allocate for this month");
      return;
    }
    setErrorMsg("");
    postAllocationMutation.mutate({
      year: selectedYear,
      month: selectedMonth,
      approved_by: "Admin",
      notes: `Monthly profit allocation for ${report.month_name}`,
    });
  };

  const handleExportCSV = () => {
    if (!report) return;
    const rows = [
      [`Billiard Hall Monthly Financial Report — ${report.month_name}`],
      [],
      ["Revenue Source", "Amount (Rs.)"],
      ["Pool Board Revenue (4001)", (report.pool_revenue_paise / 100).toFixed(2)],
      ["PS4 Gaming Revenue (4002)", (report.ps4_revenue_paise / 100).toFixed(2)],
      ["Soft Drinks Sales Revenue (4003)", (report.drinks_revenue_paise / 100).toFixed(2)],
      ["Total Gross Revenue", (report.total_revenue_paise / 100).toFixed(2)],
      [],
      ["Operating Costs", "Amount (Rs.)"],
      ["Total Operating Expenses", (report.total_expenses_paise / 100).toFixed(2)],
      ["Net Distributable Profit", (report.net_income_paise / 100).toFixed(2)],
      [],
      ["Profit Allocation (40/20/20/20)", "Share Amount (Rs.)"],
      ["Savings Reserve Fund (40%)", (report.profit_allocation.savings_paise / 100).toFixed(2)],
      ["Akash (20%)", (report.profit_allocation.akash_paise / 100).toFixed(2)],
      ["Pasan (20%)", (report.profit_allocation.pasan_paise / 100).toFixed(2)],
      ["Vishwa (20% + Remainder)", (report.profit_allocation.vishwa_paise / 100).toFixed(2)],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `monthly_report_${selectedYear}_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-indigo-400" />
            Monthly Income Statement & Profit Allocation
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Authoritative partnership income statement, 40% business savings reserve, and 20% owner shares
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Month Navigator */}
          <div className="flex items-center bg-slate-800/80 border border-slate-700 rounded-lg p-1">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded text-slate-400 hover:text-white"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-semibold text-white">
              {report?.month_name || `${selectedYear}-${selectedMonth}`}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded text-slate-400 hover:text-white"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition flex items-center gap-1.5"
            title="Export CSV"
          >
            <Download className="w-4 h-4 text-emerald-400" /> CSV
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition flex items-center gap-1.5"
            title="Print Report"
          >
            <Printer className="w-4 h-4 text-sky-400" /> Print
          </button>
        </div>
      </div>

      {postingSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{postingSuccess}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-20 text-center text-slate-400">Loading monthly financial statements...</div>
      ) : !report ? (
        <div className="py-20 text-center text-slate-500">No report available for this period.</div>
      ) : (
        <>
          {/* Headline Financial Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Gross Operating Revenue</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-white">{formatLKR(report.total_revenue_paise)}</p>
              <p className="text-xs text-slate-500 mt-1">Pool, PS4 & drinks sales</p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Operating Expenses</span>
                <Receipt className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-2xl font-bold text-rose-400">{formatLKR(report.total_expenses_paise)}</p>
              <p className="text-xs text-slate-500 mt-1">Paid & accrued expense bills</p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Net Operating Profit</span>
                <TrendingUp className="w-4 h-4 text-sky-400" />
              </div>
              <p className="text-2xl font-bold text-emerald-400">{formatLKR(report.net_income_paise)}</p>
              <p className="text-xs text-slate-500 mt-1">Available for partner distribution</p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Savings Reserve (40%)</span>
                <PiggyBank className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-2xl font-bold text-indigo-400">
                {formatLKR(report.profit_allocation.savings_paise)}
              </p>
              <p className="text-xs text-slate-500 mt-1">Target Rs. 100,000 / month</p>
            </div>
          </div>

          {/* Income Statement Table */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Income Statement — {report.month_name}
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                {report.period_start} to {report.period_end}
              </span>
            </div>

            <div className="p-5 space-y-6">
              {/* Revenues */}
              <div>
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
                  1. Operating Revenues
                </h3>
                <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 divide-y divide-slate-800">
                  <div className="p-3 flex justify-between items-center text-sm">
                    <span className="text-slate-300 flex items-center gap-2">
                      <CircleDot className="w-4 h-4 text-emerald-400" /> Pool Board Playing Revenue (4001)
                    </span>
                    <span className="font-mono text-white font-semibold">{formatLKR(report.pool_revenue_paise)}</span>
                  </div>
                  <div className="p-3 flex justify-between items-center text-sm">
                    <span className="text-slate-300 flex items-center gap-2">
                      <Gamepad2 className="w-4 h-4 text-sky-400" /> PS4 Gaming Session Revenue (4002)
                    </span>
                    <span className="font-mono text-white font-semibold">{formatLKR(report.ps4_revenue_paise)}</span>
                  </div>
                  <div className="p-3 flex justify-between items-center text-sm">
                    <span className="text-slate-300 flex items-center gap-2">
                      <Coffee className="w-4 h-4 text-amber-400" /> Soft Drinks Sales Revenue (4003)
                    </span>
                    <span className="font-mono text-white font-semibold">{formatLKR(report.drinks_revenue_paise)}</span>
                  </div>
                  <div className="p-3 flex justify-between items-center text-sm bg-slate-800/40 font-bold">
                    <span className="text-white">Total Gross Revenue</span>
                    <span className="font-mono text-emerald-400">{formatLKR(report.total_revenue_paise)}</span>
                  </div>
                </div>
              </div>

              {/* Operating Expenses */}
              <div>
                <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2">
                  2. Operating Expenses & Overheads
                </h3>
                <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 p-3 flex justify-between items-center text-sm font-bold bg-slate-800/40">
                  <span className="text-white">Total Operating Expenses (6xxx Accounts)</span>
                  <span className="font-mono text-rose-400">{formatLKR(report.total_expenses_paise)}</span>
                </div>
              </div>

              {/* Net Distributable Profit */}
              <div className="p-4 rounded-xl bg-slate-900 border-2 border-emerald-500/30 flex justify-between items-center">
                <div>
                  <span className="text-xs uppercase font-bold text-slate-400">Net Distributable Partnership Profit</span>
                  <p className="text-xs text-slate-500 mt-0.5">Calculated as: Total Gross Revenue − Total Operating Expenses</p>
                </div>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  {formatLKR(report.net_income_paise)}
                </div>
              </div>
            </div>
          </div>

          {/* Profit Allocation Model (40/20/20/20) */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-indigo-400" />
                  Partnership Profit Distribution Model (40% Savings / 20% Each Owner)
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Remainder from integer paise rounding is assigned to Vishwa per partnership rules.
                </p>
              </div>

              <button
                onClick={handlePostAllocation}
                disabled={postAllocationMutation.isPending || report.net_income_paise <= 0}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-sm disabled:opacity-50 flex items-center gap-2 self-start sm:self-auto"
              >
                <CheckCircle2 className="w-4 h-4" />
                {postAllocationMutation.isPending ? "Posting to Ledger..." : "Post Profit Allocation to Ledger"}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              {/* Savings */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-emerald-500/30">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="font-semibold text-emerald-400">Savings Reserve</span>
                  <span className="font-mono font-bold">40.0%</span>
                </div>
                <div className="text-xl font-bold font-mono text-white mt-1">
                  {formatLKR(report.profit_allocation.savings_paise)}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Target Rs. 100,000 / month</p>
              </div>

              {/* Akash */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-sky-500/30">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="font-semibold text-sky-400">Akash</span>
                  <span className="font-mono font-bold">20.0%</span>
                </div>
                <div className="text-xl font-bold font-mono text-white mt-1">
                  {formatLKR(report.profit_allocation.akash_paise)}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Credit to Account 7001</p>
              </div>

              {/* Pasan */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-sky-500/30">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="font-semibold text-sky-400">Pasan</span>
                  <span className="font-mono font-bold">20.0%</span>
                </div>
                <div className="text-xl font-bold font-mono text-white mt-1">
                  {formatLKR(report.profit_allocation.pasan_paise)}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Credit to Account 7002</p>
              </div>

              {/* Vishwa */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-indigo-500/30">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="font-semibold text-indigo-400">Vishwa</span>
                  <span className="font-mono font-bold">20.0% + rem</span>
                </div>
                <div className="text-xl font-bold font-mono text-white mt-1">
                  {formatLKR(report.profit_allocation.vishwa_paise)}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Credit to Account 7003</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
