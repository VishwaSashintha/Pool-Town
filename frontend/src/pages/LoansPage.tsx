/**
 * LoansPage — Track partner loans, external debts, principal repayments, and interest expenses.
 */
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  HandCoins,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  User,
  Plus,
  History,
  X,
  CreditCard,
} from "lucide-react";
import { apiClient } from "@/api/client";
import { formatLKR, rupeesToPaise, paiseToRupees } from "@/lib/money";
import type { Loan, LoanTransaction, OwnerDetail, FinancialAccount, LoanCreate, LoanRepaymentCreate } from "@/types";

export const LoansPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLoanForRepayment, setSelectedLoanForRepayment] = useState<Loan | null>(null);
  const [selectedLoanForHistory, setSelectedLoanForHistory] = useState<Loan | null>(null);

  // Create Loan Form States
  const [lenderName, setLenderName] = useState("");
  const [loanType, setLoanType] = useState<"owner" | "external">("owner");
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | "">("");
  const [principalRs, setPrincipalRs] = useState("");
  const [interestRateBps, setInterestRateBps] = useState("0");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [repaymentTerms, setRepaymentTerms] = useState("");
  const [disbursementAccountId, setDisbursementAccountId] = useState<number | "">("");

  // Repayment Form States
  const [repaymentDate, setRepaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [principalPaymentRs, setPrincipalPaymentRs] = useState("");
  const [interestPaymentRs, setInterestPaymentRs] = useState("0");
  const [paymentAccountId, setPaymentAccountId] = useState<number | "">("");
  const [repaymentNotes, setRepaymentNotes] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const { data: loans = [], isLoading: loansLoading } = useQuery<Loan[]>({
    queryKey: ["loansList"],
    queryFn: () => apiClient.owners.listLoans(),
  });

  const { data: owners = [] } = useQuery<OwnerDetail[]>({
    queryKey: ["ownersList"],
    queryFn: apiClient.owners.list,
  });

  const { data: accounts = [] } = useQuery<FinancialAccount[]>({
    queryKey: ["financialAccounts"],
    queryFn: apiClient.accounts.list,
  });

  const { data: loanHistory = [], isLoading: historyLoading } = useQuery<LoanTransaction[]>({
    queryKey: ["loanTransactions", selectedLoanForHistory?.id],
    queryFn: () => (selectedLoanForHistory ? apiClient.owners.listLoanTransactions(selectedLoanForHistory.id) : Promise.resolve([])),
    enabled: !!selectedLoanForHistory,
  });

  const createLoanMutation = useMutation({
    mutationFn: (data: LoanCreate) => apiClient.owners.createLoan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loansList"] });
      queryClient.invalidateQueries({ queryKey: ["financialAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["trialBalance"] });
      setSuccessMsg("Loan recorded and disbursed successfully!");
      setShowCreateModal(false);
      resetCreateForm();
      setTimeout(() => setSuccessMsg(""), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to create loan");
    },
  });

  const recordRepaymentMutation = useMutation({
    mutationFn: ({ loanId, data }: { loanId: number; data: LoanRepaymentCreate }) =>
      apiClient.owners.recordLoanRepayment(loanId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loansList"] });
      queryClient.invalidateQueries({ queryKey: ["financialAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["trialBalance"] });
      setSuccessMsg("Loan repayment recorded and posted to general ledger!");
      setSelectedLoanForRepayment(null);
      resetRepaymentForm();
      setTimeout(() => setSuccessMsg(""), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to record loan repayment");
    },
  });

  const resetCreateForm = () => {
    setLenderName("");
    setLoanType("owner");
    setSelectedOwnerId("");
    setPrincipalRs("");
    setInterestRateBps("0");
    setRepaymentTerms("");
    setDisbursementAccountId("");
    setErrorMsg("");
  };

  const resetRepaymentForm = () => {
    setPrincipalPaymentRs("");
    setInterestPaymentRs("0");
    setPaymentAccountId("");
    setRepaymentNotes("");
    setErrorMsg("");
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const principalPaise = rupeesToPaise(parseFloat(principalRs) || 0);
    if (principalPaise <= 0) {
      setErrorMsg("Principal must be greater than zero");
      return;
    }
    const finalLenderName = loanType === "owner"
      ? (owners.find((o: OwnerDetail) => o.id === Number(selectedOwnerId))?.name || lenderName)
      : lenderName;

    if (!finalLenderName) {
      setErrorMsg("Please specify lender name");
      return;
    }

    createLoanMutation.mutate({
      lender_name: finalLenderName,
      loan_type: loanType,
      original_principal_paise: principalPaise,
      start_date: startDate,
      interest_rate_bps: Number(interestRateBps) || 0,
      repayment_terms: repaymentTerms || "As cashflow permits",
      owner_id: loanType === "owner" && selectedOwnerId ? Number(selectedOwnerId) : undefined,
      disburse_to_account_id: disbursementAccountId ? Number(disbursementAccountId) : undefined,
    });
  };

  const handleRepaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanForRepayment) return;

    const principalPaise = rupeesToPaise(parseFloat(principalPaymentRs) || 0);
    const interestPaise = rupeesToPaise(parseFloat(interestPaymentRs) || 0);

    if (principalPaise <= 0 && interestPaise <= 0) {
      setErrorMsg("Please enter either a principal or interest repayment amount");
      return;
    }

    if (!paymentAccountId) {
      setErrorMsg("Please select the payment account");
      return;
    }

    if (principalPaise > selectedLoanForRepayment.current_outstanding_paise) {
      setErrorMsg(`Principal repayment cannot exceed remaining outstanding balance of ${formatLKR(selectedLoanForRepayment.current_outstanding_paise)}`);
      return;
    }

    recordRepaymentMutation.mutate({
      loanId: selectedLoanForRepayment.id,
      data: {
        repayment_date: repaymentDate,
        principal_amount_paise: principalPaise,
        interest_amount_paise: interestPaise,
        account_id: Number(paymentAccountId),
        notes: repaymentNotes,
      },
    });
  };

  // Metric Totals
  const totalOutstanding = loans.reduce((sum: number, l: Loan) => sum + (l.current_outstanding_paise || 0), 0);
  const activeLoans = loans.filter((l: Loan) => l.status === "active");
  const totalRepaid = loans.reduce((sum: number, l: Loan) => sum + Math.max(0, l.original_principal_paise - l.current_outstanding_paise), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <HandCoins className="w-6 h-6 text-indigo-400" />
            Business Loans & Liabilities
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track partner loans (2001), bank/third-party debts (2002), repayments, and interest expense
          </p>
        </div>

        <button
          onClick={() => {
            setShowCreateModal(true);
            resetCreateForm();
          }}
          className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition flex items-center gap-2 shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Record New Loan
        </button>
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
            <span className="text-xs font-medium uppercase tracking-wider">Total Outstanding Debt</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400">{formatLKR(totalOutstanding)}</p>
          <p className="text-xs text-slate-500 mt-1">{activeLoans.length} active liability loan(s)</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Principal Repaid</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white">{formatLKR(totalRepaid)}</p>
          <p className="text-xs text-slate-500 mt-1">Total principal cleared</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Partner Borrowings</span>
            <User className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-bold text-sky-400">
            {formatLKR(loans.filter((l: Loan) => l.loan_type === "owner").reduce((s: number, l: Loan) => s + (l.current_outstanding_paise || 0), 0))}
          </p>
          <p className="text-xs text-slate-500 mt-1">From Akash, Pasan, or Vishwa</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Third-Party Debt</span>
            <DollarSign className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-white">
            {formatLKR(loans.filter((l: Loan) => l.loan_type === "external" || l.loan_type === "bank").reduce((s: number, l: Loan) => s + (l.current_outstanding_paise || 0), 0))}
          </p>
          <p className="text-xs text-slate-500 mt-1">External borrowings</p>
        </div>
      </div>

      {/* Accounting Notice */}
      <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 text-xs text-slate-400 flex items-start gap-3">
        <HandCoins className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
        <div>
          <span className="font-semibold text-slate-200">Accounting Rule Reminder: </span>
          Receiving a loan is NOT revenue — it credits Loan Payable (2001/2002). Repaying principal is NOT an expense —
          it directly reduces loan liability. Only interest paid is booked as an expense (6020 Interest Expense).
        </div>
      </div>

      {/* Loans Table */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Loans Schedule & Ledger</h2>
          <span className="text-xs text-slate-400">{loans.length} loan(s) recorded</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Ref</th>
                <th className="py-3 px-4">Lender</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Start Date</th>
                <th className="py-3 px-4 text-right">Original Principal</th>
                <th className="py-3 px-4 text-right">Repaid</th>
                <th className="py-3 px-4 text-right">Remaining Due</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-sm">
              {loansLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Loading loans...
                  </td>
                </tr>
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No loans found. The business currently has zero debt liabilities.
                  </td>
                </tr>
              ) : (
                loans.map((loan: Loan) => {
                  const repaid = Math.max(0, loan.original_principal_paise - (loan.current_outstanding_paise || 0));
                  const isSettled = loan.current_outstanding_paise === 0;

                  return (
                    <tr key={loan.id} className="hover:bg-slate-750/30 transition">
                      <td className="py-3 px-4 font-mono text-xs font-medium text-slate-300">
                        {loan.reference}
                      </td>
                      <td className="py-3 px-4 font-medium text-white">
                        {loan.lender_name}
                      </td>
                      <td className="py-3 px-4">
                        {loan.loan_type === "owner" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            Partner Loan (2001)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            Third Party (2002)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap text-xs">
                        {loan.start_date}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300 font-mono">
                        {formatLKR(loan.original_principal_paise)}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-400 font-mono">
                        {formatLKR(repaid)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                        {formatLKR(loan.current_outstanding_paise || 0)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isSettled ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Settled
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {!isSettled && (
                            <button
                              onClick={() => {
                                setSelectedLoanForRepayment(loan);
                                setPrincipalPaymentRs(paiseToRupees(loan.current_outstanding_paise || 0).toString());
                                setInterestPaymentRs("0");
                                setErrorMsg("");
                              }}
                              className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
                            >
                              Repay
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedLoanForHistory(loan)}
                            className="p-1 rounded-md bg-slate-700/60 hover:bg-slate-700 text-slate-300 transition"
                            title="View Transactions"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record New Loan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <HandCoins className="w-5 h-5 text-indigo-400" />
              Record New Loan Liability
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Add a loan borrowed from a partner or third-party lender
            </p>

            {errorMsg && (
              <div className="my-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Loan Type *
                  </label>
                  <select
                    value={loanType}
                    onChange={e => setLoanType(e.target.value as "owner" | "external")}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="owner">Partner Loan (2001)</option>
                    <option value="external">Third Party / External (2002)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              {loanType === "owner" ? (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Partner Lender *
                  </label>
                  <select
                    value={selectedOwnerId}
                    onChange={e => setSelectedOwnerId(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                    required
                  >
                    <option value="">Select partner...</option>
                    {owners.map((o: OwnerDetail) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Lender Name *
                  </label>
                  <input
                    type="text"
                    value={lenderName}
                    onChange={e => setLenderName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Commercial Bank or Private Lender"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Principal Amount (Rs.) *
                </label>
                <input
                  type="number"
                  step="any"
                  value={principalRs}
                  onChange={e => setPrincipalRs(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. 100000"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Disbursed Into Account *
                </label>
                <select
                  value={disbursementAccountId}
                  onChange={e => setDisbursementAccountId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                  required
                >
                  <option value="">Select account receiving cash...</option>
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
                  Repayment Terms / Notes
                </label>
                <input
                  type="text"
                  value={repaymentTerms}
                  onChange={e => setRepaymentTerms(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Repayable in monthly installments"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoanMutation.isPending}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition shadow-sm disabled:opacity-50"
                >
                  {createLoanMutation.isPending ? "Recording..." : "Record Loan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Repayment Modal */}
      {selectedLoanForRepayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedLoanForRepayment(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              Record Loan Repayment
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Repaying loan <span className="font-mono text-indigo-400">{selectedLoanForRepayment.reference}</span> ({selectedLoanForRepayment.lender_name})
            </p>

            <div className="my-4 p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs flex justify-between items-center">
              <span className="text-slate-400">Remaining Balance:</span>
              <span className="font-mono font-bold text-amber-400 text-sm">
                {formatLKR(selectedLoanForRepayment.current_outstanding_paise || 0)}
              </span>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleRepaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Principal Amount (Rs.) *
                </label>
                <input
                  type="number"
                  step="any"
                  value={principalPaymentRs}
                  onChange={e => setPrincipalPaymentRs(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. 50000"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-0.5">Reduces liability (not an expense)</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Interest Amount (Rs.)
                </label>
                <input
                  type="number"
                  step="any"
                  value={interestPaymentRs}
                  onChange={e => setInterestPaymentRs(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="0"
                />
                <p className="text-[11px] text-slate-500 mt-0.5">Debited to 6020 Interest Expense</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Repayment Date
                  </label>
                  <input
                    type="date"
                    value={repaymentDate}
                    onChange={e => setRepaymentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Paid From Account
                  </label>
                  <select
                    value={paymentAccountId}
                    onChange={e => setPaymentAccountId(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                    required
                  >
                    <option value="">Select account...</option>
                    {accounts
                      .filter((a: FinancialAccount) => a.code === "1001" || a.code === "1002")
                      .map((a: FinancialAccount) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Repayment Notes
                </label>
                <input
                  type="text"
                  value={repaymentNotes}
                  onChange={e => setRepaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Month 1 principal settlement"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLoanForRepayment(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordRepaymentMutation.isPending}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition shadow-sm disabled:opacity-50"
                >
                  {recordRepaymentMutation.isPending ? "Posting..." : "Confirm Repayment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loan History Drawer / Modal */}
      {selectedLoanForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedLoanForHistory(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-400" />
              Loan Transactions History
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {selectedLoanForHistory.reference} — {selectedLoanForHistory.lender_name}
            </p>

            <div className="my-4 divide-y divide-slate-800 max-h-80 overflow-y-auto">
              {historyLoading ? (
                <p className="text-center py-8 text-xs text-slate-400">Loading history...</p>
              ) : loanHistory.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-500">No repayments recorded yet.</p>
              ) : (
                loanHistory.map((tx: LoanTransaction) => (
                  <div key={tx.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-white uppercase">{tx.transaction_type.replace("_", " ")}</div>
                      <div className="text-slate-500">{tx.transaction_date} • {tx.notes || "Repayment"}</div>
                    </div>
                    <div className="text-right font-mono font-semibold text-emerald-400">
                      {formatLKR(tx.amount_paise)}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedLoanForHistory(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
