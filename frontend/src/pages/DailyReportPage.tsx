/**
 * DailyReportPage — Comprehensive daily operational, revenue, expense, and cash reconciliation report.
 */
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  BarChart3,
  CircleDot,
  Gamepad2,
  Coffee,
  Banknote,
  CheckCircle2,
  Download,
  Printer,
  FileSpreadsheet,
} from "lucide-react";
import { apiClient } from "@/api/client";
import { formatLKR } from "@/lib/money";
import type { DailyReportData } from "@/types";

export const DailyReportPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const { data: report, isLoading } = useQuery<DailyReportData>({
    queryKey: ["dailyReport", selectedDate],
    queryFn: () => apiClient.reports.getDaily(selectedDate),
  });

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      await apiClient.reports.downloadExport("daily", { report_date: selectedDate });
    } catch (err: any) {
      alert(err.message || "Failed to export Excel file");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!report) return;
    const rows = [
      ["Pool Town Daily Report", selectedDate],
      [],
      ["Revenue Stream", "Amount (Rs.)"],
      ["Pool Board Revenue", (report.pool_revenue_paise / 100).toFixed(2)],
      ["PS4 Gaming Revenue", (report.ps4_revenue_paise / 100).toFixed(2)],
      ["Soft Drinks Revenue", (report.drinks_revenue_paise / 100).toFixed(2)],
      ["Total Gross Revenue", (report.total_revenue_paise / 100).toFixed(2)],
      [],
      ["Collections & Expenses", "Amount (Rs.)"],
      ["Cash Collected", (report.cash_collected_paise / 100).toFixed(2)],
      ["Bank Collected", (report.bank_collected_paise / 100).toFixed(2)],
      ["Total Collected", (report.total_collected_paise / 100).toFixed(2)],
      ["Total Expenses", (report.total_expenses_paise / 100).toFixed(2)],
      ["Net Daily Income", (report.net_income_paise / 100).toFixed(2)],
      [],
      ["Account Balances", "Amount (Rs.)"],
      ["Cash in Hand", (report.cash_balance_paise / 100).toFixed(2)],
      ["Commercial Bank", (report.bank_balance_paise / 100).toFixed(2)],
      ["Savings Reserve", (report.savings_balance_paise / 100).toFixed(2)],
      ["Total Liquid Funds", (report.total_liquid_paise / 100).toFixed(2)],
      ["Total Outstanding AR", (report.total_outstanding_ar_paise / 100).toFixed(2)],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `daily_report_${selectedDate}.csv`);
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
            <BarChart3 className="w-6 h-6 text-sky-400" />
            Daily Operational & Revenue Report
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Authoritative daily closing, session revenues, cash reconciliations, and expense summaries
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-lg text-sm text-white">
            <Calendar className="w-4 h-4 text-sky-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent text-white text-sm focus:outline-none"
            />
          </div>

          <button
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            title="Download genuine Microsoft Excel (.xlsx) workbook"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isExportingExcel ? "Exporting…" : "Export Excel (.xlsx)"}</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition flex items-center gap-1.5"
            title="Export CSV"
          >
            <Download className="w-4 h-4 text-emerald-400" /> CSV
          </button>
          <button
            onClick={handlePrint}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition flex items-center gap-1.5"
            title="Print Report"
          >
            <Printer className="w-4 h-4 text-sky-400" /> Print
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-slate-400">Loading daily report for {selectedDate}...</div>
      ) : !report ? (
        <div className="py-20 text-center text-slate-500">No report data found for this date.</div>
      ) : (
        <>
          {/* Main Revenue & Net Income Highlight */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-slate-800/90 to-slate-900 border border-slate-700/80 rounded-2xl p-5 shadow-lg">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gross Day Revenue</span>
              <div className="text-3xl font-bold font-numeric text-white mt-1">
                {formatLKR(report.total_revenue_paise)}
              </div>
              <div className="text-xs text-slate-400 mt-2 flex items-center gap-3">
                <span>Pool: <strong className="font-numeric font-bold text-slate-200">{formatLKR(report.pool_revenue_paise)}</strong></span>
                <span>•</span>
                <span>PS4: <strong className="font-numeric font-bold text-slate-200">{formatLKR(report.ps4_revenue_paise)}</strong></span>
                <span>•</span>
                <span>Drinks: <strong className="font-numeric font-bold text-slate-200">{formatLKR(report.drinks_revenue_paise)}</strong></span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800/90 to-slate-900 border border-slate-700/80 rounded-2xl p-5 shadow-lg">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Day Collections</span>
              <div className="text-3xl font-bold font-numeric text-emerald-400 mt-1">
                {formatLKR(report.total_collected_paise)}
              </div>
              <div className="text-xs text-slate-400 mt-2 flex items-center gap-3">
                <span>Cash: <strong className="font-numeric font-bold text-emerald-300">{formatLKR(report.cash_collected_paise)}</strong></span>
                <span>•</span>
                <span>Bank: <strong className="font-numeric font-bold text-sky-300">{formatLKR(report.bank_collected_paise)}</strong></span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800/90 to-slate-900 border border-slate-700/80 rounded-2xl p-5 shadow-lg">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Net Operating Surplus</span>
              <div className="text-3xl font-bold font-numeric text-sky-400 mt-1">
                {formatLKR(report.net_income_paise)}
              </div>
              <div className="text-xs text-slate-400 mt-2">
                Expenses: <strong className="font-numeric font-bold text-rose-400">{formatLKR(report.total_expenses_paise)}</strong>
              </div>
            </div>
          </div>

          {/* Departmental Performance */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pool Board */}
            <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-4">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase text-emerald-400 flex items-center gap-1.5">
                  <CircleDot className="w-4 h-4" /> Pool Board Operations
                </span>
                <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-numeric font-bold">
                  {report.pool_sessions} sessions
                </span>
              </div>
              <p className="text-xl font-bold font-numeric text-white mt-1">{formatLKR(report.pool_revenue_paise)}</p>
              <p className="text-xs text-slate-500 mt-1">First hour Rs. 500 + Rs. 300 / 30 min block</p>
            </div>

            {/* PS4 Gaming */}
            <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-4">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase text-sky-400 flex items-center gap-1.5">
                  <Gamepad2 className="w-4 h-4" /> PS4 Gaming Operations
                </span>
                <span className="text-xs bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-full font-numeric font-bold">
                  {report.ps4_sessions} sessions
                </span>
              </div>
              <p className="text-xl font-bold font-numeric text-white mt-1">{formatLKR(report.ps4_revenue_paise)}</p>
              <p className="text-xs text-slate-500 mt-1">1P: Rs. 400/hr • 2P: Rs. 500/hr</p>
            </div>

            {/* Soft Drinks */}
            <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-4">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase text-amber-400 flex items-center gap-1.5">
                  <Coffee className="w-4 h-4" /> Soft Drinks Sales
                </span>
                <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-numeric font-bold">
                  {report.drinks_bottles_sold} bottles
                </span>
              </div>
              <p className="text-xl font-bold font-numeric text-white mt-1">{formatLKR(report.drinks_revenue_paise)}</p>
              <p className="text-xs text-slate-500 mt-1">Beverage counter sales</p>
            </div>
          </div>

          {/* Account & Liquid Balances as of Report Date */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-5 shadow-sm">
            <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Banknote className="w-5 h-5 text-emerald-400" />
              Financial Position & Liquid Assets as of {selectedDate}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-700/60">
                <span className="text-xs text-slate-400">Cash in Hand</span>
                <p className="text-lg font-bold text-emerald-400 font-mono mt-1">
                  {formatLKR(report.cash_balance_paise)}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-700/60">
                <span className="text-xs text-slate-400">Commercial Bank</span>
                <p className="text-lg font-bold text-sky-400 font-mono mt-1">
                  {formatLKR(report.bank_balance_paise)}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-700/60">
                <span className="text-xs text-slate-400">Savings Reserve</span>
                <p className="text-lg font-bold text-teal-400 font-mono mt-1">
                  {formatLKR(report.savings_balance_paise)}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-700/60">
                <span className="text-xs text-slate-400">Total Liquid Funds</span>
                <p className="text-lg font-bold text-white font-mono mt-1">
                  {formatLKR(report.total_liquid_paise)}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-700/60">
                <span className="text-xs text-slate-400">Outstanding AR Dues</span>
                <p className="text-lg font-bold text-amber-400 font-mono mt-1">
                  {formatLKR(report.total_outstanding_ar_paise)}
                </p>
              </div>
            </div>
          </div>

          {/* Daily Reconciliation Checklist */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Daily Closing Reconciliation Status
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Total cash collected on {selectedDate} was <strong className="text-white">{formatLKR(report.cash_collected_paise)}</strong> and
              bank transfers totaled <strong className="text-white">{formatLKR(report.bank_collected_paise)}</strong>.
              Compare physical cash in register with the expected balance in Cash in Hand using the Cash &amp; Bank reconciliation tab before closing operations.
            </p>
          </div>
        </>
      )}
    </div>
  );
};
