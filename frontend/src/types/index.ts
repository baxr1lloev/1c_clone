// TypeScript interfaces mirroring Django models (Refined for 1C Architecture)

// ============ Base Types ============
export interface BaseModel {
  id: number;
  created_at: string;
  updated_at: string;
}

// ============ Auth & Tenancy ============
export interface Tenant extends BaseModel {
  name: string;
  slug: string;
  is_active: boolean;
}

export interface User extends BaseModel {
  email: string;
  first_name: string;
  last_name: string;
  tenant: number;
  role: Role;
  role_name?: string;
  is_active: boolean;
}

export interface Role {
  id: number;
  name: 'owner' | 'accountant' | 'manager' | 'warehouse' | 'viewer';
  permissions: Permission[];
}

export interface Permission {
  id: number;
  codename: string;
  name: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  company_name: string;
}

// ============ Directories ============
export interface Currency extends BaseModel {
  code: string;
  name: string;
  symbol: string;
  is_base: boolean;
}

export interface ExchangeRate extends BaseModel {
  tenant: number;
  currency: number;
  currency_detail?: Currency;
  rate: number;
  date: string;
}

// 1C: Counterparty can be both Customer and Supplier
export type CounterpartyType = 'customer' | 'supplier' | 'agent' | 'other';

export interface ContactPerson {
  id: number;
  name: string;
  phone: string;
  email: string;
  position: string;
}

export interface Counterparty extends BaseModel {
  tenant: number;
  name: string;
  inn: string;
  type: CounterpartyType;
  address: string;
  phone: string;
  email: string;
  is_active: boolean;
  contacts: ContactPerson[];
}

export interface Contract extends BaseModel {
  tenant: number;
  number: string;
  counterparty: number;
  counterparty_detail?: Counterparty;
  currency: number;
  currency_detail?: Currency;
  start_date: string;
  end_date: string | null;
  terms: string;
  is_active: boolean;
}

export type WarehouseType = 'physical' | 'virtual' | 'transit';

export interface Warehouse extends BaseModel {
  tenant: number;
  name: string;
  code: string;
  type: WarehouseType;
  address: string;
  is_active: boolean;
}

export type ItemType = 'goods' | 'service';

export interface ItemUnit {
  id: number;
  name: string;
  coefficient: number; // e.g. 1 Box = 12 Base Units
}

export interface Item extends BaseModel {
  tenant: number;
  sku: string;
  name: string;
  description: string;
  type: ItemType;
  base_unit: string; // Immutable, e.g. "pcs", "kg"
  units: ItemUnit[]; // Available packages

  // 1C Change: Prices should live in "Price Lists" (Registers), not here.
  // Keeping optional for legacy compatibility or "Default Price" UI.
  purchase_price?: number;
  sale_price?: number;

  category: string;
  is_active: boolean;
}

export interface Project extends BaseModel {
  tenant: number;
  name: string;
  code: string;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

export interface Department extends BaseModel {
  tenant: number;
  name: string;
  code: string;
  parent?: number | null;
  is_active: boolean;
}

// ============ Documents ============
// 1C: Critical for "Posting" Methodology
export type DocumentStatus = 'draft' | 'posted' | 'cancelled';

export interface BaseDocument extends BaseModel {
  tenant: number;
  number: string;
  date: string;

  // 1C Posting Flags
  status: DocumentStatus;
  is_posted: boolean; // Computed helper, true if status == 'posted'
  posted_by: number | null;
  posted_at: string | null;

  comment: string;
  created_by: number;
}

export interface DocumentLine {
  id: number;
  item: number;
  item_detail?: Item;
  quantity: number;
  price: number;
  amount: number;
  price_base?: number;
  amount_base?: number;
}

export interface SalesDocumentLine extends DocumentLine {
  document: number;
  warehouse: number;
  warehouse_detail?: Warehouse;
  package?: number | null;
  coefficient?: number;

  // 1C VAT Fields
  vat_rate?: number;
  vat_amount?: number;
  total_with_vat?: number;
}

export interface SalesDocument extends BaseDocument {
  counterparty: number;
  counterparty_detail?: Counterparty;
  contract: number | null;
  contract_detail?: Contract;
  warehouse: number;
  warehouse_detail?: Warehouse;
  currency: number;
  currency_detail?: Currency;
  exchange_rate: number;
  base_currency_rate: number;

