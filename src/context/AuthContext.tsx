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
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, firestore } from '../lib/firebase';
import { pullCloudToLocal, fullSync, pushLocalToCloud, clearAllCloudData, SyncResult, isQuotaExceededBlocked, markQuotaExceeded } from '../services/syncService';
import { db, hasPendingLocalChanges, clearLocalDatabaseForAccountSwitch } from '../db/db';

import { sanitizeText, BruteForceGuard, calculateSha256 } from '../lib/security';

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
    return localStorage.getItem('albarakah_offline_session') === 'true';
  });

  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('albarakah_user_profile');
      const parsed = saved ? JSON.parse(saved) : null;
      const cachedPhoto = localStorage.getItem('albarakah_shop_photo');
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
    const isOffline = localStorage.getItem('albarakah_offline_session') === 'true';
    if (isOffline) {
      try {
        const saved = localStorage.getItem('albarakah_user_profile');
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

  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [lastSynced, setLastSynced] = useState<string | null>(() => {
    return localStorage.getItem('albarakah_last_synced') || null;
  });

  const [isBalanceVisible, setIsBalanceVisible] = useState(() => {
    try {
      const saved = localStorage.getItem('albarakah_balance_visible');
      return saved !== null ? saved === 'true' : true; // Default to true in production!
    } catch {
      return true;
    }
  });

  const toggleBalanceVisibility = () => {
    setIsBalanceVisible(prev => {
      const next = !prev;
      try {
        localStorage.setItem('albarakah_balance_visible', String(next));
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
      if (user && navigator.onLine && !isQuotaExceededBlocked()) {
        // STRICT GUARD: Only proceed if database has actual pending changes!
        if (!hasPendingLocalChanges()) return;

        // Debounce sync so multiple rapid DB writes batch together into a single write
        clearTimeout(syncTimeout);
        syncTimeout = setTimeout(async () => {
          if (!isQuotaExceededBlocked() && hasPendingLocalChanges()) {
            try {
              setSyncStatus('syncing');
              // STRICT QUOTA GUARD: Only push modified local data! Never pull 11 collections on local edits!
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
        }, 7000); // 7 second debounce to batch rapid transactions together into 1 push
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      // ONLY trigger sync if there are actual offline changes pending to be pushed!
      if (!isQuotaExceededBlocked() && hasPendingLocalChanges()) {
        runAutoSync();
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    // Listen for custom db-changed events dispatched from Dexie hooks
    window.addEventListener('albarakah-db-changed', runAutoSync);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('albarakah-db-changed', runAutoSync);
      clearTimeout(syncTimeout);
    };
  }, [user]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      const previousActiveUid = localStorage.getItem('albarakah_active_uid');

      if (currentUser) {
        setUser(currentUser);
        const isAccountSwitch = previousActiveUid && previousActiveUid !== currentUser.uid;

        if (isAccountSwitch) {
          console.info(`[Auth] Account switch detected: ${previousActiveUid} -> ${currentUser.uid}. Resetting local DB for new user.`);
          // CRITICAL: A different user has signed in. Wipe previous user's local tables so no data leaks!
          await clearLocalDatabaseForAccountSwitch(true);
        }

        localStorage.setItem('albarakah_active_uid', currentUser.uid);

        try {
          if (!isQuotaExceededBlocked()) {
            const cachedProfile = localStorage.getItem('albarakah_user_profile');
            // If account switched or no cached profile, fetch from firestore
            if (isAccountSwitch || !cachedProfile) {
              const docRef = doc(firestore, 'users', currentUser.uid);
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) {
                const data = docSnap.data() as UserProfile;
                setProfile(data);
                localStorage.setItem('albarakah_user_profile', JSON.stringify(data));
              }
            }
          }
        } catch (err: any) {
          if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota limit exceeded')) {
            markQuotaExceeded();
          }
          console.warn('Could not fetch online profile, using cached profile:', err);
        }

        // Account synchronization:
        if (navigator.onLine && !isQuotaExceededBlocked()) {
          setTimeout(async () => {
            try {
              const salesCount = await db.sales.count();
              const expensesCount = await db.expenses.count();
              const duesCount = await db.dues.count();
              const isFreshOrSwitched = isAccountSwitch || (salesCount === 0 && expensesCount === 0 && duesCount === 0);

              if (isFreshOrSwitched) {
                // Pull cloud data for THIS user from Firestore
                setSyncStatus('syncing');
                await pullCloudToLocal(currentUser.uid);
                setSyncStatus('synced');
                setLastSynced(new Date().toISOString());
              } else if (hasPendingLocalChanges()) {
                // Has pending local changes: push them now
                setSyncStatus('syncing');
                const pushed = await pushLocalToCloud(currentUser.uid, false);
                setSyncStatus('synced');
                if (pushed > 0) {
                  setLastSynced(new Date().toISOString());
                }
              } else {
                setSyncStatus('synced');
              }
            } catch (err) {
              console.warn('Initial sync check error:', err);
              setSyncStatus('synced');
            }
          }, 600);
        } else {
          setSyncStatus('synced');
        }
      } else {
        // User not logged in to Firebase
        const isOffline = localStorage.getItem('albarakah_offline_session') === 'true';
        if (isOffline) {
          try {
            const savedProfile = localStorage.getItem('albarakah_user_profile');
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
            setUser(null);
            setProfile(null);
            setIsOfflineMode(false);
          }
        } else {
          setUser(null);
          setProfile(null);
          setIsOfflineMode(false);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
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
      localStorage.setItem('albarakah_active_uid', userCred.user.uid);

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
      localStorage.setItem('albarakah_user_profile', JSON.stringify(newProfile));

      // Cache credentials hash for offline unlocking
      try {
        const pwHash = await calculateSha256(password);
        localStorage.setItem('albarakah_offline_auth', JSON.stringify({
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

      const previousActiveUid = localStorage.getItem('albarakah_active_uid');
      if (previousActiveUid && previousActiveUid !== userCred.user.uid) {
        console.info(`[Auth] User switched on login: ${previousActiveUid} -> ${userCred.user.uid}. Clearing local data.`);
        await clearLocalDatabaseForAccountSwitch(true);
      }
      localStorage.setItem('albarakah_active_uid', userCred.user.uid);

      // Fetch Profile
      let activeProfile: UserProfile | null = null;
      try {
        const docRef = doc(firestore, 'users', userCred.user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          activeProfile = data;
          setProfile(data);
          localStorage.setItem('albarakah_user_profile', JSON.stringify(data));
        }
      } catch (profileErr) {
        console.warn('Could not fetch profile from Firestore on login:', profileErr);
      }

      // Cache credentials hash for offline unlocking
      try {
        const pwHash = await calculateSha256(password);
        localStorage.setItem('albarakah_offline_auth', JSON.stringify({
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
        const savedOffline = localStorage.getItem('albarakah_offline_auth');
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
    localStorage.setItem('albarakah_user_profile', JSON.stringify(updatedProfile));

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
    localStorage.setItem('albarakah_user_profile', JSON.stringify(updatedProfile));
    if (newPhotoURL) {
      localStorage.setItem('albarakah_shop_photo', newPhotoURL);
    } else {
      localStorage.removeItem('albarakah_shop_photo');
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
    const cachedPhoto = localStorage.getItem('albarakah_shop_photo');
    const newProfile: UserProfile = {
      uid: 'offline_owner',
      storeName: cleanName,
      phone: cleanPhone,
      photoURL: cachedPhoto || '/logo.png?v=2',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem('albarakah_offline_session', 'true');
    localStorage.setItem('albarakah_active_uid', 'offline_owner');
    localStorage.setItem('albarakah_user_profile', JSON.stringify(newProfile));

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

      localStorage.removeItem('albarakah_offline_session');
      setIsOfflineMode(false);

      if (auth.currentUser) {
        await signOut(auth);
      }
      setUser(null);
      setProfile(null);
      localStorage.removeItem('albarakah_user_profile');
      localStorage.removeItem('albarakah_active_uid');
      localStorage.removeItem('albarakah_offline_auth');
      // Local database is PRESERVED so offline shop records are never lost on logout
      setSyncStatus('idle');
    } catch (err) {
      console.error('Logout error:', err);
      localStorage.removeItem('albarakah_offline_session');
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
      localStorage.removeItem('albarakah_user_profile');
      localStorage.removeItem('albarakah_active_uid');
      localStorage.removeItem('albarakah_offline_auth');
      localStorage.removeItem('albarakah_shop_photo');
      localStorage.removeItem('albarakah_last_synced');
      localStorage.removeItem('albarakah_pending_tables');
      localStorage.removeItem('albarakah_db_dirty');
      localStorage.removeItem('albarakah_quota_blocked_until');
      localStorage.removeItem('albarakah_quota_override');
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
