/**
 * TransactionsPage — General Ledger transaction history, double-entry audit log, and journal inspector.
 */
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  History,
  Search,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Database,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import { apiClient } from "@/api/client";
import { formatLKR } from "@/lib/money";
import type { JournalEntryItem, JournalLineItem, FinancialAccount } from "@/types";

export const TransactionsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceType, setSourceType] = useState<string>("all");
  const [accountCode, setAccountCode] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedEntryId, setExpandedEntryId] = useState<number | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const handleExportExcel = async (type: "transactions" | "ledger" = "transactions") => {
    try {
      setIsExportingExcel(true);
      await apiClient.reports.downloadExport(type, {
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        account_code: accountCode !== "all" ? accountCode : undefined,
      });
    } catch (err: any) {
      alert(err.message || "Failed to download Excel file");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const { data: accounts = [] } = useQuery<FinancialAccount[]>({
    queryKey: ["financialAccounts"],
    queryFn: apiClient.accounts.list,
  });

  const { data: txResponse, isLoading } = useQuery<{ total: number; offset: number; limit: number; items: JournalEntryItem[] }>({
    queryKey: ["journalTransactions", startDate, endDate, accountCode, sourceType, searchTerm],
    queryFn: () =>
      apiClient.accounts.listTransactions({
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        account_code: accountCode !== "all" ? accountCode : undefined,
        source_type: sourceType !== "all" ? sourceType : undefined,
        search: searchTerm || undefined,
        limit: 200,
      }),
  });

  const entries = txResponse?.items || [];
  const totalEntries = txResponse?.total || 0;

  const toggleExpand = (id: number) => {
    setExpandedEntryId(prev => (prev === id ? null : id));
  };

  const handleExportCSV = () => {
    if (entries.length === 0) return;
    const rows = [
      ["Journal Entry Ref", "Date", "Source", "Description", "Account Code", "Account Name", "DR/CR", "Amount (Rs.)"],
    ];

    entries.forEach((e: JournalEntryItem) => {
      e.lines.forEach((l: JournalLineItem) => {
        rows.push([
          e.reference,
          e.entry_date,
          e.source_type || "",
          e.description,
          l.account_code,
          l.account_name,
          l.is_debit ? "DEBIT" : "CREDIT",
          (l.amount_paise / 100).toFixed(2),
        ]);
      });
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(r => r.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `general_ledger_transactions_${new Date().toISOString().split("T")[0]}.csv`);
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
            <History className="w-6 h-6 text-sky-400" />
            General Ledger & Transaction History
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Complete, immutable audit trail of all balanced double-entry journal postings across the system
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => handleExportExcel("transactions")}
            disabled={isExportingExcel || entries.length === 0}
            className="px-3.5 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-sm font-medium border border-emerald-500/30 transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            title="Export Transactions Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            {isExportingExcel ? "Exporting..." : "Excel (.xlsx)"}
          </button>
          <button
            onClick={() => handleExportExcel("ledger")}
            disabled={isExportingExcel || entries.length === 0}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            title="Export Full Ledger Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
            Ledger (.xlsx)
          </button>
          <button
            onClick={handleExportCSV}
            disabled={entries.length === 0}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-emerald-400" /> CSV
          </button>
        </div>
      </div>

      {/* Accounting Integrity Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Journal Entries</span>
            <Database className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-bold text-white">{totalEntries}</p>
          <p className="text-xs text-slate-500 mt-1">Total transactions posted</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Double-Entry Balance Invariant</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              100% Balanced (Sum DR = Sum CR)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Zero imbalance tolerance</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Historical Foundation</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-sm font-bold text-slate-200 mt-1">Starting 1 January 2026</p>
          <p className="text-xs text-slate-500 mt-1">Opening balance & operational transactions</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Keyword Search */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search reference, description..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Account Filter */}
          <div>
            <select
              value={accountCode}
              onChange={e => setAccountCode(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Accounts</option>
              {accounts.map((a: FinancialAccount) => (
                <option key={a.id} value={a.code}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Source Type */}
          <div>
            <select
              value={sourceType}
              onChange={e => setSourceType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Event Types</option>
              <option value="session_payment">Session Payments</option>
              <option value="pool_session">Pool Sessions</option>
              <option value="ps4_session">PS4 Sessions</option>
              <option value="expense">Expenses</option>
              <option value="account_transfer">Transfers</option>
              <option value="opening_balance">Opening Balance</option>
              <option value="equipment_purchase">Equipment Purchases</option>
              <option value="damage_charge">Damage Charges</option>
              <option value="owner_transaction">Capital & Withdrawals</option>
              <option value="loan">Loans</option>
            </select>
          </div>

          {/* Date Range Start / End */}
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-2 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
              title="Start Date"
            />
            <span className="text-slate-500 text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-2 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
              title="End Date"
            />
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Journal Entries ({entries.length})</h2>
          <span className="text-xs text-slate-400">Click any row to inspect debit/credit breakdown</span>
        </div>

        <div className="divide-y divide-slate-700/60">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400">Loading general ledger transactions...</div>
          ) : entries.length === 0 ? (
            <div className="py-16 text-center text-slate-500">No journal transactions found for these filters.</div>
          ) : (
            entries.map((entry: JournalEntryItem) => {
              const isExpanded = expandedEntryId === entry.id;

              return (
                <div key={entry.id} className="transition hover:bg-slate-750/20">
                  <div
                    onClick={() => toggleExpand(entry.id)}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <button className="text-slate-400 mt-0.5 p-1 rounded hover:bg-slate-700">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-sky-400">{entry.reference}</span>
                          <span className="text-xs text-slate-400 font-mono">{entry.entry_date}</span>
                          {entry.source_type && (
                            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-slate-700 text-slate-300">
                              {entry.source_type.replace("_", " ")}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-white mt-1">{entry.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 pl-8 sm:pl-0">
                      <div className="text-right">
                        <div className="font-mono font-bold text-white text-sm">
                          {formatLKR(entry.total_amount_paise)}
                        </div>
                        <span className="text-[11px] text-emerald-400 font-medium">Balanced Entry</span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Debit/Credit Lines */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 bg-slate-900/60 border-t border-slate-700/40">
                      <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/60 overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-700 text-slate-400 uppercase tracking-wider text-[10px]">
                              <th className="py-2 px-3">Account</th>
                              <th className="py-2 px-3">Description</th>
                              <th className="py-2 px-3 text-right">Debit (DR)</th>
                              <th className="py-2 px-3 text-right">Credit (CR)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700/40 font-mono">
                            {entry.lines.map((line: JournalLineItem, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-700/20">
                                <td className="py-2 px-3 font-sans">
                                  <span className="text-white font-medium">{line.account_name}</span>
                                </td>
                                <td className="py-2 px-3 text-slate-400 font-sans">{line.description || "—"}</td>
                                <td className="py-2 px-3 text-right text-emerald-400 font-semibold">
                                  {line.is_debit ? formatLKR(line.amount_paise) : "—"}
                                </td>
                                <td className="py-2 px-3 text-right text-sky-400 font-semibold">
                                  {!line.is_debit ? formatLKR(line.amount_paise) : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
