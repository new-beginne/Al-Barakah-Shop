import { db } from '../db/db';
import { adjustAccountBalance, mapPaymentMethodToAccountId } from './accountService';
import { logCustomRangeDelete, logAllDataReset } from './activityLogService';
import { auth } from '../lib/firebase';
import { deleteCloudDocument, clearCloudCollections } from './syncService';

export interface RangeDeleteOptions {
  startDate: string;
  endDate: string;
  modules: {
    sales: boolean;
    expenses: boolean;
    mfs: boolean;
    borrowings: boolean;
  };
  adjustBalances: boolean;
}

export interface RangePreviewResult {
  salesCount: number;
  salesTotal: number;
  expensesCount: number;
  expensesTotal: number;
  mfsCount: number;
  mfsTotal: number;
  borrowingsCount: number;
  borrowingsTotal: number;
  totalRecords: number;
}

export async function getCustomRangePreview(
  startDate: string,
  endDate: string,
  modules: { sales: boolean; expenses: boolean; mfs: boolean; borrowings: boolean }
): Promise<RangePreviewResult> {
  const result: RangePreviewResult = {
    salesCount: 0,
    salesTotal: 0,
    expensesCount: 0,
    expensesTotal: 0,
    mfsCount: 0,
    mfsTotal: 0,
    borrowingsCount: 0,
    borrowingsTotal: 0,
    totalRecords: 0,
  };

  if (modules.sales) {
    const matchingSales = await db.sales
      .filter(s => s.date >= startDate && s.date <= endDate)
      .toArray();
    result.salesCount = matchingSales.length;
    result.salesTotal = matchingSales.reduce((sum, s) => sum + (s.amount || 0), 0);
  }

  if (modules.expenses) {
    const matchingExpenses = await db.expenses
      .filter(e => e.date >= startDate && e.date <= endDate)
      .toArray();
    result.expensesCount = matchingExpenses.length;
    result.expensesTotal = matchingExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }

  if (modules.mfs) {
    const matchingMfs = await db.mfs
      .filter(m => m.date >= startDate && m.date <= endDate)
      .toArray();
    result.mfsCount = matchingMfs.length;
    result.mfsTotal = matchingMfs.reduce((sum, m) => sum + (m.amount || 0), 0);
  }

  if (modules.borrowings) {
    const matchingBorrowings = await db.borrowings
      .filter(b => b.date >= startDate && b.date <= endDate)
      .toArray();
    result.borrowingsCount = matchingBorrowings.length;
    result.borrowingsTotal = matchingBorrowings.reduce((sum, b) => sum + (b.amount || 0), 0);
  }

  result.totalRecords =
    result.salesCount + result.expensesCount + result.mfsCount + result.borrowingsCount;

  return result;
}

