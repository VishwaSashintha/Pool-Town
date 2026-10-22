import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  ShieldCheck,
  X,
  AlertCircle,
  Landmark,
  Calculator,
  Lock,
  Unlock,
  CheckCircle2,
  History,
  FileCheck,
} from "lucide-react";
import { api } from "@/api/client";
import { MoneyDisplay } from "@/components/common/MoneyDisplay";
import { rupeesToPaise, formatLKR } from "@/lib/money";

type ActiveTab = "treasury" | "reconciliation" | "periods" | "opening";

export const AccountsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ActiveTab>("treasury");

  // Transfer form state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split("T")[0]);
  const [fromAccountId, setFromAccountId] = useState<number>(0);
  const [toAccountId, setToAccountId] = useState<number>(0);
  const [amountRupees, setAmountRupees] = useState<number>(0);
  const [transferDesc, setTransferDesc] = useState("");
  const [transferError, setTransferError] = useState("");

  // Cash Count state
  const [cashCountDate, setCashCountDate] = useState(new Date().toISOString().split("T")[0]);
  const [countedCashRupees, setCountedCashRupees] = useState<number>(0);
  const [cashNotes, setCashNotes] = useState("");
  const [investigator, setInvestigator] = useState("");
  const [cashCountSuccess, setCashCountSuccess] = useState("");

  // Bank Reconciliation state
  const [bankRecDate, setBankRecDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<number>(0);
  const [statementBalanceRupees, setStatementBalanceRupees] = useState<number>(0);
  const [bankRecNotes, setBankRecNotes] = useState("");
  const [bankRecSuccess, setBankRecSuccess] = useState("");

  // Reopen Period state
  const [reopenModal, setReopenModal] = useState<{ isOpen: boolean; year: number; month: number }>({
    isOpen: false,
    year: 0,
    month: 0,
  });
  const [reopenReason, setReopenReason] = useState("");
  const [reopenUser, setReopenUser] = useState("Admin");

  // Queries
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => api.accounts.list(),
  });

  const { data: trialBalance = [] } = useQuery({
    queryKey: ["trial-balance"],
    queryFn: () => api.accounts.getTrialBalance(),
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ["transfers"],
    queryFn: () => api.accounts.listTransfers(50),
    enabled: activeTab === "treasury",
  });

  const { data: expectedCash } = useQuery({
    queryKey: ["expected-cash", cashCountDate],
    queryFn: () => api.accounts.getExpectedCash(cashCountDate),
    enabled: activeTab === "reconciliation",
  });

  const { data: cashCounts = [] } = useQuery({
    queryKey: ["cash-counts"],
    queryFn: () => api.accounts.listCashCounts(20),
    enabled: activeTab === "reconciliation",
  });

  const cashAccounts = accounts.filter((a) =>
    ["cash", "bank", "savings"].includes(a.account_type)
  );
  const bankAccounts = accounts.filter((a) =>
    ["bank", "savings"].includes(a.account_type)
  );

  const activeBankId = selectedBankAccountId || (bankAccounts.length > 0 ? bankAccounts[0].id : 0);

  const { data: expectedBank } = useQuery({
    queryKey: ["expected-bank", activeBankId, bankRecDate],
    queryFn: () => api.accounts.getExpectedBank(activeBankId, bankRecDate),
    enabled: activeTab === "reconciliation" && activeBankId > 0,
  });

  const { data: bankRecs = [] } = useQuery({
    queryKey: ["bank-reconciliations"],
    queryFn: () => api.accounts.listBankReconciliations(undefined, 20),
    enabled: activeTab === "reconciliation",
  });

  const { data: periods = [] } = useQuery({
    queryKey: ["periods"],
    queryFn: () => api.accounts.listPeriods(),
    enabled: activeTab === "periods",
  });

  const { data: openingData } = useQuery({
    queryKey: ["opening-balances"],
    queryFn: () => api.accounts.getOpeningBalances(),
    enabled: activeTab === "opening",
  });

  // Mutations
  const transferMutation = useMutation({
    mutationFn: () =>
      api.accounts.createTransfer({
        transfer_date: transferDate,
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount_paise: rupeesToPaise(amountRupees),
        description: transferDesc.trim() || "Inter-account fund transfer",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["trial-balance"] });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      setIsTransferModalOpen(false);
      setAmountRupees(0);
      setTransferDesc("");
      setTransferError("");
    },
    onError: (err: any) => {
      setTransferError(err.message || "Failed to transfer funds");
    },
  });

  const cashCountMutation = useMutation({
    mutationFn: () =>
      api.accounts.recordCashCount({
        count_date: cashCountDate,
        counted_paise: rupeesToPaise(countedCashRupees),
        notes: cashNotes.trim() || undefined,
        investigated_by: investigator.trim() || undefined,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["cash-counts"] });
      setCashCountSuccess(
        `Cash count recorded. Difference: ${formatLKR(data.difference_paise)} (${
          data.difference_paise === 0
            ? "Exact Match"
            : data.difference_paise > 0
            ? "Surplus"
            : "Shortage"
        })`
      );
      setCashNotes("");
      setInvestigator("");
    },
  });

  const bankRecMutation = useMutation({
    mutationFn: () =>
      api.accounts.recordBankReconciliation({
        reconciliation_date: bankRecDate,
        account_id: activeBankId,
        statement_balance_paise: rupeesToPaise(statementBalanceRupees),
        notes: bankRecNotes.trim() || undefined,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["bank-reconciliations"] });
      setBankRecSuccess(
        `Bank reconciliation saved. Discrepancy: ${formatLKR(data.difference_paise)}`
      );
      setBankRecNotes("");
    },
  });

  const closePeriodMutation = useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      api.accounts.closePeriod(year, month, "Admin"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["periods"] });
    },
  });

  const reopenPeriodMutation = useMutation({
    mutationFn: () =>
      api.accounts.reopenPeriod(reopenModal.year, reopenModal.month, reopenReason, reopenUser),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["periods"] });
      setReopenModal({ isOpen: false, year: 0, month: 0 });
      setReopenReason("");
    },
  });

  // Calculate trial balance totals
  const totalDebitsPaise = trialBalance.reduce((acc, r) => acc + r.total_debit_paise, 0);
  const totalCreditsPaise = trialBalance.reduce((acc, r) => acc + r.total_credit_paise, 0);
  const isBalanced = totalDebitsPaise === totalCreditsPaise;

  // Expected vs counted cash variance
  const expectedCashPaise = expectedCash?.expected_paise ?? 0;
  const countedCashPaise = rupeesToPaise(countedCashRupees);
  const cashVariancePaise = countedCashPaise - expectedCashPaise;

  // Bank book vs statement variance
  const bankBookPaise = expectedBank?.book_balance_paise ?? 0;
  const statementPaise = rupeesToPaise(statementBalanceRupees);
  const bankVariancePaise = statementPaise - bankBookPaise;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Accounts & General Ledger</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Treasury balances, balanced double-entry trial balance, cash counts, and month closing
          </p>
        </div>

        {activeTab === "treasury" && (
          <button
            onClick={() => {
              if (cashAccounts.length >= 2) {
                setFromAccountId(cashAccounts[0].id);
                setToAccountId(cashAccounts[1].id);
              }
              setTransferError("");
              setIsTransferModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition shadow-md shrink-0"
          >
            <ArrowRightLeft className="h-4 w-4" />
            <span>Transfer Between Accounts</span>
          </button>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-3 overflow-x-auto text-xs font-medium">
        <button
          onClick={() => setActiveTab("treasury")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition shrink-0 ${
            activeTab === "treasury"
              ? "bg-emerald-600/20 text-emerald-300 font-semibold border border-emerald-500/30"
              : "text-muted-foreground hover:text-white hover:bg-secondary/30"
          }`}
        >
          <Landmark className="h-4 w-4" />
          <span>Treasury & Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab("reconciliation")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition shrink-0 ${
            activeTab === "reconciliation"
              ? "bg-emerald-600/20 text-emerald-300 font-semibold border border-emerald-500/30"
              : "text-muted-foreground hover:text-white hover:bg-secondary/30"
          }`}
        >
          <Calculator className="h-4 w-4" />
          <span>Cash & Bank Reconciliation</span>
        </button>

        <button
          onClick={() => setActiveTab("periods")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition shrink-0 ${
            activeTab === "periods"
              ? "bg-emerald-600/20 text-emerald-300 font-semibold border border-emerald-500/30"
              : "text-muted-foreground hover:text-white hover:bg-secondary/30"
          }`}
        >
          <Lock className="h-4 w-4" />
          <span>Month-End Closing</span>
        </button>

        <button
          onClick={() => setActiveTab("opening")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition shrink-0 ${
            activeTab === "opening"
              ? "bg-emerald-600/20 text-emerald-300 font-semibold border border-emerald-500/30"
              : "text-muted-foreground hover:text-white hover:bg-secondary/30"
          }`}
        >
          <FileCheck className="h-4 w-4" />
          <span>Opening Position (31 Dec 2025)</span>
        </button>
      </div>

      {/* TAB 1: TREASURY & GENERAL LEDGER */}
      {activeTab === "treasury" && (
        <div className="space-y-8">
          {/* Liquid Treasury Cards */}
          <div>
            <h3 className="text-xs uppercase font-semibold tracking-wider text-muted-foreground mb-3">
              Liquid Treasury & Bank Balances
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {cashAccounts.map((a) => (
                <div
                  key={a.id}
                  className="p-5 rounded-xl border border-border/80 bg-card/60 glass-panel space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-emerald-400 font-semibold">{a.code}</span>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-secondary font-medium">
                      {a.account_type}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{a.name}</p>
                  <div className="text-2xl font-bold font-mono text-foreground pt-1">
                    <MoneyDisplay paise={a.current_balance_paise || 0} />
                  </div>
                  {a.description && (
                    <p className="text-xs text-muted-foreground pt-1">{a.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Transfer History Table */}
          {transfers.length > 0 && (
            <div className="rounded-xl border border-border/70 bg-card/60 p-6 glass-panel space-y-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-emerald-400" />
                <h3 className="font-semibold text-base text-white">Recent Account Transfers</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="uppercase bg-secondary/40 text-muted-foreground border-b border-border/60">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Reference</th>
                      <th className="py-2.5 px-3">Source (From)</th>
                      <th className="py-2.5 px-3">Destination (To)</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {transfers.map((t) => (
                      <tr key={t.id} className="hover:bg-secondary/20">
                        <td className="py-2.5 px-3 font-mono">{t.transfer_date}</td>
                        <td className="py-2.5 px-3 font-mono text-emerald-400 font-medium">{t.reference}</td>
                        <td className="py-2.5 px-3">{t.from_account_code} — {t.from_account_name}</td>
                        <td className="py-2.5 px-3">{t.to_account_code} — {t.to_account_name}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                          <MoneyDisplay paise={t.amount_paise} />
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">{t.description || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Trial Balance Section */}
          <div className="rounded-xl border border-border/70 bg-card/60 p-6 glass-panel space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-lg text-white">Trial Balance (General Ledger)</h3>
                <p className="text-xs text-muted-foreground">
                  Real-time summary of all debit and credit journal lines
                </p>
              </div>
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  isBalanced
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                }`}
              >
                {isBalanced ? (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    <span>Balanced: Total Debits == Total Credits</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4" />
                    <span>Discrepancy Detected!</span>
                  </>
                )}
              </div>
            </div>

            {trialBalance.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No journal entries posted yet. Start recording sessions or expenses.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-secondary/40 text-muted-foreground border-b border-border/60">
                    <tr>
                      <th className="py-2.5 px-4">Code</th>
                      <th className="py-2.5 px-4">Account Name</th>
                      <th className="py-2.5 px-4 text-right">Debit (Paise)</th>
                      <th className="py-2.5 px-4 text-right">Credit (Paise)</th>
                      <th className="py-2.5 px-4 text-right">Net Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono text-xs">
                    {trialBalance.map((r) => (
                      <tr key={r.account_code} className="hover:bg-secondary/20 transition-colors">
                        <td className="py-3 px-4 font-bold text-emerald-400">{r.account_code}</td>
                        <td className="py-3 px-4 font-sans font-medium text-foreground">
                          {r.account_name}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {r.total_debit_paise > 0 ? (
                            <MoneyDisplay paise={r.total_debit_paise} />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {r.total_credit_paise > 0 ? (
                            <MoneyDisplay paise={r.total_credit_paise} />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-foreground">
                          <MoneyDisplay paise={r.net_balance_paise} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-secondary/50 font-mono font-bold text-xs border-t-2 border-border">
                    <tr>
                      <td colSpan={2} className="py-3 px-4 uppercase text-foreground">
                        Totals
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-400">
                        <MoneyDisplay paise={totalDebitsPaise} />
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-400">
                        <MoneyDisplay paise={totalCreditsPaise} />
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-400">
                        {isBalanced ? "BALANCED" : "OUT OF BALANCE"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CASH & BANK RECONCILIATION */}
      {activeTab === "reconciliation" && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cash in Hand Count Panel */}
            <div className="rounded-xl border border-border/70 bg-card/60 p-6 glass-panel space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-emerald-400" />
                  <div>
                    <h3 className="font-bold text-base text-white">Daily Physical Cash Count</h3>
                    <p className="text-xs text-muted-foreground">Account 1001 · Cash in Hand</p>
                  </div>
                </div>
              </div>

              {cashCountSuccess && (
                <div className="p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs">
                  {cashCountSuccess}
                </div>
              )}

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-muted-foreground mb-1">Count Date</label>
                  <input
                    type="date"
                    value={cashCountDate}
                    onChange={(e) => setCashCountDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground font-mono"
                  />
                </div>

                <div className="p-4 rounded-xl bg-secondary/30 border border-border/60 flex items-center justify-between">
                  <div>
                    <span className="text-muted-foreground">Calculated Book Cash:</span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Sum of all cash debits minus credits</p>
                  </div>
                  <div className="text-lg font-bold font-mono text-emerald-400">
                    <MoneyDisplay paise={expectedCashPaise} />
                  </div>
                </div>

                <div>
                  <label className="block text-muted-foreground mb-1">Counted Physical Cash (Rs.) *</label>
                  <input
                    type="number"
                    min={0}
                    value={countedCashRupees}
                    onChange={(e) => setCountedCashRupees(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground font-mono text-base font-bold"
                  />
                </div>

                {/* Variance Display */}
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between font-mono ${
                    cashVariancePaise === 0
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : cashVariancePaise > 0
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                  }`}
                >
                  <span className="font-sans font-medium">Variance (Counted − Expected):</span>
                  <span className="font-bold text-sm">
                    {cashVariancePaise === 0
                      ? "✓ Exact Match (Rs. 0)"
                      : cashVariancePaise > 0
                      ? `Surplus: +${formatLKR(cashVariancePaise)}`
                      : `Shortage: -${formatLKR(Math.abs(cashVariancePaise))}`}
                  </span>
                </div>

                <div>
                  <label className="block text-muted-foreground mb-1">Investigated / Counted By</label>
                  <input
                    type="text"
                    placeholder="e.g. Vishwa / Akash"
                    value={investigator}
                    onChange={(e) => setInvestigator(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-muted-foreground mb-1">Investigation Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Document explanation for any discrepancy (Requirement 7.2)"
                    value={cashNotes}
                    onChange={(e) => setCashNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => cashCountMutation.mutate()}
                  disabled={cashCountMutation.isPending}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition shadow-md disabled:opacity-50"
                >
                  {cashCountMutation.isPending ? "Recording Count..." : "Record & Log Cash Count"}
                </button>
              </div>
            </div>

            {/* Bank Statement Reconciliation Panel */}
            <div className="rounded-xl border border-border/70 bg-card/60 p-6 glass-panel space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-blue-400" />
                  <div>
                    <h3 className="font-bold text-base text-white">Bank Statement Reconciliation</h3>
                    <p className="text-xs text-muted-foreground">Main Bank (1002) & Savings (1003)</p>
                  </div>
                </div>
              </div>

              {bankRecSuccess && (
                <div className="p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs">
                  {bankRecSuccess}
                </div>
              )}

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-muted-foreground mb-1">Bank Account</label>
                  <select
                    value={activeBankId}
                    onChange={(e) => setSelectedBankAccountId(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                  >
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} — {b.name} ({formatLKR(b.current_balance_paise || 0)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-muted-foreground mb-1">Statement Date</label>
                  <input
                    type="date"
                    value={bankRecDate}
                    onChange={(e) => setBankRecDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground font-mono"
                  />
                </div>

                <div className="p-4 rounded-xl bg-secondary/30 border border-border/60 flex items-center justify-between">
                  <div>
                    <span className="text-muted-foreground">Book Balance (Ledger):</span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Balance per journal records</p>
                  </div>
                  <div className="text-lg font-bold font-mono text-blue-400">
                    <MoneyDisplay paise={bankBookPaise} />
                  </div>
                </div>

                <div>
                  <label className="block text-muted-foreground mb-1">Ending Statement Balance (Rs.) *</label>
                  <input
                    type="number"
                    value={statementBalanceRupees}
                    onChange={(e) => setStatementBalanceRupees(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground font-mono text-base font-bold"
                  />
                </div>

                {/* Variance Display */}
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between font-mono ${
                    bankVariancePaise === 0
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                  }`}
                >
                  <span className="font-sans font-medium">Variance (Statement − Book):</span>
                  <span className="font-bold text-sm">
                    {bankVariancePaise === 0
                      ? "✓ Reconciled (Rs. 0)"
                      : formatLKR(bankVariancePaise)}
                  </span>
                </div>

                <div>
                  <label className="block text-muted-foreground mb-1">Reconciliation Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Notes, uncredited deposits, or bank charge adjustments"
                    value={bankRecNotes}
                    onChange={(e) => setBankRecNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => bankRecMutation.mutate()}
                  disabled={bankRecMutation.isPending}
                  className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition shadow-md disabled:opacity-50"
                >
                  {bankRecMutation.isPending ? "Saving..." : "Save Bank Reconciliation"}
                </button>
              </div>
            </div>
          </div>

          {/* Historical Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cash Counts Log */}
            <div className="rounded-xl border border-border/70 bg-card/60 p-5 glass-panel space-y-3">
              <h4 className="font-semibold text-sm text-white">Past Physical Cash Counts</h4>
              {cashCounts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4">No cash count entries yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-secondary/40 text-muted-foreground uppercase border-b border-border/60">
                      <tr>
                        <th className="py-2 px-2.5">Date</th>
                        <th className="py-2 px-2.5 text-right">Expected</th>
                        <th className="py-2 px-2.5 text-right">Counted</th>
                        <th className="py-2 px-2.5 text-right">Diff</th>
                        <th className="py-2 px-2.5">Investigator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {cashCounts.map((c) => (
                        <tr key={c.id} className="hover:bg-secondary/20">
                          <td className="py-2 px-2.5">{c.count_date}</td>
                          <td className="py-2 px-2.5 text-right">{formatLKR(c.expected_paise)}</td>
                          <td className="py-2 px-2.5 text-right text-white font-medium">{formatLKR(c.counted_paise)}</td>
                          <td className={`py-2 px-2.5 text-right font-bold ${
                            c.difference_paise === 0 ? "text-emerald-400" : c.difference_paise > 0 ? "text-amber-400" : "text-rose-400"
                          }`}>
                            {formatLKR(c.difference_paise)}
                          </td>
                          <td className="py-2 px-2.5 font-sans text-muted-foreground">{c.investigated_by || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Bank Reconciliations Log */}
            <div className="rounded-xl border border-border/70 bg-card/60 p-5 glass-panel space-y-3">
              <h4 className="font-semibold text-sm text-white">Past Bank Reconciliations</h4>
              {bankRecs.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4">No bank reconciliation entries yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-secondary/40 text-muted-foreground uppercase border-b border-border/60">
                      <tr>
                        <th className="py-2 px-2.5">Date</th>
                        <th className="py-2 px-2.5">Account</th>
                        <th className="py-2 px-2.5 text-right">Statement</th>
                        <th className="py-2 px-2.5 text-right">Book</th>
                        <th className="py-2 px-2.5 text-right">Diff</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {bankRecs.map((b) => (
                        <tr key={b.id} className="hover:bg-secondary/20">
                          <td className="py-2 px-2.5">{b.reconciliation_date}</td>
                          <td className="py-2 px-2.5 font-sans">{b.account_code}</td>
                          <td className="py-2 px-2.5 text-right text-white font-medium">{formatLKR(b.statement_balance_paise)}</td>
                          <td className="py-2 px-2.5 text-right">{formatLKR(b.book_balance_paise)}</td>
                          <td className={`py-2 px-2.5 text-right font-bold ${
                            b.difference_paise === 0 ? "text-emerald-400" : "text-rose-400"
                          }`}>
                            {formatLKR(b.difference_paise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MONTH-END CLOSING & PERIOD LOCKING */}
      {activeTab === "periods" && (
        <div className="space-y-8">
          {/* Closing Checklist */}
          <div className="rounded-xl border border-border/70 bg-card/60 p-6 glass-panel space-y-4">
            <h3 className="font-bold text-base text-white">Month-End Closing Protocol (Requirement 13)</h3>
            <p className="text-xs text-muted-foreground">
              Once a calendar period is closed, no transactions can be posted to it without documented authorization.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/60 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>1. Pool & PS4 sessions verified</span>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/60 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>2. Unpaid balances reviewed</span>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/60 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>3. Cash count recorded</span>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/60 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>4. Bank statement reconciled</span>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/60 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>5. Drink stock counts entered</span>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/60 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>6. Supplier bills confirmed</span>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/60 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>7. Loan payments recorded</span>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/60 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>8. Profit allocation approved</span>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/60 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>9. General ledger balanced</span>
              </div>
            </div>
          </div>

          {/* Periods Status Table */}
          <div className="rounded-xl border border-border/70 bg-card/60 p-6 glass-panel space-y-4">
            <h3 className="font-bold text-base text-white">Calendar Accounting Periods (2026)</h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="uppercase bg-secondary/40 text-muted-foreground border-b border-border/60">
                  <tr>
                    <th className="py-2.5 px-4">Period</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Closed By</th>
                    <th className="py-2.5 px-4">Closed Date</th>
                    <th className="py-2.5 px-4">Reopen Reason</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
                    const p = periods.find((x) => x.year === 2026 && x.month === m);
                    const isClosed = p?.is_closed ?? false;

                    return (
                      <tr key={m} className="hover:bg-secondary/20">
                        <td className="py-3 px-4 font-bold text-white font-mono">
                          2026-{String(m).padStart(2, "0")}
                        </td>
                        <td className="py-3 px-4 font-sans">
                          {isClosed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold text-[11px] border border-rose-500/30">
                              <Lock className="h-3 w-3" /> Locked / Closed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold text-[11px] border border-emerald-500/30">
                              <Unlock className="h-3 w-3" /> Active / Open
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-sans text-muted-foreground">{p?.closed_by || "—"}</td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {p?.closed_at ? p.closed_at.split("T")[0] : "—"}
                        </td>
                        <td className="py-3 px-4 font-sans text-amber-300 text-[11px] max-w-xs truncate">
                          {p?.reopen_reason || "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-sans">
                          {isClosed ? (
                            <button
                              onClick={() => setReopenModal({ isOpen: true, year: 2026, month: m })}
                              className="px-3 py-1 rounded bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 text-[11px] font-semibold transition"
                            >
                              Authorize Reopen
                            </button>
                          ) : (
                            <button
                              onClick={() => closePeriodMutation.mutate({ year: 2026, month: m })}
                              className="px-3 py-1 rounded bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 text-[11px] font-semibold transition"
                            >
                              Lock & Close Period
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: OPENING BALANCES (31 DEC 2025) */}
      {activeTab === "opening" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border/70 bg-card/60 p-6 glass-panel space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white">Opening Balances as of 31 December 2025</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Establishes Day-1 balance sheet before operations begin on 1 Jan 2026 (Decision D-007)
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                  openingData?.posted
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                }`}
              >
                {openingData?.posted ? `Posted (${openingData.reference})` : "Not Yet Configured"}
              </span>
            </div>

            {openingData?.posted ? (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-2 text-xs">
                  <div className="flex justify-between font-mono">
                    <span className="text-muted-foreground">Reference:</span>
                    <span className="text-emerald-400 font-bold">{openingData.reference}</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-muted-foreground">Effective Date:</span>
                    <span className="text-white">{openingData.entry_date}</span>
                  </div>
                  <div className="flex justify-between font-sans">
                    <span className="text-muted-foreground">Description:</span>
                    <span className="text-white">{openingData.description}</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-secondary/40 uppercase text-muted-foreground border-b border-border/60">
                      <tr>
                        <th className="py-2.5 px-3">Account</th>
                        <th className="py-2.5 px-3">Account Name</th>
                        <th className="py-2.5 px-3 text-right">Debit (Asset)</th>
                        <th className="py-2.5 px-3 text-right">Credit (Liab / Equity)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {openingData.lines?.map((l: any, idx: number) => (
                        <tr key={idx} className="hover:bg-secondary/20">
                          <td className="py-2.5 px-3 font-bold text-emerald-400">{l.account_code}</td>
                          <td className="py-2.5 px-3 font-sans text-foreground">{l.account_name}</td>
                          <td className="py-2.5 px-3 text-right">
                            {l.is_debit ? <MoneyDisplay paise={l.amount_paise} /> : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {!l.is_debit ? <MoneyDisplay paise={l.amount_paise} /> : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-secondary/20 border border-border/60 text-center space-y-3">
                <p className="text-xs text-muted-foreground">
                  Opening balances can be entered by the authorized owners to reflect the business starting position (Cash, Bank, Equipment, Loans, and Partner Capital) as of 31 Dec 2025.
                </p>
                <p className="text-xs text-amber-400">
                  Total debited assets must equal total credited liabilities and owner capital.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <ArrowRightLeft className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Transfer Funds</h3>
                  <p className="text-xs text-muted-foreground">DR Destination, CR Source</p>
                </div>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="text-muted-foreground hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {transferError && (
              <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs">
                {transferError}
              </div>
            )}

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Transfer Date
                </label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  From Account (Source)
                </label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs"
                >
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name} ({formatLKR(a.current_balance_paise || 0)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  To Account (Destination)
                </label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs"
                >
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Amount (Rs.) *
                </label>
                <input
                  type="number"
                  min={1}
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Deposit daily cash to main bank account"
                  value={transferDesc}
                  onChange={(e) => setTransferDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary/40 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => transferMutation.mutate()}
                disabled={amountRupees <= 0 || fromAccountId === toAccountId || transferMutation.isPending}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition shadow-sm disabled:opacity-50"
              >
                {transferMutation.isPending ? "Posting..." : "Confirm & Post Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Period Modal */}
      {reopenModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                  <Unlock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    Authorize Reopening Period {reopenModal.year}-{String(reopenModal.month).padStart(2, "0")}
                  </h3>
                  <p className="text-xs text-muted-foreground">Documented justification is mandatory (Requirement 13)</p>
                </div>
              </div>
              <button
                onClick={() => setReopenModal({ isOpen: false, year: 0, month: 0 })}
                className="text-muted-foreground hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1">Reason for Reopening *</label>
                <textarea
                  rows={3}
                  placeholder="Explain why transactions must be posted into this closed period..."
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Authorized By *</label>
                <input
                  type="text"
                  value={reopenUser}
                  onChange={(e) => setReopenUser(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => setReopenModal({ isOpen: false, year: 0, month: 0 })}
                className="px-4 py-2 rounded-lg border border-border text-xs hover:bg-secondary/40 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reopenReason.trim().length < 5 || reopenPeriodMutation.isPending}
                onClick={() => reopenPeriodMutation.mutate()}
                className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs transition shadow-sm disabled:opacity-50"
              >
                {reopenPeriodMutation.isPending ? "Reopening..." : "Authorize & Reopen Period"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
