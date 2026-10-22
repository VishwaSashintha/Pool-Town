import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Receipt, Plus, X } from "lucide-react";
import { api } from "@/api/client";
import { MoneyDisplay } from "@/components/common/MoneyDisplay";
import { rupeesToPaise } from "@/lib/money";

export const ExpensesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form states
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [amountRupees, setAmountRupees] = useState<number>(0);
  const [payee, setPayee] = useState("");
  const [error, setError] = useState("");

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => api.expenses.list(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: () => api.expenses.listCategories(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.expenses.create({
        expense_date: expenseDate,
        category_id: categoryId || categories[0]?.id || 1,
        description: description.trim(),
        amount_paise: rupeesToPaise(amountRupees),
        payee: payee.trim() || undefined,
        is_asset: false,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setIsAddModalOpen(false);
      setDescription("");
      setAmountRupees(0);
      setPayee("");
      setError("");
    },
    onError: (err: any) => {
      setError(err.message || "Failed to record expense");
    },
  });

  const totalExpensesPaise = expenses.reduce((acc, e) => acc + e.amount_paise, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Operating Expenses</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Rent, utilities, maintenance, and operating bill ledger
          </p>
        </div>

        <button
          onClick={() => {
            if (categories.length > 0 && !categoryId) {
              setCategoryId(categories[0].id);
            }
            setError("");
            setIsAddModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition shadow-md shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Record Expense Bill</span>
        </button>
      </div>

      {/* Summary card */}
      <div className="p-4 rounded-xl border border-border/70 bg-card/40 glass-panel flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Total Posted Expenses:</span>
        <span className="text-lg font-bold font-mono text-rose-400">
          <MoneyDisplay paise={totalExpensesPaise} />
        </span>
      </div>

      {/* Expenses Table */}
      <div className="rounded-xl border border-border/70 bg-card/60 overflow-hidden glass-panel">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading expenses...</div>
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <Receipt className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium">No expenses recorded</p>
            <p className="text-xs mt-1">Click "Record Expense Bill" to log electricity, rent, or supplies.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-secondary/30 text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="py-3 px-4">Ref</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Payee</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono text-xs">
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-foreground">{e.reference}</td>
                    <td className="py-3.5 px-4 text-muted-foreground">{e.expense_date}</td>
                    <td className="py-3.5 px-4 font-sans font-medium text-emerald-400">
                      {e.category_name || "General"}
                    </td>
                    <td className="py-3.5 px-4 font-sans text-foreground">{e.description}</td>
                    <td className="py-3.5 px-4 font-sans text-muted-foreground">{e.payee || "—"}</td>
                    <td className="py-3.5 px-4 font-bold text-foreground">
                      <MoneyDisplay paise={e.amount_paise} />
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-secondary text-muted-foreground">
                        {e.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Record Expense Bill</h3>
                  <p className="text-xs text-muted-foreground">Posts DR Expense, CR Accounts Payable</p>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Expense Date
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Category
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Electricity CEB Bill for January"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Amount (Rs.) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={amountRupees}
                    onChange={(e) => setAmountRupees(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Payee / Supplier
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CEB, Landlord"
                    value={payee}
                    onChange={(e) => setPayee(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs"
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
                disabled={!description.trim() || amountRupees <= 0 || createMutation.isPending}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition shadow-sm disabled:opacity-50"
              >
                {createMutation.isPending ? "Posting..." : "Confirm & Post Bill"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
