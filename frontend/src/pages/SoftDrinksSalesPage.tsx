import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShoppingCart,
  Calendar,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Coffee,
  Plus,
  Minus,
  Ban,
  CheckCircle2,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { formatLKR } from "@/lib/money";
import { apiClient } from "@/api/client";

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

interface DrinkProduct {
  id: number;
  name: string;
  purchase_cost_paise: number;
  selling_price_paise: number;
  current_stock: number;
  is_active: boolean;
}

interface SaleRecord {
  id: number;
  reference: string;
  sale_date: string;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price_paise: number;
  total_revenue_paise: number;
  unit_cost_paise: number;
  total_cogs_paise: number;
  is_cancelled?: boolean;
}

export const SoftDrinksSalesPage: React.FC = () => {
  const qc = useQueryClient();

  const today = new Date().toISOString().split("T")[0];
  const [saleDate, setSaleDate] = useState(today);
  const [viewDate, setViewDate] = useState(today);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      await apiClient.reports.downloadExport("drinks");
    } catch (err: any) {
      alert(err.message || "Failed to download Excel file");
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Cancel sale states
  const [cancelSale, setCancelSale] = useState<SaleRecord | null>(null);
  const [cancelAdminUser, setCancelAdminUser] = useState("");
  const [cancelAdminPass, setCancelAdminPass] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelSuccess, setCancelSuccess] = useState("");

  const { data: products = [] } = useQuery<DrinkProduct[]>({
    queryKey: ["drinks-products"],
    queryFn: () => apiRequest<DrinkProduct[]>("/drinks/products"),
  });

  const { data: salesHistory = [], isLoading: isLoadingSales } = useQuery<SaleRecord[]>({
    queryKey: ["drinks-sales", viewDate],
    queryFn: () => apiRequest<SaleRecord[]>(`/drinks/sales${viewDate ? `?sale_date=${viewDate}` : ""}`),
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      const entries = Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([pid, qty]) => ({ product_id: Number(pid), quantity_sold: qty }));
      if (entries.length === 0) throw new Error("Enter at least one sale quantity");
      return apiRequest("/drinks/sales", {
        method: "POST",
        body: JSON.stringify({ sale_date: saleDate, entries }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drinks-sales"] });
      qc.invalidateQueries({ queryKey: ["drinks-products"] });
      setQuantities({});
      setSubmitError("");
      setSubmitSuccess("Sales recorded successfully!");
      setTimeout(() => setSubmitSuccess(""), 4000);
    },
    onError: (e: any) => setSubmitError(e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: () => {
      if (!cancelSale) throw new Error("No sale selected");
      return apiRequest<{
        success: boolean;
        reference: string;
        status: string;
        quantity_restored: number;
        revenue_reversed_paise: number;
      }>(`/drinks/sales/${cancelSale.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({
          admin_username: cancelAdminUser.trim(),
          admin_password: cancelAdminPass,
          reason: cancelReason.trim() || undefined,
        }),
      });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["drinks-sales"] });
      qc.invalidateQueries({ queryKey: ["drinks-products"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["daily-report"] });
      setCancelSuccess(
        `Sale ${data.reference} cancelled successfully. ${data.quantity_restored} bottle(s) restored to stock and accounting reversed.`
      );
    },
    onError: (e: any) => setCancelError(e.message || "Failed to cancel sale. Please verify admin credentials."),
  });

  const totalRevenue = Object.entries(quantities).reduce((sum, [pid, qty]) => {
    const product = products.find((p) => p.id === Number(pid));
    return sum + (product ? product.selling_price_paise * qty : 0);
  }, 0);

  const totalCost = Object.entries(quantities).reduce((sum, [pid, qty]) => {
    const product = products.find((p) => p.id === Number(pid));
    return sum + (product ? product.purchase_cost_paise * qty : 0);
  }, 0);

  const totalProfit = totalRevenue - totalCost;
  const totalSalesItems = Object.values(quantities).reduce((sum, q) => sum + q, 0);

  // History summary (only active sales)
  const activeSales = salesHistory.filter((r) => !r.is_cancelled);
  const historySalesRevenue = activeSales.reduce((s, r) => s + r.total_revenue_paise, 0);
  const historySalesQty = activeSales.reduce((s, r) => s + r.quantity, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Soft Drinks Sales</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Record how many bottles of each drink were sold today
          </p>
        </div>

        <button
          onClick={handleExportExcel}
          disabled={isExportingExcel}
          className="px-3.5 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-sm font-medium border border-emerald-500/30 transition flex items-center gap-1.5 shadow-sm self-start sm:self-auto disabled:opacity-50"
          title="Export Soft Drinks to Excel (.xlsx)"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>{isExportingExcel ? "Exporting..." : "Export Excel (.xlsx)"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Daily Entry Form */}
        <div className="lg:col-span-3 space-y-4">
          <div className="p-5 rounded-xl border border-border/70 bg-card/60 glass-panel space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm">Record Sales for a Day</h3>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-400" />
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="px-3 py-1.5 rounded-md bg-secondary/50 border border-border/60 text-xs font-mono text-foreground"
                />
              </div>
            </div>

            {submitError && (
              <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {submitError}
              </div>
            )}
            {submitSuccess && (
              <div className="p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0" />
                {submitSuccess}
              </div>
            )}

            {products.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <Coffee className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm">No drinks configured yet.</p>
                <p className="text-xs">Go to Soft Drinks Inventory to add flavours first.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-12 text-xs text-muted-foreground uppercase font-medium px-1 mb-2">
                  <span className="col-span-5">Drink</span>
                  <span className="col-span-2 text-center">Stock</span>
                  <span className="col-span-2 text-right">Price</span>
                  <span className="col-span-3 text-right">Qty Sold</span>
                </div>
                {products.map((p) => {
                  const qty = quantities[p.id] ?? 0;
                  const lineRevenue = p.selling_price_paise * qty;
                  return (
                    <div
                      key={p.id}
                      className={`grid grid-cols-12 items-center gap-2 px-3 py-2.5 rounded-xl border transition ${
                        qty > 0
                          ? "border-amber-500/40 bg-amber-500/5"
                          : "border-border/40 bg-secondary/10"
                      }`}
                    >
                      <div className="col-span-5">
                        <p className="text-sm font-medium text-foreground leading-tight">{p.name}</p>
                        {qty > 0 && (
                          <p className="text-[10px] text-amber-400 font-mono">
                            = {formatLKR(lineRevenue)}
                          </p>
                        )}
                      </div>
                      <span className={`col-span-2 text-center text-xs font-mono ${p.current_stock <= 5 ? "text-rose-400" : "text-muted-foreground"}`}>
                        {p.current_stock}
                      </span>
                      <span className="col-span-2 text-right text-xs font-mono text-muted-foreground">
                        {formatLKR(p.selling_price_paise)}
                      </span>
                      <div className="col-span-3 flex items-center justify-end gap-1">
                        <button
                          onClick={() => setQuantities({ ...quantities, [p.id]: Math.max(0, qty - 1) })}
                          className="h-6 w-6 rounded-md bg-secondary/60 hover:bg-secondary border border-border/60 flex items-center justify-center text-muted-foreground hover:text-white transition"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={p.current_stock}
                          value={qty || ""}
                          placeholder="0"
                          onChange={(e) =>
                            setQuantities({ ...quantities, [p.id]: Math.max(0, Number(e.target.value)) })
                          }
                          className="w-14 text-center px-1 py-1 rounded-md bg-secondary/50 border border-border font-mono text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        <button
                          onClick={() =>
                            setQuantities({ ...quantities, [p.id]: Math.min(p.current_stock, qty + 1) })
                          }
                          className="h-6 w-6 rounded-md bg-secondary/60 hover:bg-secondary border border-border/60 flex items-center justify-center text-muted-foreground hover:text-white transition"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sale Summary */}
            {totalSalesItems > 0 && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Total bottles sold:</span>
                  <span className="font-bold font-numeric tabular-nums text-foreground">{totalSalesItems}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Total cost of goods:</span>
                  <span className="font-numeric font-bold tabular-nums">{formatLKR(totalCost)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t border-amber-500/30 pt-2">
                  <span className="text-foreground">Total revenue:</span>
                  <span className="text-amber-400 font-numeric font-bold tabular-nums">{formatLKR(totalRevenue)}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>Gross profit:</span>
                  <span className="font-bold font-numeric tabular-nums">{formatLKR(totalProfit)}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || totalSalesItems === 0}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs transition disabled:opacity-50"
              >
                <ShoppingCart className="h-4 w-4" />
                {submitMutation.isPending ? "Recording..." : "Record Sales"}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Sales History */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-5 rounded-xl border border-border/70 bg-card/60 glass-panel space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm">Sales History</h3>
              <input
                type="date"
                value={viewDate}
                onChange={(e) => setViewDate(e.target.value)}
                className="px-2 py-1 rounded-md bg-secondary/50 border border-border/60 text-xs font-mono text-foreground"
              />
            </div>

            {historySalesRevenue > 0 && (
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/60 space-y-1 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total sold:</span>
                  <span className="font-bold text-foreground">{historySalesQty} bottles</span>
                </div>
                <div className="flex justify-between font-bold text-amber-400">
                  <span>Total revenue:</span>
                  <span>{formatLKR(historySalesRevenue)}</span>
                </div>
              </div>
            )}

            {isLoadingSales ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : salesHistory.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-muted-foreground">
                <TrendingUp className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs">No sales recorded for this date.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {salesHistory.map((s) => (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition ${
                      s.is_cancelled
                        ? "bg-secondary/10 border-border/30 opacity-60"
                        : "bg-secondary/20 border-border/40"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className={`font-medium ${s.is_cancelled ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {s.product_name}
                        </p>
                        {s.is_cancelled && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-500/20 text-rose-400 font-medium">
                            Cancelled
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground font-mono">
                        {s.quantity} × {formatLKR(s.unit_price_paise)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono font-bold ${s.is_cancelled ? "line-through text-muted-foreground" : "text-amber-400"}`}>
                        {formatLKR(s.total_revenue_paise)}
                      </span>
                      {!s.is_cancelled && (
                        <button
                          onClick={() => {
                            setCancelSale(s);
                            setCancelAdminUser("");
                            setCancelAdminPass("");
                            setCancelReason("");
                            setCancelError("");
                            setCancelSuccess("");
                          }}
                          title="Cancel Sale (Admin)"
                          className="p-1 rounded hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 border border-transparent hover:border-rose-500/30 transition text-xs"
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Cancel Drink Sale Modal ────────────────────────────────────────── */}
      {cancelSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
                  <Ban className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Cancel Drink Sale</h3>
                  <p className="text-xs text-muted-foreground">{cancelSale.reference}</p>
                </div>
              </div>
              <button
                onClick={() => { setCancelSale(null); setCancelSuccess(""); setCancelError(""); }}
                className="text-muted-foreground hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {cancelSuccess ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="p-3 rounded-full bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <p className="text-sm text-emerald-300 text-center font-medium">{cancelSuccess}</p>
                <button
                  onClick={() => { setCancelSale(null); setCancelSuccess(""); }}
                  className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs space-y-1">
                  <p className="font-semibold text-rose-300">⚠ Safe Cancellation Actions</p>
                  <ul className="list-disc list-inside text-rose-300/80 space-y-0.5">
                    <li>Restores <strong>{cancelSale.quantity} bottle(s)</strong> of {cancelSale.product_name} to inventory stock</li>
                    <li>Reverses revenue journal entry ({formatLKR(cancelSale.total_revenue_paise)})</li>
                    <li>Reverses Cost of Goods Sold (COGS) journal entry</li>
                    <li>Maintains double-entry ledger integrity</li>
                  </ul>
                </div>

                <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-xs space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Product:</span>
                    <span className="text-foreground font-sans font-medium">{cancelSale.product_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quantity:</span>
                    <span className="text-foreground">{cancelSale.quantity} bottles</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Revenue:</span>
                    <span className="text-amber-400 font-bold">{formatLKR(cancelSale.total_revenue_paise)}</span>
                  </div>
                </div>

                {cancelError && (
                  <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{cancelError}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Admin Username *</label>
                      <input
                        type="text"
                        value={cancelAdminUser}
                        onChange={(e) => setCancelAdminUser(e.target.value)}
                        placeholder="admin"
                        className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Admin Password *</label>
                      <input
                        type="password"
                        value={cancelAdminPass}
                        onChange={(e) => setCancelAdminPass(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Reason (Optional)</label>
                    <input
                      type="text"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="e.g. Wrong quantity entered, customer returned drink"
                      className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => { setCancelSale(null); setCancelError(""); }}
                    className="px-4 py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary/40 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCancelError(""); cancelMutation.mutate(); }}
                    disabled={!cancelAdminUser.trim() || !cancelAdminPass.trim() || cancelMutation.isPending}
                    className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition shadow-sm disabled:opacity-50"
                  >
                    {cancelMutation.isPending ? "Cancelling..." : "Confirm Cancellation"}
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

