import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Banknote,
  PiggyBank,
  Wallet,
  Building,
  FileSpreadsheet,
  Coins,
  Users,
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { api } from "@/api/client";
import { MoneyDisplay } from "@/components/common/MoneyDisplay";
import { rupeesToPaise, formatLKR } from "@/lib/money";
import type { FinancialAccount } from "@/types";

type ActiveTab = "treasury" | "reconciliation" | "periods" | "opening";

export const AccountsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ActiveTab>("treasury");
  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      await api.reports.downloadExport("cash-bank");
    } catch (err: any) {
      alert(err.message || "Failed to download Excel report");
    } finally {
      setIsExporting(false);
    }
  };

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

  // Opening Balance Setup State
  const [openingDate, setOpeningDate] = useState(new Date().toISOString().split("T")[0]);
  const [equalCapitalRupees, setEqualCapitalRupees] = useState("");
  const [akashCapitalRs, setAkashCapitalRs] = useState("");
  const [akashDest, setAkashDest] = useState("1002");
  const [pasanCapitalRs, setPasanCapitalRs] = useState("");
  const [pasanDest, setPasanDest] = useState("1002");
  const [vishwaCapitalRs, setVishwaCapitalRs] = useState("");
  const [vishwaDest, setVishwaDest] = useState("1001");

  interface RelativeRow {
    id: string;
    name: string;
    amountRs: string;
    destination: "1001" | "1002" | "1003" | "1004";
    classification: "GIFT" | "LOAN" | "PENDING";
    notes: string;
  }
  const [relatives, setRelatives] = useState<RelativeRow[]>([
    {
      id: "1",
      name: "",
      amountRs: "",
      destination: "1004",
      classification: "GIFT",
      notes: "Opening day family blessing contribution",
    },
  ]);

  const [fixedAssetsRs, setFixedAssetsRs] = useState("");
  const [openingLoanRs, setOpeningLoanRs] = useState("");
  const [openingLoanLender, setOpeningLoanLender] = useState("");
  const [setupNotes, setSetupNotes] = useState("Pool Town business opening financial position");
  const [setupError, setSetupError] = useState("");
  const [setupSuccess, setSetupSuccess] = useState("");

  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);
  const [reverseReason, setReverseReason] = useState("");
  const [isConfirmSetupModalOpen, setIsConfirmSetupModalOpen] = useState(false);

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

  const operatingCashAccount = accounts.find((a: FinancialAccount) => a.code === "1001");
  const operatingBankAccount = accounts.find((a: FinancialAccount) => a.code === "1002");
  const savingsBankAccount = accounts.find((a: FinancialAccount) => a.code === "1003");
  const savingsCashAccount = accounts.find((a: FinancialAccount) => a.code === "1004");

  const operatingCashPaise = operatingCashAccount?.current_balance_paise || 0;
  const operatingBankPaise = operatingBankAccount?.current_balance_paise || 0;
  const totalAvailableBusinessMoneyPaise = operatingCashPaise + operatingBankPaise;

  const savingsCashPaise = savingsCashAccount?.current_balance_paise || 0;
  const savingsBankPaise = savingsBankAccount?.current_balance_paise || 0;
  const totalBusinessSavingsPaise = savingsCashPaise + savingsBankPaise;

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

  const postOpeningSetupMutation = useMutation({
    mutationFn: (payload: any) => api.accounts.postOpeningBalancesSetup(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["opening-balances"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["financialAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["trial-balance"] });
      queryClient.invalidateQueries({ queryKey: ["owners"] });
      queryClient.invalidateQueries({ queryKey: ["owner-transactions"] });
      setIsConfirmSetupModalOpen(false);
      setSetupError("");
      setSetupSuccess(`Opening balances posted successfully under reference ${data.reference}!`);
      setTimeout(() => setSetupSuccess(""), 6000);
    },
    onError: (err: any) => {
      setSetupError(err.message || "Failed to post opening balances");
      setIsConfirmSetupModalOpen(false);
    },
  });

  const reverseOpeningMutation = useMutation({
    mutationFn: () =>
      api.accounts.reverseOpeningBalances({
        reason: reverseReason.trim() || "Resetting opening balances for fresh start",
        reversed_by: "Admin",
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["opening-balances"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["financialAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["trial-balance"] });
      queryClient.invalidateQueries({ queryKey: ["owners"] });
      queryClient.invalidateQueries({ queryKey: ["owner-transactions"] });
      setIsReverseModalOpen(false);
      setReverseReason("");
      setSetupSuccess(data.message || "Opening balances reversed successfully. You can now enter fresh opening figures.");
      setTimeout(() => setSetupSuccess(""), 6000);
    },
    onError: (err: any) => {
      alert(err.message || "Failed to reverse opening balances");
    },
  });

  const handleApplyEqualCapital = () => {
    if (!equalCapitalRupees || Number(equalCapitalRupees) <= 0) return;
    setAkashCapitalRs(equalCapitalRupees);
    setPasanCapitalRs(equalCapitalRupees);
    setVishwaCapitalRs(equalCapitalRupees);
  };

  const handleAddRelativeRow = () => {
    setRelatives((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: "",
        amountRs: "",
        destination: "1004",
        classification: "GIFT",
        notes: "",
      },
    ]);
  };

  const handleRemoveRelativeRow = (id: string) => {
    setRelatives((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  const handleUpdateRelativeRow = (id: string, field: keyof RelativeRow, value: any) => {
    setRelatives((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  // Capital amounts
  const akashPaise = rupeesToPaise(Number(akashCapitalRs) || 0);
  const pasanPaise = rupeesToPaise(Number(pasanCapitalRs) || 0);
  const vishwaPaise = rupeesToPaise(Number(vishwaCapitalRs) || 0);
  const totalOwnerCapitalPaise = akashPaise + pasanPaise + vishwaPaise;

  // Relatives amounts
  const relativesGiftPaise = relatives
    .filter((r) => r.classification === "GIFT" && Number(r.amountRs) > 0)
    .reduce((sum, r) => sum + rupeesToPaise(Number(r.amountRs)), 0);

  const relativesLoanPaise = relatives
    .filter((r) => (r.classification === "LOAN" || r.classification === "PENDING") && Number(r.amountRs) > 0)
    .reduce((sum, r) => sum + rupeesToPaise(Number(r.amountRs)), 0);

  const totalRelativesFundingPaise = relativesGiftPaise + relativesLoanPaise;

  // Assets routing
  let openingCashDrPaise = 0;
  let openingBankDrPaise = 0;
  let openingSavingsCashDrPaise = 0;
  let openingSavingsBankDrPaise = 0;

  if (akashDest === "1001") openingCashDrPaise += akashPaise; else openingBankDrPaise += akashPaise;
  if (pasanDest === "1001") openingCashDrPaise += pasanPaise; else openingBankDrPaise += pasanPaise;
  if (vishwaDest === "1001") openingCashDrPaise += vishwaPaise; else openingBankDrPaise += vishwaPaise;

  relatives.forEach((r) => {
    const amt = rupeesToPaise(Number(r.amountRs) || 0);
    if (r.destination === "1001") openingCashDrPaise += amt;
    else if (r.destination === "1002") openingBankDrPaise += amt;
    else if (r.destination === "1003") openingSavingsBankDrPaise += amt;
    else if (r.destination === "1004") openingSavingsCashDrPaise += amt;
  });

  const fixedAssetsPaise = rupeesToPaise(Number(fixedAssetsRs) || 0);
  const openingLoanPaise = rupeesToPaise(Number(openingLoanRs) || 0);

  const totalOpeningSavingsCalcPaise = openingSavingsCashDrPaise + openingSavingsBankDrPaise;

  const totalOpeningDebitsPaise =
    openingCashDrPaise + openingBankDrPaise + openingSavingsCashDrPaise + openingSavingsBankDrPaise + fixedAssetsPaise;
  const totalOpeningCreditsPaise =
    totalOwnerCapitalPaise + relativesGiftPaise + relativesLoanPaise + openingLoanPaise;
  const openingImbalancePaise = totalOpeningDebitsPaise - totalOpeningCreditsPaise;
  const isOpeningSetupBalanced = totalOpeningDebitsPaise > 0 && openingImbalancePaise === 0;

  const handlePostOpeningSetup = () => {
    if (!isOpeningSetupBalanced) return;
    const payload = {
      opening_date: openingDate,
      owner_contributions: [
        { owner_name: "Akash", amount_paise: akashPaise, destination_code: akashDest, notes: "Akash initial opening capital" },
        { owner_name: "Pasan", amount_paise: pasanPaise, destination_code: pasanDest, notes: "Pasan initial opening capital" },
        { owner_name: "Vishwa", amount_paise: vishwaPaise, destination_code: vishwaDest, notes: "Vishwa initial opening capital" },
      ],
      relative_contributions: relatives
        .filter((r) => Number(r.amountRs) > 0 && r.name.trim())
        .map((r) => ({
          contributor_name: r.name.trim(),
          amount_paise: rupeesToPaise(Number(r.amountRs)),
          destination_code: r.destination,
          classification: r.classification,
          purpose: r.notes.trim() || "Opening day family contribution",
          notes: r.notes.trim() || undefined,
        })),
      direct_assets: fixedAssetsPaise > 0 ? [
        { account_code: "1030", name: "Fixed Assets & Equipment", amount_paise: fixedAssetsPaise, notes: "Opening pool tables, PS4 consoles & hall fittings" }
      ] : [],
      opening_liabilities: openingLoanPaise > 0 ? [
        { account_code: "2010", lender_or_creditor: openingLoanLender.trim() || "Opening Business Loan", amount_paise: openingLoanPaise, notes: "Opening business loan" }
      ] : [],
      notes: setupNotes.trim() || "Opening balance setup",
    };
    postOpeningSetupMutation.mutate(payload);
  };

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

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => navigate("/partners")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 hover:border-emerald-500/40 text-xs font-semibold shadow-sm transition shrink-0 cursor-pointer"
            title="Record money collected by partners (Akash, Pasan, Vishwa)"
          >
            <Coins className="h-4 w-4 text-emerald-400" />
            <span>Record Money Collected</span>
          </button>

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
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-md shrink-0 cursor-pointer"
            >
              <ArrowRightLeft className="h-4 w-4" />
              <span>Transfer Between Accounts</span>
            </button>
          )}

          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 hover:border-emerald-500/40 text-xs font-semibold shadow-sm transition shrink-0 cursor-pointer disabled:opacity-50"
            title="Download Cash & Bank accounts and transfers in Excel (.xlsx)"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            <span>{isExporting ? "Exporting…" : "Export to Excel (.xlsx)"}</span>
          </button>
        </div>
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
          <span>Cash, Bank & Savings</span>
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
          <span>Cash & Bank Balance Checks</span>
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
          <span>Opening Balance Setup</span>
          <span
            className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              openingData?.posted
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
            }`}
          >
            {openingData?.posted ? "Confirmed" : "Setup Required"}
          </span>
        </button>
      </div>

      {/* TAB 1: TREASURY & GENERAL LEDGER */}
      {activeTab === "treasury" && (
        <div className="space-y-8">
          {/* Fresh-Start / Setup Pending Banner */}
          {!openingData?.posted && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200 shadow-sm animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <p className="font-semibold text-white">Fresh Start Notice: Opening Balances Not Yet Configured</p>
                  <p className="text-amber-300/80 mt-0.5">
                    All accounts currently show Rs. 0.00. Enter your verified opening capital, relatives' funding, and starting cash before daily operations.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab("opening")}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold shrink-0 cursor-pointer transition shadow"
              >
                Set Up Opening Balances →
              </button>
            </div>
          )}

          {/* ── Section A: Cash & Bank (Operating Money) ── */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Banknote className="h-4 w-4 text-emerald-400" />
                <span>Section A: Cash & Bank</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Operating business money available for daily expenses and bills (excludes savings)
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Cash in Hand */}
              <div
                className="p-5 rounded-xl border border-border/80 space-y-2"
                style={{ backgroundColor: "#1E293B" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                    Physical Cash
                  </span>
                  <Wallet className="h-4 w-4 text-emerald-400" />
                </div>
                <p className="text-sm font-semibold text-slate-200">Cash in Hand</p>
                <div className="text-2xl font-bold font-mono text-emerald-400 pt-1">
                  <MoneyDisplay paise={operatingCashPaise} />
                </div>
                <p className="text-xs text-muted-foreground pt-1">Physical cash available on premises</p>
              </div>

              {/* Main Bank Account */}
              <div
                className="p-5 rounded-xl border border-border/80 space-y-2"
                style={{ backgroundColor: "#1E293B" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 font-semibold border border-sky-500/20">
                    Operating Bank
                  </span>
                  <Building className="h-4 w-4 text-sky-400" />
                </div>
                <p className="text-sm font-semibold text-slate-200">Main Bank Account</p>
                <div className="text-2xl font-bold font-mono text-sky-400 pt-1">
                  <MoneyDisplay paise={operatingBankPaise} />
                </div>
                <p className="text-xs text-muted-foreground pt-1">Primary operational bank checking account</p>
              </div>

              {/* Total Available Business Money */}
              <div
                className="p-5 rounded-xl border border-emerald-500/30 space-y-2 bg-gradient-to-br from-emerald-500/15 via-slate-800 to-slate-900 shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    Available Now
                  </span>
                  <Banknote className="h-4 w-4 text-emerald-300" />
                </div>
                <p className="text-sm font-bold text-white">Total Available Business Money</p>
                <div className="text-2xl font-bold font-mono text-white pt-1">
                  <MoneyDisplay paise={totalAvailableBusinessMoneyPaise} />
                </div>
                <p className="text-xs text-emerald-300/80 pt-1">
                  Cash in Hand + Main Bank Account (excludes savings)
                </p>
              </div>
            </div>
          </div>

          {/* ── Section B: Business Savings ── */}
          <div className="space-y-3 pt-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-indigo-400" />
                <span>Section B: Business Savings</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Dedicated business savings reserve (held separately from operating cash)
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Total Business Savings */}
              <div
                className="p-5 rounded-xl border border-indigo-500/30 space-y-2 bg-gradient-to-br from-indigo-500/15 via-slate-800 to-slate-900 shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                    Total Savings
                  </span>
                  <PiggyBank className="h-4 w-4 text-indigo-300" />
                </div>
                <p className="text-sm font-bold text-white">Total Business Savings</p>
                <div className="text-2xl font-bold font-mono text-white pt-1">
                  <MoneyDisplay paise={totalBusinessSavingsPaise} />
                </div>
                <p className="text-xs text-indigo-300/80 pt-1">
                  Savings Cash + Savings Bank
                </p>
              </div>

              {/* Savings held as Cash */}
              <div
                className="p-5 rounded-xl border border-border/80 space-y-2"
                style={{ backgroundColor: "#1E293B" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                    Savings in Cash
                  </span>
                  <Wallet className="h-4 w-4 text-emerald-400" />
                </div>
                <p className="text-sm font-semibold text-slate-200">Savings held as Cash</p>
                <div className="text-2xl font-bold font-mono text-emerald-400 pt-1">
                  <MoneyDisplay paise={savingsCashPaise} />
                </div>
                <p className="text-xs text-muted-foreground pt-1">Physical cash savings reserve</p>
              </div>

              {/* Savings held in Bank */}
              <div
                className="p-5 rounded-xl border border-border/80 space-y-2"
                style={{ backgroundColor: "#1E293B" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 font-semibold border border-sky-500/20">
                    Savings in Bank
                  </span>
                  <Building className="h-4 w-4 text-sky-400" />
                </div>
                <p className="text-sm font-semibold text-slate-200">Savings held in Bank</p>
                <div className="text-2xl font-bold font-mono text-sky-400 pt-1">
                  <MoneyDisplay paise={savingsBankPaise} />
                </div>
                <p className="text-xs text-muted-foreground pt-1">Dedicated bank savings reserve</p>
              </div>
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
                        <td className="py-2.5 px-3 font-medium text-slate-200">{t.from_account_name}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-200">{t.to_account_name}</td>
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
                      <th className="py-2.5 px-4">Account Name</th>
                      <th className="py-2.5 px-4 text-right">Debit (Paise)</th>
                      <th className="py-2.5 px-4 text-right">Credit (Paise)</th>
                      <th className="py-2.5 px-4 text-right">Net Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono text-xs">
                    {trialBalance.map((r) => (
                      <tr key={r.account_code} className="hover:bg-secondary/20 transition-colors">
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
                      <td colSpan={1} className="py-3 px-4 uppercase text-foreground">
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
                    <h3 className="font-bold text-base text-white">Daily Cash Check</h3>
                    <p className="text-xs text-muted-foreground">Cash in Hand</p>
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
                  <label className="block text-muted-foreground mb-1">Date</label>
                  <input
                    type="date"
                    value={cashCountDate}
                    onChange={(e) => setCashCountDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground font-mono"
                  />
                </div>

                <div className="p-4 rounded-xl bg-secondary/30 border border-border/60 flex items-center justify-between">
                  <div>
                    <span className="text-muted-foreground">Expected Cash Balance:</span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Sum of all cash received minus cash paid</p>
                  </div>
                  <div className="text-lg font-bold font-mono text-emerald-400">
                    <MoneyDisplay paise={expectedCashPaise} />
                  </div>
                </div>

                <div>
                  <label className="block text-muted-foreground mb-1">Actual Cash Counted (Rs.) *</label>
                  <input
                    type="number"
                    min={0}
                    value={countedCashRupees}
                    onChange={(e) => setCountedCashRupees(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground font-mono text-base font-bold"
                  />
                </div>

                {/* Difference Display */}
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between font-mono ${
                    cashVariancePaise === 0
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : cashVariancePaise > 0
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                  }`}
                >
                  <span className="font-sans font-medium">Difference:</span>
                  <span className="font-bold text-sm">
                    {cashVariancePaise === 0
                      ? "✓ Balances match perfectly (Rs. 0)"
                      : cashVariancePaise > 0
                      ? `Surplus: +${formatLKR(cashVariancePaise)}`
                      : `Shortage: -${formatLKR(Math.abs(cashVariancePaise))} (Needs checking)`}
                  </span>
                </div>

                <div>
                  <label className="block text-muted-foreground mb-1">Checked By</label>
                  <input
                    type="text"
                    placeholder="e.g. Vishwa / Akash"
                    value={investigator}
                    onChange={(e) => setInvestigator(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-muted-foreground mb-1">Notes (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Optional notes or discrepancy explanations"
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
                  {cashCountMutation.isPending ? "Saving..." : "Save Cash Check"}
                </button>
              </div>
            </div>

            {/* Bank Statement Reconciliation Panel */}
            <div className="rounded-xl border border-border/70 bg-card/60 p-6 glass-panel space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-blue-400" />
                  <div>
                    <h3 className="font-bold text-base text-white">Bank Balance Check</h3>
                    <p className="text-xs text-muted-foreground">Main Bank & Savings</p>
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
                        {b.name} ({formatLKR(b.current_balance_paise || 0)})
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
                    <span className="text-muted-foreground">Bank Balance in System:</span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Balance per journal records</p>
                  </div>
                  <div className="text-lg font-bold font-mono text-blue-400">
                    <MoneyDisplay paise={bankBookPaise} />
                  </div>
                </div>

                <div>
                  <label className="block text-muted-foreground mb-1">Bank Statement Balance (Rs.) *</label>
                  <input
                    type="number"
                    value={statementBalanceRupees}
                    onChange={(e) => setStatementBalanceRupees(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground font-mono text-base font-bold"
                  />
                </div>

                {/* Difference Display */}
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between font-mono ${
                    bankVariancePaise === 0
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                  }`}
                >
                  <span className="font-sans font-medium">Difference:</span>
                  <span className="font-bold text-sm">
                    {bankVariancePaise === 0
                      ? "✓ Balances match perfectly (Rs. 0)"
                      : `Difference: ${formatLKR(bankVariancePaise)} (Needs checking)`}
                  </span>
                </div>

                <div>
                  <label className="block text-muted-foreground mb-1">Notes (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Notes or explanations"
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
                  {bankRecMutation.isPending ? "Saving..." : "Save Bank Check"}
                </button>
              </div>
            </div>
          </div>

          {/* Historical Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cash Counts Log */}
            <div className="rounded-xl border border-border/70 bg-card/60 p-5 glass-panel space-y-3">
              <h4 className="font-semibold text-sm text-white">Past Cash Checks</h4>
              {cashCounts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4">No cash check entries yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-secondary/40 text-muted-foreground uppercase border-b border-border/60">
                      <tr>
                        <th className="py-2 px-2.5">Date</th>
                        <th className="py-2 px-2.5 text-right">Expected</th>
                        <th className="py-2 px-2.5 text-right">Counted</th>
                        <th className="py-2 px-2.5 text-right">Difference</th>
                        <th className="py-2 px-2.5">Checked By</th>
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
              <h4 className="font-semibold text-sm text-white">Past Bank Checks</h4>
              {bankRecs.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4">No bank check entries yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-secondary/40 text-muted-foreground uppercase border-b border-border/60">
                      <tr>
                        <th className="py-2 px-2.5">Date</th>
                        <th className="py-2 px-2.5">Account</th>
                        <th className="py-2 px-2.5 text-right">Statement Balance</th>
                        <th className="py-2 px-2.5 text-right">System Balance</th>
                        <th className="py-2 px-2.5 text-right">Difference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {bankRecs.map((b) => (
                        <tr key={b.id} className="hover:bg-secondary/20">
                          <td className="py-2 px-2.5">{b.reconciliation_date}</td>
                          <td className="py-2 px-2.5 font-sans text-slate-200">
                            {accounts.find((a: FinancialAccount) => a.code === b.account_code || a.id === b.account_id)?.name || "Bank Account"}
                          </td>
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

      {/* TAB 4: OPENING BALANCES & FRESH START SETUP */}
      {activeTab === "opening" && (
        <div className="space-y-6">
          {setupSuccess && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-emerald-300 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{setupSuccess}</span>
              </div>
              <button onClick={() => setSetupSuccess("")} className="text-emerald-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {openingData?.posted ? (
            /* POSTED VIEW */
            <div className="space-y-6">
              <div className="rounded-2xl border border-emerald-500/30 bg-card/60 p-6 glass-panel space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                        <ShieldCheck className="h-4 w-4" />
                      </span>
                      <h3 className="font-bold text-base text-white">Opening Financial Position (Active)</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Business starting position recorded and locked into double-entry ledger.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Posted ({openingData.reference})
                    </span>
                    <button
                      onClick={() => setIsReverseModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 text-xs font-medium transition"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Re-open / Reset Setup
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-secondary/30 border border-border/60 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Opening Reference</span>
                    <span className="font-mono font-bold text-emerald-400">{openingData.reference}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Opening Date</span>
                    <span className="text-white font-medium">{openingData.entry_date}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground block text-[11px]">Notes</span>
                    <span className="text-white truncate block">{openingData.description}</span>
                  </div>
                </div>

                {/* KPI Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-secondary/30 border border-border/60">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Total Owner Capital</span>
                      <Users className="h-3.5 w-3.5 text-blue-400" />
                    </div>
                    <div className="text-lg font-bold text-white">
                      <MoneyDisplay paise={openingData.breakdown?.owner_capital?.total_paise || 0} />
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                      <div className="flex justify-between"><span>Akash:</span><span className="text-white font-numeric font-bold">{formatLKR(openingData.breakdown?.owner_capital?.akash_paise || 0)}</span></div>
                      <div className="flex justify-between"><span>Pasan:</span><span className="text-white font-numeric font-bold">{formatLKR(openingData.breakdown?.owner_capital?.pasan_paise || 0)}</span></div>
                      <div className="flex justify-between"><span>Vishwa:</span><span className="text-white font-numeric font-bold">{formatLKR(openingData.breakdown?.owner_capital?.vishwa_paise || 0)}</span></div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-secondary/30 border border-border/60">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Relatives' Funding</span>
                      <Banknote className="h-3.5 w-3.5 text-amber-400" />
                    </div>
                    <div className="text-lg font-bold text-white">
                      <MoneyDisplay paise={openingData.breakdown?.relatives_contributions?.total_paise || 0} />
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                      <div className="flex justify-between"><span>Gift/Equity:</span><span className="text-emerald-400 font-numeric font-bold">{formatLKR(openingData.breakdown?.relatives_contributions?.gift_equity_paise || 0)}</span></div>
                      <div className="flex justify-between"><span>Repayable Loan:</span><span className="text-amber-400 font-numeric font-bold">{formatLKR(openingData.breakdown?.relatives_contributions?.loan_liability_paise || 0)}</span></div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-secondary/30 border border-border/60">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Total Business Savings</span>
                      <PiggyBank className="h-3.5 w-3.5 text-purple-400" />
                    </div>
                    <div className="text-lg font-bold text-purple-300">
                      <MoneyDisplay paise={openingData.breakdown?.assets?.total_savings_paise || 0} />
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                      <div className="flex justify-between"><span>Savings Cash:</span><span className="text-white font-numeric font-bold">{formatLKR(openingData.breakdown?.assets?.savings_cash_paise || 0)}</span></div>
                      <div className="flex justify-between"><span>Savings Bank:</span><span className="text-white font-numeric font-bold">{formatLKR(openingData.breakdown?.assets?.savings_bank_paise || 0)}</span></div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-secondary/30 border border-border/60">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Operating Cash & Bank</span>
                      <Building className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    <div className="text-lg font-bold text-emerald-300">
                      <MoneyDisplay paise={(openingData.breakdown?.assets?.cash_in_hand_paise || 0) + (openingData.breakdown?.assets?.main_bank_paise || 0)} />
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                      <div className="flex justify-between"><span>Cash in Hand:</span><span className="text-white font-numeric font-bold">{formatLKR(openingData.breakdown?.assets?.cash_in_hand_paise || 0)}</span></div>
                      <div className="flex justify-between"><span>Main Bank:</span><span className="text-white font-numeric font-bold">{formatLKR(openingData.breakdown?.assets?.main_bank_paise || 0)}</span></div>
                    </div>
                  </div>
                </div>

                {/* Journal lines table */}
                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-secondary/40 uppercase text-muted-foreground border-b border-border/60">
                      <tr>
                        <th className="py-2.5 px-3">Account Name</th>
                        <th className="py-2.5 px-3 text-right">Debit (Assets)</th>
                        <th className="py-2.5 px-3 text-right">Credit (Capital / Liab)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {openingData.lines?.map((l: any, idx: number) => (
                        <tr key={idx} className="hover:bg-secondary/20">
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
            </div>
          ) : (
            /* UNPOSTED GUIDED SETUP WIZARD */
            <div className="space-y-6">
              <div className="rounded-2xl border border-primary/30 bg-card/60 p-6 glass-panel space-y-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-primary/20 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <h3 className="font-bold text-base text-white">Opening Balance & Capital Setup</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Set up your genuine starting financial position before launching live operations. All accounts currently start at Rs. 0.00 until confirmed here.
                  </p>
                </div>

                {setupError && (
                  <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{setupError}</span>
                  </div>
                )}

                {/* STEP 1: OPENING DATE */}
                <div className="p-5 rounded-xl bg-secondary/30 border border-border/60 space-y-4">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <h4 className="font-bold text-xs uppercase text-primary tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] flex items-center justify-center font-bold">1</span>
                      Business Opening Date & Reference
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-muted-foreground mb-1">Business Opening Date *</label>
                      <input
                        type="date"
                        value={openingDate}
                        onChange={(e) => setOpeningDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-secondary/60 border border-border text-foreground text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-muted-foreground mb-1">Opening Reference Notes</label>
                      <input
                        type="text"
                        value={setupNotes}
                        onChange={(e) => setSetupNotes(e.target.value)}
                        placeholder="e.g. Pool Town opening financial position"
                        className="w-full px-3 py-2 rounded-lg bg-secondary/60 border border-border text-foreground text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* STEP 2: THREE OWNERS EQUAL CAPITAL */}
                <div className="p-5 rounded-xl bg-secondary/30 border border-border/60 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2">
                    <h4 className="font-bold text-xs uppercase text-primary tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] flex items-center justify-center font-bold">2</span>
                      Owner Capital Contributions (Akash, Pasan, Vishwa)
                    </h4>
                    <span className="text-[11px] text-muted-foreground">
                      Total Capital: <strong className="text-white font-mono">{formatLKR(totalOwnerCapitalPaise)}</strong>
                    </span>
                  </div>

                  <div className="p-3.5 rounded-lg bg-primary/10 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-white">Equal Capital Shortcut</span>
                      <p className="text-[11px] text-muted-foreground">
                        All 3 owners started with identical capital contributions. Enter once to fill for all 3.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Rs. amount per owner"
                        value={equalCapitalRupees}
                        onChange={(e) => setEqualCapitalRupees(e.target.value)}
                        className="w-36 px-2.5 py-1.5 rounded-lg bg-secondary/80 border border-border text-foreground text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleApplyEqualCapital}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-sm transition"
                      >
                        <Sparkles className="h-3 w-3" />
                        Apply to All 3
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Akash */}
                    <div className="p-4 rounded-xl bg-card/60 border border-border/70 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">Akash</span>
                        <span className="text-[10px] text-muted-foreground font-mono">Account 3001</span>
                      </div>
                      <div>
                        <label className="block text-muted-foreground mb-1 text-[11px]">Capital Contribution (Rs.)</label>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={akashCapitalRs}
                          onChange={(e) => setAkashCapitalRs(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-secondary/60 border border-border text-foreground font-mono font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-muted-foreground mb-1 text-[11px]">Deposited / Received Into</label>
                        <select
                          value={akashDest}
                          onChange={(e) => setAkashDest(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-secondary/60 border border-border text-foreground text-xs"
                        >
                          <option value="1002">Main Bank Account</option>
                          <option value="1001">Cash in Hand</option>
                        </select>
                      </div>
                    </div>

                    {/* Pasan */}
                    <div className="p-4 rounded-xl bg-card/60 border border-border/70 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">Pasan</span>
                        <span className="text-[10px] text-muted-foreground font-mono">Account 3002</span>
                      </div>
                      <div>
                        <label className="block text-muted-foreground mb-1 text-[11px]">Capital Contribution (Rs.)</label>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={pasanCapitalRs}
                          onChange={(e) => setPasanCapitalRs(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-secondary/60 border border-border text-foreground font-mono font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-muted-foreground mb-1 text-[11px]">Deposited / Received Into</label>
                        <select
                          value={pasanDest}
                          onChange={(e) => setPasanDest(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-secondary/60 border border-border text-foreground text-xs"
                        >
                          <option value="1002">Main Bank Account</option>
                          <option value="1001">Cash in Hand</option>
                        </select>
                      </div>
                    </div>

                    {/* Vishwa */}
                    <div className="p-4 rounded-xl bg-card/60 border border-border/70 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">Vishwa</span>
                        <span className="text-[10px] text-muted-foreground font-mono">Account 3003</span>
                      </div>
                      <div>
                        <label className="block text-muted-foreground mb-1 text-[11px]">Capital Contribution (Rs.)</label>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={vishwaCapitalRs}
                          onChange={(e) => setVishwaCapitalRs(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-secondary/60 border border-border text-foreground font-mono font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-muted-foreground mb-1 text-[11px]">Deposited / Received Into</label>
                        <select
                          value={vishwaDest}
                          onChange={(e) => setVishwaDest(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-secondary/60 border border-border text-foreground text-xs"
                        >
                          <option value="1001">Cash in Hand</option>
                          <option value="1002">Main Bank Account</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* STEP 3: RELATIVES CONTRIBUTIONS & SAVINGS */}
                <div className="p-5 rounded-xl bg-secondary/30 border border-border/60 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2">
                    <div>
                      <h4 className="font-bold text-xs uppercase text-primary tracking-wider flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] flex items-center justify-center font-bold">3</span>
                        Money Received From Relatives (Opening Day)
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Classified as Family Gift (Equity 3020) or Repayable Loan (Liability 2015). Never counted as operating profit!
                      </p>
                    </div>
                    <div className="text-right text-[11px] text-muted-foreground">
                      Total Relatives: <strong className="text-white font-mono">{formatLKR(totalRelativesFundingPaise)}</strong>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {relatives.map((rel) => (
                      <div key={rel.id} className="p-3.5 rounded-xl bg-card/60 border border-border/70 grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs items-center">
                        <div className="sm:col-span-3">
                          <label className="block text-muted-foreground text-[10px] mb-0.5">Relative / Contributor Name *</label>
                          <input
                            type="text"
                            placeholder="e.g. Uncle Samantha"
                            value={rel.name}
                            onChange={(e) => handleUpdateRelativeRow(rel.id, "name", e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-secondary/60 border border-border text-foreground text-xs"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-muted-foreground text-[10px] mb-0.5">Amount (Rs.) *</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={rel.amountRs}
                            onChange={(e) => handleUpdateRelativeRow(rel.id, "amountRs", e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-secondary/60 border border-border text-foreground text-xs font-mono font-medium"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-muted-foreground text-[10px] mb-0.5">Destination Account</label>
                          <select
                            value={rel.destination}
                            onChange={(e) => handleUpdateRelativeRow(rel.id, "destination", e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg bg-secondary/60 border border-border text-foreground text-xs"
                          >
                            <option value="1004">Savings Held as Cash</option>
                            <option value="1003">Savings Held in Bank</option>
                            <option value="1001">Cash in Hand</option>
                            <option value="1002">Main Bank Account</option>
                          </select>
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-muted-foreground text-[10px] mb-0.5">Classification</label>
                          <select
                            value={rel.classification}
                            onChange={(e) => handleUpdateRelativeRow(rel.id, "classification", e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg bg-secondary/60 border border-border text-foreground text-xs"
                          >
                            <option value="GIFT">Family Gift / Contribution (Equity)</option>
                            <option value="LOAN">Repayable Loan (Liability)</option>
                            <option value="PENDING">Pending Confirmation (Liability)</option>
                          </select>
                        </div>
                        <div className="sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveRelativeRow(rel.id)}
                            disabled={relatives.length === 1}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30 transition"
                            title="Remove row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={handleAddRelativeRow}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-secondary/40 text-xs font-medium text-foreground transition"
                      >
                        <Plus className="h-3.5 w-3.5 text-primary" />
                        Add Another Contributor
                      </button>
                      <span className="text-[11px] text-muted-foreground">
                        Savings from Relatives: <strong className="text-purple-300 font-mono">{formatLKR(totalOpeningSavingsCalcPaise)}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* STEP 4: OPTIONAL ASSETS & LIABILITIES */}
                <div className="p-5 rounded-xl bg-secondary/30 border border-border/60 space-y-4">
                  <h4 className="font-bold text-xs uppercase text-primary tracking-wider flex items-center gap-2 border-b border-border/40 pb-2">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] flex items-center justify-center font-bold">4</span>
                    Optional Opening Equipment & Other Liabilities
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block text-muted-foreground mb-1 text-[11px]">Pool Tables & Equipment (Rs.)</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={fixedAssetsRs}
                        onChange={(e) => setFixedAssetsRs(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-secondary/60 border border-border text-foreground text-xs font-mono"
                      />
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">Account 1030 (Fixed Assets)</span>
                    </div>
                    <div>
                      <label className="block text-muted-foreground mb-1 text-[11px]">Opening Business Loan (Rs.)</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={openingLoanRs}
                        onChange={(e) => setOpeningLoanRs(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-secondary/60 border border-border text-foreground text-xs font-mono"
                      />
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">Account 2010 (Commercial Loan)</span>
                    </div>
                    <div>
                      <label className="block text-muted-foreground mb-1 text-[11px]">Lender Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Bank of Ceylon / Commercial Bank"
                        value={openingLoanLender}
                        onChange={(e) => setOpeningLoanLender(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-secondary/60 border border-border text-foreground text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* STEP 5: DOUBLE-ENTRY BALANCE VERIFICATION */}
                <div className={`p-5 rounded-xl border space-y-4 ${
                  isOpeningSetupBalanced
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : totalOpeningDebitsPaise > 0
                    ? "bg-amber-500/10 border-amber-500/30"
                    : "bg-secondary/30 border-border/60"
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] flex items-center justify-center font-bold">5</span>
                        Double-Entry Ledger Balancing Check
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Every rupee of assets (Cash, Bank, Savings, Equipment) must equal total Equity & Liabilities.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOpeningSetupBalanced ? (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          Balanced & Ready to Post
                        </span>
                      ) : totalOpeningDebitsPaise > 0 ? (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                          Imbalance: {formatLKR(Math.abs(openingImbalancePaise))}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Awaiting amounts</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-lg bg-card/60 border border-border/60 font-mono text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[10px] font-sans">Total Assets (DR)</span>
                      <span className="text-white font-bold">{formatLKR(totalOpeningDebitsPaise)}</span>
                      <span className="block text-[10px] text-muted-foreground font-sans">Cash, Bank, Savings, Assets</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] font-sans">Total Equity & Liab (CR)</span>
                      <span className="text-white font-bold">{formatLKR(totalOpeningCreditsPaise)}</span>
                      <span className="block text-[10px] text-muted-foreground font-sans">Capital, Relatives, Loans</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] font-sans">Difference</span>
                      <span className={openingImbalancePaise === 0 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                        {formatLKR(openingImbalancePaise)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      disabled={!isOpeningSetupBalanced || postOpeningSetupMutation.isPending}
                      onClick={() => setIsConfirmSetupModalOpen(true)}
                      className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs transition shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Review & Post Opening Balances
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
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
                      {a.name} ({formatLKR(a.current_balance_paise || 0)})
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
                      {a.name}
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

      {/* Confirm Opening Setup Modal */}
      {isConfirmSetupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Confirm Opening Balances</h3>
                  <p className="text-xs text-muted-foreground">This action cannot be undone without an explicit reversal.</p>
                </div>
              </div>
              <button onClick={() => setIsConfirmSetupModalOpen(false)} className="text-muted-foreground hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="text-xs text-slate-300 space-y-2">
              <p>You are about to post the opening financial position for Pool Town. This will create journal entries for:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Owner capital contributions (Akash, Pasan, Vishwa)</li>
                <li>Relatives&#39; funding contributions</li>
                <li>Opening cash, bank, and savings balances</li>
              </ul>
              <p className="text-amber-300 font-medium">Verify all amounts are correct before confirming.</p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
              <button type="button" onClick={() => setIsConfirmSetupModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary/40 transition">
                Back to Edit
              </button>
              <button type="button" onClick={() => { handlePostOpeningSetup(); }}
                disabled={postOpeningSetupMutation.isPending}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md disabled:opacity-50">
                {postOpeningSetupMutation.isPending ? "Posting..." : "Confirm & Post Opening Balances"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reverse Opening Balances Modal */}
      {isReverseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Reset Opening Balances</h3>
                  <p className="text-xs text-muted-foreground">This will reverse all opening journal entries so you can re-enter them.</p>
                </div>
              </div>
              <button onClick={() => setIsReverseModalOpen(false)} className="text-muted-foreground hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1">Reason for Reset *</label>
                <textarea rows={3}
                  placeholder="Explain why the opening balances must be corrected..."
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
              <button type="button" onClick={() => setIsReverseModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary/40 transition">
                Cancel
              </button>
              <button type="button"
                disabled={reverseReason.trim().length < 5 || reverseOpeningMutation.isPending}
                onClick={() => reverseOpeningMutation.mutate()}
                className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition shadow-sm disabled:opacity-50">
                {reverseOpeningMutation.isPending ? "Reversing..." : "Confirm Reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
