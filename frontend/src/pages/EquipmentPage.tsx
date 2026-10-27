/**
 * EquipmentPage — Track cue sticks, tables, PS4 hardware, repairs, and maintenance purchases.
 */
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wrench,
  Search,
  Filter,
  Plus,
  DollarSign,
  CheckCircle2,
  Gamepad2,
  CircleDot,
  X,
} from "lucide-react";
import { apiClient } from "@/api/client";
import { formatLKR, rupeesToPaise } from "@/lib/money";
import type { EquipmentPurchase, EquipmentPurchaseCreate, FinancialAccount } from "@/types";

export const EquipmentPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState<string>("cue_stick");
  const [itemName, setItemName] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [amountRs, setAmountRs] = useState("");
  const [supplier, setSupplier] = useState("");
  const [paymentStatus] = useState<string>("paid");
  const [accountId, setAccountId] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const { data: accounts = [] } = useQuery<FinancialAccount[]>({
    queryKey: ["financialAccounts"],
    queryFn: apiClient.accounts.list,
  });

  const { data: purchases = [], isLoading } = useQuery<EquipmentPurchase[]>({
    queryKey: ["equipmentPurchases"],
    queryFn: () => apiClient.equipment.listPurchases(),
  });

  const createPurchaseMutation = useMutation({
    mutationFn: (data: EquipmentPurchaseCreate) => apiClient.equipment.createPurchase(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipmentPurchases"] });
      queryClient.invalidateQueries({ queryKey: ["financialAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["trialBalance"] });
      setSuccessMsg("Equipment purchase recorded and posted successfully!");
      setShowCreateModal(false);
      resetForm();
      setTimeout(() => setSuccessMsg(""), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to record purchase");
    },
  });

  const resetForm = () => {
    setItemName("");
    setDescription("");
    setQuantity("1");
    setAmountRs("");
    setSupplier("");
    setNotes("");
    setAccountId("");
    setErrorMsg("");
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountPaise = rupeesToPaise(parseFloat(amountRs) || 0);
    if (amountPaise <= 0) {
      setErrorMsg("Amount must be greater than zero");
      return;
    }
    if (!itemName.trim()) {
      setErrorMsg("Item name is required");
      return;
    }

    createPurchaseMutation.mutate({
      purchase_date: purchaseDate,
      category,
      item_name: itemName.trim(),
      description: description.trim() || undefined,
      quantity: Math.max(1, parseInt(quantity, 10) || 1),
      amount_paise: amountPaise,
      supplier: supplier.trim() || undefined,
      payment_status: paymentStatus,
      account_id: accountId ? Number(accountId) : undefined,
      notes: notes.trim() || undefined,
    });
  };

  // Filtered
  const filteredPurchases = purchases.filter((p: EquipmentPurchase) => {
    const matchesSearch =
      p.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      Boolean(p.supplier && p.supplier.toLowerCase().includes(searchTerm.toLowerCase())) ||
      p.reference.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === "all" ? true : p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // Summary Metrics
  const totalSpend = purchases.reduce((sum: number, p: EquipmentPurchase) => sum + p.amount_paise, 0);
  const cueSpend = purchases
    .filter((p: EquipmentPurchase) => p.category === "cue_stick" || p.category === "accessory")
    .reduce((sum: number, p: EquipmentPurchase) => sum + p.amount_paise, 0);
  const ps4Spend = purchases
    .filter((p: EquipmentPurchase) => p.category === "ps4" || p.category === "controller")
    .reduce((sum: number, p: EquipmentPurchase) => sum + p.amount_paise, 0);
  const tableSpend = purchases
    .filter((p: EquipmentPurchase) => p.category === "table" || p.category === "repair")
    .reduce((sum: number, p: EquipmentPurchase) => sum + p.amount_paise, 0);

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case "cue_stick":
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Cue Stick</span>;
      case "table":
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20">Pool Table</span>;
      case "ps4":
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">PS4 Console</span>;
      case "controller":
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Controller</span>;
      case "repair":
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Repair / Service</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-300 border border-slate-500/20">{cat}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Wrench className="w-6 h-6 text-amber-400" />
            Equipment Purchases & Repairs
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track cue sticks, table maintenance, PS4 hardware, and repairs (separate from customer damage recoveries)
          </p>
        </div>

        <button
          onClick={() => {
            setShowCreateModal(true);
            resetForm();
          }}
          className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition flex items-center gap-2 shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Record Purchase / Repair
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
            <span className="text-xs font-medium uppercase tracking-wider">Total Equipment Spend</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-white">{formatLKR(totalSpend)}</p>
          <p className="text-xs text-slate-500 mt-1">{purchases.length} total purchase(s)</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Cue Sticks & Tips</span>
            <CircleDot className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400">{formatLKR(cueSpend)}</p>
          <p className="text-xs text-slate-500 mt-1">Cues, chalk, tips & accessories</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Table Maintenance</span>
            <Wrench className="w-4 h-4 text-teal-400" />
          </div>
          <p className="text-2xl font-bold text-teal-400">{formatLKR(tableSpend)}</p>
          <p className="text-xs text-slate-500 mt-1">Cloth, cushions & slate repairs</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">PS4 Hardware & Pads</span>
            <Gamepad2 className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-bold text-sky-400">{formatLKR(ps4Spend)}</p>
          <p className="text-xs text-slate-500 mt-1">Controllers, games & cables</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search item, supplier or ref..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="flex bg-slate-900/80 p-1 rounded-lg border border-slate-700 text-xs">
            {["all", "cue_stick", "table", "ps4", "controller", "repair"].map(catKey => (
              <button
                key={catKey}
                onClick={() => setSelectedCategory(catKey)}
                className={`px-3 py-1.5 rounded-md font-medium transition whitespace-nowrap ${
                  selectedCategory === catKey
                    ? "bg-amber-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {catKey === "all" ? "All" : catKey.replace("_", " ").toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Equipment Table */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Ref</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Item & Description</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4 text-right">Cost</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Loading equipment records...
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No equipment purchases found matching your filter.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((p: EquipmentPurchase) => (
                  <tr key={p.id} className="hover:bg-slate-750/30 transition">
                    <td className="py-3 px-4 font-mono text-xs font-medium text-slate-300">
                      {p.reference}
                    </td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap text-xs">
                      {p.purchase_date}
                    </td>
                    <td className="py-3 px-4">
                      {getCategoryBadge(p.category)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-white">{p.item_name}</div>
                      {p.description && (
                        <div className="text-xs text-slate-500 truncate max-w-xs">{p.description}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-300">
                      {p.quantity}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs">
                      {p.supplier || "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-white">
                      {formatLKR(p.amount_paise)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                        {p.payment_status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Equipment Purchase Modal */}
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
              <Wrench className="w-5 h-5 text-amber-400" />
              Record Equipment Purchase / Repair
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Add new sticks, table repairs, hardware, or replacement parts
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
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                  >
                    <option value="cue_stick">Cue Stick</option>
                    <option value="table">Pool Table Cloth / Cushion</option>
                    <option value="ps4">PS4 Console / Unit</option>
                    <option value="controller">PS4 Controller / Pad</option>
                    <option value="accessory">Accessory (Tips, Chalk, Balls)</option>
                    <option value="repair">General Service & Repair</option>
                    <option value="other">Other Equipment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Purchase Date *
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={e => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={e => setItemName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                  placeholder="e.g. 58-inch 2-Piece Maple Cue Stick"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Total Amount (Rs.) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={amountRs}
                    onChange={e => setAmountRs(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                    placeholder="e.g. 15000"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Supplier / Vendor
                  </label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={e => setSupplier(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                    placeholder="e.g. Snooker World Colombo"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Paid From Account
                  </label>
                  <select
                    value={accountId}
                    onChange={e => setAccountId(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Default: Cash in Hand</option>
                    {accounts.map((a: FinancialAccount) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description / Specification
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                  placeholder="e.g. Heavy duty break cue with Kamui tip"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Additional Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                  placeholder="Warranty info, serial numbers..."
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
                  disabled={createPurchaseMutation.isPending}
                  className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition shadow-sm disabled:opacity-50"
                >
                  {createPurchaseMutation.isPending ? "Recording..." : "Save Equipment Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
