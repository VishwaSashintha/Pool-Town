import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Coffee,
  Plus,
  Package,
  AlertCircle,
  X,
  ClipboardList,
  Truck,
  Edit2,
  CheckCircle,
} from "lucide-react";
import { formatLKR, rupeesToPaise, paiseToRupees } from "@/lib/money";

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
  notes?: string | null;
}

export const SoftDrinksInventoryPage: React.FC = () => {
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"products" | "stock-count" | "delivery">("products");
  const [editingProduct, setEditingProduct] = useState<DrinkProduct | null>(null);

  // Add product form
  const [newName, setNewName] = useState("");
  const [newPurchaseCost, setNewPurchaseCost] = useState<number>(0);
  const [newSellingPrice, setNewSellingPrice] = useState<number>(0);
  const [newOpeningStock, setNewOpeningStock] = useState<number>(0);
  const [newOpeningDate, setNewOpeningDate] = useState(new Date().toISOString().split("T")[0]);
  const [addError, setAddError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Stock count state
  const [countDate, setCountDate] = useState(new Date().toISOString().split("T")[0]);
  const [countEntries, setCountEntries] = useState<Record<number, number>>({});
  const [countError, setCountError] = useState("");
  const [countSuccess, setCountSuccess] = useState("");

  // Delivery state
  const [deliveryProductId, setDeliveryProductId] = useState<number | null>(null);
  const [deliveryQty, setDeliveryQty] = useState<number>(1);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split("T")[0]);
  const [deliveryCost, setDeliveryCost] = useState<number>(0);
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [deliveryError, setDeliveryError] = useState("");
  const [deliverySuccess, setDeliverySuccess] = useState("");

  const { data: products = [], isLoading } = useQuery<DrinkProduct[]>({
    queryKey: ["drinks-products"],
    queryFn: () => apiRequest<DrinkProduct[]>("/drinks/products"),
  });

  const addProductMutation = useMutation({
    mutationFn: () =>
      apiRequest<DrinkProduct>("/drinks/products", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          purchase_cost_paise: rupeesToPaise(newPurchaseCost),
          selling_price_paise: rupeesToPaise(newSellingPrice),
          opening_stock: newOpeningStock,
          opening_date: newOpeningDate,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drinks-products"] });
      setNewName("");
      setNewPurchaseCost(0);
      setNewSellingPrice(0);
      setNewOpeningStock(0);
      setShowAddForm(false);
      setAddError("");
    },
    onError: (e: any) => setAddError(e.message),
  });

  const updateProductMutation = useMutation({
    mutationFn: (data: { id: number; name: string; purchase_cost_paise: number; selling_price_paise: number }) =>
      apiRequest<DrinkProduct>(`/drinks/products/${data.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: data.name,
          purchase_cost_paise: data.purchase_cost_paise,
          selling_price_paise: data.selling_price_paise,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drinks-products"] });
      setEditingProduct(null);
    },
    onError: (e: any) => setAddError(e.message),
  });

  const stockCountMutation = useMutation({
    mutationFn: () => {
      const entries = Object.entries(countEntries)
        .filter(([, qty]) => qty >= 0)
        .map(([pid, qty]) => ({ product_id: Number(pid), counted_quantity: qty }));
      if (entries.length === 0) throw new Error("Enter at least one count");
      return apiRequest("/drinks/stock-count", {
        method: "POST",
        body: JSON.stringify({ count_date: countDate, entries }),
      });
    },
    onSuccess: () => {
      setCountSuccess("Stock count saved successfully!");
      setCountEntries({});
      setCountError("");
      setTimeout(() => setCountSuccess(""), 3000);
    },
    onError: (e: any) => setCountError(e.message),
  });

  const deliveryMutation = useMutation({
    mutationFn: () => {
      if (!deliveryProductId) throw new Error("Select a product");
      return apiRequest("/drinks/stock-delivery", {
        method: "POST",
        body: JSON.stringify({
          product_id: deliveryProductId,
          delivery_date: deliveryDate,
          quantity: deliveryQty,
          unit_cost_paise: deliveryCost > 0 ? rupeesToPaise(deliveryCost) : null,
          notes: deliveryNotes || null,
        }),
      });
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["drinks-products"] });
      setDeliverySuccess(`Delivery recorded. New stock: ${data.new_stock}`);
      setDeliveryQty(1);
      setDeliveryCost(0);
      setDeliveryNotes("");
      setDeliveryError("");
      setTimeout(() => setDeliverySuccess(""), 3000);
    },
    onError: (e: any) => setDeliveryError(e.message),
  });

  const totalStockValue = products.reduce(
    (sum, p) => sum + p.current_stock * p.purchase_cost_paise,
    0
  );
  const lowStockProducts = products.filter((p) => p.current_stock <= 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Soft Drinks Inventory</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Manage drink flavours, track stock, and record deliveries
          </p>
        </div>
        <button
          onClick={() => { setShowAddForm(true); setActiveTab("products"); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm transition shadow-md shadow-amber-950/40 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Add Drink</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-border/70 bg-card/60 glass-panel">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-medium mb-1">
            <Coffee className="h-4 w-4" />
            <span>Total Flavours</span>
          </div>
          <div className="text-2xl font-bold font-numeric tabular-nums text-white">{products.length}</div>
          <p className="text-xs text-muted-foreground">{products.filter(p => p.is_active).length} active</p>
        </div>
        <div className="p-4 rounded-xl border border-border/70 bg-card/60 glass-panel">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium mb-1">
            <Package className="h-4 w-4" />
            <span>Total Stock Value</span>
          </div>
          <div className="text-2xl font-bold font-numeric tabular-nums text-white">{formatLKR(totalStockValue)}</div>
          <p className="text-xs text-muted-foreground">At purchase cost</p>
        </div>
        <div className="p-4 rounded-xl border border-border/70 bg-card/60 glass-panel">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-medium mb-1">
            <AlertCircle className="h-4 w-4" />
            <span>Low Stock Alert</span>
          </div>
          <div className="text-2xl font-bold font-numeric tabular-nums text-white">{lowStockProducts.length}</div>
          <p className="text-xs text-muted-foreground">5 bottles or fewer</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/60">
        {[
          { id: "products", label: "Flavours & Prices", icon: Coffee },
          { id: "stock-count", label: "Daily Stock Count", icon: ClipboardList },
          { id: "delivery", label: "New Delivery", icon: Truck },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition -mb-px ${
                activeTab === tab.id
                  ? "border-amber-400 text-amber-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab: Products */}
      {activeTab === "products" && (
        <div className="space-y-4">
          {/* Add Form */}
          {showAddForm && (
            <div className="p-5 rounded-xl border border-amber-500/30 bg-card/80 glass-panel space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white text-sm">Add New Drink</h3>
                <button onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {addError && (
                <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs">
                  {addError}
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div className="md:col-span-3">
                  <label className="block text-muted-foreground mb-1">Drink Name / Flavour</label>
                  <input
                    type="text"
                    placeholder="e.g. Coca-Cola 330ml, Sprite, Water"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Purchase cost (Rs.)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={newPurchaseCost}
                    onChange={(e) => setNewPurchaseCost(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Selling price (Rs.)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={newSellingPrice}
                    onChange={(e) => setNewSellingPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Opening stock (bottles)</label>
                  <input
                    type="number"
                    min={0}
                    value={newOpeningStock}
                    onChange={(e) => setNewOpeningStock(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Opening stock date</label>
                  <input
                    type="date"
                    value={newOpeningDate}
                    onChange={(e) => setNewOpeningDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border font-mono text-xs"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAddForm(false)} className="px-4 py-1.5 text-xs border border-border rounded-lg hover:bg-secondary/40 transition">
                  Cancel
                </button>
                <button
                  onClick={() => addProductMutation.mutate()}
                  disabled={addProductMutation.isPending || !newName.trim()}
                  className="px-4 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition"
                >
                  {addProductMutation.isPending ? "Adding..." : "Add Drink"}
                </button>
              </div>
            </div>
          )}

          {/* Products Table */}
          <div className="rounded-xl border border-border/70 bg-card/60 overflow-hidden glass-panel">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading drinks...</div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 text-muted-foreground">
                <Coffee className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium">No drinks added yet</p>
                <p className="text-xs mt-1">Click "Add Drink" to get started.</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-secondary/30 text-muted-foreground border-b border-border/60">
                  <tr>
                    <th className="py-3 px-4">Drink / Flavour</th>
                    <th className="py-3 px-4 text-right">Buy Cost</th>
                    <th className="py-3 px-4 text-right">Sell Price</th>
                    <th className="py-3 px-4 text-right">Margin</th>
                    <th className="py-3 px-4 text-right">Stock</th>
                    <th className="py-3 px-4 text-right">Value</th>
                    <th className="py-3 px-4 text-right">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-xs">
                  {products.map((p) => {
                    const margin = p.selling_price_paise - p.purchase_cost_paise;
                    const isEditing = editingProduct?.id === p.id;
                    return (
                      <tr key={p.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="py-3 px-4 font-medium text-foreground">
                          {p.name}
                          {p.current_stock <= 5 && (
                            <span className="ml-2 text-[10px] text-rose-400 font-medium">⚠ Low Stock</span>
                          )}
                        </td>
                        {isEditing ? (
                          <>
                            <td className="py-2 px-4">
                              <input
                                type="number"
                                min={0}
                                value={paiseToRupees(editingProduct.purchase_cost_paise)}
                                onChange={(e) =>
                                  setEditingProduct({ ...editingProduct, purchase_cost_paise: rupeesToPaise(Number(e.target.value)) })
                                }
                                className="w-20 px-2 py-1 rounded bg-secondary/50 border border-border font-mono text-xs text-right"
                              />
                            </td>
                            <td className="py-2 px-4">
                              <input
                                type="number"
                                min={0}
                                value={paiseToRupees(editingProduct.selling_price_paise)}
                                onChange={(e) =>
                                  setEditingProduct({ ...editingProduct, selling_price_paise: rupeesToPaise(Number(e.target.value)) })
                                }
                                className="w-20 px-2 py-1 rounded bg-secondary/50 border border-border font-mono text-xs text-right"
                              />
                            </td>
                            <td className="py-2 px-4 text-right font-mono">—</td>
                            <td className="py-2 px-4 text-right font-mono">{p.current_stock}</td>
                            <td className="py-2 px-4 text-right font-mono">—</td>
                            <td className="py-2 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() =>
                                    updateProductMutation.mutate({
                                      id: editingProduct.id,
                                      name: editingProduct.name,
                                      purchase_cost_paise: editingProduct.purchase_cost_paise,
                                      selling_price_paise: editingProduct.selling_price_paise,
                                    })
                                  }
                                  className="p-1 rounded bg-emerald-600/30 text-emerald-400 hover:bg-emerald-600/50 transition"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setEditingProduct(null)}
                                  className="p-1 rounded bg-secondary/40 text-muted-foreground hover:text-white transition"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                              {formatLKR(p.purchase_cost_paise)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-foreground">
                              {formatLKR(p.selling_price_paise)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-emerald-400">
                              +{formatLKR(margin)}
                            </td>
                            <td className={`py-3 px-4 text-right font-mono font-bold ${p.current_stock <= 5 ? "text-rose-400" : "text-foreground"}`}>
                              {p.current_stock}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                              {formatLKR(p.current_stock * p.purchase_cost_paise)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => setEditingProduct(p)}
                                className="p-1 rounded hover:bg-secondary/40 text-muted-foreground hover:text-amber-400 transition"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab: Stock Count */}
      {activeTab === "stock-count" && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl border border-border/70 bg-card/60 glass-panel space-y-4">
            <div>
              <h3 className="font-semibold text-white text-sm mb-1">Daily Physical Stock Count</h3>
              <p className="text-xs text-muted-foreground">
                Count each drink physically and enter the actual number of bottles you see.
                This does <strong className="text-foreground">not</strong> add new stock — it records what is actually there.
              </p>
            </div>

            {countError && (
              <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs">
                {countError}
              </div>
            )}
            {countSuccess && (
              <div className="p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                {countSuccess}
              </div>
            )}

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Count Date</label>
              <input
                type="date"
                value={countDate}
                onChange={(e) => setCountDate(e.target.value)}
                className="px-3 py-2 rounded-lg bg-secondary/50 border border-border font-mono text-xs"
              />
            </div>

            {products.length === 0 ? (
              <p className="text-xs text-muted-foreground">No drinks configured. Add drinks first.</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-3 text-xs text-muted-foreground uppercase font-medium px-1 mb-1">
                  <span>Drink</span>
                  <span className="text-center">Expected Stock</span>
                  <span className="text-right">Actual Count</span>
                </div>
                {products.map((p) => {
                  const counted = countEntries[p.id];
                  const diff = counted !== undefined ? counted - p.current_stock : 0;
                  return (
                    <div key={p.id} className="grid grid-cols-3 items-center gap-3 px-1">
                      <span className="text-sm font-medium text-foreground">{p.name}</span>
                      <span className="text-center font-mono text-sm text-muted-foreground">{p.current_stock}</span>
                      <div className="flex items-center gap-2 justify-end">
                        {counted !== undefined && diff !== 0 && (
                          <span className={`text-xs font-mono font-bold ${diff > 0 ? "text-blue-400" : "text-rose-400"}`}>
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        )}
                        <input
                          type="number"
                          min={0}
                          placeholder="Count"
                          value={counted ?? ""}
                          onChange={(e) => setCountEntries({ ...countEntries, [p.id]: Number(e.target.value) })}
                          className="w-20 px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border font-mono text-sm text-right"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => stockCountMutation.mutate()}
                disabled={stockCountMutation.isPending || Object.keys(countEntries).length === 0}
                className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs transition"
              >
                {stockCountMutation.isPending ? "Saving..." : "Save Stock Count"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Delivery */}
      {activeTab === "delivery" && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl border border-border/70 bg-card/60 glass-panel space-y-4">
            <div>
              <h3 className="font-semibold text-white text-sm mb-1">Record New Stock Delivery</h3>
              <p className="text-xs text-muted-foreground">
                Use this when new stock arrives from your supplier. This increases the stock count.
              </p>
            </div>

            {deliveryError && (
              <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs">
                {deliveryError}
              </div>
            )}
            {deliverySuccess && (
              <div className="p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                {deliverySuccess}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1">Delivery Date</label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Drink / Flavour</label>
                <select
                  value={deliveryProductId ?? ""}
                  onChange={(e) => {
                    const pid = Number(e.target.value);
                    setDeliveryProductId(pid || null);
                    const prod = products.find((p) => p.id === pid);
                    if (prod) setDeliveryCost(paiseToRupees(prod.purchase_cost_paise));
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-xs text-foreground"
                >
                  <option value="">Select drink...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Quantity received (bottles)</label>
                <input
                  type="number"
                  min={1}
                  value={deliveryQty}
                  onChange={(e) => setDeliveryQty(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">
                  Purchase cost per bottle (Rs.) <span className="text-[10px] text-muted-foreground/70">optional</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={deliveryCost}
                  onChange={(e) => setDeliveryCost(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border font-mono text-xs"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-muted-foreground mb-1">Notes (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Weekly delivery from XYZ Beverages"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-xs text-foreground"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => deliveryMutation.mutate()}
                disabled={deliveryMutation.isPending || !deliveryProductId || deliveryQty < 1}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition"
              >
                <Truck className="h-4 w-4" />
                {deliveryMutation.isPending ? "Recording..." : "Record Delivery"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
