import { db, Account, MfsTransaction, BalanceLog, getRecordMetadata } from '../db/db';

export const DEFAULT_ACCOUNTS: Omit<Account, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'cash',
    name: 'Cash (হাতে নগদ)',
    type: 'cash',
    balance: 0,
    note: 'Cash Drawer'
  },
  {
    id: 'bkash',
    name: 'bKash (বিকাশ)',
    type: 'mfs',
    balance: 0,
    note: 'bKash Wallet'
  },
  {
    id: 'nagad',
    name: 'Nagad (নগদ)',
    type: 'mfs',
    balance: 0,
    note: 'Nagad Wallet'
  },
  {
    id: 'rocket',
    name: 'Rocket (রকেট)',
    type: 'mfs',
    balance: 0,
    note: 'Rocket Wallet'
  }
];

export async function initDefaultAccounts(): Promise<void> {
  try {
    const now = new Date().toISOString();

    // Clean up old non-standard accounts if any (like upay, bank)
    const existing = await db.accounts.toArray();
    for (const item of existing) {
      if (!['cash', 'bkash', 'nagad', 'rocket'].includes(item.id)) {
        await db.accounts.delete(item.id);
      }
    }

    // Check if bKash/Nagad/Rocket have latest MFS balances
    const allMfs = await db.mfs.toArray();
    const getMfsLatestBal = (op: string): number => {
      const opTxs = allMfs
        .filter(t => t.operator?.toLowerCase() === op.toLowerCase())
        .sort((a, b) => (b.id || 0) - (a.id || 0));
      return opTxs.length > 0 && typeof opTxs[0].balanceAfter === 'number' ? opTxs[0].balanceAfter : 0;
    };

    // Ensure only the 4 core accounts exist
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
  } catch (error) {
    console.error('Failed to initialize accounts:', error);
  }
}

/**
 * Maps payment method string from Sales / Expenses to Account ID
 */
export function mapPaymentMethodToAccountId(method?: string): string | null {
  if (!method) return 'cash';
  const clean = method.toLowerCase().trim();
  if (clean === 'cash') return 'cash';
  if (clean.includes('bkash') || clean.includes('b-kash') || clean.includes('বিকাশ')) return 'bkash';
  if (clean.includes('nagad') || clean.includes('নগদ')) return 'nagad';
  if (clean.includes('rocket') || clean.includes('রকেট')) return 'rocket';
  if (clean.includes('upay') || clean.includes('উপায়')) return 'upay';
  if (clean.includes('bank') || clean.includes('card') || clean.includes('ব্যাংক')) return 'bank';
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
      // Fallback to cash if target account doesn't exist
      const cashAcc = await db.accounts.get('cash');
      if (cashAcc) {
        const newBal = (cashAcc.balance || 0) + delta;
        await db.accounts.update('cash', { balance: newBal, updatedAt: new Date().toISOString() });
        return newBal;
      }
      return 0;
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
          accountId === 'rocket' ? 'Rocket' :
          accountId === 'upay' ? 'Upay' : acc.name;

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
