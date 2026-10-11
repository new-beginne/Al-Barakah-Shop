/**
 * Safe Storage Utility for Al-Barakah Digital Manager
 * Provides 100% crash-proof storage access even when third-party cookies or localStorage
 * are blocked or restricted in cross-origin iframes, private tabs, or web containers.
 */

const memoryStore = new Map<string, string>();

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Storage access blocked / restricted in iframe
    }
    return memoryStore.has(key) ? memoryStore.get(key)! : null;
  },

  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch {
      // Storage access blocked or quota exceeded in iframe
    }
    memoryStore.set(key, value);
  },

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Storage access blocked
    }
    memoryStore.delete(key);
  },

  clear(): void {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.clear();
      }
    } catch {
      // ignore
    }
    memoryStore.clear();
  }
};
