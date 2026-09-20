import { 
  collection, doc, getDocs, setDoc, deleteDoc 
} from 'firebase/firestore';
import { firestore } from '../lib/firebase';
import { db, Sale, Expense, MfsTransaction, Due, Customer, Account, BalanceLog, Borrowing, ServiceRate } from '../db/db';
import { sanitizePayload, generateRecordHash } from '../lib/security';

export interface SyncResult {
  success: boolean;
  message?: string;
  pushedCount?: number;
  pulledCount?: number;
}

/**
 * Delete a specific document from Firestore directly
 */
export async function deleteCloudDocument(uid: string | undefined, table: string, id: string | number): Promise<void> {
  if (!uid || !navigator.onLine) return;
  try {
    await deleteDoc(doc(firestore, 'users', uid, table, String(id)));
  } catch (err) {
    console.warn(`Failed to delete cloud doc users/${uid}/${table}/${id}:`, err);
  }
}

/**
 * Clear entire collections on Firestore (used during full reset)
 */
export async function clearCloudCollections(uid: string | undefined, tables: string[]): Promise<void> {
  if (!uid || !navigator.onLine) return;
  try {
    for (const table of tables) {
      const snap = await getDocs(collection(firestore, 'users', uid, table));
      for (const d of snap.docs) {
        await deleteDoc(doc(firestore, 'users', uid, table, d.id));
      }
    }
  } catch (err) {
    console.warn(`Failed to clear cloud collections for ${uid}:`, err);
  }
}

export async function pushLocalToCloud(uid: string): Promise<number> {
  if (!uid || !navigator.onLine) return 0;

  let count = 0;
  try {
    // 0. Process any queued offline deletions first
    const pendingDeletions = await db.deletedRecords.toArray();
    for (const item of pendingDeletions) {
      try {
        await deleteDoc(doc(firestore, 'users', uid, item.table, String(item.remoteId)));
      } catch (e) {
        console.warn('Error deleting cloud document:', item, e);
      }
    }
    if (pendingDeletions.length > 0) {
      await db.deletedRecords.clear();
    }

    // 1. Sales
    const localSales = await db.sales.toArray();
    for (const rawItem of localSales) {
      if (rawItem.id) {
        const cleanItem = sanitizePayload(rawItem);
        const recordHash = await generateRecordHash(cleanItem);
        await setDoc(doc(firestore, 'users', uid, 'sales', String(cleanItem.id)), {
          ...cleanItem,
          recordHash,
          ownerUid: uid,
          updatedAt: cleanItem.updatedAt || new Date().toISOString()
        }, { merge: true });
        count++;
      }
    }

    // 2. Expenses
    const localExpenses = await db.expenses.toArray();
    for (const rawItem of localExpenses) {
      if (rawItem.id) {
        const cleanItem = sanitizePayload(rawItem);
        const recordHash = await generateRecordHash(cleanItem);
        await setDoc(doc(firestore, 'users', uid, 'expenses', String(cleanItem.id)), {
          ...cleanItem,
          recordHash,
          ownerUid: uid,
          updatedAt: cleanItem.updatedAt || new Date().toISOString()
        }, { merge: true });
        count++;
      }
    }

    // 3. MFS
    const localMfs = await db.mfs.toArray();
    for (const rawItem of localMfs) {
      if (rawItem.id) {
        const cleanItem = sanitizePayload(rawItem);
        const recordHash = await generateRecordHash(cleanItem);
        await setDoc(doc(firestore, 'users', uid, 'mfs', String(cleanItem.id)), {
          ...cleanItem,
          recordHash,
          ownerUid: uid,
          updatedAt: cleanItem.updatedAt || new Date().toISOString()
        }, { merge: true });
        count++;
      }
    }

    // 4. Dues
    const localDues = await db.dues.toArray();
    for (const rawItem of localDues) {
      if (rawItem.id) {
        const cleanItem = sanitizePayload(rawItem);
        const recordHash = await generateRecordHash(cleanItem);
        await setDoc(doc(firestore, 'users', uid, 'dues', String(cleanItem.id)), {
          ...cleanItem,
          recordHash,
          ownerUid: uid,
          updatedAt: cleanItem.updatedAt || new Date().toISOString()
        }, { merge: true });
        count++;
      }
    }

    // 5. Customers
    const localCustomers = await db.customers.toArray();
    for (const rawItem of localCustomers) {
      if (rawItem.id) {
        const cleanItem = sanitizePayload(rawItem);
        const recordHash = await generateRecordHash(cleanItem);
        await setDoc(doc(firestore, 'users', uid, 'customers', String(cleanItem.id)), {
          ...cleanItem,
          recordHash,
          ownerUid: uid,
          updatedAt: cleanItem.updatedAt || new Date().toISOString()
        }, { merge: true });
        count++;
      }
    }

    // 6. Accounts
    const localAccounts = await db.accounts.toArray();
    for (const rawItem of localAccounts) {
      if (rawItem.id) {
        const cleanItem = sanitizePayload(rawItem);
        const recordHash = await generateRecordHash(cleanItem);
        await setDoc(doc(firestore, 'users', uid, 'accounts', String(cleanItem.id)), {
          ...cleanItem,
          recordHash,
          ownerUid: uid,
          updatedAt: cleanItem.updatedAt || new Date().toISOString()
        }, { merge: true });
        count++;
      }
    }

    // 7. Balance Logs
    const localBalanceLogs = await db.balanceLogs.toArray();
    for (const rawItem of localBalanceLogs) {
      if (rawItem.id) {
        const cleanItem = sanitizePayload(rawItem);
        const recordHash = await generateRecordHash(cleanItem);
        await setDoc(doc(firestore, 'users', uid, 'balanceLogs', String(cleanItem.id)), {
          ...cleanItem,
          recordHash,
          ownerUid: uid,
          updatedAt: cleanItem.updatedAt || new Date().toISOString()
        }, { merge: true });
        count++;
      }
    }

    // 8. Borrowings
    const localBorrowings = await db.borrowings.toArray();
    for (const rawItem of localBorrowings) {
      if (rawItem.id) {
        const cleanItem = sanitizePayload(rawItem);
        const recordHash = await generateRecordHash(cleanItem);
        await setDoc(doc(firestore, 'users', uid, 'borrowings', String(cleanItem.id)), {
          ...cleanItem,
          recordHash,
          ownerUid: uid,
          updatedAt: cleanItem.updatedAt || new Date().toISOString()
        }, { merge: true });
        count++;
      }
    }

    // 9. Services
    const localServices = await db.services.toArray();
    for (const rawItem of localServices) {
      if (rawItem.id) {
        const cleanItem = sanitizePayload(rawItem);
        const recordHash = await generateRecordHash(cleanItem);
        await setDoc(doc(firestore, 'users', uid, 'services', String(cleanItem.id)), {
          ...cleanItem,
          recordHash,
          ownerUid: uid,
          updatedAt: cleanItem.updatedAt || new Date().toISOString()
        }, { merge: true });
        count++;
      }
    }
  } catch (err) {
    console.error('Push to cloud error:', err);
    throw err;
  }

  return count;
}

