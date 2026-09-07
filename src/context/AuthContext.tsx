import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, firestore, testFirestoreConnection } from '../lib/firebase';
import { fullSync, SyncResult } from '../services/syncService';

import { sanitizeText, BruteForceGuard } from '../lib/security';

export interface UserProfile {
  uid: string;
  storeName: string;
  phone: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isOnline: boolean;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  lastSynced: string | null;
  registerWithStore: (storeName: string, phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithPhone: (phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('albarakah_user_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [lastSynced, setLastSynced] = useState<string | null>(() => {
    return localStorage.getItem('albarakah_last_synced') || null;
  });

  // Check network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (user) {
        triggerSync();
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user]);

  // Boot connection check
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const docRef = doc(firestore, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setProfile(data);
            localStorage.setItem('albarakah_user_profile', JSON.stringify(data));
          }
        } catch (err) {
          console.warn('Could not fetch online profile, using cached profile:', err);
        }
      } else {
        setProfile(null);
        localStorage.removeItem('albarakah_user_profile');
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
    setSyncStatus('syncing');
    try {
      const result = await fullSync(user.uid);
      if (result.success) {
        setSyncStatus('synced');
        const now = new Date().toISOString();
        setLastSynced(now);
      } else {
        setSyncStatus('error');
      }
      return result;
    } catch (e: any) {
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

      // Push existing local Dexie data to Cloud
      setTimeout(() => {
        triggerSync();
      }, 1000);

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

      // Fetch Profile
      try {
        const docRef = doc(firestore, 'users', userCred.user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          setProfile(data);
          localStorage.setItem('albarakah_user_profile', JSON.stringify(data));
        }
      } catch (profileErr) {
        console.warn('Could not fetch profile from Firestore on login:', profileErr);
      }

      // Sync and pull all cloud records to local IndexedDB!
      setTimeout(() => {
        triggerSync();
      }, 500);

      return { success: true };
    } catch (err: any) {
      console.error('Login error:', err);
      const failRecord = BruteForceGuard.recordFailure(cleanPhone);
      let message = 'Login failed. Please check your phone number or password.';
      if (failRecord.locked) {
        message = `Account temporarily locked due to repeated failed attempts. Please try again after ${failRecord.waitSeconds} seconds.`;
      } else if (err?.code === 'auth/user-not-found' || err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        message = `Incorrect phone number or password. ${failRecord.attemptsLeft} attempt(s) remaining before temporary lockout.`;
      }
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setProfile(null);
      localStorage.removeItem('albarakah_user_profile');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      isOnline,
      syncStatus,
      lastSynced,
      registerWithStore,
      loginWithPhone,
      logout,
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
