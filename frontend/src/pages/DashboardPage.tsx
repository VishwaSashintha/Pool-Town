/**
 * DashboardPage — Modern, professional analytics admin dashboard for Billiard Hall Management System.
 * Powered by backend-authoritative live accounting ledger data.
 * Adheres strictly to the dark color palette (#0F172A, #1E293B, #334155, #475569, #F8FAFC, #38BDF8).
 */
import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  Banknote,
  PiggyBank,
  AlertCircle,
  CircleDot,
  Gamepad2,
  Coffee,
  ArrowRight,
  RefreshCw,
  Wallet,
  Receipt,
  Layers,
  BarChart3,
  CheckCircle2,
  Clock,
  TrendingDown,
  ChevronRight,
  PieChart as PieIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { api } from "@/api/client";
import { formatLKR, paiseToRupees } from "@/lib/money";

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

/* ── Date range calculation helper ─────────────────────────────────────── */
type DatePreset = "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "this_year" | "custom";

function formatDateYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveDateRange(preset: DatePreset, customStart: string, customEnd: string): { start: string; end: string; label: string } {
  const now = new Date();
  switch (preset) {
    case "today": {
      const s = formatDateYMD(now);
      return { start: s, end: s, label: "Today" };
    }
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const s = formatDateYMD(y);
      return { start: s, end: s, label: "Yesterday" };
    }
    case "this_week": {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      return { start: formatDateYMD(monday), end: formatDateYMD(now), label: "This Week" };
    }
    case "this_month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: formatDateYMD(first), end: formatDateYMD(now), label: "This Month" };
    }
    case "last_month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: formatDateYMD(first), end: formatDateYMD(last), label: "Last Month" };
    }
    case "this_year": {
      const first = new Date(now.getFullYear(), 0, 1);
      return { start: formatDateYMD(first), end: formatDateYMD(now), label: "This Year" };
    }
    case "custom": {
      return {
        start: customStart || formatDateYMD(now),
        end: customEnd || formatDateYMD(now),
        label: "Custom Period",
      };
    }
  }
}