  // Analytics
  project?: number | null;
  department?: number | null;
  manager?: number | null;

  subtotal: number;
  tax_amount: number;
  total: number;
  lines: SalesDocumentLine[];

  // 1C Operation Type
  operation_type?: 'goods' | 'services' | 'goods_services';

  // UX Flags
  can_edit?: boolean;
  can_post?: boolean;
  can_unpost?: boolean;
  period_is_closed?: boolean;
}

export interface PurchaseDocumentLine extends DocumentLine {
  document: number;
  warehouse: number;
  warehouse_detail?: Warehouse;

  // Units
  package?: number | null;
  coefficient?: number;

  // VAT
  vat_rate?: number;
  vat_amount?: number;
  total_with_vat?: number;
}

export interface PurchaseDocument extends BaseDocument {
  supplier: number;
  supplier_detail?: Counterparty;
  contract: number | null;
  contract_detail?: Contract;
  warehouse: number;
  warehouse_detail?: Warehouse;
  currency: number;
  currency_detail?: Currency;
  exchange_rate: number;
  base_currency_rate: number;

  // Analytics
  project?: number | null;
  department?: number | null;

  // Totals
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  total_amount_base: number;

  lines: PurchaseDocumentLine[];
}

export interface BankAccount extends BaseModel {
  tenant: number;
  name: string;
  bank_name: string;
  account_number: string;
  currency: number;
  currency_detail?: Currency;
  is_active: boolean;
}

export type PaymentType = 'INCOMING' | 'OUTGOING';

export interface PaymentDocument extends BaseDocument {
  payment_type: PaymentType;
  counterparty: number;
  counterparty_detail?: Counterparty;
  contract: number | null;
  contract_detail?: Contract;

  bank_account: number | null;
  bank_account_detail?: BankAccount;

  // Added missing field from mock data
  payment_method?: string;

  currency: number;
  currency_detail?: Currency;
  rate: number;

  amount: number;
  purpose: string;

  // UX Flags
  status_display?: string;
  payment_type_display?: string;
  can_edit?: boolean;
  can_post?: boolean;
  can_unpost?: boolean;
  period_is_closed?: boolean;
}

export interface TransferDocumentLine extends DocumentLine {
  document: number;
}

export interface TransferDocument extends BaseDocument {
  source_warehouse: number;
  source_warehouse_detail?: Warehouse;
  target_warehouse: number;
  target_warehouse_detail?: Warehouse;
  lines: TransferDocumentLine[];
}

export interface SalesOrderLine extends DocumentLine {
  document: number;
  warehouse: number;
  warehouse_detail?: Warehouse;
  reserved_quantity?: number;
  package?: number | null;
  coefficient?: number;
}

export interface SalesOrder extends BaseDocument {
  counterparty: number;
  counterparty_detail?: Counterparty;
  contract: number | null;
  contract_detail?: Contract;
  warehouse: number;
  warehouse_detail?: Warehouse;
  currency: number;
  currency_detail?: Currency;
  rate: number;
  exchange_rate: number;
  order_date: string;
  delivery_date: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  total_amount: number;
  total_amount_base: number;
  lines: SalesOrderLine[];
  shipped_document?: number | null;
  can_edit?: boolean;
  can_post?: boolean;
  can_unpost?: boolean;
  can_create_sales_document?: boolean;
}

export interface InventoryDocumentLine {
  id: number;
  document: number;
  item: number;
  item_detail?: Item;
  system_quantity: number;
  actual_quantity: number;
  difference: number;
  price: number;
  amount: number;
}

export interface InventoryDocument extends BaseDocument {
  warehouse: number;
  warehouse_detail?: Warehouse;
  lines: InventoryDocumentLine[];
}

export type TransitStatus = 'shipped' | 'in_transit' | 'received';
export type RiskStatus = 'on_time' | 'delayed' | 'critical';

export interface GoodsInTransit extends BaseDocument {
  source_document: number;
  source_warehouse: number;
  source_warehouse_detail?: Warehouse;
  target_warehouse: number;
  target_warehouse_detail?: Warehouse;
  shipped_date: string;
  expected_date: string;
  received_date: string | null;
  transit_status: TransitStatus;
  risk_status: RiskStatus;
}

// ============ Registers ============
// 1C: Registers store "Movements" (Движения). Balances are calculated.

export type MovementType = 'receipt' | 'dispatch' | 'adjustment';

export interface StockMovement {
  id: number;
  tenant: number;
  document_type: string;
  document_id: number;
  date: string;

