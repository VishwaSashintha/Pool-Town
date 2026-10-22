import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Gamepad2,
  Plus,
  Calendar,
  CreditCard,
  AlertCircle,
  X,
  ChevronDown,
} from "lucide-react";
import { api } from "@/api/client";
import { MoneyDisplay } from "@/components/common/MoneyDisplay";
import { formatLKR, rupeesToPaise, paiseToRupees } from "@/lib/money";
import type { PS4Session } from "@/types";

// Only whole-hour presets as requested
const PS4_DURATIONS = [
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "3 hours", minutes: 180 },
  { label: "4 hours", minutes: 240 },
];

function statusLabel(s: string): string {
  switch (s.toLowerCase()) {
    case "paid": return "Fully Paid";
    case "partial": return "Partially Paid";
    case "pending": return "Unpaid";
    case "cancelled": return "Cancelled";
    default: return s;
  }
}

function minutesToLabel(m: number): string {
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return h === 1 ? "1 hour" : `${h} hours`;
  return `${h} hr ${rem} min`;
}

export const PS4SessionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [filterStatus, setFilterStatus] = useState<string>("");

  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [paymentSession, setPaymentSession] = useState<PS4Session | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Form states
  const [formDate, setFormDate] = useState<string>(selectedDate);
  const [playerCount, setPlayerCount] = useState<1 | 2>(1);
  const [player1Name, setPlayer1Name] = useState<string>("");
  const [player2Name, setPlayer2Name] = useState<string>("");
  const [minutes, setMinutes] = useState<number>(60);
  const [manualPriceRupees, setManualPriceRupees] = useState<number | "">("");
  const [discountRupees, setDiscountRupees] = useState<number>(0);
  const [cashPaidRupees, setCashPaidRupees] = useState<number>(0);
  const [bankPaidRupees, setBankPaidRupees] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [formError, setFormError] = useState<string>("");

  // Payment collection states
  const [collectCashRupees, setCollectCashRupees] = useState<number>(0);
  const [collectBankRupees, setCollectBankRupees] = useState<number>(0);
  const [collectDate, setCollectDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [payError, setPayError] = useState<string>("");

  useEffect(() => {
    if (searchParams.get("action") === "new") {
      setIsNewModalOpen(true);
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["ps4-sessions", selectedDate, filterStatus],
    queryFn: () =>
      api.ps4Sessions.list({
        date: selectedDate || undefined,
        status: filterStatus || undefined,
      }),
  });

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => api.players.list(),
  });

  // Calculate standard PS4 rate
  const hourlyRatePaise = playerCount === 1 ? 40000 : 50000;
  const calculatedStandardPaise = Math.round((minutes / 60) * hourlyRatePaise);
  const standardChargePaise =
    manualPriceRupees !== "" && Number(manualPriceRupees) >= 0
      ? rupeesToPaise(Number(manualPriceRupees))
      : calculatedStandardPaise;
  const discountPaise = rupeesToPaise(discountRupees);
  const finalChargePaise = Math.max(0, standardChargePaise - discountPaise);
  const finalChargeRupees = paiseToRupees(finalChargePaise);

  const totalPaidRupees = cashPaidRupees + bankPaidRupees;
  const stillToPayRupees = Math.max(0, finalChargeRupees - totalPaidRupees);

  // Auto-fill cash when price or player count changes
  useEffect(() => {
    if (isNewModalOpen) {
      setCashPaidRupees(paiseToRupees(finalChargePaise));
      setBankPaidRupees(0);
    }
  }, [finalChargePaise, isNewModalOpen]);

  const createMutation = useMutation({
    mutationFn: () => {
      const combinedName =
        playerCount === 2 && player2Name.trim()
          ? `${player1Name.trim() || "Player 1"} & ${player2Name.trim()}`
          : player1Name.trim() || "Player 1";
      const firstPaymentMethod = cashPaidRupees > 0 ? "cash" : bankPaidRupees > 0 ? "bank_transfer" : "cash";
      const firstPaymentAmount = cashPaidRupees > 0 ? rupeesToPaise(cashPaidRupees) : rupeesToPaise(bankPaidRupees);
      return api.ps4Sessions.create({
        session_date: formDate,
        player_count: playerCount,
        customer_name: combinedName,
        minutes,
        discount_paise: discountPaise,
        initial_payment_paise: firstPaymentAmount,
        initial_payment_method: firstPaymentMethod,
        notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ps4-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setIsNewModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to create PS4 session");
    },
  });

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
          session_type: "ps4",
          session_id: paymentSession.id,
          collection_date: collectDate,
          amount_paise: rupeesToPaise(collectCashRupees),
          payment_method: "cash",
        }));
      }
      if (collectBankRupees > 0) {
        promises.push(api.payments.record({
          session_type: "ps4",
          session_id: paymentSession.id,
          collection_date: collectDate,
          amount_paise: rupeesToPaise(collectBankRupees),
          payment_method: "bank_transfer",
        }));
      }
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ps4-sessions"] });
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

  const resetForm = () => {
    setPlayerCount(1);
    setPlayer1Name("");
    setPlayer2Name("");
    setMinutes(60);
    setManualPriceRupees("");
    setDiscountRupees(0);
    setCashPaidRupees(400);
    setBankPaidRupees(0);
    setNotes("");
    setFormError("");
    setShowAdvanced(false);
  };

  const collectTotal = collectCashRupees + collectBankRupees;
  const collectOutstanding = paymentSession
    ? Math.max(0, paiseToRupees(paymentSession.outstanding_paise) - collectTotal)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">PS4 Gaming</h2>
          <p className="text-xs text-muted-foreground mt-1">
            1 player: Rs. 400/hour · 2 players: Rs. 500/hour
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsNewModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition shadow-md shadow-blue-950/40 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New PS4 Session</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-border/70 bg-card/40 glass-panel">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-4 w-4 text-blue-400" />
            <span>Date:</span>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded-md bg-secondary/50 border border-border/60 text-xs font-mono text-foreground focus:outline-none"
          />
          <button
            onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
            className="text-xs text-blue-400 hover:underline"
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
          <div className="p-12 text-center text-sm text-muted-foreground">Loading PS4 sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <Gamepad2 className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium">No PS4 sessions found</p>
            <p className="text-xs mt-1">Click "New PS4 Session" to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-secondary/30 text-muted-foreground border-b border-border/60 font-sans">
                <tr>
                  <th className="py-3 px-4">Ref</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Players</th>
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
                    <td className="py-3.5 px-4 font-semibold text-blue-400">{s.reference}</td>
                    <td className="py-3.5 px-4 text-muted-foreground">{s.session_date}</td>
                    <td className="py-3.5 px-4 font-sans font-medium text-foreground">
                      {s.player1?.name || s.customer_name || "Gamer"}
                      {s.player_count === 2 && ` & ${s.player2?.name || "Player 2"}`}
                      <span className="ml-1.5 text-[10px] text-muted-foreground">
                        ({s.player_count} {s.player_count === 1 ? "player" : "players"})
                      </span>
                    </td>
                    <td className="py-3.5 px-4">{minutesToLabel(s.minutes)}</td>
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
                          s.status === "paid"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : s.status === "partial"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-rose-500/20 text-rose-400"
                        }`}
                      >
                        {statusLabel(s.status)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-sans">
                      {s.outstanding_paise > 0 && (
                        <button
                          onClick={() => {
                            setPaymentSession(s);
                            setCollectCashRupees(paiseToRupees(s.outstanding_paise));
                            setCollectBankRupees(0);
                            setCollectDate(new Date().toISOString().split("T")[0]);
                            setPayError("");
                          }}
                          className="px-2.5 py-1 rounded bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/30 text-xs font-medium transition"
                        >
                          Collect Payment
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

      {/* ── New PS4 Session Modal ───────────────────────────────────────────────── */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-blue-500/30 bg-card p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                  <Gamepad2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Record PS4 Session</h3>
                  <p className="text-xs text-muted-foreground">Gaming station session</p>
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
              {/* Date & Players */}
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
                    Number of Players
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPlayerCount(1)}
                      className={`py-2 rounded-lg text-xs font-semibold border transition ${
                        playerCount === 1
                          ? "bg-blue-600 text-white border-blue-500"
                          : "bg-secondary/40 text-muted-foreground border-border"
                      }`}
                    >
                      1 Player
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlayerCount(2)}
                      className={`py-2 rounded-lg text-xs font-semibold border transition ${
                        playerCount === 2
                          ? "bg-blue-600 text-white border-blue-500"
                          : "bg-secondary/40 text-muted-foreground border-border"
                      }`}
                    >
                      2 Players
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Rate: Rs. {playerCount === 1 ? "400" : "500"}/hour
                  </p>
                </div>
              </div>

              {/* Player Names */}
              <div className={`grid ${playerCount === 2 ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {playerCount === 2 ? "Player 1 Name" : "Player Name"}
                  </label>
                  <input
                    type="text"
                    placeholder="Gamer name"
                    value={player1Name}
                    onChange={(e) => setPlayer1Name(e.target.value)}
                    list="players-list-ps4"
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs"
                  />
                  <datalist id="players-list-ps4">
                    {players.map((p) => (
                      <option key={p.id} value={p.name} />
                    ))}
                  </datalist>
                </div>
                {playerCount === 2 && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Player 2 Name
                    </label>
                    <input
                      type="text"
                      placeholder="Second player"
                      value={player2Name}
                      onChange={(e) => setPlayer2Name(e.target.value)}
                      list="players-list-ps4"
                      className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Duration — whole hours only */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Time Played
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {PS4_DURATIONS.map((d) => {
                    const price = Math.round((d.minutes / 60) * (playerCount === 1 ? 400 : 500));
                    return (
                      <button
                        key={d.minutes}
                        type="button"
                        onClick={() => setMinutes(d.minutes)}
                        className={`py-2.5 px-1 rounded-lg text-xs font-semibold transition border flex flex-col items-center gap-0.5 ${
                          minutes === d.minutes
                            ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                            : "bg-secondary/40 hover:bg-secondary border-border/60 text-muted-foreground"
                        }`}
                      >
                        <span>{d.label}</span>
                        <span className={`text-[10px] ${minutes === d.minutes ? "text-blue-200" : "text-muted-foreground/60"}`}>
                          Rs. {price.toLocaleString()}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  For unusual durations, use the manual price option below.
                </p>
              </div>

              {/* Price summary */}
              <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/80 space-y-1.5 font-mono text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Time played:</span>
                  <span className="font-semibold text-foreground">{minutesToLabel(minutes)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Players:</span>
                  <span className="font-semibold text-foreground">{playerCount} · Rs. {playerCount === 1 ? "400" : "500"}/hr</span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-border/40">
                  <span className="font-sans font-medium text-foreground text-sm">Total price:</span>
                  <span className="text-lg font-bold text-blue-400">{formatLKR(finalChargePaise)}</span>
                </div>
              </div>

              {/* Payment */}
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
                  placeholder="Any remarks"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-xs text-foreground"
                />
              </div>

              {/* Advanced: manual price override */}
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
                        Custom price (Rs.)
                      </label>
                      <input
                        type="number"
                        min={0}
                        placeholder="Leave blank for auto"
                        value={manualPriceRupees}
                        onChange={(e) =>
                          setManualPriceRupees(e.target.value === "" ? "" : Number(e.target.value))
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
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition shadow-sm"
              >
                {createMutation.isPending ? "Saving..." : "Save Session"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collect Payment Modal */}
      {paymentSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-blue-500/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Collect Payment</h3>
                  <p className="text-xs text-muted-foreground">
                    {paymentSession.customer_name || "Gamer"} · {paymentSession.reference}
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
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition shadow-sm"
              >
                {payMutation.isPending ? "Recording..." : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
