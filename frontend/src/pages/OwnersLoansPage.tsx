import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  HandCoins,
  X,
  Building,
} from "lucide-react";
import { api } from "@/api/client";
import { MoneyDisplay } from "@/components/common/MoneyDisplay";
import { formatLKR, rupeesToPaise } from "@/lib/money";
import type { Loan } from "@/types";

export const OwnersLoansPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Capital Transaction Modal
  const [isCapitalModalOpen, setIsCapitalModalOpen] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState<number>(1);
  const [txType, setTxType] = useState<string>("additional_capital");
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);
  const [txAmountRupees, setTxAmountRupees] = useState<number>(0);
  const [txAccountId, setTxAccountId] = useState<number>(0);
  const [txDesc, setTxDesc] = useState("");
  const [capitalError, setCapitalError] = useState("");

  // New Loan Modal
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [lenderName, setLenderName] = useState("");
  const [loanType, setLoanType] = useState<"bank" | "external" | "owner">("bank");
  const [loanPrincipalRupees, setLoanPrincipalRupees] = useState<number>(0);
  const [loanStartDate, setLoanStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [interestPercent, setInterestPercent] = useState<number>(12);
  const [loanOwnerId, setLoanOwnerId] = useState<number>(1);
  const [disburseAccountId, setDisburseAccountId] = useState<number>(0);
  const [loanTerms, setLoanTerms] = useState("");
  const [loanError, setLoanError] = useState("");

  // Loan Repayment Modal
  const [repaymentModal, setRepaymentModal] = useState<{ isOpen: boolean; loan: Loan | null }>({
    isOpen: false,
    loan: null,
  });
  const [repDate, setRepDate] = useState(new Date().toISOString().split("T")[0]);
  const [repPrincipalRupees, setRepPrincipalRupees] = useState<number>(0);
  const [repInterestRupees, setRepInterestRupees] = useState<number>(0);
  const [repAccountId, setRepAccountId] = useState<number>(0);
  const [repNotes, setRepNotes] = useState("");
  const [repError, setRepError] = useState("");

  // Queries
  const { data: owners = [] } = useQuery({
    queryKey: ["owners"],
    queryFn: () => api.owners.list(),
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["owner-transactions"],
    queryFn: () => api.owners.listTransactions(undefined, 50),
  });

  const { data: loans = [] } = useQuery({
    queryKey: ["loans"],
    queryFn: () => api.owners.listLoans(),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => api.accounts.list(),
  });

  const liquidAccounts = accounts.filter((a) =>
    ["cash", "bank", "savings"].includes(a.account_type)
  );

  // Mutations
  const capitalMutation = useMutation({
    mutationFn: () =>
      api.owners.recordTransaction({
        owner_id: selectedOwnerId,
        transaction_date: txDate,
        transaction_type: txType,
        amount_paise: rupeesToPaise(txAmountRupees),
        account_id: txAccountId || (liquidAccounts.length > 0 ? liquidAccounts[0].id : 1),
        description: txDesc.trim() || `${txType.replace("_", " ")} by partner`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owners"] });
      queryClient.invalidateQueries({ queryKey: ["owner-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["trial-balance"] });
      setIsCapitalModalOpen(false);
      setTxAmountRupees(0);
      setTxDesc("");
      setCapitalError("");
    },
    onError: (err: any) => {
      setCapitalError(err.message || "Failed to record transaction");
    },
  });

  const loanMutation = useMutation({
    mutationFn: () =>
      api.owners.createLoan({
        lender_name: lenderName.trim(),
        loan_type: loanType,
        original_principal_paise: rupeesToPaise(loanPrincipalRupees),
        start_date: loanStartDate,
        interest_rate_bps: Math.round(interestPercent * 100),
        repayment_terms: loanTerms.trim() || undefined,
        owner_id: loanType === "owner" ? loanOwnerId : undefined,
        disburse_to_account_id: disburseAccountId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["owners"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["trial-balance"] });
      setIsLoanModalOpen(false);
      setLenderName("");
      setLoanPrincipalRupees(0);
      setLoanError("");
    },
    onError: (err: any) => {
      setLoanError(err.message || "Failed to create loan");
    },
  });

  const repaymentMutation = useMutation({
    mutationFn: () => {
      if (!repaymentModal.loan) throw new Error("No loan selected");
      return api.owners.recordLoanRepayment(repaymentModal.loan.id, {
        repayment_date: repDate,
        principal_amount_paise: rupeesToPaise(repPrincipalRupees),
        interest_amount_paise: rupeesToPaise(repInterestRupees),
        account_id: repAccountId || (liquidAccounts.length > 0 ? liquidAccounts[0].id : 1),
        notes: repNotes.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["owners"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["trial-balance"] });
      setRepaymentModal({ isOpen: false, loan: null });
      setRepPrincipalRupees(0);
      setRepInterestRupees(0);
      setRepNotes("");
      setRepError("");
    },
    onError: (err: any) => {
      setRepError(err.message || "Failed to record repayment");
    },
  });

  const totalOutstandingLoanPaise = loans
    .filter((l) => l.status === "active")
    .reduce((acc, l) => acc + l.current_outstanding_paise, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Partner Capital & Loans Management
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Track owner equity, drawings, capital injections, and business loans with double-entry accounting
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (liquidAccounts.length > 0) setTxAccountId(liquidAccounts[0].id);
              setCapitalError("");
              setIsCapitalModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition shadow-md"
          >
            <Coins className="h-4 w-4" />
            <span>Capital Transaction</span>
          </button>

          <button
            onClick={() => {
              if (liquidAccounts.length > 0) setDisburseAccountId(liquidAccounts[0].id);
              setLoanError("");
              setIsLoanModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border hover:bg-secondary/40 text-foreground font-medium text-xs transition"
          >
            <Building className="h-4 w-4 text-blue-400" />
            <span>New Loan Record</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: PARTNER CAPITAL ACCOUNTS */}
      <div>
        <h3 className="text-xs uppercase font-semibold tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-emerald-400" />
          <span>Partner Equity Accounts (3001, 3002, 3003)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {owners.map((owner) => (
            <div
              key={owner.id}
              className="p-5 rounded-xl border border-border/80 bg-card/60 glass-panel space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-base text-white">{owner.name}</h4>
                  <span className="text-[11px] text-muted-foreground">
                    Profit Share: <strong className="text-emerald-400">{owner.profit_share_percent}</strong>
                  </span>
                </div>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-secondary text-emerald-400 font-semibold">
                  {owner.capital_account_code}
                </span>
              </div>

              <div className="space-y-2 pt-1 border-t border-border/40 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-sans">Current Capital Balance:</span>
                  <span className="text-base font-bold text-white">
                    <MoneyDisplay paise={owner.capital_balance_paise} />
                  </span>
                </div>

                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-muted-foreground font-sans">Total Drawings Taken (700{owner.id}):</span>
                  <span className="text-rose-400">
                    <MoneyDisplay paise={owner.distributions_total_paise} />
                  </span>
                </div>

                {owner.owner_loan_balance_paise > 0 && (
                  <div className="flex justify-between items-center text-[11px] text-amber-400">
                    <span className="font-sans">Active Owner Loan Owed:</span>
                    <span><MoneyDisplay paise={owner.owner_loan_balance_paise} /></span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedOwnerId(owner.id);
                    setTxType("additional_capital");
                    if (liquidAccounts.length > 0) setTxAccountId(liquidAccounts[0].id);
                    setIsCapitalModalOpen(true);
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-semibold text-xs border border-emerald-500/30 transition flex items-center justify-center gap-1"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" /> Inject Capital
                </button>
                <button
                  onClick={() => {
                    setSelectedOwnerId(owner.id);
                    setTxType("withdrawal");
                    if (liquidAccounts.length > 0) setTxAccountId(liquidAccounts[0].id);
                    setIsCapitalModalOpen(true);
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 font-semibold text-xs border border-rose-500/30 transition flex items-center justify-center gap-1"
                >
                  <ArrowDownLeft className="h-3.5 w-3.5" /> Withdrawal
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: LOANS & LIABILITIES */}
      <div className="rounded-xl border border-border/70 bg-card/60 p-6 glass-panel space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building className="h-5 w-5 text-blue-400" />
            <div>
              <h3 className="font-bold text-base text-white">Business Loans & Liabilities (2010 / 2030)</h3>
              <p className="text-xs text-muted-foreground">
                Principal tracking, interest payments, and automatic settlement
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/30 flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">Total Active Principal:</span>
            <span className="font-mono font-bold text-base text-blue-300">
              <MoneyDisplay paise={totalOutstandingLoanPaise} />
            </span>
          </div>
        </div>

        {loans.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No active loans recorded. Click "New Loan Record" to add external borrowings or owner loans.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-secondary/40 text-muted-foreground uppercase border-b border-border/60">
                <tr>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3">Lender Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Start Date</th>
                  <th className="py-2.5 px-3">Interest Rate</th>
                  <th className="py-2.5 px-3 text-right">Original Principal</th>
                  <th className="py-2.5 px-3 text-right">Current Outstanding</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {loans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-secondary/20">
                    <td className="py-3 px-3 font-bold text-emerald-400">{loan.reference}</td>
                    <td className="py-3 px-3 font-sans font-medium text-foreground">
                      {loan.lender_name}
                      {loan.owner_name && (
                        <span className="text-[10px] text-muted-foreground ml-1.5">
                          (Owner: {loan.owner_name})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 uppercase text-[10px] tracking-wider text-muted-foreground font-sans">
                      {loan.loan_type}
                    </td>
                    <td className="py-3 px-3">{loan.start_date}</td>
                    <td className="py-3 px-3 font-sans">
                      {loan.interest_rate_bps > 0 ? `${(loan.interest_rate_bps / 100).toFixed(1)}% p.a.` : "0% (Interest-Free)"}
                    </td>
                    <td className="py-3 px-3 text-right">{formatLKR(loan.original_principal_paise)}</td>
                    <td className="py-3 px-3 text-right font-bold text-white">
                      {formatLKR(loan.current_outstanding_paise)}
                    </td>
                    <td className="py-3 px-3 font-sans">
                      {loan.status === "active" ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold text-[10px] border border-emerald-500/30">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-semibold text-[10px]">
                          Settled ✓
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-sans">
                      {loan.status === "active" && (
                        <button
                          onClick={() => {
                            setRepaymentModal({ isOpen: true, loan });
                            setRepPrincipalRupees(0);
                            setRepInterestRupees(0);
                            if (liquidAccounts.length > 0) setRepAccountId(liquidAccounts[0].id);
                            setRepError("");
                          }}
                          className="px-3 py-1 rounded bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 text-[11px] font-semibold transition"
                        >
                          Record Repayment
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 3: RECENT CAPITAL TRANSACTIONS TABLE */}
      {transactions.length > 0 && (
        <div className="rounded-xl border border-border/70 bg-card/60 p-6 glass-panel space-y-4">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-emerald-400" />
            <h3 className="font-bold text-base text-white">Partner Capital Transactions History</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-secondary/40 text-muted-foreground uppercase border-b border-border/60">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3">Partner</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3">Account</th>
                  <th className="py-2.5 px-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-secondary/20">
                    <td className="py-2.5 px-3">{tx.transaction_date}</td>
                    <td className="py-2.5 px-3 text-emerald-400 font-bold">{tx.reference}</td>
                    <td className="py-2.5 px-3 font-sans font-medium text-white">{tx.owner_name}</td>
                    <td className="py-2.5 px-3 font-sans uppercase text-[10px] tracking-wider text-muted-foreground">
                      {tx.transaction_type.replace("_", " ")}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-white">
                      <MoneyDisplay paise={tx.amount_paise} />
                    </td>
                    <td className="py-2.5 px-3 font-sans text-muted-foreground">{tx.account_name || "—"}</td>
                    <td className="py-2.5 px-3 font-sans text-muted-foreground">{tx.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: CAPITAL INJECTION / DRAWING */}
      {isCapitalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Coins className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Capital Transaction</h3>
                  <p className="text-xs text-muted-foreground">Inject capital or record partner drawing</p>
                </div>
              </div>
              <button
                onClick={() => setIsCapitalModalOpen(false)}
                className="text-muted-foreground hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {capitalError && (
              <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs">
                {capitalError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1">Partner *</label>
                <select
                  value={selectedOwnerId}
                  onChange={(e) => setSelectedOwnerId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                >
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.profit_share_percent} share)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Transaction Type *</label>
                <select
                  value={txType}
                  onChange={(e) => setTxType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                >
                  <option value="additional_capital">Additional Capital Injection (DR Cash/Bank, CR 300x)</option>
                  <option value="initial_capital">Initial Capital (DR Cash/Bank, CR 300x)</option>
                  <option value="withdrawal">Partner Withdrawal / Drawing (DR 700x, CR Cash/Bank)</option>
                  <option value="distribution">Profit Distribution (DR 700x, CR Cash/Bank)</option>
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Date *</label>
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground font-mono"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Treasury Account (Cash / Bank) *</label>
                <select
                  value={txAccountId}
                  onChange={(e) => setTxAccountId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                >
                  {liquidAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name} ({formatLKR(a.current_balance_paise || 0)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Amount (Rs.) *</label>
                <input
                  type="number"
                  min={1}
                  value={txAmountRupees}
                  onChange={(e) => setTxAmountRupees(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground font-mono text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Capital injection for equipment upgrade"
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => setIsCapitalModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-border text-xs hover:bg-secondary/40 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => capitalMutation.mutate()}
                disabled={txAmountRupees <= 0 || capitalMutation.isPending}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition shadow-sm disabled:opacity-50"
              >
                {capitalMutation.isPending ? "Posting..." : "Confirm & Post"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NEW LOAN RECORD */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-blue-500/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                  <Building className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Record New Loan</h3>
                  <p className="text-xs text-muted-foreground">Bank, external lender, or owner loan</p>
                </div>
              </div>
              <button
                onClick={() => setIsLoanModalOpen(false)}
                className="text-muted-foreground hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loanError && (
              <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs">
                {loanError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1">Lender Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Commercial Bank / Akash Loan to Business"
                  value={lenderName}
                  onChange={(e) => setLenderName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Loan Type *</label>
                <select
                  value={loanType}
                  onChange={(e) => setLoanType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                >
                  <option value="bank">Bank Loan (Liability Account 2010)</option>
                  <option value="external">External Third-Party Lender (Account 2010)</option>
                  <option value="owner">Owner Loan to Business (Account 2030)</option>
                </select>
              </div>

              {loanType === "owner" && (
                <div>
                  <label className="block text-muted-foreground mb-1">Owner Lender *</label>
                  <select
                    value={loanOwnerId}
                    onChange={(e) => setLoanOwnerId(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                  >
                    {owners.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-muted-foreground mb-1">Principal Amount (Rs.) *</label>
                <input
                  type="number"
                  min={1}
                  value={loanPrincipalRupees}
                  onChange={(e) => setLoanPrincipalRupees(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground font-mono text-sm font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={loanStartDate}
                    onChange={(e) => setLoanStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground font-mono"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Interest Rate (% p.a.)</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={interestPercent}
                    onChange={(e) => setInterestPercent(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Disburse Proceeds into Account</label>
                <select
                  value={disburseAccountId}
                  onChange={(e) => setDisburseAccountId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                >
                  <option value={0}>Do not post cash deposit (Liability record only)</option>
                  {liquidAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      Deposit into {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Repayment Terms</label>
                <input
                  type="text"
                  placeholder="e.g. Rs. 25,000 monthly for 24 months"
                  value={loanTerms}
                  onChange={(e) => setLoanTerms(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => setIsLoanModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-border text-xs hover:bg-secondary/40 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => loanMutation.mutate()}
                disabled={!lenderName.trim() || loanPrincipalRupees <= 0 || loanMutation.isPending}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition shadow-sm disabled:opacity-50"
              >
                {loanMutation.isPending ? "Recording..." : "Save Loan Record"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LOAN REPAYMENT */}
      {repaymentModal.isOpen && repaymentModal.loan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-blue-500/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                  <HandCoins className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Record Loan Payment</h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    {repaymentModal.loan.reference} ({repaymentModal.loan.lender_name})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRepaymentModal({ isOpen: false, loan: null })}
                className="text-muted-foreground hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {repError && (
              <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs">
                {repError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-secondary/30 border border-border/60 flex justify-between font-mono">
                <span className="text-muted-foreground font-sans">Remaining Principal:</span>
                <span className="text-white font-bold">
                  {formatLKR(repaymentModal.loan.current_outstanding_paise)}
                </span>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Payment Date *</label>
                <input
                  type="date"
                  value={repDate}
                  onChange={(e) => setRepDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1">Principal Paid (Rs.)</label>
                  <input
                    type="number"
                    min={0}
                    value={repPrincipalRupees}
                    onChange={(e) => setRepPrincipalRupees(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground font-mono text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Interest Paid (Rs.)</label>
                  <input
                    type="number"
                    min={0}
                    value={repInterestRupees}
                    onChange={(e) => setRepInterestRupees(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground font-mono text-sm font-bold"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-secondary/40 border border-border/60 flex justify-between font-mono text-sm">
                <span className="font-sans font-medium text-foreground">Total Paid:</span>
                <span className="font-bold text-emerald-400">
                  {formatLKR(rupeesToPaise(repPrincipalRupees + repInterestRupees))}
                </span>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Payment Account *</label>
                <select
                  value={repAccountId}
                  onChange={(e) => setRepAccountId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                >
                  {liquidAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name} ({formatLKR(a.current_balance_paise || 0)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Month installment with receipt slip"
                  value={repNotes}
                  onChange={(e) => setRepNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => setRepaymentModal({ isOpen: false, loan: null })}
                className="px-4 py-2 rounded-lg border border-border text-xs hover:bg-secondary/40 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => repaymentMutation.mutate()}
                disabled={repPrincipalRupees + repInterestRupees <= 0 || repaymentMutation.isPending}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition shadow-sm disabled:opacity-50"
              >
                {repaymentMutation.isPending ? "Recording..." : "Confirm & Post Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
