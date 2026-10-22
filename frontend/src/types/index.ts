/**
 * Core TypeScript definitions for the Billiard Hall Management System.
 * All monetary amounts are integers representing LKR paise (1 Rs. = 100 paise).
 */

export type SessionStatus = "pending" | "partial" | "paid" | "cancelled" | "adjusted";
export type PaymentMethod = "cash" | "bank_transfer" | "other";
export type PaymentStatus = "confirmed" | "reversed" | "pending";
export type ExpenseStatus = "unpaid" | "partial" | "paid" | "cancelled";
export type AccountType = "cash" | "bank" | "savings" | "other";
export type StockMovementType = "purchase" | "sale" | "adjustment_loss" | "adjustment_gain" | "opening_stock";

export interface Player {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  is_active: boolean;
  total_sessions?: number;
  total_charges_paise?: number;
  total_paid_paise?: number;
  outstanding_balance_paise?: number;
  created_at: string;
}

export interface PlayerCreate {
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface PoolSession {
  id: number;
  reference: string;
  session_date: string;
  player_id?: number | null;
  player?: Player | null;
  customer_name?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  actual_minutes: number;
  chargeable_minutes: number;
  standard_charge_paise: number;
  discount_paise: number;
  final_charge_paise: number;
  paid_amount_paise: number;
  outstanding_paise: number;
  status: SessionStatus;
  notes?: string | null;
  created_at: string;
}

export interface PoolSessionCreate {
  session_date: string;
  player_id?: number | null;
  customer_name?: string | null;
  chargeable_minutes: number;
  actual_minutes?: number;
  custom_standard_charge_paise?: number;
  discount_paise?: number;
  initial_payment_paise?: number;
  initial_payment_method?: PaymentMethod;
  initial_payment_account_id?: number;
  notes?: string | null;
}

export interface PS4Session {
  id: number;
  reference: string;
  session_date: string;
  player_count: 1 | 2;
  player1_id?: number | null;
  player1?: Player | null;
  player2_id?: number | null;
  player2?: Player | null;
  customer_name?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  minutes: number;
  standard_charge_paise: number;
  discount_paise: number;
  final_charge_paise: number;
  paid_amount_paise: number;
  outstanding_paise: number;
  status: SessionStatus;
  notes?: string | null;
  created_at: string;
}

export interface PS4SessionCreate {
  session_date: string;
  player_count: 1 | 2;
  player1_id?: number | null;
  player2_id?: number | null;
  customer_name?: string | null;
  minutes: number;
  discount_paise?: number;
  initial_payment_paise?: number;
  initial_payment_method?: PaymentMethod;
  initial_payment_account_id?: number;
  notes?: string | null;
}

export interface SessionPayment {
  id: number;
  reference: string;
  session_type: "pool" | "ps4";
  session_id: number;
  collection_date: string;
  amount_paise: number;
  payment_method: PaymentMethod;
  account_id?: number | null;
  status: PaymentStatus;
  notes?: string | null;
  created_at: string;
}

export interface SessionPaymentCreate {
  session_type: "pool" | "ps4";
  session_id: number;
  collection_date: string;
  amount_paise: number;
  payment_method: PaymentMethod;
  account_id?: number;
  notes?: string | null;
}

export interface Product {
  id: number;
  name: string;
  category_id?: number | null;
  unit: string;
  selling_price_paise: number;
  average_cost_paise: number;
  current_stock: number;
  reorder_level: number;
  is_active: boolean;
}

export interface Expense {
  id: number;
  reference: string;
  expense_date: string;
  category_id: number;
  category_name?: string;
  description: string;
  amount_paise: number;
  payee?: string | null;
  status: ExpenseStatus;
  paid_amount_paise: number;
  is_asset: boolean;
  notes?: string | null;
  created_at: string;
}

export interface ExpenseCreate {
  expense_date: string;
  category_id: number;
  description: string;
  amount_paise: number;
  payee?: string | null;
  is_asset?: boolean;
  asset_account_code?: string | null;
  notes?: string | null;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  account_code?: string | null;
  description?: string | null;
  is_active: boolean;
}

export interface FinancialAccount {
  id: number;
  code: string;
  name: string;
  account_type: AccountType;
  description?: string | null;
  is_active: boolean;
  current_balance_paise?: number;
}

export interface AccountTransferCreate {
  transfer_date: string;
  from_account_id: number;
  to_account_id: number;
  amount_paise: number;
  description: string;
}

export interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  total_debit_paise: number;
  total_credit_paise: number;
  net_balance_paise: number;
}

