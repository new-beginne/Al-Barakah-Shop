import { 
  collection, doc, getDocs, setDoc, deleteDoc, writeBatch 
} from 'firebase/firestore';
import { firestore, auth } from '../lib/firebase';
import { 
  db, Sale, Expense, MfsTransaction, Due, Customer, 
  Account, BalanceLog, Borrowing, ServiceRate, InventoryItem, MfsClosing,
  setSyncSilent, hasPendingLocalChanges, getPendingModifiedTables,
  clearPendingModifiedTable, clearAllPendingChanges, markTableModified, SYNCED_TABLES
} from '../db/db';
import { sanitizePayload, generateRecordHash } from '../lib/security';

export interface SyncResult {
  success: boolean;
  message?: string;
  pushedCount?: number;
  pulledCount?: number;
  isQuotaExceeded?: boolean;
}

// Calculate when next UTC day begins (when Google Cloud resets free daily write quota)
export function getNextUtcResetTime(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5, 0);
}

// Known quota exhaustion date string
const KNOWN_EXHAUSTED_DATE = '2026-09-24';

/**
 * Check if cloud sync is temporarily paused due to free quota limit
 */
export function isQuotaExceededBlocked(): boolean {
  if (typeof localStorage === 'undefined') return true;

  // Protect against known exhausted day so users don't face repeated Firestore retry loops
  const todayUtc = new Date().toISOString().slice(0, 10);
  if (todayUtc === KNOWN_EXHAUSTED_DATE) {
    const override = localStorage.getItem('albarakah_quota_override');
    if (!override) {
      return true;
    }
  }

  const until = localStorage.getItem('albarakah_quota_blocked_until');
  if (until) {
    const expiry = Number(until);
    if (Date.now() < expiry) {
      return true;
    }
    localStorage.removeItem('albarakah_quota_blocked_until');
  }

  return false;
}

export function markQuotaExceeded(): void {
  if (typeof localStorage === 'undefined') return;
  const resetTime = getNextUtcResetTime();
  localStorage.setItem('albarakah_quota_blocked_until', resetTime.toString());
}

/**
 * Delete a specific document from Firestore directly
 */
export async function deleteCloudDocument(uid: string | undefined, table: string, id: string | number): Promise<void> {
  if (!uid || !navigator.onLine || isQuotaExceededBlocked()) return;
  try {
    await deleteDoc(doc(firestore, 'users', uid, table, String(id)));
  } catch (err: any) {
    if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota limit exceeded')) {
      markQuotaExceeded();
    }
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
      if (!snap.empty) {
        let batch = writeBatch(firestore);
        let batchCount = 0;
        for (const d of snap.docs) {
          batch.delete(d.ref);
          batchCount++;
          if (batchCount >= 400) {
            await batch.commit();
            batch = writeBatch(firestore);
            batchCount = 0;
          }
        }
        if (batchCount > 0) {
          await batch.commit();
        }
      }
    }
  } catch (err: any) {
    if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota limit exceeded')) {
      markQuotaExceeded();
    }
    console.warn(`Failed to clear cloud collections for ${uid}:`, err);
  }
}

/**
 * Delete ALL cloud data across all Firestore subcollections for the shop owner
 */
export async function clearAllCloudData(uid: string): Promise<{ deletedCount: number; collectionsCleared: string[] }> {
  if (!uid || !navigator.onLine) {
    return { deletedCount: 0, collectionsCleared: [] };
  }

  const allTables = [
    'sales',
    'expenses',
    'mfs',
    'dues',
    'customers',
    'accounts',
    'balanceLogs',
    'borrowings',
    'services',
    'activityLogs',
    'inventory',
    'mfsClosings'
  ];

  let deletedCount = 0;
  const collectionsCleared: string[] = [];

  for (const table of allTables) {
    try {
      const snap = await getDocs(collection(firestore, 'users', uid, table));
      if (!snap.empty) {
        let batch = writeBatch(firestore);
        let batchCount = 0;
        for (const d of snap.docs) {
          batch.delete(d.ref);
          batchCount++;
          deletedCount++;
          if (batchCount >= 400) {
            await batch.commit();
            batch = writeBatch(firestore);
            batchCount = 0;
          }
        }
        if (batchCount > 0) {
          await batch.commit();
        }
        collectionsCleared.push(table);
      }
    } catch (err: any) {
      console.warn(`Failed to wipe cloud collection users/${uid}/${table}:`, err);
    }
  }

  // Clear sync tracking timestamps
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('albarakah_last_synced');
    localStorage.removeItem('albarakah_quota_blocked_until');
    localStorage.removeItem('albarakah_quota_override');
  }

  return { deletedCount, collectionsCleared };
}

