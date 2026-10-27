/**
 * AppLayout — main application shell with permanently expanded sidebar navigation.
 * Uses the specified dark palette: bg #0F172A, surface #1E293B, accent #38BDF8.
 * Bold, readable ~14px navigation typography.
 * Pool Town branded.
 */
import React from "react";
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
      { path: "/sessions/pool",        label: "Pool Board",           icon: CircleDot },
      { path: "/sessions/ps4",         label: "PS4 Gaming",           icon: Gamepad2 },
      { path: "/players",              label: "Players",              icon: Users },
      { path: "/outstanding-payments", label: "Outstanding Payments", icon: CreditCard },
    ],
  },
  {
    label: "Soft Drinks",
    items: [
      { path: "/drinks/inventory",     label: "Inventory",            icon: Coffee },
      { path: "/drinks/sales",         label: "Sales Book",           icon: ShoppingCart },
      { path: "/drinks/issues",        label: "Stock & Sales Issues", icon: AlertTriangle },
    ],
  },
  {
    label: "Finance",
    items: [
      { path: "/expenses",             label: "Expenses",             icon: Receipt },
      { path: "/cash-bank",            label: "Cash & Bank",          icon: Banknote },
      { path: "/savings",              label: "Savings",              icon: PiggyBank },
      { path: "/owners-loans",         label: "Partners",             icon: UserCheck },
      { path: "/loans",                label: "Loans",                icon: HandCoins },
      { path: "/equipment",            label: "Equipment & Repairs",  icon: Wrench },
      { path: "/damage-charges",       label: "Damage Charges",       icon: ShieldAlert },
    ],
  },
  {
    label: "Reports",
    items: [
      { path: "/reports/daily",        label: "Daily Report",         icon: BarChart3 },
      { path: "/reports/weekly",       label: "Weekly Report",        icon: BarChart3 },
      { path: "/reports/monthly",      label: "Monthly Report",       icon: BarChart3 },
      { path: "/reports",              label: "All Reports",          icon: BarChart3, exact: true },
    ],
  },
  {
    label: "Administration",
    items: [
      { path: "/month-end",            label: "Month-End Closing",    icon: CalendarCheck },
      { path: "/transactions",         label: "Transaction History",  icon: History },
      { path: "/accounts",             label: "Accounting Ledger",    icon: Database },
      { path: "/settings",             label: "Settings",             icon: Settings },
      { path: "/backup",               label: "Backup & Restore",     icon: Database },
    ],
  },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const location = useLocation();
  const { logout, username } = useAuth();
  const [time, setTime] = React.useState("");
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);

  React.useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  const isActive = (path: string, exact = false) => {
    if (exact) return location.pathname === path;
    if (path === "/reports") return location.pathname === "/reports";
    if (path === "/owners-loans") return location.pathname === "/owners-loans" || location.pathname === "/partners";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "#0F172A", color: "#F8FAFC" }}>
      {/* ── Sidebar (Always expanded, fixed w-64, no collapse button) ── */}
      <aside
        className="w-64 shrink-0 flex flex-col border-r"
        style={{ backgroundColor: "#1E293B", borderColor: "#334155" }}
      >
        {/* Brand — Pool Town */}
        <div
          className="flex items-center gap-3 px-4 py-4 border-b shrink-0"
          style={{ borderColor: "#334155" }}
        >
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 overflow-hidden shadow-sm"
            style={{ backgroundColor: "#fff" }}
          >
            <img
              src="/images/pool-town-logo.jpeg"
              alt="Pool Town"
              className="w-8 h-8 object-contain"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-white truncate font-display">
              POOL TOWN
            </h1>
            <p className="text-[11px] font-medium text-slate-400 truncate">
              Management & Accounting
            </p>
          </div>
        </div>

        {/* Navigation items: Bold, ~14px, readable */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-4 px-2.5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-2.5 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path, item.exact);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors duration-150 ${
                        active
                          ? "bg-sky-500/15 text-sky-400 font-bold border border-sky-500/30"
                          : "text-slate-300 hover:text-white hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${active ? "text-sky-400" : "text-slate-400"}`} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer / Logout Button */}
        <div className="shrink-0 border-t p-3" style={{ borderColor: "#334155" }}>
          <button
            onClick={() => setShowLogoutModal(true)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-bold text-slate-300 hover:text-rose-400 hover:bg-rose-500/10 transition-colors duration-150"
          >
            <LogOut className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-rose-400" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header — Currency description text removed */}
        <header
          className="h-12 shrink-0 flex items-center justify-between px-6 border-b"
          style={{ backgroundColor: "#1E293B", borderColor: "#334155" }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="inline-block w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: "#22C55E" }}
            />
            <span className="text-xs font-semibold text-slate-300">Pool Town ERP</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Live Clock */}
            <div
              className="flex items-center gap-1.5 text-xs font-mono font-medium px-3 py-1 rounded-md"
              style={{ backgroundColor: "#0F172A", color: "#94A3B8", border: "1px solid #334155" }}
            >
              <Clock className="w-3.5 h-3.5" style={{ color: "#38BDF8" }} />
              <span>{time || "…"}</span>
            </div>
            {/* Authenticated user badge */}
            <div
              className="flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-md"
              style={{ backgroundColor: "#0F172A", color: "#F8FAFC", border: "1px solid #334155" }}
            >
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              <span>{username || "admin"}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-screen-2xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* ── Logout Confirmation Dialog ── */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150"
            style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-rose-500/15 text-rose-400 shrink-0 border border-rose-500/20">
                <LogOut className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-white">Confirm Logout</h3>
                <p className="text-sm text-slate-300">
                  Are you sure you want to log out?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white text-sm font-semibold hover:bg-slate-750 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutModal(false);
                  logout();
                }}
                className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold shadow-lg shadow-rose-900/30 transition flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