  // Dimensions
  item: number;
  item_detail?: Item;
  warehouse: number;
  warehouse_detail?: Warehouse;

  // 1C: FIFO Support
  batch_id?: number | null; // ID of the sourcing PurchaseDocument

  movement_type: MovementType;

  // Resources
  quantity: number;
  unit_cost: number;
  total_cost: number;

  direction?: 'in' | 'out';
  is_reversal?: boolean;
  movement_date?: string;
  created_at: string;
}

export interface StockBalance {
  id: number;
  tenant: number;
  item: number;
  item_detail?: Item;
  warehouse: number;
  warehouse_detail?: Warehouse;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  total_cost: number;
  average_cost: number;
  last_movement_date: string | null;
}

export type SettlementType = 'receivable' | 'payable' | 'payment_received' | 'payment_made';

export interface SettlementMovement {
  id: number;
  tenant: number;

  // Recorder
  document_type: string;
  document_id: number;
  date: string;

  // Dimensions
  counterparty: number;
  counterparty_detail?: Counterparty;
  contract: number | null;
  contract_detail?: Contract;
  currency: number;
  currency_detail?: Currency;

  // Resources
  settlement_type: SettlementType;
  amount: number;
  base_amount: number;
  created_at: string;
}

export interface SettlementBalance {
  id: number;
  tenant: number;
  counterparty: number;
  counterparty_detail?: Counterparty;
  contract: number | null;
  contract_detail?: Contract;
  currency: number;
  currency_detail?: Currency;
  receivable_amount: number;
  payable_amount: number;
  net_balance: number;
  base_receivable: number;
  base_payable: number;
  base_net_balance: number;
  last_settlement_date: string | null;
}

export interface CounterpartyStockBalance {
  tenant: number;
  counterparty: number;
  counterparty_detail?: Counterparty;
  item: number;
  item_detail?: Item;
  quantity: number;
}

export interface SettlementsBalance {
  tenant: number;
  counterparty: number;
  counterparty_detail?: Counterparty;
  contract: number | null;
  contract_detail?: Contract;
  currency: number;
  currency_detail?: Currency;
  debit: number;
  credit: number;
  balance: number;
}

export interface StockReservation extends BaseModel {
  tenant: number;
  order: number;
  item: number;
  item_detail?: Item;
  warehouse: number;
  warehouse_detail?: Warehouse;
  quantity: number;
  is_active: boolean;
}

// 1C: Specific Batch Register for FIFO
export interface StockBatch extends BaseModel {
  tenant: number;
  item: number;
  item_detail?: Item;
  warehouse: number;
  warehouse_detail?: Warehouse;

  // Creation Source
  purchase_document: number;
  batch_date: string; // The "FIFO Date"

  quantity: number;
  remaining_quantity: number;
  cost: number;
}

// ============ Accounting ============
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export interface ChartOfAccounts extends BaseModel {
  tenant: number;
  code: string;
  name: string;
  account_type: AccountType;
  parent: number | null;
  is_active: boolean;
  children?: ChartOfAccounts[];
}

export interface Account extends BaseModel {
  tenant: number;
  code: string;
  name: string;
  description: string;
  type: AccountType;
  parent: number | null;
  is_active: boolean;
}

// 1C Canonical: A single "Wiring" (Provodka) row
export interface JournalEntryLine {
  id: number;
  entry: number;

  // Wiring: Debit -> Credit
  debit_account: number;
  debit_account_detail?: Account;

  credit_account: number;
  credit_account_detail?: Account;

  amount: number; // Single amount
  currency_amount?: number; // Optional multi-currency
  currency?: number;

  description: string;

