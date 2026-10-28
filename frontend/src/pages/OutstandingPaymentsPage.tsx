/**
 * OutstandingPaymentsPage — Track and collect all unpaid/partial player session balances.
 */
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  Search,
  Filter,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  User,
  Phone,
  X,
  Gamepad2,
  CircleDot,
} from "lucide-react";
import { apiClient } from "@/api/client";
import { formatLKR, rupeesToPaise, paiseToRupees } from "@/lib/money";
import type { OutstandingSession, FinancialAccount, SessionPaymentCreate } from "@/types";

export const OutstandingPaymentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedSession, setSelectedSession] = useState<OutstandingSession | null>(null);

  // Form states for collection modal
  const [paymentAmountRs, setPaymentAmountRs] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer">("cash");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const { data: accounts = [] } = useQuery<FinancialAccount[]>({
    queryKey: ["financialAccounts"],
    queryFn: apiClient.accounts.list,
  });

  const { data: sessions = [], isLoading, refetch } = useQuery<OutstandingSession[]>({
    queryKey: ["outstandingSessions"],
    queryFn: () => apiClient.payments.getOutstandingSessions(),
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (data: SessionPaymentCreate) => apiClient.payments.record(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outstandingSessions"] });
      queryClient.invalidateQueries({ queryKey: ["poolSessions"] });
      queryClient.invalidateQueries({ queryKey: ["ps4Sessions"] });
      queryClient.invalidateQueries({ queryKey: ["trialBalance"] });
      queryClient.invalidateQueries({ queryKey: ["financialAccounts"] });
      setSuccessMsg(`Payment of Rs. ${paymentAmountRs} recorded successfully!`);
      setSelectedSession(null);
      setPaymentAmountRs("");
      setNotes("");
      setTimeout(() => setSuccessMsg(""), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to record payment");
    },
  });

  // Filtered sessions
  const filteredSessions = sessions.filter((s: OutstandingSession) => {
    const matchesSearch =
      s.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      Boolean(s.phone && s.phone.includes(searchTerm));
    const matchesType =
      selectedType === "all" ? true : s.session_type === selectedType;
    return matchesSearch && matchesType;
  });

  // Summary Metrics
  const totalOutstanding = sessions.reduce((sum: number, s: OutstandingSession) => sum + s.outstanding_paise, 0);
  const poolOutstanding = sessions
    .filter((s: OutstandingSession) => s.session_type === "pool")
    .reduce((sum: number, s: OutstandingSession) => sum + s.outstanding_paise, 0);
  const ps4Outstanding = sessions
    .filter((s: OutstandingSession) => s.session_type === "ps4")
    .reduce((sum: number, s: OutstandingSession) => sum + s.outstanding_paise, 0);
  const uniquePlayers = new Set(sessions.map((s: OutstandingSession) => s.player_id || s.player_name)).size;

  const handleOpenPay = (session: OutstandingSession) => {
    setSelectedSession(session);
    setPaymentAmountRs(paiseToRupees(session.outstanding_paise).toString());
    setPaymentMethod("cash");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setNotes(`Settlement for ${session.reference}`);
    setErrorMsg("");
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession) return;
    const amountPaise = rupeesToPaise(parseFloat(paymentAmountRs) || 0);

    if (amountPaise <= 0) {
      setErrorMsg("Payment amount must be greater than zero");
      return;
    }
    if (amountPaise > selectedSession.outstanding_paise) {
      setErrorMsg(`Amount cannot exceed outstanding balance of ${formatLKR(selectedSession.outstanding_paise)}`);
      return;
    }

    const targetAccount = accounts.find((a: FinancialAccount) =>
      paymentMethod === "cash" ? a.code === "1001" : a.code === "1002"
    );

    recordPaymentMutation.mutate({
      session_type: selectedSession.session_type,
      session_id: selectedSession.id,
      amount_paise: amountPaise,
      payment_method: paymentMethod,
      collection_date: paymentDate,
      account_id: targetAccount?.id,
      notes,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-sky-400" />
            Outstanding Session Payments
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track and collect unpaid and partially paid balances from pool and gaming sessions
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="self-start sm:self-auto px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition flex items-center gap-2"
        >
          Refresh List
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
            <span className="text-xs font-medium uppercase tracking-wider">Total Outstanding AR</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold font-numeric tabular-nums text-amber-400">{formatLKR(totalOutstanding)}</p>
          <p className="text-xs text-slate-500 mt-1">{sessions.length} unpaid session(s)</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Pool Board AR</span>
            <CircleDot className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold font-numeric tabular-nums text-white">{formatLKR(poolOutstanding)}</p>
          <p className="text-xs text-slate-500 mt-1">
            {sessions.filter((s: OutstandingSession) => s.session_type === "pool").length} pool session(s)
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">PS4 Gaming AR</span>
            <Gamepad2 className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-bold font-numeric tabular-nums text-white">{formatLKR(ps4Outstanding)}</p>
          <p className="text-xs text-slate-500 mt-1">
            {sessions.filter((s: OutstandingSession) => s.session_type === "ps4").length} gaming session(s)
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Indebted Players</span>
            <User className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold font-numeric tabular-nums text-white">{uniquePlayers}</p>
          <p className="text-xs text-slate-500 mt-1">Unique players with dues</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by player name or reference..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="flex bg-slate-900/80 p-1 rounded-lg border border-slate-700 text-xs">
            <button
              onClick={() => setSelectedType("all")}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                selectedType === "all" ? "bg-sky-500 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setSelectedType("pool")}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                selectedType === "pool" ? "bg-sky-500 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Pool Only
            </button>
            <button
              onClick={() => setSelectedType("ps4")}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                selectedType === "ps4" ? "bg-sky-500 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              PS4 Only
            </button>
          </div>
        </div>
      </div>

      {/* Outstanding Sessions Table */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Session Ref</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Player</th>
                <th className="py-3 px-4 text-right">Total Charge</th>
                <th className="py-3 px-4 text-right">Paid</th>
                <th className="py-3 px-4 text-right">Outstanding</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Loading outstanding balances...
                  </td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No outstanding session payments found. All accounts are settled!
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session: OutstandingSession) => (
                  <tr key={`${session.session_type}-${session.id}`} className="hover:bg-slate-750/30 transition">
                    <td className="py-3 px-4 font-mono text-xs font-medium text-slate-300">
                      {session.reference}
                    </td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {session.session_date}
                    </td>
                    <td className="py-3 px-4">
                      {session.session_type === "pool" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CircleDot className="w-3 h-3" /> Pool Board
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          <Gamepad2 className="w-3 h-3" /> PS4 Gaming
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-white">{session.player_name}</div>
                      {session.phone && (
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" /> {session.phone}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-300 font-mono">
                      {formatLKR(session.final_charge_paise)}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-400 font-mono">
                      {formatLKR(session.paid_amount_paise)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-amber-400">
                      {formatLKR(session.outstanding_paise)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleOpenPay(session)}
                        className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition shadow-sm"
                      >
                        Settle Dues
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collect Payment Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedSession(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-sky-400" />
              Collect Session Payment
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Record customer payment for reference <span className="font-mono text-sky-400">{selectedSession.reference}</span>
            </p>

            <div className="my-4 p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Player:</span>
                <span className="font-medium text-white">{selectedSession.player_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Session Total:</span>
                <span className="font-mono text-slate-300">{formatLKR(selectedSession.final_charge_paise)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Already Paid:</span>
                <span className="font-mono text-emerald-400">{formatLKR(selectedSession.paid_amount_paise)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-700">
                <span className="font-semibold text-slate-300">Remaining Balance:</span>
                <span className="font-mono font-bold text-amber-400">{formatLKR(selectedSession.outstanding_paise)}</span>
              </div>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Payment Amount (Rs.) *
                </label>
                <input
                  type="number"
                  step="any"
                  value={paymentAmountRs}
                  onChange={e => setPaymentAmountRs(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-sky-500"
                  placeholder="e.g. 500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Collection Date
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Notes / Receipt Details
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                  placeholder="Optional receipt notes..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedSession(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordPaymentMutation.isPending}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition shadow-sm disabled:opacity-50"
                >
                  {recordPaymentMutation.isPending ? "Recording..." : "Confirm Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