/* ── KPI Sparkline Component ───────────────────────────────────────────── */
const MiniSparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  if (!data || data.length === 0) return null;
  const chartData = data.map((val, idx) => ({ idx, val }));
  return (
    <div className="w-20 h-7 overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="val"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#grad-${color.replace("#", "")})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

/* ── KPI Card ──────────────────────────────────────────────────────────── */
interface KpiCardProps {
  title: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  accentColor: string;
  href?: string;
  growthPercent?: number | null;
  sparkline?: number[];
  badgeText?: string;
  badgeType?: "success" | "warning" | "danger" | "neutral";
}

const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  sub,
  icon: Icon,
  accentColor,
  href,
  growthPercent,
  sparkline,
  badgeText,
  badgeType = "neutral",
}) => {
  const content = (
    <div
      className="rounded-xl p-4 transition-all duration-200 h-full flex flex-col justify-between"
      style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "#475569";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "#334155";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-medium text-slate-400">{title}</span>
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform"
            style={{ backgroundColor: `${accentColor}18` }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: accentColor }} />
          </div>
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xl sm:text-2xl font-bold font-numeric metric-value tracking-tight text-slate-50 tabular-nums">
            {value}
          </p>
          {sparkline && <MiniSparkline data={sparkline} color={accentColor} />}
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
        <span className="text-slate-400 truncate mr-2">{sub}</span>
        {growthPercent !== undefined && growthPercent !== null ? (
          <span
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-medium tabular-nums ${
              growthPercent > 0
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : growthPercent < 0
                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                : "bg-slate-700 text-slate-400 border border-slate-600"
            }`}
          >
            {growthPercent > 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : growthPercent < 0 ? (
              <TrendingDown className="w-3 h-3" />
            ) : null}
            {growthPercent > 0 ? `+${growthPercent}%` : `${growthPercent}%`}
          </span>
        ) : badgeText ? (
          <span
            className={`px-1.5 py-0.5 rounded font-medium ${
              badgeType === "warning"
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                : badgeType === "success"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : badgeType === "danger"
                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                : "bg-slate-700 text-slate-400 border border-slate-600"
            }`}
          >
            {badgeText}
          </span>
        ) : null}
      </div>
    </div>
  );

  return href ? (
    <Link to={href} className="block h-full cursor-pointer focus:outline-none">
      {content}
    </Link>
  ) : (
    content
  );
};

/* ── Custom Recharts Tooltip ───────────────────────────────────────────── */
const AnalyticsTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className="rounded-lg p-3 text-xs shadow-xl backdrop-blur-md"
      style={{ backgroundColor: "#0F172A", border: "1px solid #334155" }}
    >
      <p className="font-semibold text-slate-300 mb-2">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry: any, idx: number) => (
          <div key={idx} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-400">{entry.name}:</span>
            </div>
            <span className="font-numeric font-bold text-slate-100 tabular-nums">
              {entry.unit === "count" ? entry.value : formatLKR(entry.value * 100)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Main Dashboard Page ───────────────────────────────────────────────── */
export const DashboardPage: React.FC = () => {
  const [preset, setPreset] = useState<DatePreset>("this_month");
  const [customStart, setCustomStart] = useState(() => formatDateYMD(new Date()));
  const [customEnd, setCustomEnd] = useState(() => formatDateYMD(new Date()));
  const [activeSeries, setActiveSeries] = useState<"all" | "pool" | "ps4" | "drinks">("all");
  const [barMetric, setBarMetric] = useState<"revenue" | "volume" | "collections">("revenue");

  const { start, end, label: rangeLabel } = useMemo(
    () => resolveDateRange(preset, customStart, customEnd),
    [preset, customStart, customEnd]
  );

  const {
    data: analytics,
    isLoading,
    isRefetching,
    refetch,
    isError,
    error,
  } = useQuery({
    queryKey: ["dashboard-analytics", start, end],
    queryFn: () => api.reports.getAnalytics(start, end),
    staleTime: 1000 * 30, // 30 seconds
  });

  /* Chart data transformations */
  const trendChartData = useMemo(() => {
    if (!analytics?.revenue_trend) return [];
    return analytics.revenue_trend.map(pt => ({
      date: pt.date,
      label: pt.label,
      pool: paiseToRupees(pt.pool_revenue_paise),
      ps4: paiseToRupees(pt.ps4_revenue_paise),
      drinks: paiseToRupees(pt.drinks_revenue_paise),
      total: paiseToRupees(pt.total_revenue_paise),
      collections: paiseToRupees(pt.collections_paise),
      expenses: paiseToRupees(pt.expenses_paise),
    }));
  }, [analytics?.revenue_trend]);

  const distributionData = useMemo(() => {
    if (!analytics?.revenue_distribution) return [];
    return analytics.revenue_distribution.map(d => ({
      name: d.name,
      value: d.revenue_paise,
      percentage: d.percentage,
      color: d.color,
      count: d.count,
      collections: d.collections_paise,
    }));
  }, [analytics?.revenue_distribution]);

  const barChartData = useMemo(() => {
    if (!analytics?.service_comparison) return [];
    return analytics.service_comparison.map(s => {
      let metricValue = 0;
      let displayUnit = "currency";
      if (barMetric === "revenue") {
        metricValue = paiseToRupees(s.revenue_paise);
      } else if (barMetric === "volume") {
        metricValue = s.sessions_or_sales_count;
        displayUnit = "count";
      } else {
        metricValue = paiseToRupees(s.collections_paise);
      }
      return {
        name: s.name,
        value: metricValue,
        color: s.color,
        unit: displayUnit,
        rawRevenue: s.revenue_paise,
        rawCollections: s.collections_paise,
        count: s.sessions_or_sales_count,
      };
    });
  }, [analytics?.service_comparison, barMetric]);

  const kpis = analytics?.kpis;
  const activity = analytics?.activity_summary;
  const accounts = analytics?.account_balances;
  const paymentStatus = analytics?.payment_status;
  const collectionsMethod = analytics?.collections_by_method;
  const expensesList = analytics?.expenses_by_category || [];
  const inventory = analytics?.inventory_overview;
  const recentSessions = analytics?.recent_sessions || [];

  const totalRevenuePaise = kpis?.total_revenue_paise ?? 0;
  const hasRevenueData = totalRevenuePaise > 0;
  const hasTrendData = trendChartData.some(d => d.total > 0 || d.collections > 0);

  // Sparkline data arrays
  const revenueSparkline = useMemo(
    () => trendChartData.map(d => d.total),
    [trendChartData]
  );
  const collectionsSparkline = useMemo(
    () => trendChartData.map(d => d.collections),
    [trendChartData]
  );
  const profitSparkline = useMemo(
    () => trendChartData.map(d => Math.max(0, d.total - d.expenses)),
    [trendChartData]
  );

  return (
    <div className="space-y-6 pb-12">
      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-50">
              Pool Town Dashboard
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
              Live Ledger
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time sessions, collections, and financial analytics
          </p>
        </div>

        {/* Date presets & actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div
            className="flex items-center rounded-lg p-0.5 overflow-x-auto max-w-full"
            style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
          >
            {(
              [
                ["this_month", "This Month"],
                ["today", "Today"],
                ["yesterday", "Yesterday"],
                ["this_week", "This Week"],
                ["last_month", "Last Month"],
                ["this_year", "This Year"],
                ["custom", "Custom"],
              ] as [DatePreset, string][]
            ).map(([pKey, pLabel]) => (
              <button
                key={pKey}
                onClick={() => setPreset(pKey)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                  preset === pKey
                    ? "bg-sky-400 text-slate-950 font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                }`}
              >
                {pLabel}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs if preset is custom */}
          {preset === "custom" && (
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer"
              />
              <span className="text-slate-500 text-xs">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer"
              />
            </div>
          )}

          {/* Refresh Action */}
          <button
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            title="Refresh dashboard data"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading || isRefetching ? "animate-spin text-sky-400" : ""}`}
            />
          </button>

          {/* Quick Actions */}
          <Link
            to="/sessions/pool?action=new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-400 text-slate-950 hover:bg-sky-300 transition-all shadow-sm"
          >
            <CircleDot className="w-3.5 h-3.5" /> New Pool
          </Link>
          <Link
            to="/sessions/ps4?action=new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 transition-all"
          >
            <Gamepad2 className="w-3.5 h-3.5 text-indigo-400" /> New PS4
          </Link>
        </div>
      </div>

      {/* Error Banner if API failed */}
      {isError && (
        <div className="rounded-xl p-4 bg-rose-500/10 border border-rose-500/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-rose-300">Unable to load dashboard data</h4>
            <p className="text-xs text-rose-400/90 mt-0.5">
              {(error as Error)?.message || "A network or server error occurred while querying the accounting ledger."}
            </p>
          </div>
        </div>
      )}

      {/* ── FIRST ROW: FOUR COMPACT STATISTIC CARDS ───────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Revenue */}
        <KpiCard
          title="Total Revenue"
          value={formatLKR(kpis?.total_revenue_paise ?? 0)}
          sub="Pool, PS4 & Soft drinks"
          icon={TrendingUp}
          accentColor="#38BDF8"
          growthPercent={kpis?.revenue_growth_percent}
          sparkline={revenueSparkline}
        />

        {/* 2. Total Collections */}
        <KpiCard
          title="Total Collections"
          value={formatLKR(kpis?.total_collected_paise ?? 0)}
          sub="Cash & bank received"
          icon={Banknote}
          accentColor="#22C55E"
          growthPercent={kpis?.collections_growth_percent}
          sparkline={collectionsSparkline}
          href="/accounts"
        />

        {/* 3. Outstanding Payments */}
        <KpiCard
          title="Outstanding Payments"
          value={formatLKR(kpis?.total_outstanding_paise ?? 0)}
          sub="Customer receivables owed"
          icon={AlertCircle}
          accentColor={(kpis?.total_outstanding_paise ?? 0) > 0 ? "#F59E0B" : "#22C55E"}
          badgeText={(kpis?.total_outstanding_paise ?? 0) > 0 ? "Action Required" : "All Settled"}
          badgeType={(kpis?.total_outstanding_paise ?? 0) > 0 ? "warning" : "success"}
          href="/outstanding-payments"
        />

        {/* 4. Net Profit */}
        <KpiCard
          title="Net Profit"
          value={formatLKR(kpis?.net_profit_paise ?? 0)}
          sub="Revenue minus expenses"
          icon={PiggyBank}
          accentColor={(kpis?.net_profit_paise ?? 0) >= 0 ? "#A78BFA" : "#EF4444"}
          growthPercent={kpis?.profit_growth_percent}
          sparkline={profitSparkline}
          href="/reports"
        />
      </div>

      {/* ── SECOND ROW: BUSINESS PERFORMANCE AND REVENUE TREND ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT PANEL: BUSINESS ACTIVITY SUMMARY (4 of 12 cols on desktop) */}
        <div
          className="lg:col-span-4 rounded-xl p-5 flex flex-col justify-between"
          style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-400" /> Activity Summary
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Recorded operations for {rangeLabel}</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {/* Pool Table Activity */}
              <Link
                to="/sessions/pool"
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/60 hover:border-sky-500/40 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-sky-500/10 flex items-center justify-center">
                    <CircleDot className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-200 group-hover:text-sky-300 transition-colors">
                      Pool Table Sessions
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {activity?.pool_sessions_count ?? 0} session(s)
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold font-mono text-slate-100">
                    {formatLKR(activity?.pool_revenue_paise ?? 0)}
                  </p>
                  <span className="text-[10px] text-sky-400 group-hover:underline inline-flex items-center">
                    View <ChevronRight className="w-2.5 h-2.5 ml-0.5" />
                  </span>
                </div>
              </Link>

              {/* PS4 Activity */}
              <Link
                to="/sessions/ps4"
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/60 hover:border-indigo-500/40 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-indigo-500/10 flex items-center justify-center">
                    <Gamepad2 className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-200 group-hover:text-indigo-300 transition-colors">
                      PS4 Gaming Sessions
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {activity?.ps4_sessions_count ?? 0} session(s)
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold font-mono text-slate-100">
                    {formatLKR(activity?.ps4_revenue_paise ?? 0)}
                  </p>
                  <span className="text-[10px] text-indigo-400 group-hover:underline inline-flex items-center">
                    View <ChevronRight className="w-2.5 h-2.5 ml-0.5" />
                  </span>
                </div>
              </Link>

              {/* Soft Drinks Activity */}
              <Link
                to="/drinks/sales"
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/60 hover:border-amber-500/40 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center">
                    <Coffee className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-200 group-hover:text-amber-300 transition-colors">
                      Soft Drinks Sold
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {activity?.drinks_bottles_sold ?? 0} bottle(s) sold
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold font-mono text-slate-100">
                    {formatLKR(activity?.drinks_revenue_paise ?? 0)}
                  </p>
                  <span className="text-[10px] text-amber-400 group-hover:underline inline-flex items-center">
                    View <ChevronRight className="w-2.5 h-2.5 ml-0.5" />
                  </span>
                </div>
              </Link>

              {/* Expenses Activity */}
              <Link
                to="/expenses"
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/60 hover:border-rose-500/40 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-rose-500/10 flex items-center justify-center">
                    <Receipt className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-200 group-hover:text-rose-300 transition-colors">
                      Recorded Expenses
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {activity?.total_expenses_count ?? 0} expense item(s)
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold font-mono text-rose-300">
                    {formatLKR(activity?.total_expenses_paise ?? 0)}
                  </p>
                  <span className="text-[10px] text-rose-400 group-hover:underline inline-flex items-center">
                    View <ChevronRight className="w-2.5 h-2.5 ml-0.5" />
                  </span>
                </div>
              </Link>

              {/* Unpaid Sessions Activity */}
              <Link
                to="/outstanding-payments"
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/60 hover:border-amber-500/40 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-200 group-hover:text-amber-300 transition-colors">
                      Unpaid / Partial Sessions
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {activity?.unpaid_sessions_count ?? 0} session(s) with balance
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold font-mono text-amber-300">
                    {formatLKR(activity?.unpaid_sessions_outstanding_paise ?? 0)}
                  </p>
                  <span className="text-[10px] text-amber-400 group-hover:underline inline-flex items-center">
                    View <ChevronRight className="w-2.5 h-2.5 ml-0.5" />
                  </span>
                </div>
              </Link>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
            <span>Stock Discrepancies</span>
            <span
              className={`font-medium px-2 py-0.5 rounded text-[11px] ${
                (activity?.stock_discrepancies_count ?? 0) > 0
                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              }`}
            >
              {(activity?.stock_discrepancies_count ?? 0) > 0
                ? `${activity?.stock_discrepancies_count} Issue(s)`
                : "None recorded"}
            </span>
          </div>
        </div>

        {/* RIGHT PANEL: REVENUE TREND LINE CHART (8 of 12 cols on desktop) */}
        <div
          className="lg:col-span-8 rounded-xl p-5"
          style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-400" /> Revenue Overview
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Financial performance trend over {rangeLabel}
              </p>
            </div>

            {/* Series Filter Selector */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-0.5 text-xs">
              {(
                [
                  ["all", "All Services"],
                  ["pool", "Pool Table"],
                  ["ps4", "PS4"],
                  ["drinks", "Soft Drinks"],
                ] as const
              ).map(([sKey, sLabel]) => (
                <button
                  key={sKey}
                  onClick={() => setActiveSeries(sKey)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    activeSeries === sKey
                      ? "bg-slate-700 text-sky-400 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {sLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Chart or Honest Empty State */}
          {!hasTrendData ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-700/60 rounded-lg">
              <TrendingUp className="w-8 h-8 text-slate-600 mb-2" />
              <p className="text-sm font-medium text-slate-400">No revenue data for this date range</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                As games are completed or soft drinks are sold, your revenue trend curves will automatically graph here.
              </p>
            </div>
          ) : (
            <div className="h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="poolGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="ps4Grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818CF8" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#818CF8" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="drinksGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />

                  <XAxis
                    dataKey="label"
                    stroke="#64748B"
                    tick={{ fill: "#94A3B8", fontSize: 11, fontFamily: "Montserrat", fontWeight: 600 }}
                    tickLine={false}
                    axisLine={{ stroke: "#334155" }}
                  />

                  <YAxis
                    stroke="#64748B"
                    tick={{ fill: "#94A3B8", fontSize: 11, fontFamily: "Montserrat", fontWeight: 700 }}
                    tickLine={false}
                    axisLine={{ stroke: "#334155" }}
                    tickFormatter={val => (val >= 1000 ? `Rs.${(val / 1000).toFixed(0)}k` : `Rs.${val}`)}
                  />

                  <Tooltip content={<AnalyticsTooltip />} />

                  {(activeSeries === "all" || activeSeries === "pool") && (
                    <Area
                      type="monotone"
                      name="Pool Table"
                      dataKey="pool"
                      stroke="#38BDF8"
                      strokeWidth={2}
                      fill="url(#poolGrad)"
                      dot={{ r: 2, fill: "#38BDF8" }}
                      activeDot={{ r: 5 }}
                    />
                  )}

                  {(activeSeries === "all" || activeSeries === "ps4") && (
                    <Area
                      type="monotone"
                      name="PS4 Gaming"
                      dataKey="ps4"
                      stroke="#818CF8"
                      strokeWidth={2}
                      fill="url(#ps4Grad)"
                      dot={{ r: 2, fill: "#818CF8" }}
                      activeDot={{ r: 5 }}
                    />
                  )}

                  {(activeSeries === "all" || activeSeries === "drinks") && (
                    <Area
                      type="monotone"
                      name="Soft Drinks"
                      dataKey="drinks"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      fill="url(#drinksGrad)"
                      dot={{ r: 2, fill: "#F59E0B" }}
                      activeDot={{ r: 5 }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Interactive Legend Row */}
          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-center gap-6 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8]" /> Pool Table
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#818CF8]" /> PS4
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" /> Soft Drinks
            </span>
          </div>
        </div>
      </div>

      {/* ── THIRD ROW: LARGE CIRCULAR REVENUE DISTRIBUTION DOUGHNUT CHART ──── */}
      <div
        className="rounded-xl p-5 sm:p-6"
        style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-sky-400" /> Revenue Distribution
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Category share of total business revenue for {rangeLabel}
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Total Recognized: <strong className="text-slate-100 font-semibold">{formatLKR(totalRevenuePaise)}</strong>
          </span>
        </div>

        {!hasRevenueData ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-slate-700/60 rounded-xl">
            <div className="w-16 h-16 rounded-full border-4 border-slate-700 flex items-center justify-center mb-3 text-slate-600">
              <PieIcon className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-slate-300">No Revenue Earned in Selected Period</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              When pool games, PS4 sessions, or soft drinks are recorded, category share percentages and totals will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Doughnut Chart Container with Center Text */}
            <div className="md:col-span-6 lg:col-span-5 relative flex items-center justify-center min-h-[280px]">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Tooltip
                    formatter={(val: number, name: string) => [
                      `${formatLKR(val)} (${
                        totalRevenuePaise > 0
                          ? ((val / totalRevenuePaise) * 100).toFixed(2)
                          : "0.00"
                      }%)`,
                      name,
                    ]}
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      borderColor: "#334155",
                      borderRadius: "8px",
                      color: "#F8FAFC",
                      fontSize: "12px",
                    }}
                  />
                  <Pie
                    data={distributionData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={85}
                    outerRadius={125}
                    paddingAngle={4}
                    stroke="#1E293B"
                    strokeWidth={3}
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Total Revenue Center Overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mb-0.5">
                  Total Revenue
                </span>
                <span className="text-lg sm:text-2xl font-bold font-mono text-slate-50 tabular-nums">
                  {formatLKR(totalRevenuePaise, false)}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">{rangeLabel}</span>
              </div>
            </div>

            {/* Category Breakdown & Detailed Legend */}
            <div className="md:col-span-6 lg:col-span-7 flex flex-col justify-center space-y-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Category Contribution Breakdown
              </h4>

              <div className="space-y-3">
                {distributionData.map(service => {
                  return (
                    <div
                      key={service.name}
                      className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-700/60 transition-all hover:border-slate-500/50"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: service.color }}
                          />
                          <span className="text-sm font-semibold text-slate-100">{service.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold font-mono text-slate-50 tabular-nums">
                            {formatLKR(service.value)}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded text-xs font-semibold tabular-nums"
                            style={{
                              backgroundColor: `${service.color}18`,
                              color: service.color,
                              border: `1px solid ${service.color}35`,
                            }}
                          >
                            {service.percentage.toFixed(2)}%
                          </span>
                        </div>
                      </div>

                      {/* Percentage progress bar */}
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.max(0, service.percentage))}%`,
                            backgroundColor: service.color,
                          }}
                        />
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                        <span>
                          {service.name === "Soft Drinks"
                            ? `${service.count} bottles sold`
                            : `${service.count} recorded sessions`}
                        </span>
                        <span>Collected: {formatLKR(service.collections)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── FOURTH ROW: REVENUE COMPARISON BAR CHART ──────────────────────── */}
      <div
        className="rounded-xl p-5"
        style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-sky-400" /> Business Performance by Service
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Comparative analysis across business activities for {rangeLabel}
            </p>
          </div>

          {/* Metric Selector Toggle */}
          <div
            className="flex items-center rounded-lg p-0.5 bg-slate-900 border border-slate-700 text-xs"
          >
            {(
              [
                ["revenue", "Revenue (Rs.)"],
                ["volume", "Sessions / Sales Count"],
                ["collections", "Collections (Rs.)"],
              ] as const
            ).map(([mKey, mLabel]) => (
              <button
                key={mKey}
                onClick={() => setBarMetric(mKey)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  barMetric === mKey
                    ? "bg-slate-700 text-sky-400 font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {mLabel}
              </button>
            ))}
          </div>
        </div>

        {barChartData.every(b => b.value === 0) ? (
          <div className="h-56 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-700/60 rounded-lg">
            <BarChart3 className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-sm font-medium text-slate-400">No service activity recorded for this period</p>
            <p className="text-xs text-slate-500 mt-1">
              Comparison bars will show Pool Table, PS4, and Soft Drinks metrics when transactions occur.
            </p>
          </div>
        ) : (
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 15, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#64748B"
                  tick={{ fill: "#94A3B8", fontSize: 12, fontWeight: 500, fontFamily: "Poppins" }}
                  tickLine={false}
                  axisLine={{ stroke: "#334155" }}
                />
                <YAxis
                  stroke="#64748B"
                  tick={{ fill: "#94A3B8", fontSize: 11, fontFamily: "Montserrat", fontWeight: 700 }}
                  tickLine={false}
                  axisLine={{ stroke: "#334155" }}
                  tickFormatter={val =>
                    barMetric === "volume"
                      ? `${val}`
                      : val >= 1000
                      ? `Rs.${(val / 1000).toFixed(0)}k`
                      : `Rs.${val}`
                  }
                />
                <Tooltip
                  cursor={{ fill: "rgba(51, 65, 85, 0.4)" }}
                  content={<AnalyticsTooltip />}
                />
                <Bar dataKey="value" name={barMetric.toUpperCase()} radius={[6, 6, 0, 0]}>
                  {barChartData.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── FIFTH ROW: COMPACT ANALYTICS PANELS (4 Panels in responsive grid) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Panel A: Payment Status */}
        <div
          className="rounded-xl p-4 flex flex-col justify-between"
          style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Payment Status
              </h4>
              <Link
                to="/outstanding-payments"
                className="text-[11px] text-sky-400 hover:underline inline-flex items-center"
              >
                Manage <ArrowRight className="w-2.5 h-2.5 ml-0.5" />
              </Link>
            </div>

            <p className="text-xs text-slate-400 mb-3">Settlement breakdown for {rangeLabel}</p>

            {/* Stacked Progress Bar */}
            {paymentStatus?.total_sessions ? (
              <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-900 mb-4">
                <div
                  title="Fully Paid"
                  style={{
                    width: `${((paymentStatus.paid.count / paymentStatus.total_sessions) * 100).toFixed(1)}%`,
                    backgroundColor: "#22C55E",
                  }}
                />
                <div
                  title="Partially Paid"
                  style={{
                    width: `${((paymentStatus.partial.count / paymentStatus.total_sessions) * 100).toFixed(1)}%`,
                    backgroundColor: "#F59E0B",
                  }}
                />
                <div
                  title="Unpaid / Pending"
                  style={{
                    width: `${((paymentStatus.pending.count / paymentStatus.total_sessions) * 100).toFixed(1)}%`,
                    backgroundColor: "#EF4444",
                  }}
                />
              </div>
            ) : (
              <div className="w-full h-2 rounded-full bg-slate-800 mb-4" />
            )}

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-slate-900/40">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Fully Paid
                </span>
                <span className="font-mono text-slate-200 font-medium">
                  {paymentStatus?.paid.count ?? 0} sessions · {formatLKR(paymentStatus?.paid.amount_paise ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-900/40">
                <span className="flex items-center gap-1.5 text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> Part Paid
                </span>
                <span className="font-mono text-slate-200 font-medium">
                  {paymentStatus?.partial.count ?? 0} sessions · {formatLKR(paymentStatus?.partial.outstanding_paise ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-900/40">
                <span className="flex items-center gap-1.5 text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> Pending
                </span>
                <span className="font-mono text-slate-200 font-medium">
                  {paymentStatus?.pending.count ?? 0} sessions · {formatLKR(paymentStatus?.pending.outstanding_paise ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Panel B: Collection Method & Liquidity */}
        <div
          className="rounded-xl p-4 flex flex-col justify-between"
          style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-sky-400" /> Collections & Liquidity
              </h4>
              <Link
                to="/accounts"
                className="text-[11px] text-sky-400 hover:underline inline-flex items-center"
              >
                Ledger <ArrowRight className="w-2.5 h-2.5 ml-0.5" />
              </Link>
            </div>

            <p className="text-xs text-slate-400 mb-3">Receipts by channel in {rangeLabel}</p>

            <div className="space-y-2 text-xs mb-4">
              <div className="flex items-center justify-between p-2 rounded bg-slate-900/40">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-emerald-400" /> Cash Collections
                </span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {formatLKR(collectionsMethod?.cash_collected_paise ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-900/40">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-sky-400" /> Bank Transfer
                </span>
                <span className="font-mono text-sky-400 font-semibold">
                  {formatLKR(collectionsMethod?.bank_collected_paise ?? 0)}
                </span>
              </div>
            </div>

            {/* Live Account Balances: Operating Cash/Bank separated from Business Savings */}
            <div className="pt-2 border-t border-slate-700/60 space-y-1.5 text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>Cash in Hand</span>
                <span className="font-mono text-slate-200 font-medium">
                  {formatLKR(accounts?.cash_balance_paise ?? 0)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Main Bank Account</span>
                <span className="font-mono text-slate-200 font-medium">
                  {formatLKR(accounts?.bank_balance_paise ?? 0)}
                </span>
              </div>
              <div className="flex justify-between text-emerald-400 font-semibold border-t border-slate-700/40 pt-1">
                <span>Total Available Business Money</span>
                <span className="font-mono">
                  {formatLKR((accounts?.cash_balance_paise ?? 0) + (accounts?.bank_balance_paise ?? 0))}
                </span>
              </div>
              <div className="flex justify-between text-indigo-300 font-medium pt-0.5">
                <span>Business Savings</span>
                <span className="font-mono">
                  {formatLKR(accounts?.total_savings_paise ?? accounts?.savings_balance_paise ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Panel C: Expense Overview */}
        <div
          className="rounded-xl p-4 flex flex-col justify-between"
          style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-rose-400" /> Expense Overview
              </h4>
              <Link
                to="/expenses"
                className="text-[11px] text-sky-400 hover:underline inline-flex items-center"
              >
                All <ArrowRight className="w-2.5 h-2.5 ml-0.5" />
              </Link>
            </div>

            <p className="text-xs text-slate-400 mb-3">Recorded expenses by category</p>

            {expensesList.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No expenses recorded for this period.
              </div>
            ) : (
              <div className="space-y-2 text-xs max-h-44 overflow-y-auto pr-1">
                {expensesList.slice(0, 5).map(cat => (
                  <div key={cat.category_id} className="p-2 rounded bg-slate-900/40">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-300 truncate font-medium">{cat.category_name}</span>
                      <span className="font-mono text-slate-100 font-semibold">
                        {formatLKR(cat.amount_paise)}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rose-400 rounded-full"
                        style={{ width: `${Math.min(100, Math.max(0, cat.percentage))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-slate-700/60 flex justify-between text-xs">
            <span className="text-slate-400">Total Expenses</span>
            <span className="font-mono text-rose-400 font-semibold">
              {formatLKR(kpis?.total_expenses_paise ?? 0)}
            </span>
          </div>
        </div>

        {/* Panel D: Drinks Stock Overview */}
        <div
          className="rounded-xl p-4 flex flex-col justify-between"
          style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Coffee className="w-3.5 h-3.5 text-amber-400" /> Drinks Stock Overview
              </h4>
              <Link
                to="/drinks/inventory"
                className="text-[11px] text-sky-400 hover:underline inline-flex items-center"
              >
                Stock <ArrowRight className="w-2.5 h-2.5 ml-0.5" />
              </Link>
            </div>

            <p className="text-xs text-slate-400 mb-3">Inventory status & attention alerts</p>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="p-2 rounded bg-slate-900/60 border border-slate-700/60 text-center">
                <span className="text-[10px] text-slate-400 uppercase">In Stock</span>
                <p className="text-lg font-bold font-mono text-slate-100 mt-0.5">
                  {inventory?.total_bottles_in_stock ?? 0}
                </p>
                <span className="text-[10px] text-slate-400">Bottles total</span>
              </div>
              <div className="p-2 rounded bg-slate-900/60 border border-slate-700/60 text-center">
                <span className="text-[10px] text-slate-400 uppercase">Low Stock</span>
                <p
                  className={`text-lg font-bold font-mono mt-0.5 ${
                    (inventory?.low_stock_products_count ?? 0) > 0 ? "text-amber-400" : "text-emerald-400"
                  }`}
                >
                  {inventory?.low_stock_products_count ?? 0}
                </p>
                <span className="text-[10px] text-slate-400">Products alert</span>
              </div>
            </div>

            {/* Product items mini list */}
            {inventory?.products && inventory.products.length > 0 ? (
              <div className="space-y-1.5 text-[11px] max-h-28 overflow-y-auto">
                {inventory.products.slice(0, 3).map(p => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-slate-900/40"
                  >
                    <span className="text-slate-300 truncate">{p.name}</span>
                    <span
                      className={`font-mono font-medium ${
                        p.is_low ? "text-amber-400" : "text-slate-200"
                      }`}
                    >
                      {p.current_stock} pcs
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-2">No active drink products configured.</p>
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs">
            <span className="text-slate-400">Sales Book</span>
            <Link to="/drinks/sales" className="text-amber-400 hover:underline font-medium text-[11px]">
              Open Sales &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* ── SIXTH SECTION: RECENT ACTIVITY / SESSIONS (Preserved) ─────────── */}
      <div
        className="rounded-xl p-5"
        style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" /> Recent Sessions
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live playing sessions logged in the management ledger
            </p>
          </div>
          <div className="flex gap-3 text-xs">
            <Link
              to="/sessions/pool"
              className="flex items-center gap-1 text-sky-400 hover:text-sky-300 transition-colors"
            >
              Pool Sessions <ArrowRight className="w-3 h-3" />
            </Link>
            <Link
              to="/sessions/ps4"
              className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
            >
              PS4 Sessions <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {recentSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <CircleDot className="w-8 h-8 mb-2.5 opacity-25 text-slate-500" />
            <p className="text-sm font-medium text-slate-400">No sessions recorded yet</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Use "+ New Pool" or "+ New PS4" in the header to start a game session.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/60">
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-400">Type</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-400">Reference</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-400">Player / Customer</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-400">Duration</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-400">Charge</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map(s => (
                  <tr
                    key={`${s.svcType}-${s.id}`}
                    className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-2.5 px-3">
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium"
                        style={
                          s.svcType === "Pool"
                            ? {
                                backgroundColor: "rgba(56,189,248,0.12)",
                                color: "#38BDF8",
                                border: "1px solid rgba(56,189,248,0.25)",
                              }
                            : {
                                backgroundColor: "rgba(129,140,248,0.12)",
                                color: "#818CF8",
                                border: "1px solid rgba(129,140,248,0.25)",
                              }
                        }
                      >
                        {s.svcType === "Pool" ? (
                          <CircleDot className="w-2.5 h-2.5" />
                        ) : (
                          <Gamepad2 className="w-2.5 h-2.5" />
                        )}
                        {s.svcType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">{s.reference}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-200">
                      {s.customer_name || <span className="text-slate-500">Walk-in</span>}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">{s.duration_minutes} min</td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-100">
                      {formatLKR(s.final_charge_paise)}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={s.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
export default DashboardPage;
