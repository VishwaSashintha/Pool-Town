/**
 * AppLayout — main application shell with sidebar navigation.
 * Uses the specified dark palette: bg #0F172A, surface #1E293B, accent #38BDF8.
 */
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CircleDot,
  Gamepad2,
  Users,
  CreditCard,
  Coffee,
  ShoppingCart,
  AlertTriangle,
  Receipt,
  Banknote,
  PiggyBank,
  UserCheck,
  HandCoins,
  Wrench,
  ShieldAlert,
  BarChart3,
  CalendarCheck,
  History,
  Settings,
  Database,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Clock,

} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { path: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: "Daily Operations",
    items: [
      { path: "/sessions/pool",       label: "Pool Board",          icon: CircleDot },
      { path: "/sessions/ps4",        label: "PS4 Gaming",          icon: Gamepad2 },
      { path: "/players",             label: "Players",             icon: Users },
      { path: "/outstanding-payments",label: "Outstanding Payments",icon: CreditCard },
    ],
  },
  {
    label: "Soft Drinks",
    items: [
      { path: "/drinks/inventory", label: "Inventory",         icon: Coffee },
      { path: "/drinks/sales",     label: "Sales Book",        icon: ShoppingCart },
      { path: "/drinks/issues",    label: "Stock & Sales Issues", icon: AlertTriangle },
    ],
  },
  {
    label: "Finance",
    items: [
      { path: "/expenses",            label: "Expenses",             icon: Receipt },
      { path: "/cash-bank",           label: "Cash & Bank",          icon: Banknote },
      { path: "/savings",             label: "Savings",              icon: PiggyBank },
      { path: "/owners-loans",        label: "Owner Accounts",       icon: UserCheck },
      { path: "/loans",               label: "Loans",                icon: HandCoins },
      { path: "/equipment",           label: "Equipment & Repairs",  icon: Wrench },
      { path: "/damage-charges",      label: "Damage Charges",       icon: ShieldAlert },
    ],
  },
  {
    label: "Reports",
    items: [
      { path: "/reports/daily",       label: "Daily Report",        icon: BarChart3 },
      { path: "/reports/weekly",      label: "Weekly Report",       icon: BarChart3 },
      { path: "/reports/monthly",     label: "Monthly Report",      icon: BarChart3 },
      { path: "/reports",             label: "All Reports",         icon: BarChart3, exact: true },
    ],
  },
  {
    label: "Administration",
    items: [
      { path: "/month-end",           label: "Month-End Closing",   icon: CalendarCheck },
      { path: "/transactions",        label: "Transaction History",  icon: History },
      { path: "/accounts",            label: "Accounting Ledger",   icon: Database },
      { path: "/settings",            label: "Settings",             icon: Settings },
      { path: "/backup",              label: "Backup & Restore",    icon: Database },
    ],
  },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const location  = useLocation();
  const { logout, username } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [time, setTime] = React.useState("");

  React.useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
      }));
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  const isActive = (path: string, exact = false) => {
    if (exact) return location.pathname === path;
    if (path === "/reports") return location.pathname === "/reports";
    return location.pathname.startsWith(path);
  };

  const sidebarW = collapsed ? "w-14" : "w-56";

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "#0F172A", color: "#F8FAFC" }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={`${sidebarW} shrink-0 flex flex-col transition-all duration-200 ease-in-out border-r`}
        style={{ backgroundColor: "#1E293B", borderColor: "#334155" }}
      >
        {/* Brand */}
        <div
          className="flex items-center gap-2.5 px-3 py-3.5 border-b shrink-0"
          style={{ borderColor: "#334155" }}
        >
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
            style={{ background: "linear-gradient(135deg, #38BDF8, #0EA5E9)", boxShadow: "0 0 10px rgba(56,189,248,0.25)" }}
          >
            <CircleDot className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-tight leading-tight truncate" style={{ color: "#F8FAFC" }}>
                BILLIARD HALL
              </p>
              <p className="text-[10px] font-medium truncate" style={{ color: "#64748B" }}>
                Management System
              </p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(v => !v)}
            className="ml-auto rounded p-1 transition-fast"
            style={{ color: "#64748B" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#F8FAFC")}
            onMouseLeave={e => (e.currentTarget.style.color = "#64748B")}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 space-y-4 px-1.5">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              {!collapsed && (
                <p
                  className="px-2 mb-1 text-[9px] font-semibold uppercase tracking-widest"
                  style={{ color: "#475569" }}
                >
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const Icon   = item.icon;
                  const active = isActive(item.path, item.exact);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs font-medium transition-fast ${
                        collapsed ? "justify-center" : ""
                      }`}
                      style={{
                        backgroundColor: active ? "rgba(56,189,248,0.12)" : "transparent",
                        color: active ? "#38BDF8" : "#94A3B8",
                        border: active ? "1px solid rgba(56,189,248,0.2)" : "1px solid transparent",
                      }}
                      onMouseEnter={e => {
                        if (!active) {
                          e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)";
                          e.currentTarget.style.color = "#F8FAFC";
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) {
                          e.currentTarget.style.backgroundColor = "transparent";
                          e.currentTarget.style.color = "#94A3B8";
                        }
                      }}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer / Logout */}
        <div className="shrink-0 border-t p-2" style={{ borderColor: "#334155" }}>
          <button
            onClick={() => logout()}
            className={`flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md text-xs font-medium transition-fast ${collapsed ? "justify-center" : ""}`}
            style={{ color: "#64748B" }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.1)";
              e.currentTarget.style.color = "#EF4444";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#64748B";
            }}
            title={collapsed ? "Sign out" : undefined}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top Header */}
        <header
          className="h-11 shrink-0 flex items-center justify-between px-5 border-b"
          style={{ backgroundColor: "#1E293B", borderColor: "#334155" }}
        >
          <div className="flex items-center gap-2 text-xs" style={{ color: "#64748B" }}>
            <span
              className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: "#22C55E" }}
            />
            <span>Rs. · Sri Lankan Rupees · Double-entry accounting</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Clock */}
            <div
              className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded"
              style={{ backgroundColor: "#0F172A", color: "#64748B", border: "1px solid #334155" }}
            >
              <Clock className="w-3 h-3" style={{ color: "#38BDF8" }} />
              <span>{time || "…"}</span>
            </div>
            {/* User badge */}
            <div
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded"
              style={{ backgroundColor: "#0F172A", color: "#94A3B8", border: "1px solid #334155" }}
            >
              <span style={{ color: "#38BDF8" }}>●</span>
              <span>{username || "admin"}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-5">
          <div className="max-w-screen-xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
