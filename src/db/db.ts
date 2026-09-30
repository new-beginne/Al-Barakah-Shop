import Dexie, { Table } from 'dexie';
import { format } from 'date-fns';

export function getRecordMetadata() {
  const now = new Date();
  return {
    date: format(now, 'yyyy-MM-dd'),
    time: format(now, 'hh:mm:ss a'),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export interface Sale {
  id?: number;
  date: string;
  time?: string;
  createdAt?: string;
  updatedAt?: string;
  category: string;
  serviceName: string;
  quantity?: string | number;
  unitPrice?: number;
  unitCost?: number;
  amount: number;
  cost: number;
  profit: number;
  paymentMethod: string;
  note?: string;
  dueAmount?: number;
  paidAmount?: number;
  customerName?: string;
  customerPhone?: string;
}

export interface MfsTransaction {
  id?: number;
  date: string;
  time?: string;
  createdAt?: string;
  updatedAt?: string;
  operator: string;
  type: string;
  amount: number;
  charge: number;
  profit: number;
  balanceAfter: number;
  recipientNumber?: string;
  note?: string;
  // Due / Credit tracking fields
  isDue?: boolean;
  dueAmount?: number;
  paidAmount?: number;
  customerName?: string;
  customerPhone?: string;
  dueId?: number;
}

export interface Due {
  id?: number;
  date?: string;
  time?: string;
  createdAt?: string;
  updatedAt?: string;
  customerName: string;
  phone: string;
  totalAmount: number;
  paidAmount: number;
  status: 'Unpaid' | 'Partial' | 'Paid';
  referenceType?: 'sale' | 'mfs' | 'other';
  referenceId?: number;
  note?: string;
}

export interface Expense {
  id?: number;
  date: string;
  time?: string;
  createdAt?: string;
  updatedAt?: string;
  title: string;
  amount: number;
  category: string;
  note?: string;
  paymentMethod?: string;
  quantity?: string;
}

export interface ServiceRate {
  id?: number;
  name: string;
  category?: string;
  defaultCost: number;
  defaultPrice: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalesCategory {
  id?: number;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExpenseService {
  id?: number;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Customer {
  id?: number;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Account {
  id: string; // e.g. 'cash', 'bkash', 'nagad', 'rocket', 'upay', 'bank'
  name: string;
  type: 'cash' | 'mfs' | 'bank' | 'other';
  balance: number;
  accountNumber?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BalanceLog {
  id?: number;
  date: string;
  time?: string;
  createdAt?: string;
  updatedAt?: string;
  accountId: string;
  accountName: string;
  type: 'add' | 'edit';
  amount: number;
  previousBalance: number;
  newBalance: number;
  note?: string;
}

export interface AppNotification {
  id?: number;
  date: string;
  time: string;
  createdAt: string;
  title: string;
  message: string;
  isRead: boolean;
  type: string;
}

export interface Borrowing {
  id?: number;
  date: string;
  time?: string;
  createdAt?: string;
  updatedAt?: string;
  lenderName: string;
  phone: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: 'Unpaid' | 'Partial' | 'Paid';
  note?: string;
}

export interface ActivityLog {
  id?: number;
  date: string; // 'yyyy-MM-dd'
  time: string; // 'hh:mm:ss a'
  timestamp: string; // ISO string
  action: 'DELETE' | 'EDIT' | 'BULK_DELETE' | 'RESET' | 'CREATE';
  module: 'Sales' | 'Expenses' | 'MFS' | 'Dues' | 'Customers' | 'Borrowings' | 'Services' | 'Balance' | 'All Data' | 'System';
  entityId?: string | number;
  title: string;
  details?: string;
  meta?: Record<string, any>;
}

export interface DeletedRecord {
  id?: number;
  table: string;
  remoteId: string;
  deletedAt: string;
}

export type InventoryCategory = 'Photo Paper' | 'Plain Paper' | 'Printer Ink' | 'Lamination' | 'Photo Frames' | 'PVC & Cards' | 'Other';
export type InventoryUnit = 'sheets' | 'packs' | 'reams' | 'bottles' | 'pieces' | 'units';

export interface InventoryItem {
  id?: number;
  name: string;
  category: InventoryCategory;
  currentStock: number;
  unit: InventoryUnit;
  minAlertStock: number;
  unitCost: number;
  sellingPrice?: number;
  supplier?: string;
  note?: string;
  lastRestockedDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MfsClosing {
  id?: number;
  date: string;
  time?: string;
  operator: 'All' | 'bKash' | 'Nagad' | 'Rocket';
  simClosingBalance: number;
  drawerCashCount: number;
  systemExpectedSimBalance: number;
  systemExpectedCash: number;
  totalCalculatedBalance: number;
  discrepancy: number; // positive = surplus, negative = shortage
  status: 'Balanced' | 'Surplus' | 'Shortage';
  todayCashInTotal: number;
  todayCashOutTotal: number;
  todayProfitTotal: number;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class AlBarakahDB extends Dexie {
  sales!: Table<Sale>;
  mfs!: Table<MfsTransaction>;
  dues!: Table<Due>;
  expenses!: Table<Expense>;
  services!: Table<ServiceRate>;
  salesCategories!: Table<SalesCategory>;
  expenseServices!: Table<ExpenseService>;
  customers!: Table<Customer>;
  accounts!: Table<Account, string>;
  balanceLogs!: Table<BalanceLog>;
  notifications!: Table<AppNotification>;
  borrowings!: Table<Borrowing>;
  activityLogs!: Table<ActivityLog>;
  deletedRecords!: Table<DeletedRecord>;
  inventory!: Table<InventoryItem>;
  mfsClosings!: Table<MfsClosing>;

  constructor() {
    super('AlBarakahDB');
    this.version(2).stores({
      sales: '++id, date, category, serviceName, amount, paymentMethod',
      mfs: '++id, date, operator, type',
      dues: '++id, customerName, phone, status',
      expenses: '++id, date, category',
      services: '++id, name, category'
    });
    this.version(3).stores({
      salesCategories: '++id, name'
    });
    this.version(4).stores({
      expenseServices: '++id, name'
    });
    this.version(5).stores({
      customers: '++id, name, phone'
    });
    this.version(6).stores({
      accounts: 'id, name, type'
    });
    this.version(7).stores({
      balanceLogs: '++id, date, accountId, type'
    });
    this.version(8).stores({
      notifications: '++id, date, isRead, type'
    });
    this.version(9).stores({
      borrowings: '++id, lenderName, phone, status, dueDate'
    });
    this.version(10).stores({
      sales: '++id, date, category, serviceName, amount, paymentMethod',
      mfs: '++id, date, operator, type',
      dues: '++id, customerName, phone, status',
      expenses: '++id, date, category',
      services: '++id, name, category',
      salesCategories: '++id, name',
      expenseServices: '++id, name',
      customers: '++id, name, phone',
      accounts: 'id, name, type',
      balanceLogs: '++id, date, accountId, type',
      notifications: '++id, date, isRead, type',
      borrowings: '++id, lenderName, phone, status, dueDate'
    });
    this.version(11).stores({
      sales: '++id, date, category, serviceName, amount, paymentMethod',
      mfs: '++id, date, operator, type',
      dues: '++id, customerName, phone, status',
      expenses: '++id, date, category',
      services: '++id, name, category',
      salesCategories: '++id, name',
      expenseServices: '++id, name',
      customers: '++id, name, phone',
      accounts: 'id, name, type',
      balanceLogs: '++id, date, accountId, type',
      notifications: '++id, date, isRead, type',
      borrowings: '++id, lenderName, phone, status, dueDate',
      activityLogs: '++id, date, timestamp, action, module'
    });
    this.version(12).stores({
      sales: '++id, date, category, serviceName, amount, paymentMethod',
      mfs: '++id, date, operator, type',
      dues: '++id, customerName, phone, status',
      expenses: '++id, date, category',
      services: '++id, name, category',
      salesCategories: '++id, name',
      expenseServices: '++id, name',
      customers: '++id, name, phone',
      accounts: 'id, name, type',
      balanceLogs: '++id, date, accountId, type',
      notifications: '++id, date, isRead, type',
      borrowings: '++id, lenderName, phone, status, dueDate',
      activityLogs: '++id, date, timestamp, action, module',
      deletedRecords: '++id, table, remoteId'
    });
    this.version(13).stores({
      sales: '++id, date, category, serviceName, amount, paymentMethod',
      mfs: '++id, date, operator, type',
      dues: '++id, customerName, phone, status',
      expenses: '++id, date, category',
      services: '++id, name, category',
      salesCategories: '++id, name',
      expenseServices: '++id, name',
      customers: '++id, name, phone',
      accounts: 'id, name, type',
      balanceLogs: '++id, date, accountId, type',
      notifications: '++id, date, isRead, type',
      borrowings: '++id, lenderName, phone, status, dueDate',
      activityLogs: '++id, date, timestamp, action, module',
      deletedRecords: '++id, table, remoteId',
      inventory: '++id, name, category, currentStock',
      mfsClosings: '++id, date, operator, status'
    });
  }
}

export const db = new AlBarakahDB();

// Global Sync Event Dispatcher with mute support
let isSyncSilent = false;

export function setSyncSilent(silent: boolean) {
  isSyncSilent = silent;
}

export function getSyncSilent(): boolean {
  return isSyncSilent;
}

// Track synced tables
export const SYNCED_TABLES = new Set([
  'sales',
  'expenses',
  'mfs',
  'dues',
  'customers',
  'accounts',
  'balanceLogs',
  'borrowings',
  'services',
  'inventory',
  'mfsClosings'
]);

// In-memory + persistent set of modified tables
const pendingModifiedTables = new Set<string>();

// Restore any pending modified tables from localStorage on boot
if (typeof localStorage !== 'undefined') {
  try {
    const saved = localStorage.getItem('albarakah_pending_tables');
    if (saved) {
      const arr = JSON.parse(saved);
      if (Array.isArray(arr)) {
        arr.forEach(t => pendingModifiedTables.add(t));
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Mark a table as modified (add/edit/delete occurred)
 */
export function markTableModified(tableName: string) {
  if (isSyncSilent) return;
  pendingModifiedTables.add(tableName);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('albarakah_pending_tables', JSON.stringify(Array.from(pendingModifiedTables)));
      localStorage.setItem('albarakah_db_dirty', 'true');
      localStorage.setItem('albarakah_last_local_change', Date.now().toString());
    } catch {
      // ignore
    }
  }
}

export function getPendingModifiedTables(): string[] {
  return Array.from(pendingModifiedTables);
}

export function clearPendingModifiedTable(tableName: string) {
  pendingModifiedTables.delete(tableName);
  if (typeof localStorage !== 'undefined') {
    try {
      if (pendingModifiedTables.size === 0) {
        localStorage.removeItem('albarakah_pending_tables');
        localStorage.setItem('albarakah_db_dirty', 'false');
      } else {
        localStorage.setItem('albarakah_pending_tables', JSON.stringify(Array.from(pendingModifiedTables)));
      }
    } catch {
      // ignore
    }
  }
}

export function clearAllPendingChanges() {
  pendingModifiedTables.clear();
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem('albarakah_pending_tables');
      localStorage.setItem('albarakah_db_dirty', 'false');
    } catch {
      // ignore
    }
  }
}

/**
 * Checks whether any record in the database was added, edited, or deleted
 * since the last cloud sync.
 */
export function hasPendingLocalChanges(): boolean {
  if (typeof localStorage === 'undefined') return false;
  const isDirty = localStorage.getItem('albarakah_db_dirty') === 'true';
  return isDirty || pendingModifiedTables.size > 0;
}

function dispatchSyncEvent() {
  if (isSyncSilent) return;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('albarakah-db-changed'));
  }
}

// Hook into tables to record changes and track deletions safely
db.tables.forEach(table => {
  if (!SYNCED_TABLES.has(table.name)) return;

  // 1. ADD / CREATE
  table.hook('creating', function(primKey, obj) { 
    if (!isSyncSilent) {
      const now = new Date().toISOString();
      if (obj && typeof obj === 'object') {
        if (!obj.createdAt) obj.createdAt = now;
        if (!obj.updatedAt) obj.updatedAt = now;
      }
      markTableModified(table.name);
      setTimeout(dispatchSyncEvent, 0);
    }
  });

  // 2. EDIT / UPDATE
  table.hook('updating', function(modifications: any, primKey, obj) { 
    if (!isSyncSilent) {
      const now = new Date().toISOString();
      markTableModified(table.name);
      setTimeout(dispatchSyncEvent, 0);
      return {
        ...modifications,
        updatedAt: now
      };
    }
  });

  // 3. REMOVE / DELETE
  table.hook('deleting', function(primKey) {
    if (!isSyncSilent && primKey !== undefined && primKey !== null) {
      const remoteIdStr = String(primKey);
      const tableName = table.name;
      markTableModified(tableName);
      setTimeout(() => {
        Dexie.ignoreTransaction(async () => {
          try {
            await db.deletedRecords.add({
              table: tableName,
              remoteId: remoteIdStr,
              deletedAt: new Date().toISOString()
            });
          } catch {
            // ignore
          }
        });
        dispatchSyncEvent();
      }, 0);
    }
  });
});
