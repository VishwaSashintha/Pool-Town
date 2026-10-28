import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  CircleDot,
  Plus,
  Calendar,
  CreditCard,
  AlertCircle,
  X,
  ChevronDown,
  Ban,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/api/client";
import { MoneyDisplay } from "@/components/common/MoneyDisplay";
import { formatLKR, rupeesToPaise, paiseToRupees } from "@/lib/money";
import type { PoolSession } from "@/types";

const STANDARD_DURATIONS = [
  { label: "1 hour", minutes: 60, price: 500 },
  { label: "1½ hours", minutes: 90, price: 800 },
  { label: "2 hours", minutes: 120, price: 1000 },
  { label: "2½ hours", minutes: 150, price: 1300 },
  { label: "3 hours", minutes: 180, price: 1500 },
  { label: "3½ hours", minutes: 210, price: 1800 },
  { label: "4 hours", minutes: 240, price: 2000 },
  { label: "5 hours", minutes: 300, price: 2600 },
];

function minutesToLabel(m: number): string {
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return h === 1 ? "1 hour" : `${h} hours`;
  return `${h} hr ${rem} min`;
}

function statusLabel(s: string): string {
  switch (s.toLowerCase()) {
    case "paid": return "Fully Paid";
    case "partial": return "Partially Paid";
    case "pending": return "Unpaid";
    case "cancelled": return "Cancelled";
    default: return s;
  }
}

