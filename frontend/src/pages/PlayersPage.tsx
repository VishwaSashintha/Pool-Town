import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Search, AlertCircle, X, Pencil, Trash2, UserX, GitMerge, CheckCircle2, ArrowRight } from "lucide-react";
import { api } from "@/api/client";
import type { PlayerUpdate } from "@/api/client";
import { MoneyDisplay } from "@/components/common/MoneyDisplay";

export const PlayersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editPlayer, setEditPlayer] = useState<any | null>(null);
  const [deletePlayer, setDeletePlayer] = useState<any | null>(null);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [primaryPlayerId, setPrimaryPlayerId] = useState<number | "">("");
  const [duplicatePlayerId, setDuplicatePlayerId] = useState<number | "">("");
  const [mergeError, setMergeError] = useState("");
  const [mergeSuccess, setMergeSuccess] = useState("");

  // Add player form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  // Edit player form
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editError, setEditError] = useState("");

  const [deleteError, setDeleteError] = useState("");

  const { data: players = [], isLoading } = useQuery({
    queryKey: ["players", searchTerm],
    queryFn: () => api.players.list(searchTerm || undefined),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.players.create({
        name: name.trim(),
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
      setIsAddModalOpen(false);
      setName("");
      setPhone("");
      setNotes("");
      setError("");
    },
    onError: (err: any) => {
      setError(err.message || "Failed to create player");
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      const data: PlayerUpdate = {};
      if (editName.trim()) data.name = editName.trim();
      data.phone = editPhone.trim() || undefined;
      data.notes = editNotes.trim() || undefined;
      return api.players.update(editPlayer!.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
      setEditPlayer(null);
      setEditError("");
    },
    onError: (err: any) => {
      setEditError(err.message || "Failed to update player");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.players.delete(deletePlayer!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
      setDeletePlayer(null);
      setDeleteError("");
    },
    onError: (err: any) => {
      setDeleteError(err.message || "Failed to delete player");
    },
  });

  const mergeMutation = useMutation({
    mutationFn: () =>
      api.players.merge(Number(primaryPlayerId), Number(duplicatePlayerId)),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
      setMergeSuccess(
        `Success! ${result.sessions_moved} session(s) moved to "${result.primary_player.name}". The duplicate player has been removed.`
      );
      setDuplicatePlayerId("");
      setPrimaryPlayerId("");
    },
    onError: (err: any) => {
      setMergeError(err.message || "Failed to merge players");
    },
  });

  const openEditModal = (p: any) => {
    setEditPlayer(p);
    setEditName(p.name);
    setEditPhone(p.phone || "");
    setEditNotes(p.notes || "");
    setEditError("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Player Directory</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Registered players, playing history, charges, and receivables balances
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setMergeError("");
              setMergeSuccess("");
              setPrimaryPlayerId("");
              setDuplicatePlayerId("");
              setIsMergeModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-700 hover:bg-purple-600 text-white font-medium text-sm transition shadow-md shrink-0"
          >
            <GitMerge className="h-4 w-4" />
            <span>Merge Duplicates</span>
          </button>
          <button
            onClick={() => {
              setError("");
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition shadow-md shadow-emerald-950/40 shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Player</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by player name or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-card/60 border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Players List Table */}
      <div className="rounded-xl border border-border/70 bg-card/60 overflow-hidden glass-panel">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading players...</div>
        ) : players.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium">No players found</p>
            <p className="text-xs mt-1">Add a player or create one during session entry.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-secondary/30 text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="py-3 px-4">Player Name</th>
                  <th className="py-3 px-4">Contact Phone</th>
                  <th className="py-3 px-4">Total Sessions</th>
                  <th className="py-3 px-4">Total Charges</th>
                  <th className="py-3 px-4">Total Paid</th>
                  <th className="py-3 px-4">Outstanding Balance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs">
                {players.map((p) => (
                  <tr key={p.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <span>{p.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-muted-foreground">
                      {p.phone || "—"}
                    </td>
                    <td className="py-3.5 px-4 font-mono">{p.total_sessions || 0}</td>
                    <td className="py-3.5 px-4 font-mono text-foreground font-medium">
                      <MoneyDisplay paise={p.total_charges_paise || 0} />
                    </td>
                    <td className="py-3.5 px-4 font-mono text-emerald-400">
                      <MoneyDisplay paise={p.total_paid_paise || 0} />
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-400">
                      {(p.outstanding_balance_paise || 0) > 0 ? (
                        <MoneyDisplay paise={p.outstanding_balance_paise || 0} />
                      ) : (
                        <span className="text-muted-foreground/60">Rs. 0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${p.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-secondary text-muted-foreground"}`}>
                        {p.is_active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEditModal(p)}
                          title="Edit player"
                          className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 transition border border-blue-500/30"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        {(p.total_sessions || 0) === 0 && (
                          <button
                            onClick={() => { setDeletePlayer(p); setDeleteError(""); }}
                            title="Delete player (no sessions)"
                            className="p-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 transition border border-rose-500/30"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                        {(p.total_sessions || 0) > 0 && p.is_active && (
                          <button
                            onClick={() => openEditModal({ ...p, _deactivate: true })}
                            title="Deactivate player"
                            className="p-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 transition border border-amber-500/30"
                          >
                            <UserX className="h-3 w-3" />
                          </button>
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

      {/* Add Player Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Add New Player</h3>
                  <p className="text-xs text-muted-foreground">Creates a reusable player account</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted-foreground hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kasun Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Contact Phone (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 077 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Remarks, cue preference, member notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary/40 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createMutation.mutate()}
                disabled={!name.trim() || createMutation.isPending}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition shadow-sm disabled:opacity-50"
              >
                {createMutation.isPending ? "Saving..." : "Save Player"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Player Modal */}
      {editPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-blue-500/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                  <Pencil className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Edit Player</h3>
                  <p className="text-xs text-muted-foreground">Financial history is always preserved</p>
                </div>
              </div>
              <button
                onClick={() => setEditPlayer(null)}
                className="text-muted-foreground hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Full Name *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Contact Phone</label>
                <input
                  type="tel"
                  placeholder="Leave blank to clear"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Player remarks"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs"
                />
              </div>
              {editPlayer.is_active && (editPlayer.total_sessions || 0) > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <input
                    type="checkbox"
                    id="deactivate-check"
                    defaultChecked={false}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setEditPlayer({ ...editPlayer, _deactivate: e.target.checked });
                      } else {
                        setEditPlayer({ ...editPlayer, _deactivate: false });
                      }
                    }}
                    className="h-3.5 w-3.5"
                  />
                  <label htmlFor="deactivate-check" className="text-xs text-amber-400">
                    Deactivate this player (they will be hidden from new sessions)
                  </label>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => setEditPlayer(null)}
                className="px-4 py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary/40 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const data: PlayerUpdate = {};
                  if (editName.trim()) data.name = editName.trim();
                  data.phone = editPhone.trim() || undefined;
                  data.notes = editNotes.trim() || undefined;
                  if (editPlayer._deactivate) data.is_active = false;
                  api.players.update(editPlayer.id, data).then(() => {
                    queryClient.invalidateQueries({ queryKey: ["players"] });
                    setEditPlayer(null);
                    setEditError("");
                  }).catch((err: any) => {
                    setEditError(err.message || "Failed to update player");
                  });
                }}
                disabled={!editName.trim() || updateMutation.isPending}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition shadow-sm disabled:opacity-50"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Player Confirmation Modal */}
      {deletePlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-rose-500/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-border/60 pb-3">
              <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Delete Player?</h3>
                <p className="text-xs text-muted-foreground">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-xs text-foreground">
              You are about to permanently delete <span className="font-bold text-rose-400">"{deletePlayer.name}"</span>.
              This player has <span className="font-bold">{deletePlayer.total_sessions || 0} sessions</span> on record.
            </p>
            <p className="text-xs text-muted-foreground">
              Only players with zero recorded sessions can be deleted. Players with session history should be deactivated instead.
            </p>

            {deleteError && (
              <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => setDeletePlayer(null)}
                className="px-4 py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary/40 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition shadow-sm disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete Player"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Players Modal */}
      {isMergeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-purple-500/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                  <GitMerge className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Merge Duplicate Players</h3>
                  <p className="text-xs text-muted-foreground">Combines two player records — all history moves to the primary player</p>
                </div>
              </div>
              <button
                onClick={() => { setIsMergeModalOpen(false); setMergeSuccess(""); setMergeError(""); }}
                className="text-muted-foreground hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {mergeSuccess ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="p-4 rounded-full bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <p className="text-sm text-emerald-300 text-center font-medium">{mergeSuccess}</p>
                <button
                  onClick={() => { setIsMergeModalOpen(false); setMergeSuccess(""); }}
                  className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300 space-y-1">
                  <p className="font-semibold">⚠ How it works:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-300/80">
                    <li>All sessions and charges from the <strong>Duplicate</strong> are moved to the <strong>Primary</strong> player</li>
                    <li>The duplicate player profile is permanently deleted</li>
                    <li>Financial totals are recalculated automatically</li>
                    <li>This action cannot be undone</li>
                  </ul>
                </div>

                {mergeError && (
                  <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{mergeError}</span>
                  </div>
                )}

                <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Duplicate Player <span className="text-rose-400">(will be removed)</span>
                    </label>
                    <select
                      value={duplicatePlayerId}
                      onChange={(e) => { setDuplicatePlayerId(Number(e.target.value) || ""); setMergeError(""); }}
                      className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-rose-500/40 text-foreground text-xs"
                    >
                      <option value="">— Select duplicate —</option>
                      {players
                        .filter((p) => p.id !== Number(primaryPlayerId))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.phone ? `(${p.phone})` : ""} — {p.total_sessions || 0} sessions
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="pb-2">
                    <ArrowRight className="h-5 w-5 text-purple-400" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Primary Player <span className="text-emerald-400">(keep this one)</span>
                    </label>
                    <select
                      value={primaryPlayerId}
                      onChange={(e) => { setPrimaryPlayerId(Number(e.target.value) || ""); setMergeError(""); }}
                      className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-emerald-500/40 text-foreground text-xs"
                    >
                      <option value="">— Select primary —</option>
                      {players
                        .filter((p) => p.id !== Number(duplicatePlayerId))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.phone ? `(${p.phone})` : ""} — {p.total_sessions || 0} sessions
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {primaryPlayerId && duplicatePlayerId && (() => {
                  const primary = players.find((p) => p.id === Number(primaryPlayerId));
                  const duplicate = players.find((p) => p.id === Number(duplicatePlayerId));
                  if (!primary || !duplicate) return null;
                  return (
                    <div className="p-3 rounded-lg bg-secondary/40 border border-border/50 text-xs space-y-2">
                      <p className="font-semibold text-muted-foreground">Merge Preview:</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 p-2 rounded bg-rose-500/10 border border-rose-500/20">
                          <p className="text-rose-400 font-medium">{duplicate.name}</p>
                          <p className="text-muted-foreground">{duplicate.total_sessions || 0} sessions · <MoneyDisplay paise={duplicate.outstanding_balance_paise || 0} /> outstanding</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-purple-400 shrink-0" />
                        <div className="flex-1 p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                          <p className="text-emerald-400 font-medium">{primary.name}</p>
                          <p className="text-muted-foreground">
                            {(primary.total_sessions || 0) + (duplicate.total_sessions || 0)} sessions after merge
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => { setIsMergeModalOpen(false); setMergeError(""); }}
                    className="px-4 py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary/40 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMergeError(""); mergeMutation.mutate(); }}
                    disabled={!primaryPlayerId || !duplicatePlayerId || mergeMutation.isPending}
                    className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition shadow-sm disabled:opacity-50"
                  >
                    {mergeMutation.isPending ? "Merging..." : "Confirm Merge"}
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
