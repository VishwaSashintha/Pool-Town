/**
 * WeeklyReportPage — Weekly operational performance, revenue trends, and comparative metrics.
 */
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  DollarSign,
  CircleDot,
  Gamepad2,
  Coffee,
  Receipt,
  Banknote,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { apiClient } from "@/api/client";
import { formatLKR } from "@/lib/money";
import type { WeeklyReportData } from "@/types";

export const WeeklyReportPage: React.FC = () => {
  const [refDate, setRefDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: report, isLoading } = useQuery<WeeklyReportData>({
    queryKey: ["weeklyReport", refDate],
    queryFn: () => apiClient.reports.getWeekly(refDate),
  });

  const handlePrevWeek = () => {
    const d = new Date(refDate);
    d.setDate(d.getDate() - 7);
    setRefDate(d.toISOString().split("T")[0]);
  };

  const handleNextWeek = () => {
    const d = new Date(refDate);
    d.setDate(d.getDate() + 7);
    setRefDate(d.toISOString().split("T")[0]);
  };

  const handleExportCSV = () => {
    if (!report) return;
    const rows = [
      ["Billiard Hall Weekly Summary Report", `${report.week_start} to ${report.week_end}`],
      [],
      ["Stream", "Weekly Amount (Rs.)"],
      ["Pool Board Revenue", (report.pool_revenue_paise / 100).toFixed(2)],
      ["PS4 Gaming Revenue", (report.ps4_revenue_paise / 100).toFixed(2)],
      ["Soft Drinks Revenue", (report.drinks_revenue_paise / 100).toFixed(2)],
      ["Total Weekly Revenue", (report.total_revenue_paise / 100).toFixed(2)],
      ["Weekly Expenses", (report.total_expenses_paise / 100).toFixed(2)],
      ["Weekly Net Income", (report.net_income_paise / 100).toFixed(2)],
      [],
      ["Collections", "Amount (Rs.)"],
      ["Cash Collected", (report.cash_collected_paise / 100).toFixed(2)],
      ["Bank Collected", (report.bank_collected_paise / 100).toFixed(2)],
      ["Total Collections", (report.total_collected_paise / 100).toFixed(2)],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `weekly_report_${report.week_start}_to_${report.week_end}.csv`);
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
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            Weekly Operations & Financial Summary
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Seven-day performance across pool tables, gaming stations, soft drinks, and expenses
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="flex items-center bg-slate-800/80 border border-slate-700 rounded-lg p-1">
            <button
              onClick={handlePrevWeek}
              className="p-1 rounded text-slate-400 hover:text-white"
              title="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-mono text-slate-300">
              {report ? `${report.week_start} → ${report.week_end}` : refDate}
            </span>
            <button
              onClick={handleNextWeek}
              className="p-1 rounded text-slate-400 hover:text-white"
              title="Next Week"
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

      {isLoading ? (
        <div className="py-20 text-center text-slate-400">Loading weekly performance data...</div>
      ) : !report ? (
        <div className="py-20 text-center text-slate-500">No report data found for this week.</div>
      ) : (
        <>
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Total Weekly Revenue</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-white">{formatLKR(report.total_revenue_paise)}</p>
              <p className="text-xs text-slate-500 mt-1">Pool, PS4 & drinks gross revenue</p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Weekly Collections</span>
                <Banknote className="w-4 h-4 text-sky-400" />
              </div>
              <p className="text-2xl font-bold text-sky-400">{formatLKR(report.total_collected_paise)}</p>
              <p className="text-xs text-slate-500 mt-1">
                Cash: {formatLKR(report.cash_collected_paise)} • Bank: {formatLKR(report.bank_collected_paise)}
              </p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Weekly Expenses</span>
                <Receipt className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-2xl font-bold text-rose-400">{formatLKR(report.total_expenses_paise)}</p>
              <p className="text-xs text-slate-500 mt-1">All operating costs & utilities</p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Net Weekly Margin</span>
                <TrendingUp className="w-4 h-4 text-teal-400" />
              </div>
              <p className="text-2xl font-bold text-emerald-400">{formatLKR(report.net_income_paise)}</p>
              <p className="text-xs text-slate-500 mt-1">Distributable operating profit</p>
            </div>
          </div>

          {/* Department Breakdown */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-5">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              Revenue Stream Share ({report.week_start} to {report.week_end})
            </h2>

            <div className="space-y-4">
              {/* Pool */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium flex items-center gap-2">
                    <CircleDot className="w-3.5 h-3.5 text-emerald-400" /> Pool Board ({report.pool_sessions} sessions)
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">{formatLKR(report.pool_revenue_paise)}</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700/80">
                  <div
                    className="bg-emerald-500 h-2 rounded-full"
                    style={{
                      width: `${report.total_revenue_paise > 0 ? (report.pool_revenue_paise / report.total_revenue_paise) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* PS4 */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium flex items-center gap-2">
                    <Gamepad2 className="w-3.5 h-3.5 text-sky-400" /> PS4 Gaming ({report.ps4_sessions} sessions)
                  </span>
                  <span className="font-mono text-sky-400 font-bold">{formatLKR(report.ps4_revenue_paise)}</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700/80">
                  <div
                    className="bg-sky-500 h-2 rounded-full"
                    style={{
                      width: `${report.total_revenue_paise > 0 ? (report.ps4_revenue_paise / report.total_revenue_paise) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Drinks */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium flex items-center gap-2">
                    <Coffee className="w-3.5 h-3.5 text-amber-400" /> Soft Drinks ({report.drinks_bottles_sold} bottles sold)
                  </span>
                  <span className="font-mono text-amber-400 font-bold">{formatLKR(report.drinks_revenue_paise)}</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700/80">
                  <div
                    className="bg-amber-500 h-2 rounded-full"
                    style={{
                      width: `${report.total_revenue_paise > 0 ? (report.drinks_revenue_paise / report.total_revenue_paise) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
