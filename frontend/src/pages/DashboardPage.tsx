/**
 * DashboardPage — real business metrics from backend API.
 * No hardcoded values, no account codes, no partner percentages shown here.
 */
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  CircleDot,
  Gamepad2,
  TrendingUp,
  Banknote,
  PiggyBank,
  AlertCircle,
  Coffee,
  ArrowRight,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { api } from "@/api/client";
import { formatLKR } from "@/lib/money";

/* ── Status badge ──────────────────────────────────────────────────────── */
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const s = status.toLowerCase();
  const style =
    s === "paid"      ? { backgroundColor: "rgba(34,197,94,0.15)",  color: "#22C55E", border: "1px solid rgba(34,197,94,0.3)" }  :
    s === "partial"   ? { backgroundColor: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)" } :
    s === "cancelled" ? { backgroundColor: "rgba(239,68,68,0.15)",  color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" } :
                        { backgroundColor: "rgba(100,116,139,0.15)", color: "#94A3B8", border: "1px solid rgba(100,116,139,0.3)" };
  const label = s === "paid" ? "Paid" : s === "partial" ? "Part Paid" : s === "cancelled" ? "Cancelled" : "Unpaid";
  return (
    <span className="px-2 py-0.5 rounded text-[11px] font-medium" style={style}>
      {label}
    </span>
  );
};

/* ── KPI Card ──────────────────────────────────────────────────────────── */
const KpiCard: React.FC<{
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accentColor?: string;
  href?: string;
}> = ({ title, value, sub, icon: Icon, accentColor = "#38BDF8", href }) => {
  const inner = (
    <div
      className="rounded-lg p-4 transition-fast"
      style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "#475569")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "#334155")}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium" style={{ color: "#94A3B8" }}>{title}</p>
        <div className="flex items-center justify-center w-7 h-7 rounded-md" style={{ backgroundColor: `${accentColor}18` }}>
          <Icon className="w-3.5 h-3.5" style={{ color: accentColor }} />
        </div>
      </div>
      <p className="text-xl font-semibold font-mono tabular-nums" style={{ color: "#F8FAFC" }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "#64748B" }}>{sub}</p>}
    </div>
  );
  return href ? <Link to={href}>{inner}</Link> : inner;
};

/* ── Page ──────────────────────────────────────────────────────────────── */

const todayStr = () => new Date().toISOString().split("T")[0];

