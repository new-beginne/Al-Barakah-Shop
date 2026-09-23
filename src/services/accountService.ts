import Dexie from 'dexie';
import { db, Account, MfsTransaction, BalanceLog, getRecordMetadata } from '../db/db';

let isInitialized = false;
let initPromise: Promise<void> | null = null;

export const DEFAULT_ACCOUNTS: Omit<Account, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'cash',
    name: 'Cash',
    type: 'cash',
    balance: 0,
    note: 'Cash Drawer'
  },
  {
    id: 'bkash',
    name: 'bKash',
    type: 'mfs',
    balance: 0,
    note: 'bKash Wallet'
  },
  {
    id: 'nagad',
    name: 'Nagad',
    type: 'mfs',
    balance: 0,
    note: 'Nagad Wallet'
  },
  {
    id: 'rocket',
    name: 'Rocket',
    type: 'mfs',
    balance: 0,
    note: 'Rocket Wallet'
  }
];

export async function initDefaultAccounts(): Promise<void> {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Must use ignoreTransaction so it doesn't try to access tables (like mfs)
      // on an active IDBTransaction from another transaction (e.g. sales or dues)
      await Dexie.ignoreTransaction(async () => {
        if (!db.isOpen()) {
          await db.open();
        }

        // Clean up disabled accounts (upay, bank) so they don't appear in UI
        try {
          await db.accounts.delete('upay');
          await db.accounts.delete('bank');
        } catch (e) {
          // ignore
        }

        const now = new Date().toISOString();

        // Check if bKash/Nagad/Rocket have latest MFS balances
        let allMfs: MfsTransaction[] = [];
        try {
          allMfs = await db.mfs.toArray();
        } catch (e) {
          console.warn('Could not query mfs for initial balances:', e);
        }

        const getMfsLatestBal = (op: string): number => {
          const opTxs = allMfs
            .filter(t => t.operator?.toLowerCase() === op.toLowerCase())
            .sort((a, b) => (b.id || 0) - (a.id || 0));
          return opTxs.length > 0 && typeof opTxs[0].balanceAfter === 'number' ? opTxs[0].balanceAfter : 0;
        };

        // Ensure default accounts exist without deleting any custom accounts
        for (const def of DEFAULT_ACCOUNTS) {
          const acc = await db.accounts.get(def.id);
          if (!acc) {
            let initialBal = def.balance;
            if (def.type === 'mfs') {
              const mfsBal = getMfsLatestBal(def.id);
              if (mfsBal > 0) initialBal = mfsBal;
            }
            await db.accounts.put({
              ...def,
              balance: initialBal,
              createdAt: now,
              updatedAt: now
            });
          }
        }

        isInitialized = true;
      });
    } catch (error) {
      console.error('Failed to initialize accounts:', error);
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Maps payment method string from Sales / Expenses to Account ID
 */
export function mapPaymentMethodToAccountId(method?: string): string | null {
  if (!method) return 'cash';
  const clean = method.toLowerCase().trim();
  if (clean === 'cash') return 'cash';
  if (clean.includes('bkash') || clean.includes('b-kash')) return 'bkash';
  if (clean.includes('nagad')) return 'nagad';
  if (clean.includes('rocket')) return 'rocket';
  return 'cash';
}

/**
 * Adjust account balance incrementally (positive for income, negative for expense)
 */
export async function adjustAccountBalance(accountId: string, delta: number): Promise<number> {
  if (delta === 0) return 0;
  try {
    await initDefaultAccounts();
    const acc = await db.accounts.get(accountId);
    if (!acc) {
      const def = DEFAULT_ACCOUNTS.find(d => d.id === accountId);
      const now = new Date().toISOString();
      const newAcc: Account = {
        id: accountId,
        name: def ? def.name : accountId.charAt(0).toUpperCase() + accountId.slice(1),
        type: def ? def.type : 'other',
        balance: delta,
        createdAt: now,
        updatedAt: now
      };
      await db.accounts.put(newAcc);
      return delta;
    }

    const newBal = (acc.balance || 0) + delta;
    await db.accounts.update(accountId, { balance: newBal, updatedAt: new Date().toISOString() });
    return newBal;
  } catch (err) {
    console.error(`Error adjusting balance for account ${accountId}:`, err);
    return 0;
  }
}

/**
 * Manually set the main balance of an account from Settings
 */
export async function setAccountBalance(accountId: string, newBalance: number, note?: string): Promise<void> {
  try {
    await initDefaultAccounts();
    const now = new Date().toISOString();
    const acc = await db.accounts.get(accountId);

    if (acc) {
      await db.accounts.update(accountId, {
        balance: newBalance,
        note: note !== undefined ? note : acc.note,
        updatedAt: now
      });

      // If it's an MFS account, also append a balance adjustment in MFS log
      if (acc.type === 'mfs') {
        const operatorName = 
          accountId === 'bkash' ? 'bKash' :
          accountId === 'nagad' ? 'Nagad' :
          accountId === 'rocket' ? 'Rocket' : acc.name;

        const meta = getRecordMetadata();
        const mfsEntry: MfsTransaction = {
          date: meta.date,
          time: meta.time,
          createdAt: meta.createdAt,
          updatedAt: meta.updatedAt,
          operator: operatorName as any,
          type: 'Balance-Adjust',
          amount: 0,
          charge: 0,
          profit: 0,
          balanceAfter: newBalance,
          note: note || 'Settings Balance Update'
        };
        await db.mfs.add(mfsEntry);
      }
    }
  } catch (err) {
    console.error(`Error setting balance for account ${accountId}:`, err);
    throw err;
  }
}

/**
 * Add an amount to an account's balance
 */
export async function addBalanceToAccount(accountId: string, amountToAdd: number, note?: string): Promise<number> {
  if (isNaN(amountToAdd)) {
    throw new Error('Invalid amount');
  }
  await initDefaultAccounts();
  const acc = await db.accounts.get(accountId);
  const currentBal = acc?.balance || 0;
  const newBal = currentBal + amountToAdd;
  await setAccountBalance(accountId, newBal, note || `Added Tk ${amountToAdd.toLocaleString()}`);
  return newBal;
}

/**
 * Add a custom account (e.g. second bank, personal wallet)
 */
export async function addCustomAccount(acc: {
  name: string;
  type: 'cash' | 'mfs' | 'bank';
  balance: number;
  accountNumber?: string;
  note?: string;
}): Promise<string> {
  const id = `custom_${Date.now()}`;
  const now = new Date().toISOString();
  await db.accounts.put({
    id,
    name: acc.name,
    type: acc.type,
    balance: acc.balance || 0,
    accountNumber: acc.accountNumber || '',
    note: acc.note || '',
    createdAt: now,
    updatedAt: now
  });
  return id;
}

/**
 * Delete a custom account (default accounts cannot be deleted)
 */
export async function deleteCustomAccount(accountId: string): Promise<boolean> {
  const isDefault = DEFAULT_ACCOUNTS.some(d => d.id === accountId);
  if (isDefault) {
    return false;
  }
  await db.accounts.delete(accountId);
  return true;
}

/**
 * Add an amount to an account's balance and record it in balanceLogs
 */
export async function addBalanceWithLog(
  accountId: string, 
  amount: number, 
  note?: string
): Promise<{ newBalance: number; logId: number }> {
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Invalid amount to add');
  }
  await initDefaultAccounts();
  const acc = await db.accounts.get(accountId);
  if (!acc) throw new Error(`Account not found: ${accountId}`);

  const prevBal = acc.balance || 0;
  const newBal = prevBal + amount;
  const now = new Date().toISOString();

  await db.accounts.update(accountId, {
    balance: newBal,
    updatedAt: now
  });

  const meta = getRecordMetadata();
  const logId = await db.balanceLogs.add({
    date: meta.date,
    time: meta.time,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    accountId,
    accountName: acc.name,
    type: 'add',
    amount,
    previousBalance: prevBal,
    newBalance: newBal,
    note: note?.trim() || `Added Tk ${amount.toLocaleString()}`
  });

  return { newBalance: newBal, logId: Number(logId) };
}

