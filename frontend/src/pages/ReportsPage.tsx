import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, FileText, PiggyBank, Users, Calendar } from "lucide-react";
import { api } from "@/api/client";
import { MoneyDisplay } from "@/components/common/MoneyDisplay";
import { formatLKR } from "@/lib/money";

export const ReportsPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>("2026-01");

  const { data: poolSessions = [] } = useQuery({
    queryKey: ["pool-sessions-report"],
    queryFn: () => api.poolSessions.list(),
  });

  const { data: ps4Sessions = [] } = useQuery({
    queryKey: ["ps4-sessions-report"],
    queryFn: () => api.ps4Sessions.list(),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses-report"],
    queryFn: () => api.expenses.list(),
  });

  // Filter by selectedMonth if set
  const filteredPool = selectedMonth
    ? poolSessions.filter((s) => s.session_date.startsWith(selectedMonth))
    : poolSessions;
  const filteredPS4 = selectedMonth
    ? ps4Sessions.filter((s) => s.session_date.startsWith(selectedMonth))
    : ps4Sessions;
  const filteredExpenses = selectedMonth
    ? expenses.filter((e) => e.expense_date.startsWith(selectedMonth))
    : expenses;

  // Calculate totals
  const totalPoolPaise = filteredPool.reduce((acc, s) => acc + s.final_charge_paise, 0);
  const totalPS4Paise = filteredPS4.reduce((acc, s) => acc + s.final_charge_paise, 0);
  const totalRevenuePaise = totalPoolPaise + totalPS4Paise;

  const totalExpensePaise = filteredExpenses.reduce((acc, e) => acc + e.amount_paise, 0);
  const netIncomePaise = Math.max(0, totalRevenuePaise - totalExpensePaise);

  // Profit Allocation (Decision D-009):
  // 40% Savings, 20% Akash, 20% Pasan, remainder to Vishwa
  const savingsSharePaise = Math.round(netIncomePaise * 0.4);
  const akashSharePaise = Math.round(netIncomePaise * 0.2);
  const pasanSharePaise = Math.round(netIncomePaise * 0.2);
  const vishwaSharePaise = Math.max(
    0,
    netIncomePaise - (savingsSharePaise + akashSharePaise + pasanSharePaise)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Financial & Operational Reports</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Income statement, service revenue breakdowns, and partner profit allocation models
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-3 p-2 rounded-xl border border-border/70 bg-card/40 glass-panel">
          <Calendar className="h-4 w-4 text-emerald-400" />
          <span className="text-xs text-muted-foreground">Period:</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-2.5 py-1 rounded bg-secondary/50 border border-border text-xs font-mono text-foreground"
          />
          <button
            onClick={() => setSelectedMonth("")}
            className={`text-xs px-2 py-1 rounded transition ${
              !selectedMonth ? "bg-emerald-600/30 text-emerald-300" : "text-muted-foreground hover:text-white"
            }`}
          >
            All-Time
          </button>
        </div>
      </div>

      {/* Top 3 Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/10 to-transparent glass-panel space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-400 font-medium">Total Operating Revenue</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            <MoneyDisplay paise={totalRevenuePaise} />
          </div>
          <p className="text-xs text-muted-foreground">
            Pool: {formatLKR(totalPoolPaise)} | PS4: {formatLKR(totalPS4Paise)}
          </p>
        </div>

        <div className="p-5 rounded-xl border border-rose-500/20 bg-gradient-to-b from-rose-500/10 to-transparent glass-panel space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-rose-400 font-medium">Total Operating Expenses</span>
            <FileText className="h-4 w-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            <MoneyDisplay paise={totalExpensePaise} />
          </div>
          <p className="text-xs text-muted-foreground">Bills, utilities, and hall rent</p>
        </div>

        <div className="p-5 rounded-xl border border-cyan-500/20 bg-gradient-to-b from-cyan-500/10 to-transparent glass-panel space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-cyan-400 font-medium">Net Operating Profit</span>
            <PiggyBank className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-400">
            <MoneyDisplay paise={netIncomePaise} />
          </div>
          <p className="text-xs text-muted-foreground">Operating Revenue minus Expenses</p>
        </div>
      </div>

      {/* Income Statement Detailed Table */}
      <div className="rounded-xl border border-border/70 bg-card/60 p-6 glass-panel space-y-4">
        <h3 className="font-semibold text-lg text-white">Income Statement Summary</h3>
        <div className="border border-border/60 rounded-xl overflow-hidden font-mono text-xs">
          <div className="p-3 bg-secondary/40 font-sans font-semibold text-foreground flex justify-between">
            <span>Operating Revenue</span>
            <span>Amount (LKR)</span>
          </div>
          <div className="divide-y divide-border/40">
            <div className="p-3 flex justify-between hover:bg-secondary/20">
              <span className="font-sans">4001 Pool Table Rental Income</span>
              <span className="text-foreground">{formatLKR(totalPoolPaise)}</span>
            </div>
            <div className="p-3 flex justify-between hover:bg-secondary/20">
              <span className="font-sans">4002 PS4 Gaming Station Income</span>
              <span className="text-foreground">{formatLKR(totalPS4Paise)}</span>
            </div>
            <div className="p-3 flex justify-between font-bold bg-secondary/20 text-emerald-400">
              <span className="font-sans">Total Gross Revenue</span>
              <span>{formatLKR(totalRevenuePaise)}</span>
            </div>
          </div>

          <div className="p-3 bg-secondary/40 font-sans font-semibold text-foreground flex justify-between border-t border-border">
            <span>Operating Expenses</span>
            <span>Amount (LKR)</span>
          </div>
          <div className="divide-y divide-border/40">
            <div className="p-3 flex justify-between hover:bg-secondary/20">
              <span className="font-sans">6xxx Operating Utilities, Rent & Expenses</span>
              <span className="text-rose-400">{formatLKR(totalExpensePaise)}</span>
            </div>
            <div className="p-3 flex justify-between font-bold bg-secondary/20 text-foreground">
              <span className="font-sans">Total Expenses</span>
              <span>{formatLKR(totalExpensePaise)}</span>
            </div>
          </div>

          <div className="p-4 bg-emerald-950/40 font-bold text-sm text-emerald-400 flex justify-between border-t-2 border-emerald-500/40">
            <span className="font-sans">NET DISTRIBUTABLE PROFIT</span>
            <span>{formatLKR(netIncomePaise)}</span>
          </div>
        </div>
      </div>

      {/* Proposed Partner Profit Allocation Model */}
      <div className="rounded-xl border border-emerald-500/30 bg-card/60 p-6 glass-panel space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Proposed Profit Distribution</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Strictly calculated per business partnership rules (40% Savings, 20% Akash, 20% Pasan, 20% Vishwa)
              </p>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded bg-amber-500/20 text-amber-400 font-medium">
            Pending Owner Approval (D-005)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-950/20 space-y-1">
            <span className="text-xs font-semibold text-blue-400">Savings Reserve (40%)</span>
            <div className="text-xl font-bold font-mono text-white">
              <MoneyDisplay paise={savingsSharePaise} />
            </div>
            <p className="text-[11px] text-muted-foreground">Retained in business account 1003</p>
          </div>

          <div className="p-4 rounded-xl border border-border/80 bg-secondary/30 space-y-1">
            <span className="text-xs font-semibold text-foreground">Akash (20%)</span>
            <div className="text-xl font-bold font-mono text-emerald-400">
              <MoneyDisplay paise={akashSharePaise} />
            </div>
            <p className="text-[11px] text-muted-foreground">Partner capital account 3001</p>
          </div>

          <div className="p-4 rounded-xl border border-border/80 bg-secondary/30 space-y-1">
            <span className="text-xs font-semibold text-foreground">Pasan (20%)</span>
            <div className="text-xl font-bold font-mono text-emerald-400">
              <MoneyDisplay paise={pasanSharePaise} />
            </div>
            <p className="text-[11px] text-muted-foreground">Partner capital account 3002</p>
          </div>

          <div className="p-4 rounded-xl border border-border/80 bg-secondary/30 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Vishwa (20%)</span>
              <span className="text-[10px] text-muted-foreground font-mono">+rem (D-009)</span>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400">
              <MoneyDisplay paise={vishwaSharePaise} />
            </div>
            <p className="text-[11px] text-muted-foreground">Partner capital account 3003</p>
          </div>
        </div>
      </div>
    </div>
  );
};
