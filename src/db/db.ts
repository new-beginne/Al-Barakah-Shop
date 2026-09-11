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
  type: 'cash' | 'mfs' | 'bank';
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
  }
}

export const db = new AlBarakahDB();

// Global Sync Event Dispatcher
function dispatchSyncEvent() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('albarakah-db-changed'));
  }
}

// Hook into all tables to trigger auto-sync on any change
db.tables.forEach(table => {
  table.hook('creating', () => { dispatchSyncEvent(); });
  table.hook('updating', () => { dispatchSyncEvent(); });
  table.hook('deleting', () => { dispatchSyncEvent(); });
});
