/**
 * PartnersPage (formerly OwnersLoansPage) — Simplified Partner financial management.
 * Features:
 * 1. Monthly Partner Summary at top (Month selector, Net Profit, 40% Savings, 60% Partners, Advances, Distributions, Remaining Payable).
 * 2. Partner Profiles (Akash, Pasan, Vishwa) with Capital invested, 20% Monthly share, Advances, Remaining Payable.
 * 3. Simple "Record Money Collected" feature for Akash, Pasan, Vishwa (with unknown amount/pending confirmation support).
 * 4. Money Collected History Table with partner & status filters and inline confirmation action.
 * 5. Modals for Record Advance, Pay Distribution, and Add Capital Contribution.
 * 6. Export to Excel (.xlsx) action for partner settlement and collections.
 * 7. Internal account codes (3001, 7001, 1001, etc.) are hidden from normal view.
 */
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  History,
  Coins,
  FileSpreadsheet,
  Clock,
  Filter,
  Check,
} from "lucide-react";
import { api } from "@/api/client";
import { formatLKR, rupeesToPaise } from "@/lib/money";
import type {
  PartnerMonthlyDistributionSummary,
  OwnerTransaction,
  FinancialAccount,
  OwnerDetail,
  OwnerTransactionCreate,
  OwnerCollection,
  OwnerCollectionCreate,
  OwnerCollectionConfirm,
} from "@/types";

