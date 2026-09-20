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
  }
}

export const db = new AlBarakahDB();

// Global Sync Event Dispatcher
function dispatchSyncEvent() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('albarakah-db-changed'));
  }
}

// Track synced tables
const SYNCED_TABLES = new Set([
  'sales',
  'expenses',
  'mfs',
  'dues',
  'customers',
  'accounts',
  'balanceLogs',
  'borrowings',
  'services'
]);

// Hook into tables to record changes and track deletions
db.tables.forEach(table => {
  table.hook('creating', () => { dispatchSyncEvent(); });
  table.hook('updating', () => { dispatchSyncEvent(); });
  table.hook('deleting', function(primKey) {
    if (SYNCED_TABLES.has(table.name) && primKey !== undefined && primKey !== null) {
      db.deletedRecords.add({
        table: table.name,
        remoteId: String(primKey),
        deletedAt: new Date().toISOString()
      }).catch(() => {});
    }
    dispatchSyncEvent();
  });
});
