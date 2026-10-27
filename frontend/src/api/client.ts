/**
 * Authoritative API client for the Billiard Hall Management backend.
 * Uses typed endpoints and standard fetch.
 * Automatically injects the X-Auth-Token header from sessionStorage on every request.
 */
import type {
  SystemInfo,
  Player,
  PlayerCreate,
  PoolSession,
  PoolSessionCreate,
  PS4Session,
  PS4SessionCreate,
  SessionPayment,
  SessionPaymentCreate,
  Product,
  Expense,
  ExpenseCreate,
  ExpenseCategory,
  FinancialAccount,
  AccountTransfer,
  AccountTransferCreate,
  TrialBalanceRow,
  CashCount,
  CashCountCreate,
  BankReconciliation,
  BankReconciliationCreate,
  AccountingPeriod,
  OwnerDetail,
  OwnerTransaction,
  OwnerTransactionCreate,
  Loan,
  LoanCreate,
  LoanRepaymentCreate,
  LoanTransaction,
  ProfitAllocationPreview,
  ProfitAllocationPost,
  BackupSnapshot,
  EquipmentPurchase,
  EquipmentPurchaseCreate,
  DamageCharge,
  DamageChargeCreate,
  DamagePaymentCreate,
  OutstandingSession,
  JournalEntryItem,
  PartnerMonthlyDistributionSummary,
  PricingRatesResponse,
  PricingRatesUpdate,
  DailyReportData,
  WeeklyReportData,
  MonthlyReportData,
  DashboardAnalyticsData,
  BusinessProfile,
  OwnerCollection,
  OwnerCollectionCreate,
  OwnerCollectionConfirm,
} from "../types";

export interface ProductCreateInput {
  name: string;
  category_id?: number | null;
  unit: string;
  selling_price_paise: number;
  average_cost_paise: number;
  opening_stock: number;
  reorder_level: number;
}

export interface ExpensePaymentCreateInput {
  payment_date: string;
  amount_paise: number;
  payment_method: "cash" | "bank_transfer" | "savings";
  notes?: string;
}

export interface ExpensePaymentResponse {
  id: number;
  reference: string;
  expense_id: number;
  payment_date: string;
  amount_paise: number;
  payment_method: string;
  account_id?: number | null;
  notes?: string | null;
  created_at: string;
}

export interface PlayerUpdate {
  name?: string;
  phone?: string;
  notes?: string;
  is_active?: boolean;
}

export interface AdminResetResponse {
  success: boolean;
  backup_file: string;
  message: string;
  tables_cleared: string[];
  cleared_at: string;
}

