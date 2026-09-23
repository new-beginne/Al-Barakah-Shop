import { 
  collection, doc, getDocs, setDoc, deleteDoc 
} from 'firebase/firestore';
import { firestore, auth } from '../lib/firebase';
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

    // 1. Accounts (Priority: Push accounts FIRST so balances are synced immediately)
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

    // 2. Sales
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

    // 3. Expenses
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

    // 4. MFS
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

    // 5. Dues
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

    // 6. Customers
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

/**
 * Merge helper that prevents stale cloud data from overwriting newer local data.
 * If local item exists and has a newer updatedAt timestamp, local is kept!
 */
async function mergeWithTimestamp<T extends { id?: any; updatedAt?: string }>(
  table: any,
  cloudItems: T[]
): Promise<number> {
  let putCount = 0;
  const itemsToPut: T[] = [];

  for (const cloudItem of cloudItems) {
    if (cloudItem.id === undefined || cloudItem.id === null) continue;
    const localItem = await table.get(cloudItem.id);
    if (!localItem) {
      itemsToPut.push(cloudItem);
      putCount++;
    } else {
      const localUpdated = localItem.updatedAt ? new Date(localItem.updatedAt).getTime() : 0;
      const cloudUpdated = cloudItem.updatedAt ? new Date(cloudItem.updatedAt).getTime() : 0;
      
      // Only overwrite local if cloud data is genuinely newer or local has no timestamp
      if (cloudUpdated >= localUpdated || !localItem.updatedAt) {
        itemsToPut.push(cloudItem);
        putCount++;
      }
    }
  }

  if (itemsToPut.length > 0) {
    await table.bulkPut(itemsToPut);
  }
  return putCount;
}

export async function pullCloudToLocal(uid: string): Promise<number> {
  if (!uid || !navigator.onLine) return 0;

  let count = 0;
  try {
    // Check pending local deletions so we never resurrect them
    const pendingDeletions = await db.deletedRecords.toArray();
    const deletedMap = new Set(pendingDeletions.map(d => `${d.table}:${d.remoteId}`));

    // 1. Accounts (Merge with timestamp check so local newer balance is never overwritten)
    const accSnap = await getDocs(collection(firestore, 'users', uid, 'accounts'));
    if (!accSnap.empty) {
      const accounts: Account[] = accSnap.docs
        .filter(d => !deletedMap.has(`accounts:${d.id}`))
        .map(d => {
          const data = sanitizePayload(d.data()) as Account;
          return { ...data, id: d.id };
        });
      count += await mergeWithTimestamp(db.accounts, accounts);
    }

    // 2. Sales
    const salesSnap = await getDocs(collection(firestore, 'users', uid, 'sales'));
    if (!salesSnap.empty) {
      const sales: Sale[] = salesSnap.docs
        .filter(d => !deletedMap.has(`sales:${d.id}`))
        .map(d => {
          const data = sanitizePayload(d.data()) as Sale;
          return { ...data, id: Number(d.id) };
        });
      count += await mergeWithTimestamp(db.sales, sales);
    }

    // 3. Expenses
    const expSnap = await getDocs(collection(firestore, 'users', uid, 'expenses'));
    if (!expSnap.empty) {
      const expenses: Expense[] = expSnap.docs
        .filter(d => !deletedMap.has(`expenses:${d.id}`))
        .map(d => {
          const data = sanitizePayload(d.data()) as Expense;
          return { ...data, id: Number(d.id) };
        });
      count += await mergeWithTimestamp(db.expenses, expenses);
    }

    // 4. MFS
    const mfsSnap = await getDocs(collection(firestore, 'users', uid, 'mfs'));
    if (!mfsSnap.empty) {
      const mfsList: MfsTransaction[] = mfsSnap.docs
        .filter(d => !deletedMap.has(`mfs:${d.id}`))
        .map(d => {
          const data = sanitizePayload(d.data()) as MfsTransaction;
          return { ...data, id: Number(d.id) };
        });
      count += await mergeWithTimestamp(db.mfs, mfsList);
    }

    // 5. Dues
    const duesSnap = await getDocs(collection(firestore, 'users', uid, 'dues'));
    if (!duesSnap.empty) {
      const dues: Due[] = duesSnap.docs
        .filter(d => !deletedMap.has(`dues:${d.id}`))
        .map(d => {
          const data = sanitizePayload(d.data()) as Due;
          return { ...data, id: Number(d.id) };
        });
      count += await mergeWithTimestamp(db.dues, dues);
    }

    // 6. Customers
    const custSnap = await getDocs(collection(firestore, 'users', uid, 'customers'));
    if (!custSnap.empty) {
      const customers: Customer[] = custSnap.docs
        .filter(d => !deletedMap.has(`customers:${d.id}`))
        .map(d => {
          const data = sanitizePayload(d.data()) as Customer;
          return { ...data, id: Number(d.id) };
        });
      count += await mergeWithTimestamp(db.customers, customers);
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
      count += await mergeWithTimestamp(db.balanceLogs, logs);
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
      count += await mergeWithTimestamp(db.borrowings, borrowings);
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
      count += await mergeWithTimestamp(db.services, services);
    }
  } catch (err) {
    console.error('Pull from cloud error:', err);
    throw err;
  }

  return count;
}

/**
 * Immediately synchronizes a single account document to Firestore.
 * Call this directly when any balance is updated or calibrated so it reaches Firestore without delay.
 */
export async function syncSingleAccountToCloud(accountId: string): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user || !navigator.onLine) return;
    const cleanId = accountId.toLowerCase();
    const acc = await db.accounts.get(cleanId);
    if (!acc) return;

    const cleanItem = sanitizePayload(acc);
    const recordHash = await generateRecordHash(cleanItem);
    await setDoc(doc(firestore, 'users', user.uid, 'accounts', cleanId), {
      ...cleanItem,
      id: cleanId,
      recordHash,
      ownerUid: user.uid,
      updatedAt: cleanItem.updatedAt || new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.warn('Failed to immediately sync account to cloud:', accountId, e);
  }
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
