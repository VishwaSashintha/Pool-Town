/**
 * SavingsPage — Business Savings Management.
 * 
 * Provides 4 clear actions:
 * 1. Add Money to Savings (From Business Cash / Bank -> Savings Cash / Bank)
 * 2. Move Savings Cash to Bank (Savings Cash -> Savings Bank)
 * 3. Move Savings Bank to Cash (Savings Bank -> Savings Cash)
 * 4. View Savings History (Audit trail of all savings movements)
 * 
 * Also provides Monthly Savings Allocation:
 * - Allows user to split monthly savings into cash portion and bank portion
 * - Automatically calculates the total
 * - Validates amounts against available balances
 * - Records transfers exactly once upon explicit user action
 * - Invariant: Internal transfers between Savings Cash and Savings Bank never alter Total Savings.
 * - All internal account codes (1001, 1002, 1003, 1004) are hidden from the user.
 */
import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PiggyBank,
  TrendingUp,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  X,
  Wallet,
  Building,
  PlusCircle,
  ArrowRight,
  History,
  ShieldCheck,
  FileSpreadsheet,
} from "lucide-react";
import { api } from "@/api/client";
import { formatLKR, rupeesToPaise } from "@/lib/money";
import type { FinancialAccount, AccountTransfer, AccountTransferCreate, MonthlyReportData } from "@/types";

type TransferModalType = "add_savings" | "cash_to_bank" | "bank_to_cash" | "monthly_allocation" | null;