export const DashboardPage: React.FC = () => {
  const [date, setDate] = useState(todayStr);

  const { data: poolSessions = [], isLoading: loadingPool } = useQuery({
    queryKey: ["pool-sessions", date],
    queryFn:  () => api.poolSessions.list({ date }),
  });

  const { data: ps4Sessions = [], isLoading: loadingPS4 } = useQuery({
    queryKey: ["ps4-sessions", date],
    queryFn:  () => api.ps4Sessions.list({ date }),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn:  () => api.accounts.list(),
  });

  /* Metrics */
  const poolRevenue  = poolSessions.reduce((a, s) => a + s.final_charge_paise, 0);
  const ps4Revenue   = ps4Sessions.reduce((a, s) => a + s.final_charge_paise, 0);
  const totalRevenue = poolRevenue + ps4Revenue;
  const totalOutstanding =
    poolSessions.reduce((a, s) => a + s.outstanding_paise, 0) +
    ps4Sessions.reduce((a, s) => a + s.outstanding_paise, 0);

  const cashAcc    = accounts.find(a => a.code === "1001");
  const bankAcc    = accounts.find(a => a.code === "1002");
  const savingsAcc = accounts.find(a => a.code === "1003");

  const recentSessions = [
    ...poolSessions.map(s  => ({ ...s, svcType: "Pool" as const })),
    ...ps4Sessions.map(s   => ({ ...s, svcType: "PS4"  as const, chargeable_minutes: s.minutes })),
  ].sort((a, b) => b.id - a.id).slice(0, 8);

  const isToday = date === todayStr();
  const loading = loadingPool || loadingPS4;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "#F8FAFC" }}>
            {isToday ? "Today's Overview" : "Business Overview"}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
            All figures are from the live accounting ledger
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" style={{ color: "#64748B" }} />
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="text-xs rounded-md px-2.5 py-1.5"
              style={{ backgroundColor: "#1E293B", border: "1px solid #334155", color: "#F8FAFC", outline: "none" }}
              onFocus={e => (e.target.style.borderColor = "#38BDF8")}
              onBlur={e  => (e.target.style.borderColor = "#334155")}
            />
          </div>
          {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: "#38BDF8" }} />}
          <Link
            to="/sessions/pool?action=new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-fast"
            style={{ backgroundColor: "#38BDF8", color: "#0F172A" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#7DD3FC")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#38BDF8")}
          >
            <CircleDot className="w-3.5 h-3.5" /> New Pool
          </Link>
          <Link
            to="/sessions/ps4?action=new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-fast"
            style={{ backgroundColor: "#1E293B", color: "#94A3B8", border: "1px solid #334155" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor="#475569"; e.currentTarget.style.color="#F8FAFC"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor="#334155"; e.currentTarget.style.color="#94A3B8"; }}
          >
            <Gamepad2 className="w-3.5 h-3.5" /> New PS4
          </Link>
        </div>
      </div>

      {/* KPI row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title={isToday ? "Today's Revenue" : "Period Revenue"} value={formatLKR(totalRevenue)} sub={`${poolSessions.length} Pool · ${ps4Sessions.length} PS4`} icon={TrendingUp} accentColor="#38BDF8" />
        <KpiCard title="Outstanding Payments" value={formatLKR(totalOutstanding)} sub={totalOutstanding > 0 ? "Unpaid session balances" : "All sessions settled"} icon={AlertCircle} accentColor={totalOutstanding > 0 ? "#F59E0B" : "#22C55E"} href="/outstanding-payments" />
        <KpiCard title="Cash in Hand" value={formatLKR(cashAcc?.current_balance_paise ?? 0)} sub="Business cash drawer" icon={Banknote} accentColor="#22C55E" href="/cash-bank" />
        <KpiCard title="Savings Reserve" value={formatLKR(savingsAcc?.current_balance_paise ?? 0)} sub="Business savings balance" icon={PiggyBank} accentColor="#A78BFA" href="/savings" />
      </div>

      {/* KPI row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Pool Table Income" value={formatLKR(poolRevenue)} sub={`${poolSessions.length} session(s)`} icon={CircleDot} accentColor="#38BDF8" href="/sessions/pool" />
        <KpiCard title="PS4 Income" value={formatLKR(ps4Revenue)} sub={`${ps4Sessions.length} session(s)`} icon={Gamepad2} accentColor="#818CF8" href="/sessions/ps4" />
        <KpiCard title="Bank Account" value={formatLKR(bankAcc?.current_balance_paise ?? 0)} sub="Main business bank" icon={Banknote} accentColor="#38BDF8" href="/cash-bank" />
        <KpiCard title="Soft Drinks Sales" value="—" sub="Open Sales Book for details" icon={Coffee} accentColor="#F59E0B" href="/drinks/sales" />
      </div>

      {/* Sessions + Account balances */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Sessions table */}
        <div className="lg:col-span-2 rounded-lg p-5" style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "#F8FAFC" }}>
                {isToday ? "Today's Sessions" : `Sessions — ${date}`}
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>Pool and PS4 sessions for the selected date</p>
            </div>
            <div className="flex gap-3">
              <Link to="/sessions/pool" className="flex items-center gap-1 text-xs transition-fast" style={{ color: "#38BDF8" }}
                onMouseEnter={e => (e.currentTarget.style.color="#7DD3FC")} onMouseLeave={e => (e.currentTarget.style.color="#38BDF8")}>
                Pool <ArrowRight className="w-3 h-3" />
              </Link>
              <Link to="/sessions/ps4" className="flex items-center gap-1 text-xs transition-fast" style={{ color: "#94A3B8" }}
                onMouseEnter={e => (e.currentTarget.style.color="#F8FAFC")} onMouseLeave={e => (e.currentTarget.style.color="#94A3B8")}>
                PS4 <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {recentSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CircleDot className="w-8 h-8 mb-3 opacity-20" style={{ color: "#94A3B8" }} />
              <p className="text-sm font-medium" style={{ color: "#64748B" }}>No sessions for this date</p>
              <p className="text-xs mt-1" style={{ color: "#475569" }}>Use the buttons above to start a new session.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid #334155" }}>
                    {["Type","Player / Guest","Duration","Charge","Status"].map(h => (
                      <th key={h} className="text-left py-2 px-2 font-medium" style={{ color: "#64748B" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentSessions.map(s => (
                    <tr key={`${s.svcType}-${s.id}`} className="table-row-hover" style={{ borderBottom: "1px solid #1E293B" }}>
                      <td className="py-2.5 px-2">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium"
                          style={s.svcType==="Pool"
                            ? { backgroundColor:"rgba(56,189,248,0.12)", color:"#38BDF8", border:"1px solid rgba(56,189,248,0.2)" }
                            : { backgroundColor:"rgba(129,140,248,0.12)", color:"#818CF8", border:"1px solid rgba(129,140,248,0.2)" }}>
                          {s.svcType==="Pool" ? <CircleDot className="w-2.5 h-2.5" /> : <Gamepad2 className="w-2.5 h-2.5" />}
                          {s.svcType}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 font-medium" style={{ color: "#F8FAFC" }}>
                        {s.customer_name
                          || ("player" in s ? (s as any).player?.name : null)
                          || ("player1" in s ? (s as any).player1?.name : null)
                          || <span style={{ color:"#64748B" }}>Walk-in</span>}
                      </td>
                      <td className="py-2.5 px-2 font-mono" style={{ color:"#94A3B8" }}>{s.chargeable_minutes} min</td>
                      <td className="py-2.5 px-2 font-mono font-semibold" style={{ color:"#F8FAFC" }}>{formatLKR(s.final_charge_paise)}</td>
                      <td className="py-2.5 px-2"><StatusBadge status={s.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Account balances */}
        <div className="rounded-lg p-4" style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}>
          <h3 className="text-sm font-semibold mb-1" style={{ color: "#F8FAFC" }}>Account Balances</h3>
          <p className="text-xs mb-4" style={{ color: "#64748B" }}>Live balances from the accounting ledger</p>
          <div className="space-y-2">
            {[
              { label: "Cash",    sub: "Physical cash drawer",      acc: cashAcc,    color: "#22C55E" },
              { label: "Bank",    sub: "Main business account",     acc: bankAcc,    color: "#38BDF8" },
              { label: "Savings", sub: "Business savings reserve",  acc: savingsAcc, color: "#A78BFA" },
            ].map(({ label, sub, acc, color }) => (
              <div key={label} className="flex items-center justify-between p-3 rounded-md"
                style={{ backgroundColor: "#0F172A", border: "1px solid #334155" }}>
                <div>
                  <p className="text-xs font-medium" style={{ color: "#F8FAFC" }}>{label}</p>
                  <p className="text-[11px]" style={{ color: "#64748B" }}>{sub}</p>
                </div>
                <span className="text-sm font-semibold font-mono tabular-nums" style={{ color }}>
                  {formatLKR(acc?.current_balance_paise ?? 0)}
                </span>
              </div>
            ))}
          </div>
          <Link to="/accounts"
            className="flex items-center justify-center gap-1.5 mt-4 py-2 rounded-md text-xs font-medium transition-fast"
            style={{ backgroundColor:"#0F172A", color:"#64748B", border:"1px solid #334155" }}
            onMouseEnter={e => { e.currentTarget.style.color="#F8FAFC"; e.currentTarget.style.borderColor="#475569"; }}
            onMouseLeave={e => { e.currentTarget.style.color="#64748B"; e.currentTarget.style.borderColor="#334155"; }}>
            Accounting Ledger <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
};
