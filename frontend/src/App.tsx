/**
 * Root application component.
 * Auth-gated: shows LoginPage when unauthenticated, full app when authenticated.
 */
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AppLayout }    from "@/components/layout/AppLayout";
import { LoginPage }    from "@/pages/LoginPage";

// Daily Operations
import { DashboardPage }           from "@/pages/DashboardPage";
import { PoolSessionsPage }        from "@/pages/PoolSessionsPage";
import { PS4SessionsPage }         from "@/pages/PS4SessionsPage";
import { PlayersPage }             from "@/pages/PlayersPage";
import { OutstandingPaymentsPage } from "@/pages/OutstandingPaymentsPage";

// Soft Drinks
import { SoftDrinksInventoryPage } from "@/pages/SoftDrinksInventoryPage";
import { SoftDrinksSalesPage }     from "@/pages/SoftDrinksSalesPage";
import { StockIssuesPage }         from "@/pages/StockIssuesPage";

// Finance / Accounting
import { ExpensesPage }            from "@/pages/ExpensesPage";
import { AccountsPage }            from "@/pages/AccountsPage";
import { SavingsPage }             from "@/pages/SavingsPage";
import { OwnersLoansPage }         from "@/pages/OwnersLoansPage";
import { LoansPage }               from "@/pages/LoansPage";
import { EquipmentPage }           from "@/pages/EquipmentPage";
import { DamageChargesPage }       from "@/pages/DamageChargesPage";
import { InventoryPage }           from "@/pages/InventoryPage";

// Reports
import { ReportsPage }             from "@/pages/ReportsPage";
import { DailyReportPage }         from "@/pages/DailyReportPage";
import { WeeklyReportPage }        from "@/pages/WeeklyReportPage";
import { MonthlyReportPage }       from "@/pages/MonthlyReportPage";

// Administration
import { MonthEndPage }            from "@/pages/MonthEndPage";
import { TransactionsPage }        from "@/pages/TransactionsPage";
import { SettingsPage }            from "@/pages/SettingsPage";
import { BackupPage }              from "@/pages/BackupPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

/** Inner shell — reads AuthContext (must be inside AuthProvider) */
const AppShell: React.FC = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => {/* AuthContext.login() updates state */}} />;
  }

  return (
    <AppLayout>
      <Routes>
        {/* ── Overview ──────────────────────────────────────────────── */}
        <Route path="/"                      element={<DashboardPage />} />

        {/* ── Daily Operations ──────────────────────────────────────── */}
        <Route path="/sessions/pool"         element={<PoolSessionsPage />} />
        <Route path="/sessions/ps4"          element={<PS4SessionsPage />} />
        <Route path="/players"               element={<PlayersPage />} />
        <Route path="/outstanding-payments"  element={<OutstandingPaymentsPage />} />

        {/* ── Soft Drinks ───────────────────────────────────────────── */}
        <Route path="/drinks/inventory"      element={<SoftDrinksInventoryPage />} />
        <Route path="/drinks/sales"          element={<SoftDrinksSalesPage />} />
        <Route path="/drinks/issues"         element={<StockIssuesPage />} />

        {/* ── Finance ───────────────────────────────────────────────── */}
        <Route path="/expenses"              element={<ExpensesPage />} />
        <Route path="/cash-bank"             element={<AccountsPage />} />
        <Route path="/savings"               element={<SavingsPage />} />
        <Route path="/owners-loans"          element={<OwnersLoansPage />} />
        <Route path="/loans"                 element={<LoansPage />} />
        <Route path="/equipment"             element={<EquipmentPage />} />
        <Route path="/damage-charges"        element={<DamageChargesPage />} />

        {/* ── Reports ───────────────────────────────────────────────── */}
        <Route path="/reports"               element={<ReportsPage />} />
        <Route path="/reports/daily"         element={<DailyReportPage />} />
        <Route path="/reports/weekly"        element={<WeeklyReportPage />} />
        <Route path="/reports/monthly"       element={<MonthlyReportPage />} />

        {/* ── Administration ────────────────────────────────────────── */}
        <Route path="/month-end"             element={<MonthEndPage />} />
        <Route path="/transactions"          element={<TransactionsPage />} />
        <Route path="/accounts"              element={<AccountsPage />} />
        <Route path="/settings"              element={<SettingsPage />} />
        <Route path="/backup"                element={<BackupPage />} />

        {/* ── Legacy paths ──────────────────────────────────────────── */}
        <Route path="/inventory"             element={<InventoryPage />} />

        {/* ── Catch-all ─────────────────────────────────────────────── */}
        <Route path="*"                      element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
};

export const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