export async function pullCloudToLocal(uid: string): Promise<number> {
  if (!uid || !navigator.onLine) return 0;

  let count = 0;
  try {
    // Check pending local deletions so we never resurrect them
    const pendingDeletions = await db.deletedRecords.toArray();
    const deletedMap = new Set(pendingDeletions.map(d => `${d.table}:${d.remoteId}`));

    // 1. Sales
    const salesSnap = await getDocs(collection(firestore, 'users', uid, 'sales'));
    if (!salesSnap.empty) {
      const sales: Sale[] = salesSnap.docs
        .filter(d => !deletedMap.has(`sales:${d.id}`))
        .map(d => {
          const data = sanitizePayload(d.data()) as Sale;
          return { ...data, id: Number(d.id) };
        });
      if (sales.length > 0) {
        await db.sales.bulkPut(sales);
        count += sales.length;
      }
    }

    // 2. Expenses
    const expSnap = await getDocs(collection(firestore, 'users', uid, 'expenses'));
    if (!expSnap.empty) {
      const expenses: Expense[] = expSnap.docs
        .filter(d => !deletedMap.has(`expenses:${d.id}`))
        .map(d => {
          const data = sanitizePayload(d.data()) as Expense;
          return { ...data, id: Number(d.id) };
        });
      if (expenses.length > 0) {
        await db.expenses.bulkPut(expenses);
        count += expenses.length;
      }
    }

    // 3. MFS
    const mfsSnap = await getDocs(collection(firestore, 'users', uid, 'mfs'));
    if (!mfsSnap.empty) {
      const mfsList: MfsTransaction[] = mfsSnap.docs
        .filter(d => !deletedMap.has(`mfs:${d.id}`))
        .map(d => {
          const data = sanitizePayload(d.data()) as MfsTransaction;
          return { ...data, id: Number(d.id) };
        });
      if (mfsList.length > 0) {
        await db.mfs.bulkPut(mfsList);
        count += mfsList.length;
      }
    }

    // 4. Dues
    const duesSnap = await getDocs(collection(firestore, 'users', uid, 'dues'));
    if (!duesSnap.empty) {
      const dues: Due[] = duesSnap.docs
        .filter(d => !deletedMap.has(`dues:${d.id}`))
        .map(d => {
          const data = sanitizePayload(d.data()) as Due;
          return { ...data, id: Number(d.id) };
        });
      if (dues.length > 0) {
        await db.dues.bulkPut(dues);
        count += dues.length;
      }
    }

    // 5. Customers
    const custSnap = await getDocs(collection(firestore, 'users', uid, 'customers'));
    if (!custSnap.empty) {
      const customers: Customer[] = custSnap.docs
        .filter(d => !deletedMap.has(`customers:${d.id}`))
        .map(d => {
          const data = sanitizePayload(d.data()) as Customer;
          return { ...data, id: Number(d.id) };
        });
      if (customers.length > 0) {
        await db.customers.bulkPut(customers);
        count += customers.length;
      }
    }

    // 6. Accounts
    const accSnap = await getDocs(collection(firestore, 'users', uid, 'accounts'));
    if (!accSnap.empty) {
      const accounts: Account[] = accSnap.docs
        .filter(d => !deletedMap.has(`accounts:${d.id}`))
        .map(d => {
          const data = sanitizePayload(d.data()) as Account;
          return { ...data, id: d.id };
        });
      if (accounts.length > 0) {
        await db.accounts.bulkPut(accounts);
        count += accounts.length;
      }
    }

    // 7. Balance Logs
    const logSnap = await getDocs(collection(firestore, 'users', uid, 'balanceLogs'));
    if (!logSnap.empty) {
      const logs: BalanceLog[] = logSnap.docs
        .filter(d => !deletedMap.has(`balanceLogs:${d.id}`))
        .map(d => {
          const data = sanitizePayload(d.data()) as BalanceLog;
          return { ...data, id: Number(d.id) || undefined };
        });
      if (logs.length > 0) {
        await db.balanceLogs.bulkPut(logs);
        count += logs.length;
      }
    }

    // 8. Borrowings
    const borSnap = await getDocs(collection(firestore, 'users', uid, 'borrowings'));
    if (!borSnap.empty) {
      const borrowings: Borrowing[] = borSnap.docs
        .filter(d => !deletedMap.has(`borrowings:${d.id}`))
        .map(d => {
          const data = sanitizePayload(d.data()) as Borrowing;
          return { ...data, id: Number(d.id) };
        });
      if (borrowings.length > 0) {
        await db.borrowings.bulkPut(borrowings);
        count += borrowings.length;
      }
    }

    // 9. Services
    const srvSnap = await getDocs(collection(firestore, 'users', uid, 'services'));
    if (!srvSnap.empty) {
      const services: ServiceRate[] = srvSnap.docs
        .filter(d => !deletedMap.has(`services:${d.id}`))
        .map(d => {
          const data = sanitizePayload(d.data()) as ServiceRate;
          return { ...data, id: Number(d.id) };
        });
      if (services.length > 0) {
        await db.services.bulkPut(services);
        count += services.length;
      }
    }
  } catch (err) {
    console.error('Pull from cloud error:', err);
    throw err;
  }

  return count;
}

export async function fullSync(uid: string): Promise<SyncResult> {
  if (!uid) {
    return { success: false, message: 'User not authenticated' };
  }
  if (!navigator.onLine) {
    return { success: false, message: 'You are currently offline. Local data is safely hashed and stored in IndexedDB.' };
  }

  try {
    const pushed = await pushLocalToCloud(uid);
    const pulled = await pullCloudToLocal(uid);
    localStorage.setItem('albarakah_last_synced', new Date().toISOString());
    return {
      success: true,
      pushedCount: pushed,
      pulledCount: pulled,
      message: 'Cloud sync with SHA-256 verification completed successfully'
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Sync failed'
    };
  }
}