export interface Owner {
  id: number;
  name: string;
  profit_share_bps: number;
  profit_share_percent: string;
}

export interface OwnerDetail extends Owner {
  capital_account_code: string;
  capital_balance_paise: number;
  distribution_account_code: string;
  distributions_total_paise: number;
  owner_loan_balance_paise: number;
}

export interface OwnerTransaction {
  id: number;
  reference: string;
  owner_id: number;
  owner_name: string;
  transaction_date: string;
  transaction_type: string;
  amount_paise: number;
  account_id?: number | null;
  account_name?: string | null;
  description: string;
  notes?: string | null;
  created_at?: string;
}

export interface OwnerTransactionCreate {
  owner_id: number;
  transaction_date: string;
  transaction_type: string;
  amount_paise: number;
  account_id: number;
  description: string;
  notes?: string | null;
}

export interface Loan {
  id: number;
  reference: string;
  lender_name: string;
  loan_type: "bank" | "external" | "owner";
  original_principal_paise: number;
  current_outstanding_paise: number;
  start_date: string;
  interest_rate_bps: number;
  repayment_terms?: string | null;
  status: "active" | "settled" | "written_off";
  owner_id?: number | null;
  owner_name?: string | null;
  created_at?: string;
}

export interface LoanCreate {
  lender_name: string;
  loan_type: "bank" | "external" | "owner";
  original_principal_paise: number;
  start_date: string;
  interest_rate_bps?: number;
  repayment_terms?: string | null;
  owner_id?: number | null;
  disburse_to_account_id?: number | null;
  notes?: string | null;
}

export interface LoanRepaymentCreate {
  repayment_date: string;
  principal_amount_paise: number;
  interest_amount_paise: number;
  account_id: number;
  notes?: string | null;
}

export interface LoanTransaction {
  id: number;
  reference: string;
  loan_id: number;
  transaction_date: string;
  transaction_type: string;
  amount_paise: number;
  account_id?: number | null;
  notes?: string | null;
  created_at?: string;
}

export interface ProfitAllocationPreview {
  year: number;
  month: number;
  period_label: string;
  revenue_paise: number;
  cogs_paise: number;
  expenses_paise: number;
  net_distributable_profit_paise: number;
  savings_share_paise: number;
  akash_share_paise: number;
  pasan_share_paise: number;
  vishwa_share_paise: number;
  is_already_posted: boolean;
}

export interface ProfitAllocationPost {
  year: number;
  month: number;
  approved_by?: string;
  notes?: string | null;
}

export interface AccountTransfer {
  id: number;
  reference: string;
  transfer_date: string;
  from_account_id: number;
  from_account_code: string;
  from_account_name: string;
  to_account_id: number;
  to_account_code: string;
  to_account_name: string;
  amount_paise: number;
  description?: string | null;
  created_at?: string;
}

export interface CashCount {
  id: number;
  count_date: string;
  account_id: number;
  account_code: string;
  account_name: string;
  counted_paise: number;
  expected_paise: number;
  difference_paise: number;
  notes?: string | null;
  investigated_by?: string | null;
  created_at?: string;
}

export interface CashCountCreate {
  count_date: string;
  counted_paise: number;
  notes?: string | null;
  investigated_by?: string | null;
}

export interface BankReconciliation {
  id: number;
  reconciliation_date: string;
  account_id: number;
  account_code: string;
  account_name: string;
  statement_balance_paise: number;
  book_balance_paise: number;
  difference_paise: number;
  notes?: string | null;
  created_at?: string;
}

export interface BankReconciliationCreate {
  reconciliation_date: string;
  account_id: number;
  statement_balance_paise: number;
  notes?: string | null;
}

