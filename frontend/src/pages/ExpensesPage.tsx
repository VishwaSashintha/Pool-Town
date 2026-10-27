import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Receipt, Plus, X, CreditCard, CheckCircle2, Clock, AlertCircle, FileSpreadsheet } from "lucide-react";
import { api } from "@/api/client";
import type { ExpensePaymentCreateInput } from "@/api/client";
import { MoneyDisplay } from "@/components/common/MoneyDisplay";
import { rupeesToPaise, paiseToRupees } from "@/lib/money";

export const ExpensesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [payBillExpenseId, setPayBillExpenseId] = useState<number | null>(null);
  const [payBillExpense, setPayBillExpense] = useState<any>(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      await api.reports.downloadExport("expenses");
    } catch (err: any) {
      alert(err.message || "Failed to download Excel file");
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Add expense form states
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [amountRupees, setAmountRupees] = useState<number>(0);
  const [payee, setPayee] = useState("");
  const [error, setError] = useState("");

  // Pay bill form states
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payMethod, setPayMethod] = useState<"cash" | "bank_transfer" | "savings">("cash");
  const [payAmountRupees, setPayAmountRupees] = useState<number>(0);
  const [payNotes, setPayNotes] = useState("");
  const [payError, setPayError] = useState("");

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

  const payBillMutation = useMutation({
    mutationFn: () => {
      const data: ExpensePaymentCreateInput = {
        payment_date: payDate,
        amount_paise: rupeesToPaise(payAmountRupees),
        payment_method: payMethod,
        notes: payNotes.trim() || undefined,
      };
      return api.expenses.payBill(payBillExpenseId!, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setPayBillExpenseId(null);
      setPayBillExpense(null);
      setPayAmountRupees(0);
      setPayNotes("");
      setPayError("");
    },
    onError: (err: any) => {
      setPayError(err.message || "Failed to record payment");
    },
  });

  const totalExpensesPaise = expenses.reduce((acc, e) => acc + e.amount_paise, 0);
  const totalPaidPaise = expenses.reduce((acc, e) => acc + (e.paid_amount_paise || 0), 0);
  const totalOutstandingPaise = totalExpensesPaise - totalPaidPaise;

  const openPayModal = (exp: any) => {
    setPayBillExpense(exp);
    setPayBillExpenseId(exp.id);
    const remaining = exp.amount_paise - (exp.paid_amount_paise || 0);
    setPayAmountRupees(paiseToRupees(remaining));
    setPayDate(new Date().toISOString().split("T")[0]);
    setPayMethod("cash");
    setPayNotes("");
    setPayError("");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400"><CheckCircle2 className="h-3 w-3" />PAID</span>;
      case "partial":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400"><Clock className="h-3 w-3" />PARTIAL</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/20 text-rose-400"><AlertCircle className="h-3 w-3" />UNPAID</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Operating Expenses</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Rent, utilities, maintenance, and operating bill ledger
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={handleExportExcel}
            disabled={isExportingExcel || expenses.length === 0}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-medium text-sm transition border border-emerald-500/30 shadow-sm shrink-0 disabled:opacity-50"
            title="Export Expenses to Excel (.xlsx)"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            <span>{isExportingExcel ? "Exporting..." : "Excel (.xlsx)"}</span>
          </button>
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
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-border/70 bg-card/40 glass-panel">
          <p className="text-xs text-muted-foreground mb-1">Total Bills Posted</p>
          <p className="text-lg font-bold font-mono text-rose-400"><MoneyDisplay paise={totalExpensesPaise} /></p>
        </div>
        <div className="p-4 rounded-xl border border-border/70 bg-card/40 glass-panel">
          <p className="text-xs text-muted-foreground mb-1">Total Paid</p>
          <p className="text-lg font-bold font-mono text-emerald-400"><MoneyDisplay paise={totalPaidPaise} /></p>
        </div>
        <div className="p-4 rounded-xl border border-border/70 bg-card/40 glass-panel">
          <p className="text-xs text-muted-foreground mb-1">Outstanding Payables</p>
          <p className="text-lg font-bold font-mono text-amber-400"><MoneyDisplay paise={totalOutstandingPaise} /></p>
        </div>
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
                  <th className="py-3 px-4">Bill Amount</th>
                  <th className="py-3 px-4">Paid</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono text-xs">
                {expenses.map((e) => {
                  const remaining = e.amount_paise - (e.paid_amount_paise || 0);
                  return (
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
                      <td className="py-3.5 px-4 text-emerald-400">
                        <MoneyDisplay paise={e.paid_amount_paise || 0} />
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        {getStatusBadge(e.status)}
                      </td>
                      <td className="py-3.5 px-4">
                        {e.status !== "paid" && e.status !== "cancelled" && (
                          <button
                            onClick={() => openPayModal(e)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-[10px] font-medium font-sans transition border border-blue-500/30"
                          >
                            <CreditCard className="h-3 w-3" />
                            Pay {remaining > 0 ? `(Rs. ${paiseToRupees(remaining).toFixed(0)})` : ""}
                          </button>
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
                  <p className="text-xs text-muted-foreground">Posts debit to expense account, credit to Accounts Payable</p>
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

      {/* Pay Bill Modal */}
      {payBillExpenseId && payBillExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-blue-500/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Settle Expense Bill</h3>
                  <p className="text-xs text-muted-foreground">{payBillExpense.reference} — {payBillExpense.description}</p>
                </div>
              </div>
              <button
                onClick={() => { setPayBillExpenseId(null); setPayBillExpense(null); }}
                className="text-muted-foreground hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Outstanding summary */}
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bill Total:</span>
                <span className="font-mono font-medium text-foreground"><MoneyDisplay paise={payBillExpense.amount_paise} /></span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already Paid:</span>
                <span className="font-mono font-medium text-emerald-400"><MoneyDisplay paise={payBillExpense.paid_amount_paise || 0} /></span>
              </div>
              <div className="flex justify-between border-t border-border/40 pt-1 mt-1">
                <span className="text-muted-foreground font-medium">Remaining:</span>
                <span className="font-mono font-bold text-amber-400">
                  <MoneyDisplay paise={payBillExpense.amount_paise - (payBillExpense.paid_amount_paise || 0)} />
                </span>
              </div>
            </div>

            {payError && (
              <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs">
                {payError}
              </div>
            )}

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Paid From</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs"
                  >
                    <option value="cash">Cash in Hand</option>
                    <option value="bank_transfer">Bank Account</option>
                    <option value="savings">Savings Account</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Payment Amount (Rs.) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={paiseToRupees(payBillExpense.amount_paise - (payBillExpense.paid_amount_paise || 0))}
                  value={payAmountRupees}
                  onChange={(e) => setPayAmountRupees(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Paid via online banking"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => { setPayBillExpenseId(null); setPayBillExpense(null); }}
                className="px-4 py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary/40 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => payBillMutation.mutate()}
                disabled={payAmountRupees <= 0 || payBillMutation.isPending}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition shadow-sm disabled:opacity-50"
              >
                {payBillMutation.isPending ? "Processing..." : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
