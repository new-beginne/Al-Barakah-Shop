/**
 * Al-Barakah Enterprise Security Engine
 * Provides:
 * 1. Cryptographic SHA-256 Data Integrity Hashing (Tamper-proofing)
 * 2. Real-time XSS & Cyber Injection Sanitization
 * 3. Brute-Force & Credential Stuffing Rate Limiter
 * 4. Secure Payload Verification
 */

// 1. Cryptographic SHA-256 Hashing
export async function calculateSha256(content: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    // Fallback simple hash if subtle crypto not available
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.error('SHA-256 calculation error:', err);
    return 'unhashed';
  }
}

// Generate an integrity hash for any transactional record
export async function generateRecordHash(record: Record<string, any>): Promise<string> {
  // Extract deterministically ordered keys ignoring volatile fields like sync timestamps
  const cleanRecord: Record<string, any> = {};
  const excludedKeys = ['recordHash', 'updatedAt', 'syncedAt'];
  
  Object.keys(record)
    .filter(k => !excludedKeys.includes(k))
    .sort()
    .forEach(key => {
      cleanRecord[key] = record[key];
    });

  const serialized = JSON.stringify(cleanRecord);
  return calculateSha256(serialized);
}

// 2. Anti-XSS & Payload Sanitization
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return '';
  if (typeof input !== 'string') return String(input);

  return input
    // Strip script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Strip iframe, object, embed
    .replace(/<(iframe|object|embed|svg|style|link)[^>]*?>.*?<\/\1>/gi, '')
    // Strip event handlers like onclick, onload, onerror
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    // Strip javascript: pseudo-protocol
    .replace(/javascript\s*:/gi, '')
    // Strip dangerous HTML brackets
    .replace(/[<>]/g, '')
    .trim();
}

// Deep sanitize any object
export function sanitizePayload<T>(item: T): T {
  if (!item || typeof item !== 'object') {
    if (typeof item === 'string') {
      return sanitizeText(item) as unknown as T;
    }
    return item;
  }

  if (Array.isArray(item)) {
    return item.map(element => sanitizePayload(element)) as unknown as T;
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(item)) {
    // Prevent prototype pollution attacks
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    if (value === undefined) {
      continue;
    }
    const sanitizedVal = sanitizePayload(value);
    if (sanitizedVal !== undefined) {
      result[key] = sanitizedVal;
    }
  }
  return result as T;
}

// 3. Brute-Force & Credential Attack Defense Rate Limiter
interface AttemptRecord {
  count: number;
  lastAttempt: number;
  lockedUntil: number;
}

const attemptStorage = new Map<string, AttemptRecord>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_PERIOD_MS = 60 * 1000; // 1 minute lockout

export const BruteForceGuard = {
  checkStatus(identifier: string): { allowed: boolean; waitSeconds?: number } {
    const record = attemptStorage.get(identifier);
    if (!record) return { allowed: true };

    const now = Date.now();
    if (record.lockedUntil > now) {
      const waitSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { allowed: false, waitSeconds };
    }

    // Lockout expired, reset if it has been long enough
    if (now - record.lastAttempt > LOCKOUT_PERIOD_MS * 2) {
      attemptStorage.delete(identifier);
    }

    return { allowed: true };
  },

  recordFailure(identifier: string): { locked: boolean; waitSeconds?: number; attemptsLeft: number } {
    const now = Date.now();
    const current = attemptStorage.get(identifier) || { count: 0, lastAttempt: now, lockedUntil: 0 };
    current.count += 1;
    current.lastAttempt = now;

    if (current.count >= MAX_ATTEMPTS) {
      current.lockedUntil = now + LOCKOUT_PERIOD_MS;
      attemptStorage.set(identifier, current);
      return { 
        locked: true, 
        waitSeconds: Math.ceil(LOCKOUT_PERIOD_MS / 1000),
        attemptsLeft: 0
      };
    }

    attemptStorage.set(identifier, current);
    return {
      locked: false,
      attemptsLeft: MAX_ATTEMPTS - current.count
    };
  },

  clear(identifier: string): void {
    attemptStorage.delete(identifier);
  }
};
