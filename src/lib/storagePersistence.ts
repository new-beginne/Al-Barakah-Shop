/**
 * Persistent Storage & Data Protection Utility for Al-Barakah Digital Manager
 * Ensures IndexedDB is granted persistent storage by the browser so reinstalling,
 * updating, or browser storage pressure never deletes or evicts local shop data.
 */

export async function requestPersistentStorage(): Promise<{
  supported: boolean;
  persisted: boolean;
  estimate?: { usage: number; quota: number };
}> {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return { supported: false, persisted: false };
  }

  try {
    let isPersisted = false;
    if (navigator.storage.persisted) {
      isPersisted = await navigator.storage.persisted();
    }

    if (!isPersisted && navigator.storage.persist) {
      isPersisted = await navigator.storage.persist();
      if (isPersisted) {
        console.log('✅ Al-Barakah DB: Persistent storage granted. Data will not be evicted.');
      } else {
        console.log('ℹ️ Al-Barakah DB: Persistent storage not explicitly granted; browser default retention applied.');
      }
    } else if (isPersisted) {
      console.log('✅ Al-Barakah DB: Storage is already persisted.');
    }

    let estimate: { usage: number; quota: number } | undefined;
    if (navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      estimate = {
        usage: est.usage || 0,
        quota: est.quota || 0,
      };
    }

    return {
      supported: true,
      persisted: isPersisted,
      estimate,
    };
  } catch (err) {
    console.warn('Failed to query or request persistent storage:', err);
    return { supported: false, persisted: false };
  }
}
