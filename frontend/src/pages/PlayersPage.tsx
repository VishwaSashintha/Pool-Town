import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Search, AlertCircle, X } from "lucide-react";
import { api } from "@/api/client";
import { MoneyDisplay } from "@/components/common/MoneyDisplay";

export const PlayersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Add player form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Player Directory</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Registered players, playing history, charges, and receivables balances
          </p>
        </div>

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
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs">
                {players.map((p) => (
                  <tr key={p.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-foreground flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <span>{p.name}</span>
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
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400">
                        ACTIVE
                      </span>
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
    </div>
  );
};