export interface AccountingPeriod {
  id: number;
  year: number;
  month: number;
  is_closed: boolean;
  closed_at?: string | null;
  closed_by?: string | null;
  reopen_reason?: string | null;
  reopened_by?: string | null;
}

export interface BackupSnapshot {
  filename: string;
  path: string;
  size_bytes: number;
  created_at: string;
  is_valid: boolean;
  note?: string;
}

export interface EquipmentPurchase {
  id: number;
  reference: string;
  purchase_date: string;
  category: "cue_stick" | "table" | "ps4" | "controller" | "accessory" | "repair" | "other";
  item_name: string;
  description?: string | null;
  quantity: number;
  amount_paise: number;
  supplier?: string | null;
  payment_status: "paid" | "unpaid" | "partial";
  notes?: string | null;
  created_at?: string | null;
}

export interface EquipmentPurchaseCreate {
  purchase_date: string;
  category: string;
  item_name: string;
  description?: string;
  quantity: number;
  amount_paise: number;
  supplier?: string;
  payment_status: string;
  account_id?: number;
  notes?: string;
}

export interface DamageCharge {
  id: number;
  reference: string;
  damage_date: string;
  player_id?: number | null;
  player_name: string;
  damaged_item: string;
  description?: string | null;
  charge_amount_paise: number;
  collected_paise: number;
  outstanding_paise: number;
  status: "outstanding" | "partially_paid" | "paid" | "waived" | "written_off";
  resolution_notes?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

export interface DamageChargeCreate {
  damage_date: string;
  player_id?: number;
  player_name_override?: string;
  damaged_item: string;
  description?: string;
  charge_amount_paise: number;
  notes?: string;
}

export interface DamagePaymentCreate {
  payment_date: string;
  amount_paise: number;
  payment_method: string;
  account_id?: number;
  notes?: string;
}

export interface OutstandingSession {
  id: number;
  session_type: "pool" | "ps4";
  reference: string;
  session_date: string;
  player_id?: number | null;
  player_name: string;
  phone?: string | null;
  chargeable_minutes: number;
  final_charge_paise: number;
  paid_amount_paise: number;
  outstanding_paise: number;
  status: string;
}

export interface JournalLineItem {
  id: number;
  account_code: string;
  account_name: string;
  is_debit: boolean;
  amount_paise: number;
  debit_paise: number;
  credit_paise: number;
  description?: string | null;
}

export interface JournalEntryItem {
  id: number;
  reference: string;
  entry_date: string;
  description: string;
  source_type?: string | null;
  source_id?: number | null;
  status: string;
  created_by?: string | null;
  notes?: string | null;
  total_amount_paise: number;
  is_balanced: boolean;
  lines: JournalLineItem[];
  created_at?: string | null;
}

export interface DailyReportData {
  report_date: string;
  period: string;
  pool_sessions: number;
  pool_revenue_paise: number;
  ps4_sessions: number;
  ps4_revenue_paise: number;
  total_session_revenue_paise: number;
  cash_collected_paise: number;
  bank_collected_paise: number;
  total_collected_paise: number;
  total_expenses_paise: number;
  unpaid_expenses_paise: number;
  paid_expenses_paise: number;
  drinks_bottles_sold: number;
  drinks_revenue_paise: number;
  cash_balance_paise: number;
  bank_balance_paise: number;
  savings_balance_paise: number;
  total_liquid_paise: number;
  total_outstanding_ar_paise: number;
  total_revenue_paise: number;
  net_income_paise: number;
}

export interface WeeklyReportData extends DailyReportData {
  week_start: string;
  week_end: string;
}

export interface MonthlyReportData extends DailyReportData {
  year: number;
  month: number;
  month_name: string;
  period_start: string;
  period_end: string;
  active_loans_count: number;
  total_loan_outstanding_paise: number;
  profit_allocation: {
    savings_paise: number;
    akash_paise: number;
    pasan_paise: number;
    vishwa_paise: number;
  };
}

export interface SystemInfo {
  business_name: string;
  currency: string;
  currency_symbol: string;
  owners: Owner[];
  accounts_configured: number;
  historical_start_date: string;
}


