/**
 * SavingsPage — Business Savings Reserve (Account 1003) & 40% monthly net profit allocation tracker.
 */
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PiggyBank,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  X,
  Target,
} from "lucide-react";
import { apiClient } from "@/api/client";
import { formatLKR, rupeesToPaise } from "@/lib/money";
import type { FinancialAccount, AccountTransfer, AccountTransferCreate, MonthlyReportData } from "@/types";

export const SavingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  // Form states
  const [amountRs, setAmountRs] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState<number | "">("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const { data: accounts = [] } = useQuery<FinancialAccount[]>({
    queryKey: ["financialAccounts"],
    queryFn: apiClient.accounts.list,
  });

  const { data: transfers = [], isLoading: transfersLoading } = useQuery<AccountTransfer[]>({
    queryKey: ["accountTransfers"],
    queryFn: () => apiClient.accounts.listTransfers(100),
  });

  const { data: monthlyReport } = useQuery<MonthlyReportData>({
    queryKey: ["monthlyReportSavings"],
    queryFn: () => apiClient.reports.getMonthly(),
  });

  const transferMutation = useMutation({
    mutationFn: (data: AccountTransferCreate) => apiClient.accounts.createTransfer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financialAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["accountTransfers"] });
      queryClient.invalidateQueries({ queryKey: ["trialBalance"] });
      setSuccessMsg("Savings transaction recorded successfully!");
      setShowDepositModal(false);
      setShowWithdrawModal(false);
      setAmountRs("");
      setDescription("");
      setErrorMsg("");
      setTimeout(() => setSuccessMsg(""), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to process transfer");
    },
  });

  // Target Savings is Rs. 100,000 per month (= 10,000,000 paise)
  const MONTHLY_SAVINGS_TARGET_PAISE = 10000000;

  const savingsAccount = accounts.find((a: FinancialAccount) => a.code === "1003");
  const savingsBalance = savingsAccount?.current_balance_paise || 0;

  const currentMonthAllocated = monthlyReport?.profit_allocation?.savings_paise || 0;
  const targetPercent = Math.min(100, Math.round((currentMonthAllocated / MONTHLY_SAVINGS_TARGET_PAISE) * 100));

  // Filter transfers involving Account 1003
  const savingsTransfers = transfers.filter(
    (t: AccountTransfer) => t.from_account_code === "1003" || t.to_account_code === "1003"
  );

  const handleDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountPaise = rupeesToPaise(parseFloat(amountRs) || 0);
    if (amountPaise <= 0) {
      setErrorMsg("Amount must be greater than zero");
      return;
    }
    if (!sourceAccountId) {
      setErrorMsg("Please select source account (Cash or Bank)");
      return;
    }
    if (!savingsAccount) {
      setErrorMsg("Savings Account (1003) not configured");
      return;
    }

    transferMutation.mutate({
      transfer_date: transferDate,
      from_account_id: Number(sourceAccountId),
      to_account_id: savingsAccount.id,
      amount_paise: amountPaise,
      description: description || "Transfer to Savings Reserve (1003)",
    });
  };

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountPaise = rupeesToPaise(parseFloat(amountRs) || 0);
    if (amountPaise <= 0) {
      setErrorMsg("Amount must be greater than zero");
      return;
    }
    if (amountPaise > savingsBalance) {
      setErrorMsg(`Withdrawal exceeds available savings balance of ${formatLKR(savingsBalance)}`);
      return;
    }
    if (!sourceAccountId) {
      setErrorMsg("Please select destination account (Cash or Bank)");
      return;
    }
    if (!savingsAccount) {
      setErrorMsg("Savings Account (1003) not configured");
      return;
    }

    transferMutation.mutate({
      transfer_date: transferDate,
      from_account_id: savingsAccount.id,
      to_account_id: Number(sourceAccountId),
      amount_paise: amountPaise,
      description: description || "Emergency / Maintenance withdrawal from Savings (1003)",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <PiggyBank className="w-6 h-6 text-emerald-400" />
            Savings Reserve Account (1003)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Business emergency reserve fund, equipment maintenance reserve, and monthly 40% profit allocations
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => {
              setShowDepositModal(true);
              setErrorMsg("");
              setAmountRs("");
            }}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition flex items-center gap-2 shadow-sm"
          >
            <ArrowDownRight className="w-4 h-4" /> Deposit to Savings
          </button>
          <button
            onClick={() => {
              setShowWithdrawModal(true);
              setErrorMsg("");
              setAmountRs("");
            }}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition flex items-center gap-2"
          >
            <ArrowUpRight className="w-4 h-4 text-amber-400" /> Emergency Withdrawal
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Current Savings Balance</span>
            <PiggyBank className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400">{formatLKR(savingsBalance)}</p>
          <p className="text-xs text-slate-500 mt-1">Held in Account 1003</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Monthly Savings Target</span>
            <Target className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-bold text-white">{formatLKR(MONTHLY_SAVINGS_TARGET_PAISE)}</p>
          <p className="text-xs text-slate-500 mt-1">Rs. 100,000 / month target</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">This Month's 40% Share</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-indigo-400">{formatLKR(currentMonthAllocated)}</p>
          <p className="text-xs text-slate-500 mt-1">{targetPercent}% of target reached</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Reserve Fund Health</span>
            <ShieldCheck className="w-4 h-4 text-teal-400" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-700">
              <div
                className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(5, (savingsBalance / (MONTHLY_SAVINGS_TARGET_PAISE * 3)) * 100))}%` }}
              />
            </div>
            <span className="text-xs font-bold text-slate-300">
              {Math.round((savingsBalance / (MONTHLY_SAVINGS_TARGET_PAISE * 3)) * 100)}%
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Target 3-month operating reserve</p>
        </div>
      </div>

      {/* Target Progress Card */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
        <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
          <Target className="w-4 h-4 text-emerald-400" /> Monthly Profit Retention Rule (40% Savings)
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
          Under the partnership agreement, each month 40% of net operating profit is transferred into the business
          savings reserve to fund future repairs, table re-felting, cue stick replacements, and unexpected operational expenses.
          The remaining 60% is distributed equally (20% each) to Akash, Pasan, and Vishwa.
        </p>
      </div>

      {/* Savings Transfers History */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Savings Ledger History (Transfers & Inflows)</h2>
          <span className="text-xs text-slate-400">{savingsTransfers.length} transaction(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Flow Direction</th>
                <th className="py-3 px-4">Account</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-sm">
              {transfersLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading savings history...
                  </td>
                </tr>
              ) : savingsTransfers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No savings transactions recorded yet. Use the deposit button above to transfer funds to savings.
                  </td>
                </tr>
              ) : (
                savingsTransfers.map((t: AccountTransfer) => {
                  const isDeposit = t.to_account_code === "1003";
                  return (
                    <tr key={t.id} className="hover:bg-slate-750/30 transition">
                      <td className="py-3 px-4 font-mono text-xs font-medium text-slate-300">
                        {t.reference}
                      </td>
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {t.transfer_date}
                      </td>
                      <td className="py-3 px-4">
                        {isDeposit ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <ArrowDownRight className="w-3 h-3" /> Deposit to Savings
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <ArrowUpRight className="w-3 h-3" /> Withdrawal
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300 text-xs">
                        {isDeposit ? `From ${t.from_account_name}` : `To ${t.to_account_name}`}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-semibold ${isDeposit ? "text-emerald-400" : "text-rose-400"}`}>
                        {isDeposit ? `+${formatLKR(t.amount_paise)}` : `-${formatLKR(t.amount_paise)}`}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs max-w-xs truncate">
                        {t.description || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deposit to Savings Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setShowDepositModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-emerald-400" />
              Deposit to Savings Reserve (1003)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Transfer funds from Cash in Hand or Commercial Bank into Savings Reserve
            </p>

            {errorMsg && (
              <div className="my-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleDepositSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Source Account *
                </label>
                <select
                  value={sourceAccountId}
                  onChange={e => setSourceAccountId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                  required
                >
                  <option value="">Select source account...</option>
                  {accounts
                    .filter((a: FinancialAccount) => a.code === "1001" || a.code === "1002")
                    .map((a: FinancialAccount) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name} ({formatLKR(a.current_balance_paise || 0)})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Amount to Transfer (Rs.) *
                </label>
                <input
                  type="number"
                  step="any"
                  value={amountRs}
                  onChange={e => setAmountRs(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. 25000"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Transfer Date *
                </label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={e => setTransferDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description / Note
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. Weekly operational surplus transfer"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferMutation.isPending}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition shadow-sm disabled:opacity-50"
                >
                  {transferMutation.isPending ? "Transferring..." : "Confirm Deposit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Emergency Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setShowWithdrawModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-amber-400" />
              Emergency Withdrawal from Savings (1003)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Available Savings: <span className="font-mono text-emerald-400 font-bold">{formatLKR(savingsBalance)}</span>
            </p>

            {errorMsg && (
              <div className="my-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleWithdrawSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Destination Account (to receive cash) *
                </label>
                <select
                  value={sourceAccountId}
                  onChange={e => setSourceAccountId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                  required
                >
                  <option value="">Select destination account...</option>
                  {accounts
                    .filter((a: FinancialAccount) => a.code === "1001" || a.code === "1002")
                    .map((a: FinancialAccount) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Withdrawal Amount (Rs.) *
                </label>
                <input
                  type="number"
                  step="any"
                  value={amountRs}
                  onChange={e => setAmountRs(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                  placeholder="e.g. 15000"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Withdrawal Date *
                </label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={e => setTransferDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Reason for Emergency Withdrawal *
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                  placeholder="e.g. Table 2 cushion and cloth urgent repair"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferMutation.isPending}
                  className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition shadow-sm disabled:opacity-50"
                >
                  {transferMutation.isPending ? "Processing..." : "Confirm Withdrawal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