/**
 * Directly calibrate/edit an account's balance and record it in balanceLogs
 */
export async function editBalanceWithLog(
  accountId: string, 
  newBalance: number, 
  note?: string
): Promise<{ newBalance: number; logId: number }> {
  if (isNaN(newBalance)) {
    throw new Error('Invalid new balance');
  }
  await initDefaultAccounts();
  const acc = await db.accounts.get(accountId);
  if (!acc) throw new Error(`Account not found: ${accountId}`);

  const prevBal = acc.balance || 0;
  const diff = newBalance - prevBal;
  const now = new Date().toISOString();

  await db.accounts.update(accountId, {
    balance: newBalance,
    updatedAt: now
  });

  const meta = getRecordMetadata();
  const logId = await db.balanceLogs.add({
    date: meta.date,
    time: meta.time,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    accountId,
    accountName: acc.name,
    type: 'edit',
    amount: diff,
    previousBalance: prevBal,
    newBalance: newBalance,
    note: note?.trim() || `Balance calibrated from Tk ${prevBal.toLocaleString()} to Tk ${newBalance.toLocaleString()}`
  });

  return { newBalance, logId: Number(logId) };
}

/**
 * Edit an existing balance log (note, date, or amount)
 */
export async function updateBalanceLog(
  logId: number, 
  updated: { amount: number; note?: string; date?: string; time?: string }
): Promise<void> {
  const log = await db.balanceLogs.get(logId);
  if (!log) throw new Error('Balance log not found');

  const acc = await db.accounts.get(log.accountId);
  const now = new Date().toISOString();

  if (acc) {
    const diff = updated.amount - log.amount;
    if (diff !== 0) {
      const currentAccBal = acc.balance || 0;
      await db.accounts.update(log.accountId, {
        balance: currentAccBal + diff,
        updatedAt: now
      });
    }
  }

  await db.balanceLogs.update(logId, {
    amount: updated.amount,
    note: updated.note !== undefined ? updated.note : log.note,
    date: updated.date || log.date,
    time: updated.time || log.time,
    updatedAt: now
  });
}

/**
 * Delete a balance log entry with option to revert account balance
 */
export async function deleteBalanceLog(logId: number, revertAccountBalance: boolean): Promise<void> {
  const log = await db.balanceLogs.get(logId);
  if (!log) return;

  if (revertAccountBalance) {
    const acc = await db.accounts.get(log.accountId);
    if (acc) {
      const now = new Date().toISOString();
      const currentAccBal = acc.balance || 0;
      // Subtract the amount logged
      const newBal = currentAccBal - log.amount;
      await db.accounts.update(log.accountId, {
        balance: newBal,
        updatedAt: now
      });
    }
  }

  await db.balanceLogs.delete(logId);
}
