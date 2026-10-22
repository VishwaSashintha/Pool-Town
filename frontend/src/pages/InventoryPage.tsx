import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { api } from "@/api/client";
import { MoneyDisplay } from "@/components/common/MoneyDisplay";
import { rupeesToPaise } from "@/lib/money";

export const InventoryPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("bottle");
  const [sellingPriceRupees, setSellingPriceRupees] = useState<number>(150);
  const [costPriceRupees, setCostPriceRupees] = useState<number>(100);
  const [openingStock, setOpeningStock] = useState<number>(24);
  const [reorderLevel, setReorderLevel] = useState<number>(10);
  const [error, setError] = useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.inventory.listProducts(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.inventory.createProduct({
        name: name.trim(),
        unit: unit.trim(),
        selling_price_paise: rupeesToPaise(sellingPriceRupees),
        average_cost_paise: rupeesToPaise(costPriceRupees),
        opening_stock: Number(openingStock),
        reorder_level: Number(reorderLevel),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsAddModalOpen(false);
      setName("");
      setSellingPriceRupees(150);
      setCostPriceRupees(100);
      setOpeningStock(24);
      setError("");
    },
    onError: (err: any) => {
      setError(err.message || "Failed to create product");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Drinks & Inventory Catalogue</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Track stock on hand, weighted-average cost, and beverage sales
          </p>
        </div>

        <button
          onClick={() => {
            setError("");
            setIsAddModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition shadow-md shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Add Product</span>
        </button>
      </div>

      {/* Products Table */}
      <div className="rounded-xl border border-border/70 bg-card/60 overflow-hidden glass-panel">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading inventory...</div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <Package className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium">No products in inventory</p>
            <p className="text-xs mt-1">Click "Add Product" to add bottled drinks or snacks.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-secondary/30 text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Unit</th>
                  <th className="py-3 px-4">Selling Price</th>
                  <th className="py-3 px-4">Avg Cost</th>
                  <th className="py-3 px-4">Stock on Hand</th>
                  <th className="py-3 px-4">Reorder Level</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono text-xs">
                {products.map((p) => {
                  const isLow = p.current_stock <= p.reorder_level;
                  return (
                    <tr key={p.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="py-3.5 px-4 font-sans font-semibold text-foreground">
                        {p.name}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground">{p.unit}</td>
                      <td className="py-3.5 px-4 text-emerald-400 font-bold">
                        <MoneyDisplay paise={p.selling_price_paise} />
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground">
                        <MoneyDisplay paise={p.average_cost_paise} />
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-bold ${
                            isLow ? "text-amber-400" : "text-foreground"
                          }`}
                        >
                          {p.current_stock}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground">{p.reorder_level}</td>
                      <td className="py-3.5 px-4 font-sans">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400">
                            <AlertTriangle className="h-3 w-3" />
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Adequate
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Add Catalogue Product</h3>
                  <p className="text-xs text-muted-foreground">Drinks, snacks, or billiard items</p>
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
              <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs">
                {error}
              </div>
            )}

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sprite 300ml Glass"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Unit Type (e.g. bottle, can, pack, piece)
                </label>
                <input
                  type="text"
                  placeholder="bottle"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Selling Price (Rs.) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={sellingPriceRupees}
                    onChange={(e) => setSellingPriceRupees(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Unit Cost (Rs.)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={costPriceRupees}
                    onChange={(e) => setCostPriceRupees(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Opening Stock Units
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={openingStock}
                    onChange={(e) => setOpeningStock(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Reorder Minimum Level
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs font-mono"
                  />
                </div>
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
                {createMutation.isPending ? "Adding..." : "Save Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
