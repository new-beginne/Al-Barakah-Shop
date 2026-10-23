import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  updatePassword,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { auth, firestore } from '../lib/firebase';
import { pullCloudToLocal, fullSync, pushLocalToCloud, clearAllCloudData, SyncResult, isQuotaExceededBlocked, markQuotaExceeded, getDeviceId } from '../services/syncService';
import { db, hasPendingLocalChanges, clearLocalDatabaseForAccountSwitch } from '../db/db';

import { sanitizeText, BruteForceGuard, calculateSha256 } from '../lib/security';
import { safeStorage } from '../lib/safeStorage';

export interface UserProfile {
  uid: string;
  storeName: string;
  phone: string;
  photoURL?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isOnline: boolean;
  isOfflineMode: boolean;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  lastSynced: string | null;
  isBalanceVisible: boolean;
  toggleBalanceVisibility: () => void;
  loginOffline: (storeName?: string, phone?: string) => Promise<{ success: boolean }>;
  registerWithStore: (storeName: string, phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithPhone: (phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
  updateStorePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  updateStoreName: (newStoreName: string) => Promise<{ success: boolean; error?: string }>;
  updateStorePhoto: (photoURL: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  deleteAccount: (password: string) => Promise<{ success: boolean; error?: string }>;
  triggerSync: () => Promise<SyncResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function sanitizePhone(rawPhone: string): string {
  const digits = rawPhone.replace(/[^0-9]/g, '');
  return digits;
}

function phoneToEmail(phone: string): string {
  const clean = sanitizePhone(phone);
  return `${clean}@albarakah.app`;
}

function createOfflineUser(p: UserProfile): User {
  return {
    uid: p.uid,
    email: phoneToEmail(p.phone || '01700000000'),
    displayName: p.storeName,
    photoURL: p.photoURL || null,
    phoneNumber: p.phone,
    emailVerified: true,
    isAnonymous: false,
    metadata: {} as any,
    providerData: [],
    refreshToken: '',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => '',
    getIdTokenResult: async () => ({} as any),
    reload: async () => {},
    toJSON: () => ({}),
  } as unknown as User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(() => {
    return safeStorage.getItem('albarakah_offline_session') !== 'false';
  });

  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = safeStorage.getItem('albarakah_user_profile');
      const parsed = saved ? JSON.parse(saved) : null;
      const cachedPhoto = safeStorage.getItem('albarakah_shop_photo');
      if (parsed) {
        if (!parsed.photoURL && cachedPhoto) parsed.photoURL = cachedPhoto;
        return parsed;
      }
      return {
        uid: 'offline_owner',
        storeName: 'Al-Barakah Digital Studio',
        phone: '01700000000',
        photoURL: cachedPhoto || '/logo.png?v=2'
      };
    } catch {
      return {
        uid: 'offline_owner',
        storeName: 'Al-Barakah Digital Studio',
        phone: '01700000000',
        photoURL: '/logo.png?v=2'
      };
    }
  });

  const [user, setUser] = useState<User | null>(() => {
    const isExplicitlyLocked = safeStorage.getItem('albarakah_offline_session') === 'false';
    if (!isExplicitlyLocked) {
      try {
        const saved = safeStorage.getItem('albarakah_user_profile');
        const parsed = saved ? JSON.parse(saved) : {
          uid: 'offline_owner',
          storeName: 'Al-Barakah Digital Studio',
          phone: '01700000000'
        };
        return createOfflineUser(parsed);
      } catch {
        return createOfflineUser({
          uid: 'offline_owner',
          storeName: 'Al-Barakah Digital Studio',
          phone: '01700000000'
        });
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [lastSynced, setLastSynced] = useState<string | null>(() => {
    return safeStorage.getItem('albarakah_last_synced') || null;
  });

  const [isBalanceVisible, setIsBalanceVisible] = useState(() => {
    try {
      const saved = safeStorage.getItem('albarakah_balance_visible');
      return saved !== null ? saved === 'true' : true; // Default to true in production!
    } catch {
      return true;
    }
  });

  const toggleBalanceVisibility = () => {
    setIsBalanceVisible(prev => {
      const next = !prev;
      try {
        safeStorage.setItem('albarakah_balance_visible', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Check network status & auto-sync events
  useEffect(() => {
    let syncTimeout: any;

    const runAutoSync = () => {
      if (user && user.uid !== 'offline_owner' && navigator.onLine && !isQuotaExceededBlocked()) {
        if (!hasPendingLocalChanges()) return;

        // Fast 1.2s debounce so changes push quickly to cloud without waiting 7 seconds
        clearTimeout(syncTimeout);
        syncTimeout = setTimeout(async () => {
          if (!isQuotaExceededBlocked() && hasPendingLocalChanges() && user && user.uid !== 'offline_owner') {
            try {
              setSyncStatus('syncing');
              const pushed = await pushLocalToCloud(user.uid, false);
              setSyncStatus('synced');
              if (pushed > 0) {
                setLastSynced(new Date().toISOString());
              }
            } catch (err: any) {
              if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota limit exceeded')) {
                markQuotaExceeded();
                setSyncStatus('synced');
              } else {
                setSyncStatus('idle');
              }
            }
          }
        }, 1200);
      }
    };

    const flushImmediate = () => {
      if (user && user.uid !== 'offline_owner' && navigator.onLine && !isQuotaExceededBlocked() && hasPendingLocalChanges()) {
        pushLocalToCloud(user.uid, false).catch(() => {});
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      if (!isQuotaExceededBlocked() && user && user.uid !== 'offline_owner') {
        if (hasPendingLocalChanges()) {
          runAutoSync();
        } else {
          pullCloudToLocal(user.uid).then(() => {
            setSyncStatus('synced');
            setLastSynced(new Date().toISOString());
          }).catch(() => {});
        }
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('albarakah-db-changed', runAutoSync);
    window.addEventListener('beforeunload', flushImmediate);

    const handleVisHide = () => {
      if (document.visibilityState === 'hidden') {
        flushImmediate();
      }
    };
    document.addEventListener('visibilitychange', handleVisHide);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('albarakah-db-changed', runAutoSync);
      window.removeEventListener('beforeunload', flushImmediate);
      document.removeEventListener('visibilitychange', handleVisHide);
      clearTimeout(syncTimeout);
    };
  }, [user]);

  // Tab Focus / App Resume / Periodic Polling Sync
  useEffect(() => {
    let lastPullTime = 0;

    const pullLatestIfDue = async () => {
      if (user && user.uid !== 'offline_owner' && navigator.onLine && !isQuotaExceededBlocked()) {
        const now = Date.now();
        // Cooldown: don't pull more frequently than once every 6 seconds on rapid tab switching
        if (now - lastPullTime > 6000) {
          lastPullTime = now;
          try {
            await pullCloudToLocal(user.uid);
            setSyncStatus('synced');
            setLastSynced(new Date().toISOString());
          } catch (e) {
            // Keep current status
          }
        }
      }
    };

    const handleFocus = () => {
      pullLatestIfDue();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        pullLatestIfDue();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    // Periodic heartbeat sync every 40 seconds to catch any updates made on another device
    const intervalTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        pullLatestIfDue();
      }
    }, 40000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(intervalTimer);
    };
  }, [user]);

  // Listen to Firebase Auth state & Real-Time Cloud Broadcasts
  useEffect(() => {
    let unsubSnapshot: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      const previousActiveUid = safeStorage.getItem('albarakah_active_uid');

      // Clean up previous snapshot listener if user changes
      if (unsubSnapshot) {
        unsubSnapshot();
        unsubSnapshot = null;
      }

      if (currentUser) {
        setUser(currentUser);
        const isAccountSwitch = previousActiveUid && previousActiveUid !== currentUser.uid;

        if (isAccountSwitch) {
          console.info(`[Auth] Account switch detected: ${previousActiveUid} -> ${currentUser.uid}. Resetting local DB for new user.`);
          await clearLocalDatabaseForAccountSwitch(true);
        }

        safeStorage.setItem('albarakah_active_uid', currentUser.uid);

        try {
          if (!isQuotaExceededBlocked()) {
            const cachedProfile = safeStorage.getItem('albarakah_user_profile');
            if (isAccountSwitch || !cachedProfile) {
              const docRef = doc(firestore, 'users', currentUser.uid);
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) {
                const data = docSnap.data() as UserProfile;
                setProfile(data);
                safeStorage.setItem('albarakah_user_profile', JSON.stringify(data));
              }
            }
          }
        } catch (err: any) {
          if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota limit exceeded')) {
            markQuotaExceeded();
          }
          console.warn('Could not fetch online profile, using cached profile:', err);
        }

        // Real-Time Cross-Device Sync Listener (onSnapshot on users/{uid} document)
        try {
          const userDocRef = doc(firestore, 'users', currentUser.uid);
          unsubSnapshot = onSnapshot(userDocRef, async (snap) => {
            if (!snap.exists()) return;
            const data = snap.data();
            const currentDevId = getDeviceId();
            // If another device updated the cloud database:
            if (data?.lastCloudUpdate && data?.lastUpdateDeviceId && data.lastUpdateDeviceId !== currentDevId) {
              const lastHandled = safeStorage.getItem('albarakah_last_handled_cloud_update');
              if (lastHandled !== data.lastCloudUpdate) {
                safeStorage.setItem('albarakah_last_handled_cloud_update', data.lastCloudUpdate);
                try {
                  setSyncStatus('syncing');
                  await pullCloudToLocal(currentUser.uid);
                  setSyncStatus('synced');
                  setLastSynced(new Date().toISOString());
                } catch (livePullErr) {
                  console.warn('Real-time sync pull error:', livePullErr);
                  setSyncStatus('idle');
                }
              }
            }
          }, (err) => {
            console.warn('Real-time sync snapshot listener error:', err);
          });
        } catch (snapshotErr) {
          console.warn('Could not attach real-time sync snapshot listener:', snapshotErr);
        }

        // Account synchronization on launch/login:
        // Push pending local changes, and ALWAYS pull latest cloud data so other devices' changes reflect immediately!
        if (navigator.onLine && !isQuotaExceededBlocked()) {
          setTimeout(async () => {
            try {
              setSyncStatus('syncing');
              if (hasPendingLocalChanges()) {
                await pushLocalToCloud(currentUser.uid, false);
              }
              // Always pull down all updates from Cloud into local Dexie
              await pullCloudToLocal(currentUser.uid);
              setSyncStatus('synced');
              setLastSynced(new Date().toISOString());
            } catch (err) {
              console.warn('Initial sync error:', err);
              setSyncStatus('synced');
            }
          }, 400);
        } else {
          setSyncStatus('synced');
        }
      } else {
        // User not logged in to Firebase
        const isExplicitlyLocked = safeStorage.getItem('albarakah_offline_session') === 'false';
        if (!isExplicitlyLocked) {
          try {
            const savedProfile = safeStorage.getItem('albarakah_user_profile');
            const p: UserProfile = savedProfile ? JSON.parse(savedProfile) : {
              uid: 'offline_owner',
              storeName: 'Al-Barakah Digital Studio',
              phone: '01700000000',
              photoURL: '/logo.png?v=2'
            };
            setProfile(p);
            setUser(createOfflineUser(p));
            setIsOfflineMode(true);
          } catch {
            const fallback: UserProfile = {
              uid: 'offline_owner',
              storeName: 'Al-Barakah Digital Studio',
              phone: '01700000000',
              photoURL: '/logo.png?v=2'
            };
            setProfile(fallback);
            setUser(createOfflineUser(fallback));
            setIsOfflineMode(true);
          }
        } else {
          setUser(null);
          setProfile(null);
          setIsOfflineMode(false);
        }
      }
      setLoading(false);
    });

    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1200);

    return () => {
      clearTimeout(safetyTimer);
      if (unsubSnapshot) {
        unsubSnapshot();
      }
      unsubscribe();
    };
  }, []);

  // Sync function
  const triggerSync = async (): Promise<SyncResult> => {
    if (!user) {
      return { success: false, message: 'Please login first' };
    }
    if (isQuotaExceededBlocked()) {
      setSyncStatus('synced');
      return { 
        success: true, 
        isQuotaExceeded: true, 
        message: 'Offline mode active - All data is safe in local database.' 
      };
    }

    setSyncStatus('syncing');
    try {
      const result = await fullSync(user.uid);
      if (result.success) {
        setSyncStatus('synced');
        const now = new Date().toISOString();
        setLastSynced(now);
      } else if (result.isQuotaExceeded) {
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
      }
      return result;
    } catch (e: any) {
      if (e?.code === 'resource-exhausted' || e?.message?.includes('Quota limit exceeded')) {
        markQuotaExceeded();
        setSyncStatus('synced');
        return {
          success: true,
          isQuotaExceeded: true,
          message: 'Daily cloud quota reached. All data is securely saved in local IndexedDB.'
        };
      }
      setSyncStatus('error');
      return { success: false, message: e?.message || 'Sync failed' };
    }
  };

  // Register with Store Name, Phone and Password
  const registerWithStore = async (storeName: string, phone: string, password: string) => {
    const cleanPhone = sanitizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 6) {
      return { success: false, error: 'Please enter a valid phone number' };
    }
    if (!storeName.trim()) {
      return { success: false, error: 'Please enter your store name' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long' };
    }

    try {
      const email = phoneToEmail(cleanPhone);
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      // STRICT ISOLATION: A brand new store account MUST start 100% fresh!
      // Must NEVER inherit local data from a previous store/user!
      await clearLocalDatabaseForAccountSwitch(true);
      safeStorage.setItem('albarakah_active_uid', userCred.user.uid);

      const newProfile: UserProfile = {
        uid: userCred.user.uid,
        storeName: storeName.trim(),
        phone: cleanPhone,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save to Firestore
      try {
        await setDoc(doc(firestore, 'users', userCred.user.uid), newProfile);
      } catch (firestoreErr) {
        console.warn('Firestore profile write error:', firestoreErr);
      }

      setProfile(newProfile);
      safeStorage.setItem('albarakah_user_profile', JSON.stringify(newProfile));

      // Cache credentials hash for offline unlocking
      try {
        const pwHash = await calculateSha256(password);
        safeStorage.setItem('albarakah_offline_auth', JSON.stringify({
          phone: cleanPhone,
          pwHash,
          profile: newProfile,
          uid: userCred.user.uid
        }));
      } catch (e) {
        console.warn('Could not cache offline auth hash:', e);
      }

      setSyncStatus('synced');
      setLastSynced(new Date().toISOString());

      return { success: true };
    } catch (err: any) {
      console.error('Registration error:', err);
      let message = 'Registration failed. Please try again.';
      if (err?.code === 'auth/email-already-in-use') {
        message = 'An account already exists with this phone number. Please login.';
      } else if (err?.code === 'auth/weak-password') {
        message = 'Password should be stronger (at least 6 characters).';
      }
      return { success: false, error: message };
    }
  };

  // Login with Phone and Password
  const loginWithPhone = async (phone: string, password: string) => {
    const cleanPhone = sanitizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 6) {
      return { success: false, error: 'Please enter a valid phone number' };
    }
    if (!password) {
      return { success: false, error: 'Please enter your password' };
    }

    // Brute-force cyber attack protection
    const rateStatus = BruteForceGuard.checkStatus(cleanPhone);
    if (!rateStatus.allowed) {
      return { 
        success: false, 
        error: `Account temporarily locked due to too many failed attempts. Please wait ${rateStatus.waitSeconds} seconds and try again.` 
      };
    }

    try {
      const email = phoneToEmail(cleanPhone);
      const userCred = await signInWithEmailAndPassword(auth, email, password);

      // Reset brute-force counter on success
      BruteForceGuard.clear(cleanPhone);

      const previousActiveUid = safeStorage.getItem('albarakah_active_uid');
      if (previousActiveUid && previousActiveUid !== userCred.user.uid) {
        console.info(`[Auth] User switched on login: ${previousActiveUid} -> ${userCred.user.uid}. Clearing local data.`);
        await clearLocalDatabaseForAccountSwitch(true);
      }
      safeStorage.setItem('albarakah_active_uid', userCred.user.uid);

      // Fetch Profile
      let activeProfile: UserProfile | null = null;
      try {
        const docRef = doc(firestore, 'users', userCred.user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          activeProfile = data;
          setProfile(data);
          safeStorage.setItem('albarakah_user_profile', JSON.stringify(data));
        }
      } catch (profileErr) {
        console.warn('Could not fetch profile from Firestore on login:', profileErr);
      }

      // Cache credentials hash for offline unlocking
      try {
        const pwHash = await calculateSha256(password);
        safeStorage.setItem('albarakah_offline_auth', JSON.stringify({
          phone: cleanPhone,
          pwHash,
          profile: activeProfile || { uid: userCred.user.uid, storeName: 'Al-Barakah Digital Studio', phone: cleanPhone },
          uid: userCred.user.uid
        }));
      } catch (e) {
        console.warn('Could not cache offline auth hash:', e);
      }

      // Pull only THIS user's data from Cloud into local IndexedDB
      setSyncStatus('syncing');
      try {
        await pullCloudToLocal(userCred.user.uid);
        setSyncStatus('synced');
        setLastSynced(new Date().toISOString());
      } catch (pullErr) {
        console.warn('Could not pull cloud data on login:', pullErr);
        setSyncStatus('idle');
      }

      return { success: true };
    } catch (err: any) {
      console.error('Login error:', err);

      // Offline login fallback if network unavailable
      const isNetworkIssue = !navigator.onLine || err?.code === 'auth/network-request-failed';
      if (isNetworkIssue) {
        const savedOffline = safeStorage.getItem('albarakah_offline_auth');
        if (savedOffline) {
          try {
            const creds = JSON.parse(savedOffline);
            const inputHash = await calculateSha256(password);
            if (creds.phone === cleanPhone && creds.pwHash === inputHash) {
              BruteForceGuard.clear(cleanPhone);
              setProfile(creds.profile);
              setUser({
                uid: creds.uid,
                email: phoneToEmail(cleanPhone),
              } as any);
              return { success: true };
            }
          } catch (offlineErr) {
            console.warn('Offline verification error:', offlineErr);
          }
        }
      }

      const failRecord = BruteForceGuard.recordFailure(cleanPhone);
      let message = 'Login failed. Please check your phone number or password.';
      if (failRecord.locked) {
        message = `Account temporarily locked due to repeated failed attempts. Please try again after ${failRecord.waitSeconds} seconds.`;
      } else if (err?.code === 'auth/user-not-found' || err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        message = `Incorrect phone number or password. ${failRecord.attemptsLeft} attempt(s) remaining before temporary lockout.`;
      } else if (isNetworkIssue) {
        message = 'Device is offline and no offline session was found for this phone number. Please connect to internet to login.';
      }
      return { success: false, error: message };
    }
  };

  // Update password for currently logged-in user
  const updateStorePassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!auth.currentUser) {
      return { success: false, error: 'User is not logged in. Please log in first.' };
    }
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    try {
      await updatePassword(auth.currentUser, newPassword);
      return { success: true };
    } catch (err: any) {
      console.error('Update password error:', err);
      if (err?.code === 'auth/requires-recent-login') {
        return { 
          success: false, 
          error: 'Please log in again before changing your password (Recent login required).' 
        };
      }
      if (err?.code === 'auth/weak-password') {
        return { success: false, error: 'Password is too weak. Please use a stronger password.' };
      }
      return { success: false, error: err?.message || 'Password update failed.' };
    }
  };

  // Update store profile name
  const updateStoreName = async (newStoreName: string): Promise<{ success: boolean; error?: string }> => {
    const cleanName = sanitizeText(newStoreName.trim());
    if (!cleanName) {
      return { success: false, error: 'Store name cannot be empty.' };
    }

    const updatedProfile: UserProfile = {
      uid: user ? user.uid : (profile?.uid || 'guest'),
      storeName: cleanName,
      phone: profile?.phone || '',
      createdAt: profile?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setProfile(updatedProfile);
    safeStorage.setItem('albarakah_user_profile', JSON.stringify(updatedProfile));

    // If logged in and online, also persist to Firestore
    if (user && isOnline) {
      try {
        await setDoc(doc(firestore, 'users', user.uid), updatedProfile, { merge: true });
      } catch (e) {
        console.warn('Could not sync store name update to firestore:', e);
      }
    }

    return { success: true };
  };

  // Update store profile photo
  const updateStorePhoto = async (newPhotoURL: string): Promise<{ success: boolean; error?: string }> => {
    const updatedProfile: UserProfile = {
      uid: user ? user.uid : (profile?.uid || 'guest'),
      storeName: profile?.storeName || 'Al-Barakah Digital Studio',
      phone: profile?.phone || '',
      photoURL: newPhotoURL,
      createdAt: profile?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setProfile(updatedProfile);
    safeStorage.setItem('albarakah_user_profile', JSON.stringify(updatedProfile));
    if (newPhotoURL) {
      safeStorage.setItem('albarakah_shop_photo', newPhotoURL);
    } else {
      safeStorage.removeItem('albarakah_shop_photo');
    }
    window.dispatchEvent(new Event('albarakah-photo-changed'));

    if (user && isOnline) {
      try {
        await setDoc(doc(firestore, 'users', user.uid), { photoURL: newPhotoURL }, { merge: true });
      } catch (e) {
        console.warn('Could not sync store photo update to firestore:', e);
      }
    }

    return { success: true };
  };

  const loginOffline = async (storeName: string = 'Al-Barakah Digital Studio', phone: string = '01700000000') => {
    const cleanPhone = sanitizePhone(phone) || '01700000000';
    const cleanName = storeName.trim() || 'Al-Barakah Digital Studio';
    const cachedPhoto = safeStorage.getItem('albarakah_shop_photo');
    const newProfile: UserProfile = {
      uid: 'offline_owner',
      storeName: cleanName,
      phone: cleanPhone,
      photoURL: cachedPhoto || '/logo.png?v=2',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    safeStorage.setItem('albarakah_offline_session', 'true');
    safeStorage.setItem('albarakah_active_uid', 'offline_owner');
    safeStorage.setItem('albarakah_user_profile', JSON.stringify(newProfile));

    setProfile(newProfile);
    setUser(createOfflineUser(newProfile));
    setIsOfflineMode(true);
    setSyncStatus('synced');

    return { success: true };
  };

  const logout = async () => {
    try {
      // 1. If online and has pending local changes, quickly push to cloud for current user before logging out
      if (user && navigator.onLine && !isQuotaExceededBlocked() && hasPendingLocalChanges()) {
        try {
          await pushLocalToCloud(user.uid, false);
        } catch (syncErr) {
          console.warn('Unsynced push before logout error:', syncErr);
        }
      }

      safeStorage.removeItem('albarakah_offline_session');
      setIsOfflineMode(false);

      if (auth.currentUser) {
        await signOut(auth);
      }
      setUser(null);
      setProfile(null);
      safeStorage.removeItem('albarakah_user_profile');
      safeStorage.removeItem('albarakah_active_uid');
      safeStorage.removeItem('albarakah_offline_auth');
      // Local database is PRESERVED so offline shop records are never lost on logout
      setSyncStatus('idle');
    } catch (err) {
      console.error('Logout error:', err);
      safeStorage.removeItem('albarakah_offline_session');
      setIsOfflineMode(false);
      setUser(null);
      setProfile(null);
      setSyncStatus('idle');
    }
  };

  // Permanently delete account: cloud subcollections, firestore profile doc, auth user, and local IndexedDB
  const deleteAccount = async (password: string): Promise<{ success: boolean; error?: string }> => {
    if (!password) {
      return { success: false, error: 'Please enter your password to confirm account deletion.' };
    }

    const currentUser = auth.currentUser;

    try {
      if (currentUser && currentUser.email) {
        // 1. Re-authenticate user to satisfy Firebase Auth recent-login requirement
        const credential = EmailAuthProvider.credential(currentUser.email, password);
        await reauthenticateWithCredential(currentUser, credential);

        const uid = currentUser.uid;

        // 2. Delete all cloud subcollections from Firestore
        if (navigator.onLine) {
          try {
            await clearAllCloudData(uid);
          } catch (cloudErr) {
            console.warn('Error clearing cloud subcollections during account deletion:', cloudErr);
          }

          // 3. Delete the main user profile document in Firestore
          try {
            await deleteDoc(doc(firestore, 'users', uid));
          } catch (docErr) {
            console.warn('Error deleting user profile document:', docErr);
          }
        }

        // 4. Delete the Firebase Auth User
        await deleteUser(currentUser);
      }

      // 5. Completely wipe local IndexedDB data tables
      await clearLocalDatabaseForAccountSwitch(true);

      // 6. Clear all local storage keys
      safeStorage.removeItem('albarakah_user_profile');
      safeStorage.removeItem('albarakah_active_uid');
      safeStorage.removeItem('albarakah_offline_auth');
      safeStorage.removeItem('albarakah_shop_photo');
      safeStorage.removeItem('albarakah_last_synced');
      safeStorage.removeItem('albarakah_pending_tables');
      safeStorage.removeItem('albarakah_db_dirty');
      safeStorage.removeItem('albarakah_quota_blocked_until');
      safeStorage.removeItem('albarakah_quota_override');
      window.dispatchEvent(new Event('albarakah-photo-changed'));

      setUser(null);
      setProfile(null);
      setSyncStatus('idle');

      return { success: true };
    } catch (err: any) {
      console.error('Delete account error:', err);
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        return { success: false, error: 'Incorrect password. Please enter your valid password.' };
      }
      if (err?.code === 'auth/too-many-requests') {
        return { success: false, error: 'Too many attempts. Account is temporarily locked. Please try again later.' };
      }
      return { success: false, error: err?.message || 'Failed to delete account. Please try again.' };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      isOnline,
      isOfflineMode,
      syncStatus,
      lastSynced,
      isBalanceVisible,
      toggleBalanceVisibility,
      loginOffline,
      registerWithStore,
      loginWithPhone,
      updateStorePassword,
      updateStoreName,
      updateStorePhoto,
      logout,
      deleteAccount,
      triggerSync
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