export const PoolSessionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [filterStatus, setFilterStatus] = useState<string>("");

  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [paymentSession, setPaymentSession] = useState<PoolSession | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // New session form state
  const [formDate, setFormDate] = useState<string>(selectedDate);
  const [playerName, setPlayerName] = useState<string>("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [manualChargeRupees, setManualChargeRupees] = useState<number | "">("");
  const [discountRupees, setDiscountRupees] = useState<number>(0);
  // Payment split at creation
  const [cashPaidRupees, setCashPaidRupees] = useState<number>(0);
  const [bankPaidRupees, setBankPaidRupees] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [formError, setFormError] = useState<string>("");

  // Collect payment modal state
  const [collectCashRupees, setCollectCashRupees] = useState<number>(0);
  const [collectBankRupees, setCollectBankRupees] = useState<number>(0);
  const [collectDate, setCollectDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [payError, setPayError] = useState<string>("");

  // Void session modal state
  const [voidSession, setVoidSession] = useState<PoolSession | null>(null);
  const [voidAdminUser, setVoidAdminUser] = useState("");
  const [voidAdminPass, setVoidAdminPass] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState("");
  const [voidSuccess, setVoidSuccess] = useState("");

  useEffect(() => {
    if (searchParams.get("action") === "new") {
      setIsNewModalOpen(true);
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["pool-sessions", selectedDate, filterStatus],
    queryFn: () =>
      api.poolSessions.list({
        date: selectedDate || undefined,
        status: filterStatus || undefined,
      }),
  });

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => api.players.list(),
  });

  // Live pool charge calculation
  const calculatedStandardChargePaise = (() => {
    if (durationMinutes <= 0) return 0;
    if (durationMinutes <= 60) return 50000;
    const fullHours = Math.floor(durationMinutes / 60);
    const rem = durationMinutes % 60;
    if (rem === 0) return fullHours * 50000;
    if (rem <= 30) return fullHours * 50000 + 30000;
    return (fullHours + 1) * 50000;
  })();

  const standardChargePaise =
    manualChargeRupees !== "" && Number(manualChargeRupees) >= 0
      ? rupeesToPaise(Number(manualChargeRupees))
      : calculatedStandardChargePaise;

  const discountPaise = rupeesToPaise(discountRupees);
  const finalChargePaise = Math.max(0, standardChargePaise - discountPaise);
  const finalChargeRupees = paiseToRupees(finalChargePaise);

  const totalPaidRupees = cashPaidRupees + bankPaidRupees;
  const stillToPayRupees = Math.max(0, finalChargeRupees - totalPaidRupees);

  // Create mutation — handles cash + bank split if both entered
  const createMutation = useMutation({
    mutationFn: async () => {
      const hasCash = cashPaidRupees > 0;
      const hasBank = bankPaidRupees > 0;
      const firstPaymentMethod = hasCash ? "cash" : hasBank ? "bank_transfer" : "cash";
      const firstPaymentAmount = hasCash ? rupeesToPaise(cashPaidRupees) : (hasBank ? rupeesToPaise(bankPaidRupees) : 0);

      const session = await api.poolSessions.create({
        session_date: formDate,
        player_id: selectedPlayerId,
        customer_name: playerName || "Walk-in Guest",
        chargeable_minutes: durationMinutes,
        actual_minutes: durationMinutes,
        custom_standard_charge_paise:
          manualChargeRupees !== "" ? rupeesToPaise(Number(manualChargeRupees)) : undefined,
        discount_paise: discountPaise,
        initial_payment_paise: firstPaymentAmount,
        initial_payment_method: firstPaymentMethod,
        notes,
      });

      // If both cash and bank were entered at creation, record the second payment
      if (hasCash && hasBank) {
        await api.payments.record({
          session_type: "pool",
          session_id: session.id,
          collection_date: formDate,
          amount_paise: rupeesToPaise(bankPaidRupees),
          payment_method: "bank_transfer",
          notes: "Split payment at session creation (bank portion)",
        });
      }

      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pool-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setIsNewModalOpen(false);
      resetNewForm();
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to create pool session");
    },
  });

  // Collect payment mutation — handles cash + bank split
  const payMutation = useMutation({
    mutationFn: async () => {
      if (!paymentSession) throw new Error("No session selected");
      const totalCollect = rupeesToPaise(collectCashRupees + collectBankRupees);
      if (totalCollect <= 0) throw new Error("Please enter an amount to collect");
      if (totalCollect > paymentSession.outstanding_paise)
        throw new Error("Collection amount exceeds outstanding balance");

      const promises = [];
      if (collectCashRupees > 0) {
        promises.push(api.payments.record({
          session_type: "pool",
          session_id: paymentSession.id,
          collection_date: collectDate,
          amount_paise: rupeesToPaise(collectCashRupees),
          payment_method: "cash",
        }));
      }
      if (collectBankRupees > 0) {
        promises.push(api.payments.record({
          session_type: "pool",
          session_id: paymentSession.id,
          collection_date: collectDate,
          amount_paise: rupeesToPaise(collectBankRupees),
          payment_method: "bank_transfer",
        }));
      }
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pool-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setPaymentSession(null);
      setCollectCashRupees(0);
      setCollectBankRupees(0);
      setPayError("");
    },
    onError: (err: any) => {
      setPayError(err.message || "Failed to record payment");
    },
  });

  const voidMutation = useMutation({
    mutationFn: () => {
      if (!voidSession) throw new Error("No session selected");
      if (!voidAdminUser.trim() || !voidAdminPass.trim())
        throw new Error("Administrator username and password are required");
      return api.poolSessions.void(voidSession.id, voidAdminUser.trim(), voidAdminPass, voidReason.trim() || undefined);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["pool-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["players"] });
      setVoidSuccess(`Session ${result.reference} has been voided. ${result.payments_reversed} payment(s) reversed.`);
      setVoidError("");
    },
    onError: (err: any) => {
      setVoidError(err.message || "Failed to void session");
    },
  });

  const openVoidModal = (s: PoolSession) => {
    setVoidSession(s);
    setVoidAdminUser("");
    setVoidAdminPass("");
    setVoidReason("");
    setVoidError("");
    setVoidSuccess("");
  };

  const resetNewForm = () => {
    setPlayerName("");
    setSelectedPlayerId(null);
    setDurationMinutes(60);
    setManualChargeRupees("");
    setDiscountRupees(0);
    setCashPaidRupees(500);
    setBankPaidRupees(0);
    setNotes("");
    setFormError("");
    setShowAdvanced(false);
  };

  const handleOpenPayModal = (session: PoolSession) => {
    setPaymentSession(session);
    setCollectCashRupees(paiseToRupees(session.outstanding_paise));
    setCollectBankRupees(0);
    setCollectDate(new Date().toISOString().split("T")[0]);
    setPayError("");
  };

  // When duration changes, reset cash to full price (convenience)
  useEffect(() => {
    if (isNewModalOpen) {
      setCashPaidRupees(paiseToRupees(finalChargePaise));
      setBankPaidRupees(0);
    }
  }, [finalChargePaise, isNewModalOpen]);

  const collectTotal = collectCashRupees + collectBankRupees;
  const collectOutstanding = paymentSession
    ? Math.max(0, paiseToRupees(paymentSession.outstanding_paise) - collectTotal)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Pool Board</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Rs. 500 for 1 hour · Rs. 300 per additional 30 minutes
          </p>
        </div>
        <button
          onClick={() => {
            resetNewForm();
            setIsNewModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition shadow-md shadow-emerald-950/40 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Session</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-border/70 bg-card/40 glass-panel">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-4 w-4 text-emerald-400" />
            <span>Date:</span>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded-md bg-secondary/50 border border-border/60 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
            className="text-xs text-emerald-400 hover:underline"
          >
            Today
          </button>
          <button
            onClick={() => setSelectedDate("")}
            className="text-xs text-muted-foreground hover:underline"
          >
            All Dates
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 rounded-md bg-secondary/50 border border-border/60 text-xs text-foreground focus:outline-none"
          >
            <option value="">All</option>
            <option value="paid">Fully Paid</option>
            <option value="partial">Partially Paid</option>
            <option value="pending">Unpaid</option>
          </select>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="rounded-xl border border-border/70 bg-card/60 overflow-hidden glass-panel">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <CircleDot className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium">No pool sessions found</p>
            <p className="text-xs mt-1">Click "New Session" to record one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-secondary/30 text-muted-foreground border-b border-border/60 font-sans">
                <tr>
                  <th className="py-3 px-4">Ref</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Player</th>
                  <th className="py-3 px-4">Time Played</th>
                  <th className="py-3 px-4">Total Price</th>
                  <th className="py-3 px-4">Paid</th>
                  <th className="py-3 px-4">Still to Pay</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono text-xs">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-emerald-400">{s.reference}</td>
                    <td className="py-3.5 px-4 text-muted-foreground">{s.session_date}</td>
                    <td className="py-3.5 px-4 font-sans font-medium text-foreground">
                      {s.customer_name || s.player?.name || "Walk-in"}
                    </td>
                    <td className="py-3.5 px-4">{minutesToLabel(s.chargeable_minutes)}</td>
                    <td className="py-3.5 px-4 font-semibold text-foreground">
                      <MoneyDisplay paise={s.final_charge_paise} />
                    </td>
                    <td className="py-3.5 px-4 text-emerald-400">
                      <MoneyDisplay paise={s.paid_amount_paise} />
                    </td>
                    <td className="py-3.5 px-4 font-bold text-amber-400">
                      {s.outstanding_paise > 0 ? (
                        <MoneyDisplay paise={s.outstanding_paise} />
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          String(s.status).toLowerCase() === "paid"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : String(s.status).toLowerCase() === "partial"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-rose-500/20 text-rose-400"
                        }`}
                      >
                        {statusLabel(String(s.status))}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-sans">
                      <div className="flex items-center justify-end gap-1.5">
                        {s.outstanding_paise > 0 && String(s.status).toLowerCase() !== "cancelled" && (
                          <button
                            onClick={() => handleOpenPayModal(s)}
                            className="px-2.5 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition"
                          >
                            Collect Payment
                          </button>
                        )}
                        {String(s.status).toLowerCase() !== "cancelled" && (
                          <button
                            onClick={() => openVoidModal(s)}
                            title="Void this session"
                            className="p-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 transition border border-rose-500/30"
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {String(s.status).toLowerCase() === "cancelled" && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-secondary/60 text-muted-foreground">VOIDED</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── New Pool Session Modal ─────────────────────────────────────────────── */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-emerald-500/30 bg-card p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <CircleDot className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Record Pool Session</h3>
                  <p className="text-xs text-muted-foreground">Fill in the details below</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="text-muted-foreground hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-4 text-sm">
              {/* Date & Customer */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Playing Date
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Player Name
                  </label>
                  <input
                    type="text"
                    placeholder="Name or leave blank for walk-in"
                    value={playerName}
                    onChange={(e) => {
                      setPlayerName(e.target.value);
                      setSelectedPlayerId(null);
                    }}
                    list="players-list"
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs"
                  />
                  <datalist id="players-list">
                    {players.map((p) => (
                      <option key={p.id} value={p.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Duration Selector */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Time Played
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {STANDARD_DURATIONS.map((d) => (
                    <button
                      key={d.minutes}
                      type="button"
                      onClick={() => setDurationMinutes(d.minutes)}
                      className={`py-2.5 px-1 rounded-lg text-xs font-semibold transition border flex flex-col items-center gap-0.5 ${
                        durationMinutes === d.minutes
                          ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
                          : "bg-secondary/40 hover:bg-secondary border-border/60 text-muted-foreground"
                      }`}
                    >
                      <span>{d.label}</span>
                      <span className={`text-[10px] font-numeric font-bold tabular-nums ${durationMinutes === d.minutes ? "text-emerald-200" : "text-muted-foreground/60"}`}>
                        Rs. {d.price.toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Summary */}
              <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/80 space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Time played:</span>
                  <span className="font-semibold font-numeric tabular-nums text-foreground">{minutesToLabel(durationMinutes)}</span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-border/40">
                  <span className="font-sans font-medium text-foreground text-sm">Total price:</span>
                  <span className="text-lg font-bold font-numeric tabular-nums text-emerald-400">{formatLKR(finalChargePaise)}</span>
                </div>
              </div>

              {/* Payment Section */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-2">
                  Payment received now
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      💵 Paid in cash (Rs.)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={cashPaidRupees}
                      onChange={(e) => setCashPaidRupees(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      🏦 Paid by bank transfer (Rs.)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={bankPaidRupees}
                      onChange={(e) => setBankPaidRupees(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="mt-2 p-2.5 rounded-lg bg-secondary/20 border border-border/40 flex justify-between text-xs font-mono">
                  <span className="text-muted-foreground">Still to pay:</span>
                  <span className={stillToPayRupees > 0 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                    {stillToPayRupees > 0 ? `Rs. ${stillToPayRupees.toLocaleString()}.00` : "Fully paid ✓"}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tournament game, cue rented"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-xs text-foreground"
                />
              </div>

              {/* Advanced adjustments (collapsed by default) */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                  Price adjustments (manual override / discount)
                </button>
                {showAdvanced && (
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Custom price (Rs.) <span className="text-[10px]">(overrides formula)</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        placeholder="Leave blank for auto"
                        value={manualChargeRupees}
                        onChange={(e) =>
                          setManualChargeRupees(e.target.value === "" ? "" : Number(e.target.value))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Discount (Rs.)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={discountRupees}
                        onChange={(e) => setDiscountRupees(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary/40 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition shadow-sm"
              >
                {createMutation.isPending ? "Saving..." : "Save Session"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Collect Payment Modal ─────────────────────────────────────────────── */}
      {paymentSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Collect Payment</h3>
                  <p className="text-xs text-muted-foreground">
                    {paymentSession.customer_name || paymentSession.player?.name || "Walk-in"} · {paymentSession.reference}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPaymentSession(null)}
                className="text-muted-foreground hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {payError && (
              <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{payError}</span>
              </div>
            )}

            {/* Summary */}
            <div className="p-3 rounded-xl bg-secondary/30 border border-border/70 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total price:</span>
                <span className="font-mono font-semibold">{formatLKR(paymentSession.final_charge_paise)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already paid:</span>
                <span className="font-mono text-emerald-400">{formatLKR(paymentSession.paid_amount_paise)}</span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t border-border/40 text-amber-400">
                <span>Still to pay:</span>
                <span className="font-mono">{formatLKR(paymentSession.outstanding_paise)}</span>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Payment date
              </label>
              <input
                type="date"
                value={collectDate}
                onChange={(e) => setCollectDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border font-mono text-xs"
              />
            </div>

            {/* Cash + Bank split */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  💵 Paid in cash (Rs.)
                </label>
                <input
                  type="number"
                  min={0}
                  value={collectCashRupees}
                  onChange={(e) => setCollectCashRupees(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  🏦 Bank transfer (Rs.)
                </label>
                <input
                  type="number"
                  min={0}
                  value={collectBankRupees}
                  onChange={(e) => setCollectBankRupees(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border font-mono text-sm"
                />
              </div>
            </div>

            {/* Outstanding after this collection */}
            <div className="p-2.5 rounded-lg bg-secondary/20 border border-border/40 flex justify-between text-xs font-mono">
              <span className="text-muted-foreground">Still to pay after this:</span>
              <span className={collectOutstanding > 0 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                {collectOutstanding > 0 ? `Rs. ${collectOutstanding.toLocaleString()}.00` : "Fully paid ✓"}
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => setPaymentSession(null)}
                className="px-4 py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary/40 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => payMutation.mutate()}
                disabled={payMutation.isPending || collectTotal <= 0}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition shadow-sm"
              >
                {payMutation.isPending ? "Recording..." : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Void Session Modal ────────────────────────────────────────────────── */}
      {voidSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
                  <Ban className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Void Pool Session</h3>
                  <p className="text-xs text-muted-foreground">{voidSession.reference}</p>
                </div>
              </div>
              <button
                onClick={() => { setVoidSession(null); setVoidSuccess(""); setVoidError(""); }}
                className="text-muted-foreground hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {voidSuccess ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="p-3 rounded-full bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <p className="text-sm text-emerald-300 text-center font-medium">{voidSuccess}</p>
                <button
                  onClick={() => { setVoidSession(null); setVoidSuccess(""); }}
                  className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs space-y-1">
                  <p className="font-semibold text-rose-300">⚠ This action cannot be undone</p>
                  <ul className="list-disc list-inside text-rose-300/80 space-y-0.5">
                    <li>Session will be marked as Voided/Cancelled</li>
                    <li>Revenue journal entry will be reversed</li>
                    <li>All payments will be reversed in accounting records</li>
                    <li>Player's outstanding balance will be cleared</li>
                  </ul>
                </div>

                <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-xs space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Player:</span>
                    <span className="text-foreground font-sans">{voidSession.customer_name || voidSession.player?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Charge:</span>
                    <span className="text-foreground"><MoneyDisplay paise={voidSession.final_charge_paise} /></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paid:</span>
                    <span className="text-emerald-400"><MoneyDisplay paise={voidSession.paid_amount_paise} /></span>
                  </div>
                </div>

                {voidError && (
                  <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{voidError}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Admin Username *</label>
                      <input
                        type="text"
                        value={voidAdminUser}
                        onChange={(e) => setVoidAdminUser(e.target.value)}
                        placeholder="admin"
                        className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Admin Password *</label>
                      <input
                        type="password"
                        value={voidAdminPass}
                        onChange={(e) => setVoidAdminPass(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Reason (Optional)</label>
                    <input
                      type="text"
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      placeholder="e.g. Entered wrong player, duplicate entry"
                      className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => { setVoidSession(null); setVoidError(""); }}
                    className="px-4 py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary/40 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => { setVoidError(""); voidMutation.mutate(); }}
                    disabled={!voidAdminUser.trim() || !voidAdminPass.trim() || voidMutation.isPending}
                    className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition shadow-sm disabled:opacity-50"
                  >
                    {voidMutation.isPending ? "Voiding..." : "Void Session"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