  // Display fields
  debit_account_code?: string;
  debit_account_name?: string;
  credit_account_code?: string;
  credit_account_name?: string;
  currency_code?: string;
}

// The "Operation" (Set of wirings)
export interface JournalEntry extends BaseModel {
  tenant: number;
  number: string;
  date: string;
  description: string;

  // Recorder
  document_type: string;
  document_id: number;

  lines: JournalEntryLine[];
  total_debit: number;
  total_credit: number;

  is_posted: boolean;
  created_by: number;
}

export interface GeneralLedger {
  id: number;
  period: string;
  account: number;
  account_code: string;
  account_name: string;
  opening_debit: number;
  opening_credit: number;
  turnover_debit: number;
  turnover_credit: number;
  closing_debit: number;
  closing_credit: number;
}

export type CloseType = 'operational' | 'accounting';

export interface PeriodClosing extends BaseModel {
  tenant: number;
  period_start: string;
  period_end: string;
  close_type: CloseType;
  is_closed: boolean;
  closed_by: number | null;
  closed_at: string | null;
  reopened_by: number | null;
  reopened_at: string | null;
  reopen_reason: string;
}

export interface PeriodClosingLog extends BaseModel {
  period_closing: number;
  action: 'close' | 'reopen';
  performed_by: number;
  performed_at: string;
  reason: string;
}

export interface Operation extends BaseModel {
  tenant: number;
  number: string;
  date: string;
  comment: string;
  amount: number;
  created_by: number;
  created_by_name: string;
  entries: JournalEntryLine[];
}

export interface Employee extends BaseModel {
  tenant: number;
  first_name: string;
  last_name: string;
  middle_name: string;
  inn: string;
  position: string;
  hiring_date: string | null;
  base_salary: number;
  phone: string;
  email: string;
  address: string;
  is_active: boolean;
}

export interface PayrollDocument extends BaseModel {
  tenant: number;
  number: string;
  date: string;
  status: 'draft' | 'posted' | 'cancelled';
  status_display: string;
  comment: string;
  period_start: string;
  period_end: string;
  amount: number;
  lines: PayrollDocumentLine[];
  can_post?: boolean;
  can_unpost?: boolean;
}

export interface PayrollDocumentLine {
  id: number;
  employee: number;
  employee_name: string;
  accrual_type: string;
  amount: number;
}


export interface ProductionDocument extends BaseModel {
  number: string;
  date: string;
  warehouse: number;
  warehouse_name?: string;
  materials_warehouse?: number;
  materials_warehouse_name?: string;
  production_account_code: string;
  status: 'draft' | 'posted' | 'cancelled';
  status_display: string;
  comment: string;
  products: ProductionProductLine[];
  materials: ProductionMaterialLine[];
  can_post?: boolean;
  can_unpost?: boolean;
}

export interface ProductionProductLine {
  id?: number;
  item: number;
  item_name?: string;
  item_sku?: string;
  unit?: string;
  quantity: number;
  price: number;
  amount: number;
}

export interface ProductionMaterialLine {
  id?: number;
  item: number;
  item_name?: string;
  item_sku?: string;
  unit?: string;
  quantity: number;
  cost_price?: number;
  amount: number;
}

export interface TrialBalance {
  tenant: number;
  account: number;
  account_detail?: ChartOfAccounts;
  period_start: string;
  period_end: string;
  opening_debit: number;
  opening_credit: number;
  turnover_debit: number;
  turnover_credit: number;
  closing_debit: number;
  closing_credit: number;
}

export type StockValuationMethod = 'fifo' | 'avg';

export interface AccountingPolicy extends BaseModel {
  tenant: number;
  name: string; // Policies can have names (e.g. "Main Policy 2024")
  start_date: string;
  end_date?: string;