const API_BASE = "/api";
const TOKEN_STORAGE_KEY = "bh_session_token";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  // Automatically inject the auth token from sessionStorage
  const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["X-Auth-Token"] = token;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = "An unexpected error occurred";
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errJson.message || errorDetail;
    } catch {
      errorDetail = `Server returned ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export async function downloadExport(endpoint: string, fallbackFilename: string): Promise<void> {
  const url = `${API_BASE}${endpoint}`;
  const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  const headers: Record<string, string> = {};
  if (token) {
    headers["X-Auth-Token"] = token;
  }
  const response = await fetch(url, { headers });
  if (!response.ok) {
    let msg = `Export failed (${response.status})`;
    try {
      const err = await response.json();
      msg = err.detail || msg;
    } catch {}
    throw new Error(msg);
  }

  let filename = fallbackFilename;
  const disposition = response.headers.get("Content-Disposition");
  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(downloadUrl);
}


export const api = {
  // System
  getHealth: () => request<{ status: string; app: string; version: string; server_time: string }>("/health"),
  getSystemInfo: () => request<SystemInfo>("/info"),

  // Pricing calculations
  pricing: {
    calculatePool: (chargeable_minutes: number, discount_paise: number = 0) =>
      request<{
        duration_minutes: number;
        standard_charge_paise: number;
        discount_paise: number;
        final_charge_paise: number;
        calculation_breakdown: string;
      }>("/pricing/pool/calculate", {
        method: "POST",
        body: JSON.stringify({ chargeable_minutes, discount_paise }),
      }),

    calculatePS4: (minutes: number, player_count: 1 | 2, discount_paise: number = 0) =>
      request<{
        duration_minutes: number;
        player_count: number;
        standard_charge_paise: number;
        discount_paise: number;
        final_charge_paise: number;
      }>("/pricing/ps4/calculate", {
        method: "POST",
        body: JSON.stringify({ minutes, player_count, discount_paise }),
      }),

    getRates: () => request<PricingRatesResponse>("/pricing/rates"),
    updateRates: (data: PricingRatesUpdate) =>
      request<PricingRatesResponse>("/pricing/rates", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
  },

  // Players
  players: {
    list: (search?: string) => request<Player[]>(search ? `/players?search=${encodeURIComponent(search)}` : "/players"),
    get: (id: number) => request<Player>(`/players/${id}`),
    create: (data: PlayerCreate) =>
      request<Player>("/players", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: PlayerUpdate) =>
      request<Player>(`/players/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request<{ message: string; deleted: boolean }>(`/players/${id}`, {
        method: "DELETE",
      }),
    merge: (primary_player_id: number, duplicate_player_id: number) =>
      request<{ success: boolean; message: string; primary_player: Player; sessions_moved: number }>("/players/merge", {
        method: "POST",
        body: JSON.stringify({ primary_player_id, duplicate_player_id }),
      }),
  },

  // Pool Sessions
  poolSessions: {
    list: (params?: { date?: string; status?: string }) => {
      const query = new URLSearchParams();
      if (params?.date) query.set("date", params.date);
      if (params?.status) query.set("status", params.status);
      const q = query.toString();
      return request<PoolSession[]>(q ? `/sessions/pool?${q}` : "/sessions/pool");
    },
    get: (id: number) => request<PoolSession>(`/sessions/pool/${id}`),
    create: (data: PoolSessionCreate) =>
      request<PoolSession>("/sessions/pool", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    void: (id: number, admin_username: string, admin_password: string, reason?: string) =>
      request<{ success: boolean; reference: string; status: string; payments_reversed: number; reason: string; voided_by: string; voided_at: string }>(
        `/sessions/pool/${id}/void`, {
        method: "POST",
        body: JSON.stringify({ admin_username, admin_password, reason }),
      }),
  },

  // PS4 Sessions
  ps4Sessions: {
    list: (params?: { date?: string; status?: string }) => {
      const query = new URLSearchParams();
      if (params?.date) query.set("date", params.date);
      if (params?.status) query.set("status", params.status);
      const q = query.toString();
      return request<PS4Session[]>(q ? `/sessions/ps4?${q}` : "/sessions/ps4");
    },
    get: (id: number) => request<PS4Session>(`/sessions/ps4/${id}`),
    create: (data: PS4SessionCreate) =>
      request<PS4Session>("/sessions/ps4", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    void: (id: number, admin_username: string, admin_password: string, reason?: string) =>
      request<{ success: boolean; reference: string; status: string; payments_reversed: number; reason: string; voided_by: string; voided_at: string }>(
        `/sessions/ps4/${id}/void`, {
        method: "POST",
        body: JSON.stringify({ admin_username, admin_password, reason }),
      }),
  },

  // Payments
  payments: {
    record: (data: SessionPaymentCreate) =>
      request<SessionPayment>("/payments/session", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listForSession: (session_type: "pool" | "ps4", session_id: number) =>
      request<SessionPayment[]>(`/payments/session?session_type=${session_type}&session_id=${session_id}`),
    getOutstandingSessions: (player_id?: number, session_type?: string) => {
      const q = new URLSearchParams();
      if (player_id) q.set("player_id", player_id.toString());
      if (session_type) q.set("session_type", session_type);
      const queryStr = q.toString();
      return request<OutstandingSession[]>(queryStr ? `/payments/outstanding?${queryStr}` : "/payments/outstanding");
    },
  },

  // Drinks (Soft Drinks)
  drinks: {
    listProducts: (include_inactive?: boolean) =>
      request<any[]>(include_inactive ? "/drinks/products?include_inactive=true" : "/drinks/products"),
    listSales: (sale_date?: string) =>
      request<any[]>(sale_date ? `/drinks/sales?sale_date=${sale_date}` : "/drinks/sales"),
    cancelSale: (sale_id: number, admin_username: string, admin_password: string, reason?: string) =>
      request<{ success: boolean; reference: string; status: string; quantity_restored: number; revenue_reversed_paise: number; reason: string; cancelled_at: string }>(
        `/drinks/sales/${sale_id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ admin_username, admin_password, reason }),
      }),
  },

  // Inventory
  inventory: {
    listProducts: () => request<Product[]>("/inventory/products"),
    createProduct: (data: ProductCreateInput) =>
      request<Product>("/inventory/products", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  // Expenses
  expenses: {
    list: () => request<Expense[]>("/expenses"),
    listCategories: () => request<ExpenseCategory[]>("/expenses/categories"),
    create: (data: ExpenseCreate) =>
      request<Expense>("/expenses", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listPayments: (expense_id: number) =>
      request<ExpensePaymentResponse[]>(`/expenses/${expense_id}/payments`),
    payBill: (expense_id: number, data: ExpensePaymentCreateInput) =>
      request<ExpensePaymentResponse>(`/expenses/${expense_id}/payments`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  // Accounts & Ledger
  accounts: {
    list: () => request<FinancialAccount[]>("/accounts"),
    getTrialBalance: () => request<TrialBalanceRow[]>("/accounts/trial-balance"),
    createTransfer: (data: AccountTransferCreate) =>
      request<{ message: string; reference: string }>("/accounts/transfers", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listTransfers: (limit: number = 50) =>
      request<AccountTransfer[]>(`/accounts/transfers?limit=${limit}`),

    // Cash & Bank Reconciliation
    getExpectedCash: (as_of_date?: string) =>
      request<{ account_code: string; account_name: string; as_of_date: string; expected_paise: number }>(
        as_of_date ? `/accounts/reconciliation/cash-expected?as_of_date=${as_of_date}` : "/accounts/reconciliation/cash-expected"
      ),
    recordCashCount: (data: CashCountCreate) =>
      request<CashCount>("/accounts/reconciliation/cash-count", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listCashCounts: (limit: number = 50) =>
      request<CashCount[]>(`/accounts/reconciliation/cash-counts?limit=${limit}`),

    getExpectedBank: (account_id: number, as_of_date?: string) =>
      request<{ account_id: number; account_code: string; account_name: string; as_of_date: string; book_balance_paise: number }>(
        as_of_date
          ? `/accounts/reconciliation/bank-expected?account_id=${account_id}&as_of_date=${as_of_date}`
          : `/accounts/reconciliation/bank-expected?account_id=${account_id}`
      ),
    recordBankReconciliation: (data: BankReconciliationCreate) =>
      request<BankReconciliation>("/accounts/reconciliation/bank-reconciliation", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listBankReconciliations: (account_id?: number, limit: number = 50) => {
      const q = account_id ? `account_id=${account_id}&limit=${limit}` : `limit=${limit}`;
      return request<BankReconciliation[]>(`/accounts/reconciliation/bank-reconciliations?${q}`);
    },

    // Accounting Periods
    listPeriods: () => request<AccountingPeriod[]>("/accounts/periods"),
    closePeriod: (year: number, month: number, closed_by: string = "Admin") =>
      request<AccountingPeriod>(`/accounts/periods/${year}/${month}/close`, {
        method: "POST",
        body: JSON.stringify({ closed_by }),
      }),
    reopenPeriod: (year: number, month: number, reason: string, reopened_by: string = "Admin") =>
      request<AccountingPeriod>(`/accounts/periods/${year}/${month}/reopen`, {
        method: "POST",
        body: JSON.stringify({ reason, reopened_by }),
      }),

    // Opening Balances
    getOpeningBalances: () =>
      request<{ posted: boolean; reference?: string; entry_date?: string; description?: string; lines?: any[] }>("/accounts/opening-balances"),
    postOpeningBalances: (data: any) =>
      request<{ message: string; reference: string; entry_id: number }>("/accounts/opening-balances", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    // Transaction History / General Ledger
    listTransactions: (params?: { start_date?: string; end_date?: string; account_code?: string; source_type?: string; search?: string; limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params?.start_date) q.set("start_date", params.start_date);
      if (params?.end_date) q.set("end_date", params.end_date);
      if (params?.account_code) q.set("account_code", params.account_code);
      if (params?.source_type) q.set("source_type", params.source_type);
      if (params?.search) q.set("search", params.search);
      if (params?.limit) q.set("limit", params.limit.toString());
      if (params?.offset) q.set("offset", params.offset.toString());
      const queryStr = q.toString();
      return request<{ total: number; offset: number; limit: number; items: JournalEntryItem[] }>(queryStr ? `/accounts/transactions?${queryStr}` : "/accounts/transactions");
    },
  },

  // Owners, Capital & Loans
  owners: {
    list: () => request<OwnerDetail[]>("/owners"),
    listTransactions: (owner_id?: number, limit: number = 50) => {
      const q = owner_id ? `owner_id=${owner_id}&limit=${limit}` : `limit=${limit}`;
      return request<OwnerTransaction[]>(`/owners/transactions?${q}`);
    },
    recordTransaction: (data: OwnerTransactionCreate) =>
      request<OwnerTransaction>("/owners/transactions", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    // Loans
    listLoans: (status?: string) =>
      request<Loan[]>(status ? `/owners/loans?status=${status}` : "/owners/loans"),
    createLoan: (data: LoanCreate) =>
      request<Loan>("/owners/loans", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listLoanTransactions: (loan_id: number) =>
      request<LoanTransaction[]>(`/owners/loans/${loan_id}/transactions`),
    recordLoanRepayment: (loan_id: number, data: LoanRepaymentCreate) =>
      request<{ message: string; journal_reference: string }>(`/owners/loans/${loan_id}/repayments`, {
        method: "POST",
        body: JSON.stringify(data),
      }),

    getMonthlySummary: (year: number, month: number) =>
      request<PartnerMonthlyDistributionSummary>(`/owners/monthly-summary?year=${year}&month=${month}`),

    previewProfitAllocation: (year: number, month: number) =>
      request<ProfitAllocationPreview>(`/owners/profit-allocation/preview?year=${year}&month=${month}`),
    postProfitAllocation: (data: ProfitAllocationPost) =>
      request<{ message: string; reference: string; journal_reference: string }>("/owners/profit-allocation/post", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    // Collections
    listCollections: (params?: { collector_name?: string; owner_id?: number; status?: string; start_date?: string; end_date?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.collector_name) q.set("collector_name", params.collector_name);
      if (params?.owner_id) q.set("owner_id", params.owner_id.toString());
      if (params?.status) q.set("status", params.status);
      if (params?.start_date) q.set("start_date", params.start_date);
      if (params?.end_date) q.set("end_date", params.end_date);
      if (params?.limit) q.set("limit", params.limit.toString());
      const qs = q.toString() ? `?${q.toString()}` : "";
      return request<OwnerCollection[]>(`/owners/collections${qs}`);
    },
    recordCollection: (data: OwnerCollectionCreate) =>
      request<OwnerCollection>("/owners/collections", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    confirmCollection: (id: number, data: OwnerCollectionConfirm) =>
      request<OwnerCollection>(`/owners/collections/${id}/confirm`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },


  // Authentication
  auth: {
    login: (username: string, password: string) =>
      request<{ token: string; username: string; message: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }),
    logout: (token: string) =>
      request<{ message: string }>(`/auth/logout?token=${encodeURIComponent(token)}`, { method: "POST" }),
    verifyToken: (token: string) =>
      request<{ valid: boolean; username?: string }>(`/auth/verify?token=${encodeURIComponent(token)}`, { method: "POST" }),
    verifyPin: (pin: string) =>
      request<{ valid: boolean }>("/auth/verify-pin", {
        method: "POST",
        body: JSON.stringify({ pin }),
      }),
    changePassword: (current_password: string, new_password: string, new_username?: string) =>
      request<{ message: string }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password, new_password, new_username }),
      }),
    changePin: (current_pin: string, new_pin: string) =>
      request<{ message: string }>(`/auth/change-pin?current_pin=${encodeURIComponent(current_pin)}&new_pin=${encodeURIComponent(new_pin)}`, {
        method: "POST",
      }),
  },

  // Database Backup
  backup: {
    create: (note?: string) =>
      request<BackupSnapshot>("/backup/create", {
        method: "POST",
        body: JSON.stringify({ note: note || "Manual backup" }),
      }),
    list: () => request<BackupSnapshot[]>("/backup/list"),
    restore: (filename: string) =>
      request<{ status: string; restored_from: string; safeguard_backup: string }>("/backup/restore", {
        method: "POST",
        body: JSON.stringify({ filename }),
      }),
  },

  // Equipment & Damage Charges
  equipment: {
    listPurchases: (category?: string, limit: number = 100) => {
      const q = category ? `category=${category}&limit=${limit}` : `limit=${limit}`;
      return request<EquipmentPurchase[]>(`/equipment/purchases?${q}`);
    },
    createPurchase: (data: EquipmentPurchaseCreate) =>
      request<{ message: string; reference: string; id: number }>("/equipment/purchases", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listDamageCharges: (status?: string, player_id?: number) => {
      const q = new URLSearchParams();
      if (status) q.set("status", status);
      if (player_id) q.set("player_id", player_id.toString());
      const queryStr = q.toString();
      return request<DamageCharge[]>(queryStr ? `/equipment/damage-charges?${queryStr}` : "/equipment/damage-charges");
    },
    createDamageCharge: (data: DamageChargeCreate) =>
      request<{ message: string; reference: string; id: number }>("/equipment/damage-charges", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    recordDamagePayment: (charge_id: number, data: DamagePaymentCreate) =>
      request<{ message: string; reference: string }>(`/equipment/damage-charges/${charge_id}/payments`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    waiveDamageCharge: (charge_id: number, resolution_notes: string) =>
      request<{ message: string }>(`/equipment/damage-charges/${charge_id}/waive`, {
        method: "POST",
        body: JSON.stringify({ resolution_notes }),
      }),
  },

  // Reports
  reports: {
    getDaily: (dateStr?: string) =>
      request<DailyReportData>(dateStr ? `/reports/daily?report_date=${dateStr}` : "/reports/daily"),
    getWeekly: (refDate?: string) =>
      request<WeeklyReportData>(refDate ? `/reports/weekly?ref_date=${refDate}` : "/reports/weekly"),
    getMonthly: (year?: number, month?: number) => {
      const q = year && month ? `year=${year}&month=${month}` : "";
      return request<MonthlyReportData>(q ? `/reports/monthly?${q}` : "/reports/monthly");
    },
    getSummary: (dateStr?: string) =>
      request<DailyReportData>(dateStr ? `/reports/summary?report_date=${dateStr}` : "/reports/summary"),
    getAnalytics: (startDate?: string, endDate?: string) => {
      const params = new URLSearchParams();
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      const q = params.toString();
      return request<DashboardAnalyticsData>(q ? `/reports/analytics?${q}` : "/reports/analytics");
    },
    downloadExport: (type: string, queryParams?: Record<string, string | number | undefined>) => {
      const q = new URLSearchParams();
      if (queryParams) {
        Object.entries(queryParams).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
        });
      }
      const qs = q.toString() ? `?${q.toString()}` : "";
      return downloadExport(`/reports/export/${type}${qs}`, `pool_town_${type}.xlsx`);
    },
  },

  // Settings & Configuration
  settings: {
    getProfile: () => request<BusinessProfile>("/settings/profile"),
    updateProfile: (data: Partial<BusinessProfile>) =>
      request<BusinessProfile>("/settings/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
  },


  // Administration
  admin: {
    resetBusinessData: (confirmPhrase: string) =>
      request<AdminResetResponse>("/admin/reset-business-data", {
        method: "POST",
        body: JSON.stringify({ confirm_phrase: confirmPhrase }),
      }),
  },
};


export const apiClient = api;
export default api;