export const SavingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const historyRef = useRef<HTMLDivElement>(null);

  // Active modal
  const [activeModal, setActiveModal] = useState<TransferModalType>(null);

  // Standard Transfer Form State
  const [fromAccountId, setFromAccountId] = useState<number | "">("");
  const [toAccountId, setToAccountId] = useState<number | "">("");
  const [amountRs, setAmountRs] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");

  // Monthly Savings Split Form State
  const [allocCashRs, setAllocCashRs] = useState("");
  const [allocBankRs, setAllocBankRs] = useState("");
  const [allocDate, setAllocDate] = useState(new Date().toISOString().split("T")[0]);
  const [allocNotes, setAllocNotes] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      await api.reports.downloadExport("savings");
    } catch (err: any) {
      alert(err.message || "Failed to download Excel file");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const { data: accounts = [] } = useQuery<FinancialAccount[]>({
    queryKey: ["financialAccounts"],
    queryFn: () => api.accounts.list(),
  });

  const { data: transfers = [] } = useQuery<AccountTransfer[]>({
    queryKey: ["accountTransfers"],
    queryFn: () => api.accounts.listTransfers(100),
  });

  const { data: monthlyReport } = useQuery<MonthlyReportData>({
    queryKey: ["monthlyReportSavings"],
    queryFn: () => api.reports.getMonthly(),
  });

  // Accounts
  const cashInHandAccount = accounts.find((a) => a.code === "1001");
  const businessBankAccount = accounts.find((a) => a.code === "1002");
  const bankSavingsAccount = accounts.find((a) => a.code === "1003");
  const cashSavingsAccount = accounts.find((a) => a.code === "1004");

  const cashInHandBalance = cashInHandAccount?.current_balance_paise || 0;
  const businessBankBalance = businessBankAccount?.current_balance_paise || 0;
  const savingsInCash = cashSavingsAccount?.current_balance_paise || 0;
  const savingsInBank = bankSavingsAccount?.current_balance_paise || 0;
  const totalSavings = savingsInCash + savingsInBank;

  const currentMonthAllocated = monthlyReport?.profit_allocation?.savings_paise || 0;

  // Account label mapper (stripping all account codes)
  const getAccountLabel = (code: string, fallback: string) => {
    if (code === "1001") return "Cash in Hand";
    if (code === "1002") return "Main Bank Account";
    if (code === "1003") return "Savings Bank";
    if (code === "1004") return "Savings Cash";
    return fallback;
  };

  const getAccountBalance = (accountId: number | "") => {
    if (!accountId) return 0;
    const acct = accounts.find((a) => a.id === Number(accountId));
    return acct?.current_balance_paise || 0;
  };

  const transferMutation = useMutation({
    mutationFn: (data: AccountTransferCreate) => api.accounts.createTransfer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financialAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["accountTransfers"] });
      queryClient.invalidateQueries({ queryKey: ["trialBalance"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardAnalytics"] });
      setSuccessMsg("Transfer recorded successfully.");
      closeModal();
      setTimeout(() => setSuccessMsg(""), 5000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to process transfer.");
    },
  });

  const closeModal = () => {
    setActiveModal(null);
    setAmountRs("");
    setDescription("");
    setErrorMsg("");
    setAllocCashRs("");
    setAllocBankRs("");
    setAllocNotes("");
  };

  // Open predefined modal actions
  const openAddSavingsModal = () => {
    setErrorMsg("");
    setAmountRs("");
    setDescription("Addition to business savings");
    setTransferDate(new Date().toISOString().split("T")[0]);
    setFromAccountId(businessBankAccount?.id || cashInHandAccount?.id || "");
    setToAccountId(bankSavingsAccount?.id || cashSavingsAccount?.id || "");
    setActiveModal("add_savings");
  };

  const openCashToBankModal = () => {
    if (!cashSavingsAccount || !bankSavingsAccount) {
      setErrorMsg("Savings accounts are not configured.");
      return;
    }
    setErrorMsg("");
    setAmountRs("");
    setDescription("Move savings from cash to bank");
    setTransferDate(new Date().toISOString().split("T")[0]);
    setFromAccountId(cashSavingsAccount.id);
    setToAccountId(bankSavingsAccount.id);
    setActiveModal("cash_to_bank");
  };

  const openBankToCashModal = () => {
    if (!cashSavingsAccount || !bankSavingsAccount) {
      setErrorMsg("Savings accounts are not configured.");
      return;
    }
    setErrorMsg("");
    setAmountRs("");
    setDescription("Move savings from bank to cash");
    setTransferDate(new Date().toISOString().split("T")[0]);
    setFromAccountId(bankSavingsAccount.id);
    setToAccountId(cashSavingsAccount.id);
    setActiveModal("bank_to_cash");
  };

  const openMonthlyAllocationModal = () => {
    setErrorMsg("");
    setAllocDate(new Date().toISOString().split("T")[0]);
    setAllocNotes(`Monthly profit savings allocation - ${monthlyReport?.month_name || "Current Month"}`);
    // Default split: if savings share is available, set bank portion as default
    if (currentMonthAllocated > 0) {
      setAllocCashRs("0");
      setAllocBankRs((currentMonthAllocated / 100).toString());
    } else {
      setAllocCashRs("");
      setAllocBankRs("");
    }
    setActiveModal("monthly_allocation");
  };

  const scrollToHistory = () => {
    historyRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Handle Standard Transfer Submission
  const handleStandardTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountPaise = rupeesToPaise(parseFloat(amountRs) || 0);

    if (amountPaise <= 0) {
      setErrorMsg("Amount must be greater than zero.");
      return;
    }
    if (!fromAccountId || !toAccountId) {
      setErrorMsg("Please select both source and destination accounts.");
      return;
    }
    if (fromAccountId === toAccountId) {
      setErrorMsg("Source and destination accounts must be different.");
      return;
    }

    const sourceBalance = getAccountBalance(fromAccountId);
    if (amountPaise > sourceBalance) {
      const sourceAcct = accounts.find((a) => a.id === Number(fromAccountId));
      const sourceName = sourceAcct ? getAccountLabel(sourceAcct.code, sourceAcct.name) : "Source account";
      setErrorMsg(`Amount exceeds available balance in ${sourceName} (${formatLKR(sourceBalance)} available).`);
      return;
    }

    const sourceAcct = accounts.find((a) => a.id === Number(fromAccountId));
    const destAcct = accounts.find((a) => a.id === Number(toAccountId));
    const sourceName = sourceAcct ? getAccountLabel(sourceAcct.code, sourceAcct.name) : "Source";
    const destName = destAcct ? getAccountLabel(destAcct.code, destAcct.name) : "Destination";

    transferMutation.mutate({
      transfer_date: transferDate,
      from_account_id: Number(fromAccountId),
      to_account_id: Number(toAccountId),
      amount_paise: amountPaise,
      description: description.trim() || `Transfer from ${sourceName} to ${destName}`,
    });
  };

  // Handle Monthly Split Allocation Submit
  const handleMonthlyAllocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cashPaise = rupeesToPaise(parseFloat(allocCashRs) || 0);
    const bankPaise = rupeesToPaise(parseFloat(allocBankRs) || 0);
    const totalAllocPaise = cashPaise + bankPaise;

    if (totalAllocPaise <= 0) {
      setErrorMsg("Total savings allocation must be greater than zero.");
      return;
    }

    if (cashPaise > cashInHandBalance) {
      setErrorMsg(
        `Cash portion (${formatLKR(cashPaise)}) exceeds available Cash in Hand (${formatLKR(cashInHandBalance)}).`
      );
      return;
    }

    if (bankPaise > businessBankBalance) {
      setErrorMsg(
        `Bank portion (${formatLKR(bankPaise)}) exceeds available Main Bank balance (${formatLKR(businessBankBalance)}).`
      );
      return;
    }

    if (!cashInHandAccount || !businessBankAccount || !cashSavingsAccount || !bankSavingsAccount) {
      setErrorMsg("Required operating or savings accounts are not configured.");
      return;
    }

    try {
      // 1. If cash portion > 0: Transfer from Cash in Hand (1001) -> Savings Cash (1004)
      if (cashPaise > 0) {
        await api.accounts.createTransfer({
          transfer_date: allocDate,
          from_account_id: cashInHandAccount.id,
          to_account_id: cashSavingsAccount.id,
          amount_paise: cashPaise,
          description: allocNotes.trim()
            ? `${allocNotes.trim()} (Cash Portion)`
            : "Monthly Profit Savings Allocation (Cash)",
        });
      }

      // 2. If bank portion > 0: Transfer from Main Bank (1002) -> Savings Bank (1003)
      if (bankPaise > 0) {
        await api.accounts.createTransfer({
          transfer_date: allocDate,
          from_account_id: businessBankAccount.id,
          to_account_id: bankSavingsAccount.id,
          amount_paise: bankPaise,
          description: allocNotes.trim()
            ? `${allocNotes.trim()} (Bank Portion)`
            : "Monthly Profit Savings Allocation (Bank)",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["financialAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["accountTransfers"] });
      queryClient.invalidateQueries({ queryKey: ["trialBalance"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardAnalytics"] });
      setSuccessMsg(`Successfully allocated ${formatLKR(totalAllocPaise)} to business savings.`);
      closeModal();
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to record savings allocation.");
    }
  };

  // Savings transfers involving account 1003 or 1004
  const savingsTransfers = transfers.filter(
    (t) =>
      t.from_account_code === "1003" ||
      t.from_account_code === "1004" ||
      t.to_account_code === "1003" ||
      t.to_account_code === "1004"
  );

  // Dynamic calculation for monthly modal
  const currentAllocCashPaise = rupeesToPaise(parseFloat(allocCashRs) || 0);
  const currentAllocBankPaise = rupeesToPaise(parseFloat(allocBankRs) || 0);
  const currentAllocTotalPaise = currentAllocCashPaise + currentAllocBankPaise;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <PiggyBank className="w-6 h-6 text-emerald-400" />
            <span>Business Savings</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track business savings held in cash and bank, and manage transfers with ease
          </p>
        </div>

        {/* 4 Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={openAddSavingsModal}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-md cursor-pointer hover:opacity-95"
            style={{ backgroundColor: "#10B981", color: "#FFFFFF" }}
            title="Transfer money from business cash/bank into savings"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Money to Savings</span>
          </button>

          <button
            onClick={openCashToBankModal}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-md cursor-pointer hover:opacity-95"
            style={{ backgroundColor: "#38BDF8", color: "#0F172A" }}
            title="Move savings held as physical cash into the savings bank account"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Move Savings Cash to Bank</span>
          </button>

          <button
            onClick={openBankToCashModal}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
            title="Withdraw savings from the bank account to hold as savings cash"
          >
            <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
            <span>Move Savings Bank to Cash</span>
          </button>

          <button
            onClick={scrollToHistory}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 border border-slate-700 bg-slate-900/80 text-slate-300 hover:text-white hover:border-slate-500 cursor-pointer"
          >
            <History className="w-4 h-4 text-slate-400" />
            <span>View Savings History</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 border border-emerald-500/40 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 cursor-pointer disabled:opacity-50"
            title="Download full business savings ledger as Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>{isExportingExcel ? "Exporting..." : "Excel (.xlsx)"}</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{successMsg}</span>
        </div>
      )}

      {/* Primary Savings Figures Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Business Savings */}
        <div
          className="rounded-xl p-5 space-y-2 border-2"
          style={{ backgroundColor: "#1E293B", borderColor: "#6366F1" }}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
              Total Business Savings
            </span>
            <PiggyBank className="w-5 h-5 text-indigo-400" />
          </div>
          <p className="text-3xl font-extrabold font-numeric text-white tracking-tight">{formatLKR(totalSavings)}</p>
          <div className="flex items-center gap-1.5 text-xs text-indigo-300/80">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Savings Cash + Savings Bank</span>
          </div>
        </div>

        {/* 2. Savings Held in Cash */}
        <div
          className="rounded-xl p-5 space-y-2"
          style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Savings held as Cash</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold font-numeric text-emerald-400">{formatLKR(savingsInCash)}</p>
          <p className="text-xs text-slate-400">Physical savings cash in safety locker</p>
        </div>

        {/* 3. Savings Held in Bank */}
        <div
          className="rounded-xl p-5 space-y-2"
          style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Savings held in Bank</span>
            <Building className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-bold font-numeric text-sky-400">{formatLKR(savingsInBank)}</p>
          <p className="text-xs text-slate-400">Dedicated savings bank reserve</p>
        </div>

        {/* 4. Monthly 40% Allocation Card */}
        <div
          className="rounded-xl p-5 space-y-2"
          style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">40% Monthly Net Profit</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold font-numeric text-amber-400">{formatLKR(currentMonthAllocated)}</p>
          <button
            onClick={openMonthlyAllocationModal}
            className="text-xs font-medium text-amber-300 hover:text-amber-200 underline flex items-center gap-1 cursor-pointer"
          >
            <span>Allocate this month's portion</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Explanatory banner for non-accountants */}
      <div
        className="rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-slate-300"
        style={{ backgroundColor: "#141E33", border: "1px solid #1E293B" }}
      >
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <span className="font-semibold text-white">Savings Integrity Guarantee: </span>
            Moving money between Savings Cash and Savings Bank transfers funds directly without changing the Combined Savings total.
          </div>
        </div>
        <div className="text-slate-400">
          Available Operating Cash: <span className="text-emerald-400 font-mono font-medium">{formatLKR(cashInHandBalance)}</span> | Operating Bank: <span className="text-sky-400 font-mono font-medium">{formatLKR(businessBankBalance)}</span>
        </div>
      </div>

      {/* Savings Ledger History */}
      <div
        ref={historyRef}
        className="rounded-xl overflow-hidden shadow-sm"
        style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
      >
        <div className="p-4 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-bold text-white">Savings Transaction History</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">{savingsTransfers.length} record(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700/60 bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4">From</th>
                <th className="py-3 px-4">To</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-xs">
              {savingsTransfers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No savings transactions recorded yet. Use the buttons above to add savings or transfer funds.
                  </td>
                </tr>
              ) : (
                savingsTransfers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 text-slate-300 font-medium whitespace-nowrap">{t.transfer_date}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{t.reference}</td>
                    <td className="py-3 px-4 font-medium text-slate-300">
                      {getAccountLabel(t.from_account_code, t.from_account_name)}
                    </td>
                    <td className="py-3 px-4 font-medium text-emerald-400">
                      {getAccountLabel(t.to_account_code, t.to_account_name)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white whitespace-nowrap">
                      {formatLKR(t.amount_paise)}
                    </td>
                    <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{t.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD MONEY TO SAVINGS                                              */}
      {/* ========================================================================= */}
      {activeModal === "add_savings" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4"
            style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
          >
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                <span>Add Money to Savings</span>
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleStandardTransferSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Source Account (Where money comes from) *
                </label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-emerald-400"
                >
                  <option value="">Select source account...</option>
                  {businessBankAccount && (
                    <option value={businessBankAccount.id}>
                      Main Bank Account ({formatLKR(businessBankBalance)} available)
                    </option>
                  )}
                  {cashInHandAccount && (
                    <option value={cashInHandAccount.id}>
                      Cash in Hand ({formatLKR(cashInHandBalance)} available)
                    </option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Destination Savings Account (Where money will be kept) *
                </label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-emerald-400"
                >
                  <option value="">Select savings destination...</option>
                  {bankSavingsAccount && (
                    <option value={bankSavingsAccount.id}>
                      Savings Bank (Current: {formatLKR(savingsInBank)})
                    </option>
                  )}
                  {cashSavingsAccount && (
                    <option value={cashSavingsAccount.id}>
                      Savings Cash (Current: {formatLKR(savingsInCash)})
                    </option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Transfer Date *</label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-300">Amount to Save (Rs.) *</label>
                  {fromAccountId && (
                    <span className="text-[11px] text-slate-400">
                      Available: <span className="text-emerald-400 font-mono">{formatLKR(getAccountBalance(fromAccountId))}</span>
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={amountRs}
                  onChange={(e) => setAmountRs(e.target.value)}
                  placeholder="e.g. 10000"
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notes / Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Allocation to reserve funds"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-emerald-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferMutation.isPending}
                  className="px-5 py-2 rounded-lg text-xs font-semibold shadow-md cursor-pointer disabled:opacity-50 text-white"
                  style={{ backgroundColor: "#10B981" }}
                >
                  {transferMutation.isPending ? "Recording…" : "Save to Reserve"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: MOVE SAVINGS CASH TO BANK                                         */}
      {/* ========================================================================= */}
      {activeModal === "cash_to_bank" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4"
            style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
          >
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-sky-400" />
                <span>Move Savings Cash to Bank</span>
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-sky-950/40 border border-sky-800/40 text-xs text-sky-200">
              Depositing physical savings cash into the savings bank account. Total savings will stay unchanged at{" "}
              <strong className="text-white">{formatLKR(totalSavings)}</strong>.
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleStandardTransferSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-900/60 rounded-lg border border-slate-700/60 text-xs">
                <div>
                  <span className="text-slate-400 block">From:</span>
                  <span className="font-semibold text-white">Savings Cash</span>
                  <span className="block text-[11px] text-emerald-400 mt-0.5">
                    {formatLKR(savingsInCash)} available
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">To:</span>
                  <span className="font-semibold text-white">Savings Bank</span>
                  <span className="block text-[11px] text-sky-400 mt-0.5">
                    {formatLKR(savingsInBank)} current
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Transfer Date *</label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-300">Amount to Move (Rs.) *</label>
                  <button
                    type="button"
                    onClick={() => setAmountRs((savingsInCash / 100).toString())}
                    className="text-[11px] text-sky-400 hover:text-sky-300 underline cursor-pointer"
                  >
                    Move all ({formatLKR(savingsInCash)})
                  </button>
                </div>
                <input
                  type="number"
                  min="1"
                  max={savingsInCash / 100}
                  step="any"
                  value={amountRs}
                  onChange={(e) => setAmountRs(e.target.value)}
                  placeholder="Enter amount"
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notes / Reference</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Deposited into bank branch"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-sky-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferMutation.isPending || savingsInCash <= 0}
                  className="px-5 py-2 rounded-lg text-xs font-semibold shadow-md cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: "#38BDF8", color: "#0F172A" }}
                >
                  {transferMutation.isPending ? "Transferring…" : "Move to Bank"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: MOVE SAVINGS BANK TO CASH                                         */}
      {/* ========================================================================= */}
      {activeModal === "bank_to_cash" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4"
            style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
          >
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-emerald-400" />
                <span>Move Savings Bank to Cash</span>
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-xs text-emerald-200">
              Withdrawing from the savings bank account to hold as physical savings cash. Total savings will stay
              unchanged at <strong className="text-white">{formatLKR(totalSavings)}</strong>.
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleStandardTransferSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-900/60 rounded-lg border border-slate-700/60 text-xs">
                <div>
                  <span className="text-slate-400 block">From:</span>
                  <span className="font-semibold text-white">Savings Bank</span>
                  <span className="block text-[11px] text-sky-400 mt-0.5">
                    {formatLKR(savingsInBank)} available
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">To:</span>
                  <span className="font-semibold text-white">Savings Cash</span>
                  <span className="block text-[11px] text-emerald-400 mt-0.5">
                    {formatLKR(savingsInCash)} current
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Transfer Date *</label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-300">Amount to Move (Rs.) *</label>
                  <button
                    type="button"
                    onClick={() => setAmountRs((savingsInBank / 100).toString())}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                  >
                    Move all ({formatLKR(savingsInBank)})
                  </button>
                </div>
                <input
                  type="number"
                  min="1"
                  max={savingsInBank / 100}
                  step="any"
                  value={amountRs}
                  onChange={(e) => setAmountRs(e.target.value)}
                  placeholder="Enter amount"
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notes / Reference</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Bank withdrawal to safety locker"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-emerald-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferMutation.isPending || savingsInBank <= 0}
                  className="px-5 py-2 rounded-lg text-xs font-semibold shadow-md cursor-pointer disabled:opacity-50 text-white"
                  style={{ backgroundColor: "#10B981" }}
                >
                  {transferMutation.isPending ? "Transferring…" : "Move to Cash"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ALLOCATE MONTHLY SAVINGS (SPLIT CASH / BANK)                      */}
      {/* ========================================================================= */}
      {activeModal === "monthly_allocation" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4"
            style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
          >
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                <span>Allocate Monthly Savings</span>
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/40 text-xs text-amber-200 space-y-1">
              <div className="flex items-center justify-between">
                <span>Monthly Net Profit Savings Share (40%):</span>
                <strong className="text-white font-mono text-sm">{formatLKR(currentMonthAllocated)}</strong>
              </div>
              <p className="text-slate-400 text-[11px]">
                Choose how much to keep as physical cash in the locker and how much to deposit into the savings bank account.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleMonthlyAllocationSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Allocation Date *</label>
                <input
                  type="date"
                  value={allocDate}
                  onChange={(e) => setAllocDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-amber-400"
                />
              </div>

              {/* Cash Portion Input */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <Wallet className="w-4 h-4" />
                    <span>Cash Savings Portion (from Cash in Hand)</span>
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    Available: <span className="text-emerald-400 font-mono">{formatLKR(cashInHandBalance)}</span>
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={allocCashRs}
                  onChange={(e) => setAllocCashRs(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs outline-none focus:border-emerald-400"
                />
                <span className="text-[11px] text-slate-500 block">
                  Moves from Cash in Hand to Savings Cash
                </span>
              </div>

              {/* Bank Portion Input */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-sky-400 flex items-center gap-1.5">
                    <Building className="w-4 h-4" />
                    <span>Bank Savings Portion (from Main Bank Account)</span>
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    Available: <span className="text-sky-400 font-mono">{formatLKR(businessBankBalance)}</span>
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={allocBankRs}
                  onChange={(e) => setAllocBankRs(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs outline-none focus:border-sky-400"
                />
                <span className="text-[11px] text-slate-500 block">
                  Moves from Main Bank Account to Savings Bank
                </span>
              </div>

              {/* Automatically Calculated Total */}
              <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-700/50 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-indigo-300 block">Total Being Saved</span>
                  <span className="text-[11px] text-slate-400">Cash Portion + Bank Portion</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-white font-mono block">
                    {formatLKR(currentAllocTotalPaise)}
                  </span>
                  {currentMonthAllocated > 0 && (
                    <span
                      className={`text-[11px] font-medium ${
                        currentAllocTotalPaise === currentMonthAllocated
                          ? "text-emerald-400"
                          : currentAllocTotalPaise < currentMonthAllocated
                          ? "text-amber-400"
                          : "text-sky-400"
                      }`}
                    >
                      {currentAllocTotalPaise === currentMonthAllocated
                        ? "✓ Matches 40% monthly target"
                        : currentAllocTotalPaise < currentMonthAllocated
                        ? `Rs. ${(currentMonthAllocated - currentAllocTotalPaise) / 100} remaining`
                        : `Rs. ${(currentAllocTotalPaise - currentMonthAllocated) / 100} above target`}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notes</label>
                <input
                  type="text"
                  value={allocNotes}
                  onChange={(e) => setAllocNotes(e.target.value)}
                  placeholder="Monthly savings description"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={currentAllocTotalPaise <= 0}
                  className="px-5 py-2 rounded-lg text-xs font-semibold shadow-md cursor-pointer disabled:opacity-50 text-slate-950 font-bold"
                  style={{ backgroundColor: "#F59E0B" }}
                >
                  Save & Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