export async function executeCustomRangeDelete(options: RangeDeleteOptions): Promise<{
  deletedCounts: { sales: number; expenses: number; mfs: number; borrowings: number; total: number };
}> {
  const { startDate, endDate, modules, adjustBalances } = options;

  let salesToDelete: any[] = [];
  let expensesToDelete: any[] = [];
  let mfsToDelete: any[] = [];
  let borrowingsToDelete: any[] = [];

  if (modules.sales) {
    salesToDelete = await db.sales
      .filter(s => s.date >= startDate && s.date <= endDate)
      .toArray();
  }

  if (modules.expenses) {
    expensesToDelete = await db.expenses
      .filter(e => e.date >= startDate && e.date <= endDate)
      .toArray();
  }

  if (modules.mfs) {
    mfsToDelete = await db.mfs
      .filter(m => m.date >= startDate && m.date <= endDate)
      .toArray();
  }

  if (modules.borrowings) {
    borrowingsToDelete = await db.borrowings
      .filter(b => b.date >= startDate && b.date <= endDate)
      .toArray();
  }

  // Execute deletion in a transaction
  await db.transaction('rw', [db.sales, db.dues, db.expenses, db.mfs, db.borrowings, db.accounts, db.balanceLogs, db.activityLogs], async () => {
    // 1. Sales
    if (salesToDelete.length > 0) {
      const salesIds = salesToDelete.map(s => s.id!).filter(Boolean);
      await db.sales.bulkDelete(salesIds);

      // Clean up associated dues
      for (const s of salesToDelete) {
        if (s.customerName && ((s.dueAmount || 0) > 0 || s.paymentMethod === 'Due')) {
          const matchingDue = await db.dues
            .where('customerName')
            .equals(s.customerName)
            .filter(d => Math.abs(d.totalAmount - s.amount) < 0.01 && (!d.date || d.date === s.date))
            .first();
          if (matchingDue && matchingDue.id) {
            await db.dues.delete(matchingDue.id);
          }
        }
      }

      if (adjustBalances) {
        // Reverse sales: subtract amounts received
        for (const s of salesToDelete) {
          if (s.paymentMethod && s.paymentMethod !== 'Due') {
            const accId = mapPaymentMethodToAccountId(s.paymentMethod);
            await adjustAccountBalance(accId, -s.amount);
          } else if ((s.paidAmount || 0) > 0) {
            await adjustAccountBalance('cash', -(s.paidAmount || 0));
          }
        }
      }
    }

    // 2. Expenses
    if (expensesToDelete.length > 0) {
      const expenseIds = expensesToDelete.map(e => e.id!).filter(Boolean);
      await db.expenses.bulkDelete(expenseIds);

      if (adjustBalances) {
        // Reverse expenses: add back expense amount
        for (const e of expensesToDelete) {
          const method = e.paymentMethod || 'Cash';
          if (method !== 'Due') {
            const accId = mapPaymentMethodToAccountId(method);
            await adjustAccountBalance(accId, e.amount);
          }
        }
      }
    }

    // 3. MFS
    if (mfsToDelete.length > 0) {
      const mfsIds = mfsToDelete.map(m => m.id!).filter(Boolean);
      await db.mfs.bulkDelete(mfsIds);

      if (adjustBalances) {
        // Reverse MFS balance impacts for both wallet and cash drawer
        for (const m of mfsToDelete) {
          const op = (m.operator || 'bkash').toLowerCase();
          const amt = m.amount || 0;
          const chg = m.charge || 0;

          if (m.type === 'Cash-Out') {
            // Cash-Out originally added to wallet, deducted from cash
            await adjustAccountBalance(op, -amt);
            await adjustAccountBalance('cash', amt);
          } else if (m.type === 'Cash-In' || m.type === 'Recharge') {
            // Cash-In/Recharge originally deducted from wallet, added to cash
            await adjustAccountBalance(op, amt);
            await adjustAccountBalance('cash', -amt);
          } else if (m.type === 'Send Money') {
            // Send Money originally deducted from wallet, added (amt + chg) to cash
            await adjustAccountBalance(op, amt);
            await adjustAccountBalance('cash', -(amt + chg));
          }
        }
      }
    }

    // 4. Borrowings
    if (borrowingsToDelete.length > 0) {
      const borrowingIds = borrowingsToDelete.map(b => b.id!).filter(Boolean);
      await db.borrowings.bulkDelete(borrowingIds);
    }
  });

  // Also remove from cloud if user is online & logged in
  const uid = auth.currentUser?.uid;
  if (uid && navigator.onLine) {
    (async () => {
      for (const s of salesToDelete) if (s.id) await deleteCloudDocument(uid, 'sales', s.id);
      for (const e of expensesToDelete) if (e.id) await deleteCloudDocument(uid, 'expenses', e.id);
      for (const m of mfsToDelete) if (m.id) await deleteCloudDocument(uid, 'mfs', m.id);
      for (const b of borrowingsToDelete) if (b.id) await deleteCloudDocument(uid, 'borrowings', b.id);
    })().catch(err => console.warn('Cloud sync for range delete error:', err));
  }

  const counts = {
    sales: salesToDelete.length,
    expenses: expensesToDelete.length,
    mfs: mfsToDelete.length,
    borrowings: borrowingsToDelete.length,
    total: salesToDelete.length + expensesToDelete.length + mfsToDelete.length + borrowingsToDelete.length,
  };

  const selectedModules: string[] = [];
  if (modules.sales) selectedModules.push('Sales');
  if (modules.expenses) selectedModules.push('Expenses');
  if (modules.mfs) selectedModules.push('MFS');
  if (modules.borrowings) selectedModules.push('Borrowings');

  // Log in activity history
  await logCustomRangeDelete({
    startDate,
    endDate,
    counts,
    adjustBalances,
    selectedModules,
  });

  return { deletedCounts: counts };
}

export interface ResetOptions {
  resetAccounts: boolean;
  wipeCustomers: boolean;
  wipePresets: boolean;
}

export async function executeAllDataReset(options: ResetOptions): Promise<{
  counts: { sales: number; expenses: number; mfs: number; dues: number; customers: number; borrowings: number; total: number };
}> {
  const [salesCount, expCount, mfsCount, duesCount, custCount, borCount] = await Promise.all([
    db.sales.count(),
    db.expenses.count(),
    db.mfs.count(),
    db.dues.count(),
    db.customers.count(),
    db.borrowings.count(),
  ]);

  const counts = {
    sales: salesCount,
    expenses: expCount,
    mfs: mfsCount,
    dues: duesCount,
    customers: options.wipeCustomers ? custCount : 0,
    borrowings: borCount,
    total: salesCount + expCount + mfsCount + duesCount + borCount + (options.wipeCustomers ? custCount : 0),
  };

  await db.transaction('rw', [
    db.sales,
    db.expenses,
    db.mfs,
    db.dues,
    db.borrowings,
    db.customers,
    db.services,
    db.expenseServices,
    db.accounts,
    db.balanceLogs,
    db.activityLogs
  ], async () => {
    // Clear core transaction tables
    await db.sales.clear();
    await db.expenses.clear();
    await db.mfs.clear();
    await db.dues.clear();
    await db.borrowings.clear();

    if (options.wipeCustomers) {
      await db.customers.clear();
    }

    if (options.wipePresets) {
      await db.services.clear();
      await db.expenseServices.clear();
    }

    if (options.resetAccounts) {
      // Reset balances to 0
      const allAccs = await db.accounts.toArray();
      for (const acc of allAccs) {
        await db.accounts.update(acc.id, {
          balance: 0,
          updatedAt: new Date().toISOString(),
        });
      }
      await db.balanceLogs.clear();
    }
  });

  // Clear pending deletion queue and wipe cloud collections if user is logged in
  try {
    await db.deletedRecords.clear();
  } catch (err) {
    console.warn('Error clearing deletedRecords queue:', err);
  }

  const uid = auth.currentUser?.uid;
  if (uid && navigator.onLine) {
    const cloudTables = ['sales', 'expenses', 'mfs', 'dues', 'borrowings', 'balanceLogs'];
    if (options.wipeCustomers) cloudTables.push('customers');
    if (options.wipePresets) cloudTables.push('services');
    clearCloudCollections(uid, cloudTables).catch(err => console.warn('Cloud clear on reset error:', err));
  }

  // Log in activity history
  await logAllDataReset({
    counts,
    wipeAccounts: options.resetAccounts,
    wipePresets: options.wipePresets,
  });

  return { counts };
}
