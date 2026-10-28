/**
 * DamageChargesPage — Track player-caused equipment damage, collections, recoveries, and waivers.
 */
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert,
  Search,
  Filter,
  Plus,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  X,
  Slash,
} from "lucide-react";
import { apiClient } from "@/api/client";
import { formatLKR, rupeesToPaise, paiseToRupees } from "@/lib/money";
import type { DamageCharge, DamageChargeCreate, DamagePaymentCreate, Player } from "@/types";

export const DamageChargesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedChargeForPayment, setSelectedChargeForPayment] = useState<DamageCharge | null>(null);
  const [selectedChargeForWaive, setSelectedChargeForWaive] = useState<DamageCharge | null>(null);

  // Create Form states
  const [damageDate, setDamageDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | "">("");
  const [playerNameOverride, setPlayerNameOverride] = useState("");
  const [damagedItem, setDamagedItem] = useState("");
  const [description, setDescription] = useState("");
  const [chargeAmountRs, setChargeAmountRs] = useState("");
  const [notes, setNotes] = useState("");

  // Payment Form states
  const [paymentAmountRs, setPaymentAmountRs] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer">("cash");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentNotes, setPaymentNotes] = useState("");

  // Waive Form states
  const [resolutionNotes, setResolutionNotes] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const { data: players = [] } = useQuery<Player[]>({
    queryKey: ["playersList"],
    queryFn: () => apiClient.players.list(),
  });

  const { data: damageCharges = [], isLoading } = useQuery<DamageCharge[]>({
    queryKey: ["damageChargesList"],
    queryFn: () => apiClient.equipment.listDamageCharges(),
  });

  const createChargeMutation = useMutation({
    mutationFn: (data: DamageChargeCreate) => apiClient.equipment.createDamageCharge(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["damageChargesList"] });
      setSuccessMsg("Damage charge recorded successfully!");
      setShowCreateModal(false);
      resetCreateForm();
      setTimeout(() => setSuccessMsg(""), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to record damage charge");
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: ({ chargeId, data }: { chargeId: number; data: DamagePaymentCreate }) =>
      apiClient.equipment.recordDamagePayment(chargeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["damageChargesList"] });
      queryClient.invalidateQueries({ queryKey: ["financialAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["trialBalance"] });
      setSuccessMsg("Damage payment collected and posted!");
      setSelectedChargeForPayment(null);
      resetPaymentForm();
      setTimeout(() => setSuccessMsg(""), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to record payment");
    },
  });

  const waiveChargeMutation = useMutation({
    mutationFn: ({ chargeId, reason }: { chargeId: number; reason: string }) =>
      apiClient.equipment.waiveDamageCharge(chargeId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["damageChargesList"] });
      setSuccessMsg("Damage charge waived.");
      setSelectedChargeForWaive(null);
      setResolutionNotes("");
      setTimeout(() => setSuccessMsg(""), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to waive charge");
    },
  });

  const resetCreateForm = () => {
    setSelectedPlayerId("");
    setPlayerNameOverride("");
    setDamagedItem("");
    setDescription("");
    setChargeAmountRs("");
    setNotes("");
    setErrorMsg("");
  };

  const resetPaymentForm = () => {
    setPaymentAmountRs("");
    setPaymentNotes("");
    setErrorMsg("");
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountPaise = rupeesToPaise(parseFloat(chargeAmountRs) || 0);
    if (amountPaise <= 0) {
      setErrorMsg("Charge amount must be greater than zero");
      return;
    }
    if (!damagedItem.trim()) {
      setErrorMsg("Please specify the damaged item");
      return;
    }
    if (!selectedPlayerId && !playerNameOverride.trim()) {
      setErrorMsg("Please select an existing player or enter a guest name");
      return;
    }

    createChargeMutation.mutate({
      damage_date: damageDate,
      player_id: selectedPlayerId ? Number(selectedPlayerId) : undefined,
      player_name_override: !selectedPlayerId && playerNameOverride ? playerNameOverride.trim() : undefined,
      damaged_item: damagedItem.trim(),
      description: description.trim() || undefined,
      charge_amount_paise: amountPaise,
      notes: notes.trim() || undefined,
    });
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChargeForPayment) return;
    const amountPaise = rupeesToPaise(parseFloat(paymentAmountRs) || 0);
    if (amountPaise <= 0) {
      setErrorMsg("Payment amount must be greater than zero");
      return;
    }
    if (amountPaise > selectedChargeForPayment.outstanding_paise) {
      setErrorMsg(`Amount exceeds remaining due of ${formatLKR(selectedChargeForPayment.outstanding_paise)}`);
      return;
    }

    recordPaymentMutation.mutate({
      chargeId: selectedChargeForPayment.id,
      data: {
        payment_date: paymentDate,
        amount_paise: amountPaise,
        payment_method: paymentMethod,
        notes: paymentNotes || "Damage recovery collection",
      },
    });
  };

  const handleWaiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChargeForWaive) return;
    if (!resolutionNotes.trim()) {
      setErrorMsg("Please provide a reason / resolution note for waiving");
      return;
    }

    waiveChargeMutation.mutate({
      chargeId: selectedChargeForWaive.id,
      reason: resolutionNotes.trim(),
    });
  };

  // Filtered
  const filteredCharges = damageCharges.filter((c: DamageCharge) => {
    const matchesSearch =
      c.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.damaged_item.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.reference.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === "all" ? true : c.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  // Metrics
  const totalCharged = damageCharges.reduce((sum: number, c: DamageCharge) => sum + c.charge_amount_paise, 0);
  const totalCollected = damageCharges.reduce((sum: number, c: DamageCharge) => sum + c.collected_paise, 0);
  const totalOutstanding = damageCharges
    .filter((c: DamageCharge) => c.status !== "waived" && c.status !== "written_off")
    .reduce((sum: number, c: DamageCharge) => sum + c.outstanding_paise, 0);
  const activeCount = damageCharges.filter((c: DamageCharge) => c.status === "outstanding" || c.status === "partially_paid").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-rose-400" />
            Damage Charges & Recoveries
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Record player-caused equipment damage, track collections, and manage debt waivers
          </p>
        </div>

        <button
          onClick={() => {
            setShowCreateModal(true);
            resetCreateForm();
          }}
          className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium transition flex items-center gap-2 shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Record Damage Incident
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
            <span className="text-xs font-medium uppercase tracking-wider">Total Damage Charged</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-bold font-numeric tabular-nums text-white">{formatLKR(totalCharged)}</p>
          <p className="text-xs text-slate-500 mt-1">{damageCharges.length} incident(s) recorded</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Collected / Recovered</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold font-numeric tabular-nums text-emerald-400">{formatLKR(totalCollected)}</p>
          <p className="text-xs text-slate-500 mt-1">Cash & bank recoveries</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Outstanding Dues</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold font-numeric tabular-nums text-amber-400">{formatLKR(totalOutstanding)}</p>
          <p className="text-xs text-slate-500 mt-1">{activeCount} pending settlement(s)</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Recovery Rate</span>
            <DollarSign className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-bold font-numeric tabular-nums text-sky-400">
            {totalCharged > 0 ? `${Math.round((totalCollected / totalCharged) * 100)}%` : "100%"}
          </p>
          <p className="text-xs text-slate-500 mt-1">Of assessed player damage</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search player, item or ref..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="flex bg-slate-900/80 p-1 rounded-lg border border-slate-700 text-xs">
            {["all", "outstanding", "partially_paid", "paid", "waived"].map(st => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  selectedStatus === st ? "bg-rose-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {st === "all" ? "All" : st.replace("_", " ").toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Damage Charges Table */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Ref</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Player</th>
                <th className="py-3 px-4">Damaged Item</th>
                <th className="py-3 px-4 text-right">Assessed Charge</th>
                <th className="py-3 px-4 text-right">Collected</th>
                <th className="py-3 px-4 text-right">Remaining Due</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Loading damage records...
                  </td>
                </tr>
              ) : filteredCharges.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No damage incidents recorded. Equipment is in good condition!
                  </td>
                </tr>
              ) : (
                filteredCharges.map((c: DamageCharge) => {
                  const isSettled = c.status === "paid" || c.status === "waived";

                  return (
                    <tr key={c.id} className="hover:bg-slate-750/30 transition">
                      <td className="py-3 px-4 font-mono text-xs font-medium text-slate-300">
                        {c.reference}
                      </td>
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap text-xs">
                        {c.damage_date}
                      </td>
                      <td className="py-3 px-4 font-medium text-white">
                        {c.player_name}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-200">{c.damaged_item}</div>
                        {c.description && (
                          <div className="text-xs text-slate-500 truncate max-w-xs">{c.description}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                        {formatLKR(c.charge_amount_paise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400">
                        {formatLKR(c.collected_paise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                        {formatLKR(c.outstanding_paise)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {c.status === "paid" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Paid
                          </span>
                        )}
                        {c.status === "partially_paid" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Partial
                          </span>
                        )}
                        {c.status === "outstanding" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Outstanding
                          </span>
                        )}
                        {c.status === "waived" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                            Waived
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {!isSettled && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedChargeForPayment(c);
                                  setPaymentAmountRs(paiseToRupees(c.outstanding_paise).toString());
                                  setErrorMsg("");
                                }}
                                className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition"
                              >
                                Collect
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedChargeForWaive(c);
                                  setResolutionNotes("");
                                  setErrorMsg("");
                                }}
                                className="px-2 py-1 rounded-md bg-slate-700/60 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                                title="Waive charge"
                              >
                                Waive
                              </button>
                            </>
                          )}
                          {isSettled && (
                            <span className="text-xs text-slate-500">—</span>
                          )}
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

      {/* Record Damage Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              Record Equipment Damage Incident
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Log damaged equipment and assign liability to responsible player
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
                    Incident Date *
                  </label>
                  <input
                    type="date"
                    value={damageDate}
                    onChange={e => setDamageDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Charge Amount (Rs.) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={chargeAmountRs}
                    onChange={e => setChargeAmountRs(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-rose-500"
                    placeholder="e.g. 2500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Responsible Registered Player
                </label>
                <select
                  value={selectedPlayerId}
                  onChange={e => {
                    setSelectedPlayerId(Number(e.target.value) || "");
                    if (e.target.value) setPlayerNameOverride("");
                  }}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-rose-500"
                >
                  <option value="">Choose registered player...</option>
                  {players.map((p: Player) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.phone ? `(${p.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {!selectedPlayerId && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Or Enter Guest / Unregistered Player Name *
                  </label>
                  <input
                    type="text"
                    value={playerNameOverride}
                    onChange={e => setPlayerNameOverride(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-rose-500"
                    placeholder="e.g. Suresh Kumar"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Damaged Item *
                </label>
                <input
                  type="text"
                  value={damagedItem}
                  onChange={e => setDamagedItem(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-rose-500"
                  placeholder="e.g. Table 1 Felt Tear (Right pocket) or Broken Tip"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Incident Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-rose-500"
                  placeholder="e.g. Accidental jump shot strike into the cloth"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-rose-500"
                  placeholder="Settlement arrangement, promise date..."
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
                  disabled={createChargeMutation.isPending}
                  className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium transition shadow-sm disabled:opacity-50"
                >
                  {createChargeMutation.isPending ? "Recording..." : "Record Damage Charge"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collect Recovery Modal */}
      {selectedChargeForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedChargeForPayment(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              Collect Damage Recovery Payment
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Recovery for {selectedChargeForPayment.damaged_item} from {selectedChargeForPayment.player_name}
            </p>

            <div className="my-4 p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs flex justify-between items-center">
              <span className="text-slate-400">Remaining Balance:</span>
              <span className="font-mono font-bold text-amber-400 text-sm">
                {formatLKR(selectedChargeForPayment.outstanding_paise)}
              </span>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Payment Amount (Rs.) *
                </label>
                <input
                  type="number"
                  step="any"
                  value={paymentAmountRs}
                  onChange={e => setPaymentAmountRs(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
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
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Receipt Notes
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={e => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="Optional receipt note..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedChargeForPayment(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordPaymentMutation.isPending}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition shadow-sm disabled:opacity-50"
                >
                  {recordPaymentMutation.isPending ? "Collecting..." : "Confirm Recovery"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Waive Charge Modal */}
      {selectedChargeForWaive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedChargeForWaive(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Slash className="w-5 h-5 text-amber-400" />
              Waive Damage Charge
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Waive remaining {formatLKR(selectedChargeForWaive.outstanding_paise)} for {selectedChargeForWaive.damaged_item}
            </p>

            {errorMsg && (
              <div className="my-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleWaiveSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Reason for Waiver / Settlement Note *
                </label>
                <textarea
                  rows={3}
                  value={resolutionNotes}
                  onChange={e => setResolutionNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                  placeholder="e.g. Regular loyal customer, owner approved goodwill waiver"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedChargeForWaive(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={waiveChargeMutation.isPending}
                  className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition shadow-sm disabled:opacity-50"
                >
                  {waiveChargeMutation.isPending ? "Waiving..." : "Confirm Waiver"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
