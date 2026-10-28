import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  TrendingUp,
  Filter,
} from "lucide-react";
import { formatLKR } from "@/lib/money";

const API_BASE = "/api";
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

interface StockDiscrepancy {
  product_id: number;
  product_name: string;
  count_date: string;
  expected_stock: number;
  actual_stock: number;
  difference: number;
  estimated_value_paise: number;
  status: "over" | "short";
  notes?: string | null;
  investigated: boolean;
}

export const StockIssuesPage: React.FC = () => {
  const qc = useQueryClient();
  const [showUnresolvedOnly, setShowUnresolvedOnly] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");
  const [resolveError, setResolveError] = useState("");

  const { data: issues = [], isLoading } = useQuery<StockDiscrepancy[]>({
    queryKey: ["stock-issues", showUnresolvedOnly],
    queryFn: () =>
      apiRequest<StockDiscrepancy[]>(
        `/drinks/issues${showUnresolvedOnly ? "?unresolved_only=true" : ""}`
      ),
  });

  // We need the count IDs to resolve - let's get them from stock-count endpoint
  const { data: stockCounts = [] } = useQuery<any[]>({
    queryKey: ["drinks-stock-counts"],
    queryFn: () => apiRequest<any[]>("/drinks/stock-count"),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ countId, notes }: { countId: number; notes: string }) =>
      apiRequest(`/drinks/issues/${countId}/resolve?notes=${encodeURIComponent(notes)}`, {
        method: "PATCH",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-issues"] });
      qc.invalidateQueries({ queryKey: ["drinks-stock-counts"] });
      setResolvingId(null);
      setResolveNotes("");
      setResolveError("");
    },
    onError: (e: any) => setResolveError(e.message),
  });

  const shortages = issues.filter((i) => i.status === "short");
  const overages = issues.filter((i) => i.status === "over");
  const totalLostValue = shortages.reduce((s, i) => s + i.estimated_value_paise, 0);
  const unresolvedCount = issues.filter((i) => !i.investigated).length;

  // Map issue to its count record ID
  const getCountId = (issue: StockDiscrepancy): number | null => {
    const count = stockCounts.find(
      (c) => c.product_id === issue.product_id && c.count_date === issue.count_date
    );
    return count?.id ?? null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Stock Issues</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Discrepancies between expected stock and actual physical counts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={showUnresolvedOnly}
              onChange={(e) => setShowUnresolvedOnly(e.target.checked)}
              className="rounded"
            />
            <span className="text-muted-foreground">Show unresolved only</span>
          </label>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-rose-500/20 bg-card/60 glass-panel">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-medium mb-1">
            <TrendingDown className="h-4 w-4" />
            <span>Shortages</span>
          </div>
          <div className="text-2xl font-bold font-numeric tabular-nums text-white">{shortages.length}</div>
          <p className="text-xs text-rose-400 font-mono mt-1">
            Est. lost value: {formatLKR(totalLostValue)}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-blue-500/20 bg-card/60 glass-panel">
          <div className="flex items-center gap-2 text-blue-400 text-xs font-medium mb-1">
            <TrendingUp className="h-4 w-4" />
            <span>Overages</span>
          </div>
          <div className="text-2xl font-bold font-numeric tabular-nums text-white">{overages.length}</div>
          <p className="text-xs text-muted-foreground">More stock than expected</p>
        </div>
        <div className="p-4 rounded-xl border border-amber-500/20 bg-card/60 glass-panel">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-medium mb-1">
            <AlertTriangle className="h-4 w-4" />
            <span>Unresolved</span>
          </div>
          <div className="text-2xl font-bold font-numeric tabular-nums text-white">{unresolvedCount}</div>
          <p className="text-xs text-muted-foreground">Need investigation</p>
        </div>
      </div>

      {/* Issues Table */}
      <div className="rounded-xl border border-border/70 bg-card/60 overflow-hidden glass-panel">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading stock issues...</div>
        ) : issues.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-muted-foreground">
            <CheckCircle className="h-10 w-10 text-emerald-400/40 mb-3" />
            <p className="text-sm font-medium">No stock discrepancies found</p>
            <p className="text-xs mt-1">
              {showUnresolvedOnly
                ? "All issues have been resolved."
                : "Stock counts are matching expected quantities."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-secondary/30 text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Drink</th>
                  <th className="py-3 px-4 text-right">Expected</th>
                  <th className="py-3 px-4 text-right">Counted</th>
                  <th className="py-3 px-4 text-right">Difference</th>
                  <th className="py-3 px-4 text-right">Est. Value</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs">
                {issues.map((issue, idx) => {
                  const countId = getCountId(issue);
                  const isResolving = resolvingId !== null && countId === resolvingId;

                  return (
                    <React.Fragment key={`${issue.product_id}-${issue.count_date}-${idx}`}>
                      <tr className={`hover:bg-secondary/20 transition-colors ${issue.investigated ? "opacity-60" : ""}`}>
                        <td className="py-3 px-4 font-mono text-muted-foreground">{issue.count_date}</td>
                        <td className="py-3 px-4 font-medium text-foreground">{issue.product_name}</td>
                        <td className="py-3 px-4 text-right font-mono">{issue.expected_stock}</td>
                        <td className="py-3 px-4 text-right font-mono font-semibold">{issue.actual_stock}</td>
                        <td className={`py-3 px-4 text-right font-mono font-bold ${issue.status === "short" ? "text-rose-400" : "text-blue-400"}`}>
                          {issue.difference > 0 ? `+${issue.difference}` : issue.difference}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-rose-400">
                          {issue.status === "short" ? formatLKR(issue.estimated_value_paise) : "—"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {issue.investigated ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/20 text-emerald-400">
                              Resolved
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                              issue.status === "short"
                                ? "bg-rose-500/20 text-rose-400"
                                : "bg-blue-500/20 text-blue-400"
                            }`}>
                              {issue.status === "short" ? "Shortage" : "Overage"}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {!issue.investigated && countId !== null && (
                            <button
                              onClick={() => { setResolvingId(countId); setResolveNotes(""); setResolveError(""); }}
                              className="px-2.5 py-1 rounded bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/30 text-xs font-medium transition"
                            >
                              Resolve
                            </button>
                          )}
                        </td>
                      </tr>
                      {/* Resolve Row */}
                      {isResolving && (
                        <tr>
                          <td colSpan={8} className="px-4 py-3 bg-secondary/20">
                            {resolveError && (
                              <p className="text-xs text-rose-400 mb-2">{resolveError}</p>
                            )}
                            <div className="flex items-center gap-3">
                              <input
                                type="text"
                                placeholder="Explanation of discrepancy (required)"
                                value={resolveNotes}
                                onChange={(e) => setResolveNotes(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-lg bg-secondary/50 border border-border text-xs text-foreground"
                              />
                              <button
                                onClick={() => {
                                  if (!resolveNotes.trim()) { setResolveError("Please enter an explanation"); return; }
                                  if (countId) resolveMutation.mutate({ countId, notes: resolveNotes });
                                }}
                                disabled={resolveMutation.isPending}
                                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition"
                              >
                                {resolveMutation.isPending ? "Saving..." : "Mark Resolved"}
                              </button>
                              <button
                                onClick={() => setResolvingId(null)}
                                className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-white transition"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="p-4 rounded-xl border border-border/40 bg-secondary/10 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">How stock issues are created</p>
        <p>A discrepancy appears here when the <strong>Daily Stock Count</strong> (in Soft Drinks Inventory) shows a different number than what the system expects based on purchases and sales.</p>
        <p>A <strong>shortage</strong> means fewer bottles were counted than expected — possible theft, breakage, or unrecorded sales.</p>
        <p>An <strong>overage</strong> means more bottles were counted than expected — possible double delivery or recording error.</p>
      </div>
    </div>
  );
};