export const OwnersLoansPage: React.FC = () => {
  const queryClient = useQueryClient();
  const now = new Date();

  // Selected Month for Distribution & Advances
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);

  // Existing Modals
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isDistributionModalOpen, setIsDistributionModalOpen] = useState(false);
  const [isCapitalModalOpen, setIsCapitalModalOpen] = useState(false);

  // New Modals: Record Money Collected & Confirm Amount
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [targetCollection, setTargetCollection] = useState<OwnerCollection | null>(null);

  // Collection Form State
  const [colCollectorName, setColCollectorName] = useState("Akash");
  const [colDate, setColDate] = useState(new Date().toISOString().split("T")[0]);
  const [colAmountRupees, setColAmountRupees] = useState("");
  const [colIsUnknown, setColIsUnknown] = useState(false);
  const [colDestinationId, setColDestinationId] = useState<number | "">("");
  const [colSourceCategory, setColSourceCategory] = useState("Existing Business Funds");
  const [colNotes, setColNotes] = useState("");

  // Confirmation Form State
  const [confirmAmountRupees, setConfirmAmountRupees] = useState("");
  const [confirmDate, setConfirmDate] = useState(new Date().toISOString().split("T")[0]);
  const [confirmNotes, setConfirmNotes] = useState("");

  // Collections Table Filters
  const [filterPartner, setFilterPartner] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");

  // Selected partner for transaction modals
  const [targetPartnerId, setTargetPartnerId] = useState<number>(1);
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);
  const [txAmountRupees, setTxAmountRupees] = useState<string>("");
  const [txAccountId, setTxAccountId] = useState<number | "">("");
  const [txNotes, setTxNotes] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Queries
  const { data: monthlySummary } = useQuery<PartnerMonthlyDistributionSummary>({
    queryKey: ["partnerMonthlySummary", selectedYear, selectedMonth],
    queryFn: () => api.owners.getMonthlySummary(selectedYear, selectedMonth),
  });

  const { data: owners = [] } = useQuery<OwnerDetail[]>({
    queryKey: ["owners"],
    queryFn: () => api.owners.list(),
  });

  const { data: transactions = [] } = useQuery<OwnerTransaction[]>({
    queryKey: ["owner-transactions"],
    queryFn: () => api.owners.listTransactions(undefined, 100),
  });

  const { data: collections = [] } = useQuery<OwnerCollection[]>({
    queryKey: ["owner-collections"],
    queryFn: () => api.owners.listCollections(),
  });

  const { data: accounts = [] } = useQuery<FinancialAccount[]>({
    queryKey: ["financialAccounts"],
    queryFn: () => api.accounts.list(),
  });

  // Liquid accounts for funds placement (no technical codes shown)
  const liquidAccounts = accounts.filter((a) => ["1001", "1002", "1003", "1004"].includes(a.code));
  const paymentAccounts = accounts.filter((a) => a.code === "1001" || a.code === "1002");

  const getAccountLabel = (code?: string | null, fallback?: string | null) => {
    if (code === "1001" || fallback?.includes("Cash in Hand")) return "Business Cash";
    if (code === "1002" || fallback?.includes("Main Bank")) return "Business Bank Account";
    if (code === "1003" || fallback?.includes("Savings Account")) return "Savings Held in Bank";
    if (code === "1004" || fallback?.includes("Savings Cash")) return "Savings Held as Cash";
    return fallback || "Business Account";
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type.toLowerCase()) {
      case "advance":
        return { label: "Profit Advance", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
      case "distribution":
        return { label: "Monthly Distribution", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
      case "initial_capital":
      case "additional_capital":
        return { label: "Capital Contribution", color: "text-sky-400 bg-sky-500/10 border-sky-500/20" };
      case "withdrawal":
        return { label: "Partner Drawing", color: "text-rose-400 bg-rose-500/10 border-rose-500/20" };
      default:
        return { label: type, color: "text-slate-400 bg-slate-500/10 border-slate-500/20" };
    }
  };

  // Transaction mutation (capital, advances, distributions)
  const transactionMutation = useMutation({
    mutationFn: (data: OwnerTransactionCreate) => api.owners.recordTransaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partnerMonthlySummary"] });
      queryClient.invalidateQueries({ queryKey: ["owners"] });
      queryClient.invalidateQueries({ queryKey: ["owner-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financialAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setIsAdvanceModalOpen(false);
      setIsDistributionModalOpen(false);
      setIsCapitalModalOpen(false);
      setTxAmountRupees("");
      setTxNotes("");
      setErrorMsg("");
      setSuccessMsg("Transaction recorded and posted to accounting ledger successfully!");
      setTimeout(() => setSuccessMsg(""), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to record transaction.");
    },
  });

  // Record Collection Mutation
  const recordCollectionMutation = useMutation({
    mutationFn: (data: OwnerCollectionCreate) => api.owners.recordCollection(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-collections"] });
      queryClient.invalidateQueries({ queryKey: ["financialAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setIsCollectionModalOpen(false);
      setColAmountRupees("");
      setColIsUnknown(false);
      setColNotes("");
      setErrorMsg("");
      setSuccessMsg("Money collected recorded successfully!");
      setTimeout(() => setSuccessMsg(""), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to record money collected.");
    },
  });

  // Confirm Collection Mutation
  const confirmCollectionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: OwnerCollectionConfirm }) =>
      api.owners.confirmCollection(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-collections"] });
      queryClient.invalidateQueries({ queryKey: ["financialAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setIsConfirmModalOpen(false);
      setTargetCollection(null);
      setConfirmAmountRupees("");
      setConfirmNotes("");
      setErrorMsg("");
      setSuccessMsg("Collection amount confirmed and posted to accounting ledger successfully!");
      setTimeout(() => setSuccessMsg(""), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to confirm collection.");
    },
  });

  // Excel Export Handler
  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      await api.reports.downloadExport("partners", { year: selectedYear, month: selectedMonth });
      setSuccessMsg("Excel spreadsheet downloaded successfully!");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate Excel export.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenAdvance = (ownerId: number) => {
    setTargetPartnerId(ownerId);
    setTxDate(new Date().toISOString().split("T")[0]);
    setTxAmountRupees("");
    setTxAccountId(paymentAccounts[0]?.id || "");
    setTxNotes("");
    setErrorMsg("");
    setIsAdvanceModalOpen(true);
  };

  const handleOpenDistribution = (ownerId: number, remainingRupees: number) => {
    setTargetPartnerId(ownerId);
    setTxDate(new Date().toISOString().split("T")[0]);
    setTxAmountRupees(remainingRupees > 0 ? remainingRupees.toString() : "");
    setTxAccountId(paymentAccounts[0]?.id || "");
    setTxNotes("");
    setErrorMsg("");
    setIsDistributionModalOpen(true);
  };

  const handleOpenCapital = (ownerId?: number) => {
    setTargetPartnerId(ownerId || owners[0]?.id || 1);
    setTxDate(new Date().toISOString().split("T")[0]);
    setTxAmountRupees("");
    setTxAccountId(paymentAccounts[0]?.id || "");
    setTxNotes("");
    setErrorMsg("");
    setIsCapitalModalOpen(true);
  };

  const handleOpenCollectionModal = () => {
    setColCollectorName(owners[0]?.name || "Akash");
    setColDate(new Date().toISOString().split("T")[0]);
    setColAmountRupees("");
    setColIsUnknown(false);
    setColDestinationId(liquidAccounts[0]?.id || paymentAccounts[0]?.id || "");
    setColSourceCategory("Existing Business Funds");
    setColNotes("");
    setErrorMsg("");
    setIsCollectionModalOpen(true);
  };

  const handleOpenConfirmModal = (col: OwnerCollection) => {
    setTargetCollection(col);
    setConfirmAmountRupees("");
    setConfirmDate(new Date().toISOString().split("T")[0]);
    setConfirmNotes("");
    setErrorMsg("");
    setIsConfirmModalOpen(true);
  };

  const handleCollectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!colDestinationId) {
      setErrorMsg("Please select where the money is deposited or held.");
      return;
    }
    const amtPaise = colIsUnknown ? null : rupeesToPaise(parseFloat(colAmountRupees) || 0);
    if (!colIsUnknown && (!amtPaise || amtPaise <= 0)) {
      setErrorMsg("Please enter an amount or check 'Amount is currently unknown'.");
      return;
    }

    recordCollectionMutation.mutate({
      collector_name: colCollectorName,
      collection_date: colDate,
      amount_paise: amtPaise,
      destination_account_id: Number(colDestinationId),
      source_category: colSourceCategory,
      notes: colNotes.trim() || undefined,
      is_unknown_amount: colIsUnknown,
    });
  };

  const handleConfirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCollection) return;
    const amtPaise = rupeesToPaise(parseFloat(confirmAmountRupees) || 0);
    if (amtPaise <= 0) {
      setErrorMsg("Confirmed amount must be greater than zero.");
      return;
    }
    confirmCollectionMutation.mutate({
      id: targetCollection.id,
      data: {
        amount_paise: amtPaise,
        confirmed_date: confirmDate,
        notes: confirmNotes.trim() || undefined,
      },
    });
  };

  const handleRecordAdvanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountPaise = rupeesToPaise(parseFloat(txAmountRupees) || 0);
    if (amountPaise <= 0) {
      setErrorMsg("Amount must be greater than zero.");
      return;
    }
    if (!txAccountId) {
      setErrorMsg("Please select a payment method.");
      return;
    }

    const partner = owners.find((o) => o.id === targetPartnerId);
    transactionMutation.mutate({
      owner_id: targetPartnerId,
      transaction_date: txDate,
      transaction_type: "advance",
      amount_paise: amountPaise,
      account_id: Number(txAccountId),
      period_year: selectedYear,
      period_month: selectedMonth,
      description: `Profit Advance to ${partner?.name || "Partner"} for ${selectedYear}-${String(selectedMonth).padStart(2, "0")}`,
      notes: txNotes.trim() || undefined,
    });
  };

  const handleRecordDistributionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountPaise = rupeesToPaise(parseFloat(txAmountRupees) || 0);
    if (amountPaise <= 0) {
      setErrorMsg("Amount must be greater than zero.");
      return;
    }
    if (!txAccountId) {
      setErrorMsg("Please select an account.");
      return;
    }

    const partner = owners.find((o) => o.id === targetPartnerId);
    const detail = monthlySummary?.partners.find((p) => p.owner_id === targetPartnerId);
    const maxPayable = detail?.remaining_payable_paise ?? 0;

    if (amountPaise > maxPayable) {
      setErrorMsg(
        `Distribution amount exceeds max remaining payable allocation (${formatLKR(maxPayable)}). Overpayments are not allowed.`
      );
      return;
    }

    transactionMutation.mutate({
      owner_id: targetPartnerId,
      transaction_date: txDate,
      transaction_type: "distribution",
      amount_paise: amountPaise,
      account_id: Number(txAccountId),
      period_year: selectedYear,
      period_month: selectedMonth,
      description: `Monthly Distribution to ${partner?.name || "Partner"} for ${selectedYear}-${String(selectedMonth).padStart(2, "0")}`,
      notes: txNotes.trim() || undefined,
    });
  };

  const handleRecordCapitalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountPaise = rupeesToPaise(parseFloat(txAmountRupees) || 0);
    if (amountPaise <= 0) {
      setErrorMsg("Amount must be greater than zero.");
      return;
    }
    if (!txAccountId) {
      setErrorMsg("Please select receiving account (Business Cash or Business Bank).");
      return;
    }

    const partner = owners.find((o) => o.id === targetPartnerId);
    transactionMutation.mutate({
      owner_id: targetPartnerId,
      transaction_date: txDate,
      transaction_type: "additional_capital",
      amount_paise: amountPaise,
      account_id: Number(txAccountId),
      description: `Capital contribution by ${partner?.name || "Partner"}`,
      notes: txNotes.trim() || undefined,
    });
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const targetPartner = owners.find((o) => o.id === targetPartnerId);
  const targetPartnerDetail = monthlySummary?.partners.find((p) => p.owner_id === targetPartnerId);

  // Filtered collections
  const filteredCollections = collections.filter((c) => {
    if (filterPartner !== "ALL" && !c.collector_name.toLowerCase().includes(filterPartner.toLowerCase())) {
      return false;
    }
    if (filterStatus !== "ALL" && c.status !== filterStatus) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-sky-400" />
            <span>Partners & Collections</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track business collections by Akash, Pasan, and Vishwa, partner capital, and monthly profit sharing (20% each)
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month Selector */}
          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg p-1 text-xs">
            <Calendar className="w-4 h-4 text-slate-400 ml-1.5" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent text-slate-200 font-medium py-1 px-2 outline-none cursor-pointer"
            >
              {monthNames.map((m, idx) => (
                <option key={m} value={idx + 1} className="bg-slate-900 text-white">
                  {m}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-slate-200 font-medium py-1 px-2 outline-none cursor-pointer"
            >
              {[2025, 2026, 2027, 2028].map((y) => (
                <option key={y} value={y} className="bg-slate-900 text-white">
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Record Money Collected Button */}
          <button
            onClick={handleOpenCollectionModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition cursor-pointer"
          >
            <Coins className="w-4 h-4" />
            <span>Record Money Collected</span>
          </button>

          {/* Add Capital Button */}
          <button
            onClick={() => handleOpenCapital()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Capital</span>
          </button>

          {/* Export to Excel (.xlsx) */}
          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 hover:border-emerald-500/40 shadow-sm transition cursor-pointer disabled:opacity-50"
            title="Download full partner settlements, capital, and collection history in Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>{isExporting ? "Exporting…" : "Export to Excel (.xlsx)"}</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── 1. MONTHLY PARTNER SUMMARY CARD ──────────────────────────────── */}
      <div
        className="rounded-2xl p-5 shadow-sm space-y-4"
        style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/60 pb-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Monthly Partnership Settlement
            </span>
            <h2 className="text-lg font-bold text-white">
              {monthNames[selectedMonth - 1]} {selectedYear} Profit Overview
            </h2>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
            Agreed Rule: 40% Savings · 20% Akash · 20% Pasan · 20% Vishwa
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 pt-1">
          {/* Net Distributable Profit */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80">
            <span className="text-[11px] text-slate-400 font-medium">Eligible Net Profit</span>
            <div className="text-lg font-bold font-mono text-white mt-1">
              {formatLKR(monthlySummary?.net_profit_paise ?? 0)}
            </div>
            <span className="text-[10px] text-slate-500">Revenue minus expenses</span>
          </div>

          {/* 40% Business Savings */}
          <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <span className="text-[11px] text-indigo-300 font-medium">Business Savings (40%)</span>
            <div className="text-lg font-bold font-mono text-indigo-300 mt-1">
              {formatLKR(monthlySummary?.savings_allocation_paise ?? 0)}
            </div>
            <span className="text-[10px] text-indigo-400/80">Business emergency reserve</span>
          </div>

          {/* 60% Partners Pool */}
          <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20">
            <span className="text-[11px] text-sky-300 font-medium">Partners Pool (60%)</span>
            <div className="text-lg font-bold font-mono text-sky-300 mt-1">
              {formatLKR(monthlySummary?.total_partner_allocations_paise ?? 0)}
            </div>
            <span className="text-[10px] text-sky-400/80">Shared equally (20% each)</span>
          </div>

          {/* Akash Share */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-700/60">
            <span className="text-[11px] text-slate-400 font-medium">Akash 20% Share</span>
            <div className="text-lg font-bold font-mono text-slate-100 mt-1">
              {formatLKR(monthlySummary?.partners[0]?.monthly_allocation_paise ?? 0)}
            </div>
            <span className="text-[10px] text-slate-500">Monthly allocation</span>
          </div>

          {/* Pasan Share */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-700/60">
            <span className="text-[11px] text-slate-400 font-medium">Pasan 20% Share</span>
            <div className="text-lg font-bold font-mono text-slate-100 mt-1">
              {formatLKR(monthlySummary?.partners[1]?.monthly_allocation_paise ?? 0)}
            </div>
            <span className="text-[10px] text-slate-500">Monthly allocation</span>
          </div>

          {/* Vishwa Share */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-700/60">
            <span className="text-[11px] text-slate-400 font-medium">Vishwa 20% Share</span>
            <div className="text-lg font-bold font-mono text-slate-100 mt-1">
              {formatLKR(monthlySummary?.partners[2]?.monthly_allocation_paise ?? 0)}
            </div>
            <span className="text-[10px] text-slate-500">Monthly allocation</span>
          </div>

          {/* Total Remaining Payable */}
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <span className="text-[11px] text-emerald-300 font-bold">Remaining Due</span>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
              {formatLKR(monthlySummary?.total_remaining_payable_paise ?? 0)}
            </div>
            <span className="text-[10px] text-emerald-400/80">Owed after advances</span>
          </div>
        </div>
      </div>

      {/* ── 2. PARTNER PROFILES (CARDS) ──────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-sky-400" />
            <span>Partner Profiles & Monthly Balances</span>
          </h2>
          <span className="text-xs text-slate-400">Akash, Pasan, and Vishwa</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {owners.map((owner) => {
            const detail = monthlySummary?.partners.find((p) => p.owner_id === owner.id);
            const allocationPaise = detail?.monthly_allocation_paise ?? 0;
            const advancesPaise = detail?.advances_paid_paise ?? 0;
            const distPaise = detail?.distributions_paid_paise ?? 0;
            const remainingPaise = detail?.remaining_payable_paise ?? 0;
            const remainingRupees = remainingPaise / 100;

            return (
              <div
                key={owner.id}
                className="rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between"
                style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-white">{owner.name}</h3>
                      <span className="text-xs text-slate-400">Partner & Co-Owner</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      20.0% Share
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Total Capital Contributed:</span>
                      <span className="font-mono font-semibold text-slate-200">
                        {formatLKR(owner.capital_balance_paise)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">
                        {monthNames[selectedMonth - 1]} Share (20%):
                      </span>
                      <span className="font-mono font-semibold text-slate-100">
                        {formatLKR(allocationPaise)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Advances Received:</span>
                      <span className="font-mono text-amber-400">
                        -{formatLKR(advancesPaise)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Distributions Paid:</span>
                      <span className="font-mono text-emerald-400">
                        -{formatLKR(distPaise)}
                      </span>
                    </div>

                    {/* Remaining Payable */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-700">
                      <span className="font-semibold text-slate-200">Remaining Amount Payable:</span>
                      <span className={`font-mono text-base font-bold ${remainingPaise > 0 ? "text-amber-400" : "text-slate-400"}`}>
                        {formatLKR(remainingPaise)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2 border-t border-slate-700/60">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleOpenAdvance(owner.id)}
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Record Advance</span>
                    </button>

                    <button
                      onClick={() => handleOpenDistribution(owner.id, remainingRupees)}
                      disabled={remainingPaise <= 0}
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      <span>Pay Distribution</span>
                    </button>
                  </div>

                  <button
                    onClick={() => handleOpenCapital(owner.id)}
                    className="w-full px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Capital Contribution</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. MONEY COLLECTED BY PARTNERS (NEW SECTION) ─────────────────── */}
      <div
        className="rounded-2xl overflow-hidden shadow-sm"
        style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
      >
        <div className="p-4 border-b border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Money Collected by Partners</h2>
              <p className="text-[11px] text-slate-400">
                Track all money physically collected or handed over by Akash, Pasan, or Vishwa
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
              <Filter className="w-3 h-3 text-slate-400" />
              <span className="text-slate-400 text-[11px]">Partner:</span>
              <select
                value={filterPartner}
                onChange={(e) => setFilterPartner(e.target.value)}
                className="bg-transparent text-white font-medium outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900">All Partners</option>
                <option value="Akash" className="bg-slate-900">Akash</option>
                <option value="Pasan" className="bg-slate-900">Pasan</option>
                <option value="Vishwa" className="bg-slate-900">Vishwa</option>
              </select>
            </div>

            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
              <span className="text-slate-400 text-[11px]">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent text-white font-medium outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900">All Statuses</option>
                <option value="CONFIRMED" className="bg-slate-900">Confirmed</option>
                <option value="PENDING_CONFIRMATION" className="bg-slate-900">Pending Confirmation</option>
              </select>
            </div>

            <button
              onClick={handleOpenCollectionModal}
              className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record New</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700/60 bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4">Collected By</th>
                <th className="py-3 px-4">Collection Source</th>
                <th className="py-3 px-4">Where Money Is Now</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-xs">
              {filteredCollections.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No partner collections recorded matching criteria.
                  </td>
                </tr>
              ) : (
                filteredCollections.map((col) => {
                  const isPending = col.status === "PENDING_CONFIRMATION";
                  return (
                    <tr key={col.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 text-slate-300 font-mono">{col.collection_date}</td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-200">{col.reference}</td>
                      <td className="py-3 px-4 font-semibold text-white">{col.collector_name}</td>
                      <td className="py-3 px-4 text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px]">
                          {col.source_category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {getAccountLabel(null, col.destination_account_name)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {col.amount_paise != null ? (
                          <span className="text-emerald-400">{formatLKR(col.amount_paise)}</span>
                        ) : (
                          <span className="text-amber-400 font-normal italic">Unknown Amount</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <Clock className="w-3 h-3" />
                            <span>Pending Confirmation</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <Check className="w-3 h-3" />
                            <span>Confirmed</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{col.notes || "—"}</td>
                      <td className="py-3 px-4 text-center">
                        {isPending ? (
                          <button
                            onClick={() => handleOpenConfirmModal(col)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 transition cursor-pointer"
                          >
                            Confirm Amount
                          </button>
                        ) : (
                          <span className="text-slate-500 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 4. PARTNER FINANCIAL TRANSACTIONS TABLE ──────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden shadow-sm"
        style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
      >
        <div className="p-4 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-bold text-white">Partner Financial Events Ledger</h2>
          </div>
          <span className="text-xs text-slate-400">{transactions.length} record(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700/60 bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Partner</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-xs">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No partner transactions recorded yet.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const typeBadge = getTransactionTypeLabel(tx.transaction_type);
                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-medium text-slate-200">{tx.reference}</td>
                      <td className="py-3 px-4 text-slate-400">{tx.transaction_date}</td>
                      <td className="py-3 px-4 font-semibold text-white">{tx.owner_name}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${typeBadge.color}`}>
                          {typeBadge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {getAccountLabel(null, tx.account_name)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        {formatLKR(tx.amount_paise)}
                      </td>
                      <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{tx.description || tx.notes || "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: RECORD MONEY COLLECTED (NEW) ───────────────────────────── */}
      {isCollectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4"
            style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
          >
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-400" />
                <span>Record Money Collected</span>
              </h3>
              <button
                onClick={() => setIsCollectionModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCollectionSubmit} className="space-y-3.5">
              {/* 1. Collected by */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">1. Collected by *</label>
                <div className="grid grid-cols-3 gap-2">
                  {["Akash", "Pasan", "Vishwa"].map((pName) => (
                    <button
                      key={pName}
                      type="button"
                      onClick={() => setColCollectorName(pName)}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold transition border ${
                        colCollectorName === pName
                          ? "bg-emerald-600 text-white border-emerald-500"
                          : "bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-600"
                      }`}
                    >
                      {pName}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Amount Collected */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">2. Amount Collected (Rs.) *</label>
                  <label className="flex items-center gap-1.5 text-xs text-amber-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={colIsUnknown}
                      onChange={(e) => {
                        setColIsUnknown(e.target.checked);
                        if (e.target.checked) setColAmountRupees("");
                      }}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                    />
                    <span>Amount currently unknown</span>
                  </label>
                </div>
                {!colIsUnknown ? (
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={colAmountRupees}
                    onChange={(e) => setColAmountRupees(e.target.value)}
                    placeholder="Enter amount in Sri Lankan Rupees"
                    required={!colIsUnknown}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm outline-none focus:border-emerald-400"
                  />
                ) : (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                    Recording without an amount. Will be saved as <strong>Pending Confirmation</strong> without altering financial balances until confirmed.
                  </div>
                )}
              </div>

              {/* 3. Collection Date */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">3. Collection Date *</label>
                <input
                  type="date"
                  value={colDate}
                  onChange={(e) => setColDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-emerald-400"
                />
              </div>

              {/* 4. Where the money is now */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">4. Where the Money Is Now *</label>
                <select
                  value={colDestinationId}
                  onChange={(e) => setColDestinationId(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-emerald-400"
                >
                  <option value="">Select location / account...</option>
                  {liquidAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {getAccountLabel(a.code, a.name)}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Collection Source */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">5. Collection Source *</label>
                <select
                  value={colSourceCategory}
                  onChange={(e) => setColSourceCategory(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-emerald-400"
                >
                  <option value="Existing Business Funds">Existing Business Funds</option>
                  <option value="Pool Table Payments">Pool Table Payments</option>
                  <option value="PS4 Payments">PS4 Payments</option>
                  <option value="Soft Drink Sales">Soft Drink Sales</option>
                  <option value="Other Business Income">Other Business Income</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* 6. Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">6. Notes (Optional)</label>
                <input
                  type="text"
                  value={colNotes}
                  onChange={(e) => setColNotes(e.target.value)}
                  placeholder="e.g. Handed over at close of shift"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-emerald-400"
                />
              </div>

              {/* 7. Save Collection */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setIsCollectionModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordCollectionMutation.isPending}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md cursor-pointer disabled:opacity-50"
                >
                  {recordCollectionMutation.isPending ? "Saving…" : "Save Collection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CONFIRM PENDING COLLECTION (NEW) ───────────────────────── */}
      {isConfirmModalOpen && targetCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4"
            style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
          >
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Check className="w-5 h-5 text-amber-400" />
                <span>Confirm Collection Amount</span>
              </h3>
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Reference:</span>
                <span className="font-mono text-white font-semibold">{targetCollection.reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Collected By:</span>
                <span className="text-white font-semibold">{targetCollection.collector_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Collection Date:</span>
                <span className="text-slate-300">{targetCollection.collection_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Where Money Is Now:</span>
                <span className="text-slate-300">{getAccountLabel(null, targetCollection.destination_account_name)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Source:</span>
                <span className="text-slate-300">{targetCollection.source_category}</span>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleConfirmSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Verified Amount (Rs.) *</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={confirmAmountRupees}
                  onChange={(e) => setConfirmAmountRupees(e.target.value)}
                  placeholder="Enter exact confirmed amount"
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Confirmation Date *</label>
                <input
                  type="date"
                  value={confirmDate}
                  onChange={(e) => setConfirmDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Verification Notes</label>
                <input
                  type="text"
                  value={confirmNotes}
                  onChange={(e) => setConfirmNotes(e.target.value)}
                  placeholder="e.g. Counted cash envelope with Akash"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={confirmCollectionMutation.isPending}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {confirmCollectionMutation.isPending ? "Confirming…" : "Confirm & Post to Ledger"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: RECORD ADVANCE ─────────────────────────────────────────── */}
      {isAdvanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4"
            style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
          >
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-amber-400" />
                <span>Record Advance — {targetPartner?.name}</span>
              </h3>
              <button
                onClick={() => setIsAdvanceModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleRecordAdvanceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Partner *</label>
                <select
                  value={targetPartnerId}
                  onChange={(e) => setTargetPartnerId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-amber-400"
                >
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                <span className="text-slate-400">Advance Applied To Month:</span>
                <p className="font-semibold text-white">
                  {monthNames[selectedMonth - 1]} {selectedYear}
                </p>
                <p className="text-[11px] text-slate-500">
                  This advance will be deducted when paying final monthly distribution.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Date *</label>
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Advance Amount (Rs.) *</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={txAmountRupees}
                  onChange={(e) => setTxAmountRupees(e.target.value)}
                  placeholder="e.g. 2000"
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Payment Method *</label>
                <select
                  value={txAccountId}
                  onChange={(e) => setTxAccountId(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-amber-400"
                >
                  <option value="">Select payment method...</option>
                  {paymentAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {getAccountLabel(a.code, a.name)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notes</label>
                <input
                  type="text"
                  value={txNotes}
                  onChange={(e) => setTxNotes(e.target.value)}
                  placeholder="Optional note"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAdvanceModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transactionMutation.isPending}
                  className="px-5 py-2 rounded-lg text-xs font-semibold shadow-md cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: "#F59E0B", color: "#0F172A" }}
                >
                  {transactionMutation.isPending ? "Recording…" : "Save Advance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: RECORD MONTHLY DISTRIBUTION ────────────────────────────── */}
      {isDistributionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4"
            style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
          >
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                <span>Pay Distribution — {targetPartner?.name}</span>
              </h3>
              <button
                onClick={() => setIsDistributionModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleRecordDistributionSubmit} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Distribution Month:</span>
                  <span className="font-semibold text-white">
                    {monthNames[selectedMonth - 1]} {selectedYear}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total Monthly 20% Share:</span>
                  <span className="font-mono text-slate-200">
                    {formatLKR(targetPartnerDetail?.monthly_allocation_paise ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Advances Deducted:</span>
                  <span className="font-mono text-amber-400">
                    -{formatLKR(targetPartnerDetail?.advances_paid_paise ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                  <span className="font-bold text-slate-100">Max Remaining Payable:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {formatLKR(targetPartnerDetail?.remaining_payable_paise ?? 0)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Date *</label>
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Payment Amount (Rs.) *</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  max={targetPartnerDetail ? targetPartnerDetail.remaining_payable_paise / 100 : undefined}
                  value={txAmountRupees}
                  onChange={(e) => setTxAmountRupees(e.target.value)}
                  placeholder="e.g. 5000"
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Paid From *</label>
                <select
                  value={txAccountId}
                  onChange={(e) => setTxAccountId(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-emerald-400"
                >
                  <option value="">Select payment method...</option>
                  {paymentAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {getAccountLabel(a.code, a.name)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notes</label>
                <input
                  type="text"
                  value={txNotes}
                  onChange={(e) => setTxNotes(e.target.value)}
                  placeholder="Optional distribution note"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-emerald-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsDistributionModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transactionMutation.isPending}
                  className="px-5 py-2 rounded-lg text-xs font-semibold shadow-md cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: "#22C55E", color: "#0F172A" }}
                >
                  {transactionMutation.isPending ? "Recording…" : "Confirm & Pay Distribution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: RECORD CAPITAL CONTRIBUTION ───────────────────────────── */}
      {isCapitalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4"
            style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
          >
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-sky-400" />
                <span>Record Capital Contribution</span>
              </h3>
              <button
                onClick={() => setIsCapitalModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleRecordCapitalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Partner *</label>
                <select
                  value={targetPartnerId}
                  onChange={(e) => setTargetPartnerId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-sky-400"
                >
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Contribution Date *</label>
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Amount (Rs.) *</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={txAmountRupees}
                  onChange={(e) => setTxAmountRupees(e.target.value)}
                  placeholder="e.g. 50000"
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Payment Method (Received In) *</label>
                <select
                  value={txAccountId}
                  onChange={(e) => setTxAccountId(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-sky-400"
                >
                  <option value="">Select receiving account...</option>
                  {paymentAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {getAccountLabel(a.code, a.name)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notes</label>
                <input
                  type="text"
                  value={txNotes}
                  onChange={(e) => setTxNotes(e.target.value)}
                  placeholder="e.g. Additional equipment purchase funding"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-sky-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCapitalModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transactionMutation.isPending}
                  className="px-5 py-2 rounded-lg text-xs font-semibold shadow-md cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: "#38BDF8", color: "#0F172A" }}
                >
                  {transactionMutation.isPending ? "Recording…" : "Post Capital Contribution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnersLoansPage;
