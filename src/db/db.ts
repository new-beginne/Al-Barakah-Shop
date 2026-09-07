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

export class AlBarakahDB extends Dexie {
  sales!: Table<Sale>;
  mfs!: Table<MfsTransaction>;
  dues!: Table<Due>;
  expenses!: Table<Expense>;
  services!: Table<ServiceRate>;
  salesCategories!: Table<SalesCategory>;
  expenseServices!: Table<ExpenseService>;
  customers!: Table<Customer>;

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
  }
}

export const db = new AlBarakahDB();