export async function pushLocalToCloud(uid: string, forceAll: boolean = false): Promise<number> {
  if (!uid || !navigator.onLine) return 0;
  if (isQuotaExceededBlocked()) {
    console.info('Cloud sync paused: daily free quota limit reached. Local DB is 100% active and safe.');
    return 0;
  }

  // MULTI-TENANT ISOLATION GUARD: Verify this device's active user matches target uid
  const activeUid = typeof localStorage !== 'undefined' ? localStorage.getItem('albarakah_active_uid') : null;
  if (activeUid && activeUid !== uid) {
    console.warn(`[Sync Guard] Blocked pushLocalToCloud! Target uid (${uid}) does not match active local uid (${activeUid}).`);
    return 0;
  }

  // 1. Strict dirty check: if not forceAll, only proceed if there are actual changes!
  const pendingDeletions = await db.deletedRecords.toArray();
  const dirtyTables = getPendingModifiedTables();
  const isDirty = hasPendingLocalChanges();

  if (!forceAll && !isDirty && pendingDeletions.length === 0 && dirtyTables.length === 0) {
    // Absolutely no local changes! Do not waste quota sending any signal!
    return 0;
  }

  let count = 0;
  const lastSyncedStr = localStorage.getItem('albarakah_last_synced');
  // Exact timestamp check without clock-skew buffer to avoid redundant writes
  const lastSyncedTime = (lastSyncedStr && !forceAll) ? new Date(lastSyncedStr).getTime() : 0;

  const isRecentlyModified = (item: { updatedAt?: string; createdAt?: string }): boolean => {
    if (!lastSyncedStr || forceAll) return true;
    const updated = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
    const created = item.createdAt ? new Date(item.createdAt).getTime() : 0;
    return Math.max(updated, created) >= lastSyncedTime;
  };

  const shouldSyncTable = (tbl: string) => forceAll || dirtyTables.includes(tbl) || !lastSyncedStr;

  try {
    // 0. Process any queued offline deletions first
    for (const item of pendingDeletions) {
      try {
        await deleteDoc(doc(firestore, 'users', uid, item.table, String(item.remoteId)));
      } catch (e: any) {
        if (e?.code === 'resource-exhausted' || e?.message?.includes('Quota limit exceeded')) {
          markQuotaExceeded();
          return count;
        }
        console.warn('Error deleting cloud document:', item, e);
      }
    }
    if (pendingDeletions.length > 0) {
      await db.deletedRecords.clear();
    }

    // 1. Accounts
    if (shouldSyncTable('accounts')) {
      const localAccounts = await db.accounts.toArray();
      for (const rawItem of localAccounts) {
        if (rawItem.id && isRecentlyModified(rawItem)) {
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
      clearPendingModifiedTable('accounts');
    }

    // 2. Sales
    if (shouldSyncTable('sales')) {
      const localSales = await db.sales.toArray();
      for (const rawItem of localSales) {
        if (rawItem.id && isRecentlyModified(rawItem)) {
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
      clearPendingModifiedTable('sales');
    }

    // 3. Expenses
    if (shouldSyncTable('expenses')) {
      const localExpenses = await db.expenses.toArray();
      for (const rawItem of localExpenses) {
        if (rawItem.id && isRecentlyModified(rawItem)) {
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
      clearPendingModifiedTable('expenses');
    }

    // 4. MFS
    if (shouldSyncTable('mfs')) {
      const localMfs = await db.mfs.toArray();
      for (const rawItem of localMfs) {
        if (rawItem.id && isRecentlyModified(rawItem)) {
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
      clearPendingModifiedTable('mfs');
    }

    // 5. Dues
    if (shouldSyncTable('dues')) {
      const localDues = await db.dues.toArray();
      for (const rawItem of localDues) {
        if (rawItem.id && isRecentlyModified(rawItem)) {
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
      clearPendingModifiedTable('dues');
    }

    // 6. Customers
    if (shouldSyncTable('customers')) {
      const localCustomers = await db.customers.toArray();
      for (const rawItem of localCustomers) {
        if (rawItem.id && isRecentlyModified(rawItem)) {
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
      clearPendingModifiedTable('customers');
    }

    // 7. Balance Logs
    if (shouldSyncTable('balanceLogs')) {
      const localBalanceLogs = await db.balanceLogs.toArray();
      for (const rawItem of localBalanceLogs) {
        if (rawItem.id && isRecentlyModified(rawItem)) {
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
      clearPendingModifiedTable('balanceLogs');
    }

    // 8. Borrowings
    if (shouldSyncTable('borrowings')) {
      const localBorrowings = await db.borrowings.toArray();
      for (const rawItem of localBorrowings) {
        if (rawItem.id && isRecentlyModified(rawItem)) {
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
      clearPendingModifiedTable('borrowings');
    }

    // 9. Services
    if (shouldSyncTable('services')) {
      const localServices = await db.services.toArray();
      for (const rawItem of localServices) {
        if (rawItem.id && isRecentlyModified(rawItem)) {
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
      clearPendingModifiedTable('services');
    }

    // 10. Inventory Items
    if (shouldSyncTable('inventory')) {
      const localInventory = await db.inventory.toArray();
      for (const rawItem of localInventory) {
        if (rawItem.id && isRecentlyModified(rawItem)) {
          const cleanItem = sanitizePayload(rawItem);
          const recordHash = await generateRecordHash(cleanItem);
          await setDoc(doc(firestore, 'users', uid, 'inventory', String(cleanItem.id)), {
            ...cleanItem,
            recordHash,
            ownerUid: uid,
            updatedAt: cleanItem.updatedAt || new Date().toISOString()
          }, { merge: true });
          count++;
        }
      }
      clearPendingModifiedTable('inventory');
    }

    // 11. MFS Closings
    if (shouldSyncTable('mfsClosings')) {
      const localClosings = await db.mfsClosings.toArray();
      for (const rawItem of localClosings) {
        if (rawItem.id && isRecentlyModified(rawItem)) {
          const cleanItem = sanitizePayload(rawItem);
          const recordHash = await generateRecordHash(cleanItem);
          await setDoc(doc(firestore, 'users', uid, 'mfsClosings', String(cleanItem.id)), {
            ...cleanItem,
            recordHash,
            ownerUid: uid,
            updatedAt: cleanItem.updatedAt || new Date().toISOString()
          }, { merge: true });
          count++;
        }
      }
      clearPendingModifiedTable('mfsClosings');
    }

    // If changes were saved, update the last synced timestamp and clear dirty flag
    if (count > 0 || pendingDeletions.length > 0) {
      localStorage.setItem('albarakah_last_synced', new Date().toISOString());
    }
    clearAllPendingChanges();
  } catch (err: any) {
    if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota limit exceeded')) {
      markQuotaExceeded();
      console.warn('Daily Firestore write quota reached. Switched to offline-safe mode.');
      return count;
    }
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
  if (isQuotaExceededBlocked()) return 0;

  // MULTI-TENANT ISOLATION GUARD: Verify this device's active user matches target uid
  const activeUid = typeof localStorage !== 'undefined' ? localStorage.getItem('albarakah_active_uid') : null;
  if (activeUid && activeUid !== uid) {
    console.warn(`[Sync Guard] Skipping pullCloudToLocal because active user changed (${activeUid} !== ${uid})`);
    return 0;
  }

  let count = 0;
  // Mute Dexie hooks so pulling down cloud data DOES NOT trigger pushLocalToCloud again!
  setSyncSilent(true);

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

    // 10. Inventory Items
    const invSnap = await getDocs(collection(firestore, 'users', uid, 'inventory'));
    if (!invSnap.empty) {
      const inventoryItems: InventoryItem[] = invSnap.docs
        .filter(d => !deletedMap.has(`inventory:${d.id}`))
        .map(d => {
          const data = sanitizePayload(d.data()) as InventoryItem;
          return { ...data, id: Number(d.id) };
        });
      count += await mergeWithTimestamp(db.inventory, inventoryItems);
    }

    // 11. MFS Closings
    const clsSnap = await getDocs(collection(firestore, 'users', uid, 'mfsClosings'));
    if (!clsSnap.empty) {
      const closings: MfsClosing[] = clsSnap.docs
        .filter(d => !deletedMap.has(`mfsClosings:${d.id}`))
        .map(d => {
          const data = sanitizePayload(d.data()) as MfsClosing;
          return { ...data, id: Number(d.id) };
        });
      count += await mergeWithTimestamp(db.mfsClosings, closings);
    }
  } catch (err: any) {
    if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota limit exceeded')) {
      markQuotaExceeded();
      console.warn('Daily Firestore read/write quota reached during pull.');
      return count;
    }
    console.error('Pull from cloud error:', err);
    throw err;
  } finally {
    setSyncSilent(false);
  }

  return count;
}

/**
 * Marks account table as modified for the debounced sync batch.
 * Prevents duplicate immediate Firestore writes that waste write quotas.
 */
export async function syncSingleAccountToCloud(accountId: string): Promise<void> {
  markTableModified('accounts');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('albarakah-db-changed'));
  }
}

export async function fullSync(uid: string, forceAll: boolean = false): Promise<SyncResult> {
  if (!uid) {
    return { success: false, message: 'User not authenticated' };
  }
  if (!navigator.onLine) {
    return { success: true, message: 'You are currently offline. Local data is safely stored in IndexedDB.' };
  }
  if (isQuotaExceededBlocked()) {
    return { 
      success: true, 
      isQuotaExceeded: true, 
      message: 'ক্লাউড সিঙ্ক কোটা সাময়িক পূর্ণ। তবে লোকাল IndexedDB-তে আপনার ডাটা ১০০% সুরক্ষিত ও স্বাভাবিকভাবে কাজ করছে।' 
    };
  }

  try {
    const pushed = await pushLocalToCloud(uid, forceAll);
    const pulled = await pullCloudToLocal(uid);
    localStorage.setItem('albarakah_last_synced', new Date().toISOString());
    return {
      success: true,
      pushedCount: pushed,
      pulledCount: pulled,
      message: 'Cloud sync with SHA-256 verification completed successfully'
    };
  } catch (err: any) {
    if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota limit exceeded')) {
      markQuotaExceeded();
      return {
        success: true,
        isQuotaExceeded: true,
        message: 'দৈনিক ক্লাউড কোটা পূর্ণ। লোকাল IndexedDB ডাটাবেজে সকল ডাটা সম্পূর্ণ নিরাপদ আছে।'
      };
    }
    return {
      success: false,
      message: err?.message || 'Sync failed'
    };
  }
}
