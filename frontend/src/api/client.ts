/**
 * Authoritative API client for the Billiard Hall Management backend.
 * Uses typed endpoints and standard fetch.
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
  DailyReportData,
  WeeklyReportData,
  MonthlyReportData,
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

const API_BASE = "/api";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

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

    // Profit Allocation
    previewProfitAllocation: (year: number, month: number) =>
      request<ProfitAllocationPreview>(`/owners/profit-allocation/preview?year=${year}&month=${month}`),
    postProfitAllocation: (data: ProfitAllocationPost) =>
      request<{ message: string; reference: string; journal_reference: string }>("/owners/profit-allocation/post", {
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
  },
};

export const apiClient = api;
export default api;