  stock_valuation_method: StockValuationMethod;
  auto_post_documents: boolean;
  require_contract: boolean;
}

// ============ API Response Types ============
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiError {
  detail?: string;
  message?: string;
  errors?: Record<string, string[]>;
}

// ============ Dashboard Types ============
export interface DashboardStats {
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  total_receivables: number;
  total_payables: number;
  low_stock_items: number;
  pending_orders: number;
  documents_today: number;
}

export interface RevenueChartData {
  date: string;
  revenue: number;
  expenses: number;
}

export interface TopProduct {
  item: Item;
  quantity_sold: number;
  revenue: number;
}

export interface TopCounterparty {
  counterparty: Counterparty;
  total_sales: number;
  total_purchases: number;
}

// ============ Cash Orders ============
export type CashOrderType = 'incoming' | 'outgoing';

export interface CashOrder extends BaseDocument {
  order_type: CashOrderType;
  order_type_display?: string;
  counterparty_name: string;
  counterparty?: number | null;
  counterparty_detail?: Counterparty;

  amount: number;
  currency: number;
  currency_code?: string;
  purpose: string;
  basis?: string;

  // UX Flags
  status_display?: string;
  can_edit?: boolean;
  can_post?: boolean;
  can_unpost?: boolean;
  period_is_closed?: boolean;
}

// ============ Fixed Assets (OS) ============

export type DepreciationMethod = 'LINEAR' | 'DECLINING';

export interface FixedAssetCategory extends BaseModel {
  tenant: number;
  code: string;
  name: string;
  parent: number | null;
  parent_name?: string;
  default_useful_life_months: number;
  default_depreciation_method: DepreciationMethod;
  asset_account: number | null;
  depreciation_account: number | null;
}

export type FixedAssetStatus = 'IN_USE' | 'MOTHBALLED' | 'DISPOSED';

export interface FixedAsset extends BaseModel {
  tenant: number;
  inventory_number: string;
  name: string;
  category: number;
  category_name?: string;

  initial_cost: number;
  residual_value: number;
  accumulated_depreciation: number;
  current_value?: number;
  depreciation_base?: number;

  depreciation_method: DepreciationMethod;
  useful_life_months: number;
  depreciation_rate?: number;

  acquisition_date: string;
  commissioning_date: string;
  disposal_date?: string;

  location: string;
  location_name?: string;
  responsible_person: number | null;
  responsible_person_name?: string;

  status: FixedAssetStatus;
  description: string;
  serial_number: string;
  manufacturer: string;
}

export interface DepreciationSchedule extends BaseModel {
  asset: number;
  asset_name?: string;
  asset_inventory_number?: string;
  period: string;
  amount: number;
  accounting_entry: number | null;
  posted_at: string;
}

// --- FA Documents ---

export interface FAReceiptDocument extends BaseDocument {
  supplier: number;
  supplier_name?: string;
  asset: number | null;
  asset_name?: string;
}

export interface FAAcceptanceDocument extends BaseDocument {
  asset: number;
  asset_name?: string;
}

export type FADisposalReason = 'SALE' | 'SCRAP' | 'DONATION' | 'LOSS';

export interface FADisposalDocument extends BaseDocument {
  asset: number;
  asset_name?: string;
  reason: FADisposalReason;
  sale_amount?: number;
}

// ============ Intangible Assets (NMA) ============

export interface IntangibleAssetCategory extends BaseModel {
  tenant: number;
  code: string;
  name: string;
  parent: number | null;
  parent_name?: string;
  default_useful_life_months: number;
  asset_account: number | null;
  amortization_account: number | null;
}

export type IntangibleAssetStatus = 'IN_USE' | 'WRITTEN_OFF';

export interface IntangibleAsset extends BaseModel {
  tenant: number;
  inventory_number: string;
  name: string;
  category: number;
  category_name?: string;

  initial_cost: number;
  accumulated_amortization: number;
  current_value?: number;

  useful_life_months: number;

  acquisition_date: string;
  commissioning_date: string;
  write_off_date?: string;

  status: IntangibleAssetStatus;
  description: string;
}

export interface AmortizationSchedule extends BaseModel {
  asset: number;
  asset_name?: string;
  period: string;
  amount: number;
  accounting_entry: number | null;
  posted_at: string;
}

// --- NMA Documents ---

export interface IAReceiptDocument extends BaseDocument {
  supplier: number;
  supplier_name?: string;
  asset: number | null;
  asset_name?: string;
}

export interface IAAcceptanceDocument extends BaseDocument {
  asset: number;
  asset_name?: string;
}

export interface IADisposalDocument extends BaseDocument {
  asset: number;
  asset_name?: string;
}
