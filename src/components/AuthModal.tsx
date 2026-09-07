import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  X, Store, Phone, Lock, Cloud, CloudOff, RefreshCw, 
  LogOut, CheckCircle2, AlertCircle, ShieldCheck, UserCheck, Smartphone
} from 'lucide-react';
import { format } from 'date-fns';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { 
    user, profile, isOnline, syncStatus, lastSynced, 
    registerWithStore, loginWithPhone, logout, triggerSync 
  } = useAuth();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setLoading(true);

    const res = await loginWithPhone(phone, password);
    setLoading(false);
    if (res.success) {
      setSuccessMessage('Logged in successfully!');
      setTimeout(() => {
        onClose();
      }, 1000);
    } else {
      setErrorMessage(res.error || 'Login failed');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    setLoading(true);
    const res = await registerWithStore(storeName, phone, password);
    setLoading(false);

    if (res.success) {
      setSuccessMessage('Store account created successfully!');
      setTimeout(() => {
        onClose();
      }, 1000);
    } else {
      setErrorMessage(res.error || 'Registration failed');
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    const result = await triggerSync();
    setIsSyncing(false);
    if (result.success) {
      setSuccessMessage('Cloud backup completed successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } else {
      setErrorMessage(result.message || 'Sync failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-[#084b3e] text-white p-5 flex items-center justify-between relative overflow-hidden">
          <div className="flex items-center gap-3 z-10">
            <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-md border border-white/20">
              <Store size={24} className="text-emerald-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg tracking-wide">
                {user ? 'Store Profile & Cloud Sync' : 'User Profile & Login'}
              </h3>
              <p className="text-xs text-emerald-100/80">
                {user ? (profile?.storeName || 'Al-Barakah Digital') : 'Cloud Backup & Multi-Device Access'}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors z-10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          
          {/* Messages */}
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* If Logged in: Profile View */}
          {user ? (
            <div className="space-y-5">
              {/* Profile Card */}
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-4 flex flex-col gap-2.5">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                      Registered Store
                    </span>
                    <h4 className="text-lg font-black text-gray-900 mt-0.5">
                      {profile?.storeName || 'Al-Barakah Digital Studio'}
                    </h4>
                  </div>
                  <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    <UserCheck size={12} /> Verified
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600 pt-1 border-t border-emerald-100/80">
                  <Phone size={15} className="text-emerald-700" />
                  <span className="font-semibold">{profile?.phone || '017xxxxxxxx'}</span>
                </div>
              </div>

              {/* Sync Status Section */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isOnline ? (
                      <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    ) : (
                      <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                    )}
                    <span className="text-xs font-bold text-gray-700">
                      {isOnline ? 'Internet Connected (Online)' : 'Offline Mode'}
                    </span>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                    syncStatus === 'synced' ? 'bg-emerald-100 text-emerald-800' :
                    syncStatus === 'syncing' ? 'bg-blue-100 text-blue-800' :
                    syncStatus === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-gray-200 text-gray-700'
                  }`}>
                    {syncStatus === 'synced' ? 'Cloud Synced' :
                     syncStatus === 'syncing' ? 'Syncing...' :
                     syncStatus === 'error' ? 'Sync Error' : 'Ready'}
                  </span>
                </div>

                <p className="text-xs text-gray-500">
                  Last Synced: {lastSynced ? format(new Date(lastSynced), 'dd/MM/yyyy, hh:mm a') : 'Not synced yet'}
                </p>

                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncing || !isOnline}
                  className="w-full py-2.5 px-4 bg-[#084b3e] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-[#0c5e4e] transition-all disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                  {isSyncing ? 'Backing up to cloud...' : 'Sync Now (Cloud Backup)'}
                </button>
              </div>

              {/* Info Note */}
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
                <Smartphone size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Log in on any mobile or computer using this phone number and password to automatically access all your sales, expenses, and store records.
                </span>
              </div>

              {/* Logout Button */}
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  onClose();
                }}
                className="w-full py-2.5 px-4 border border-red-200 text-red-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          ) : (
            /* Logged Out: Login or Register Tabs */
            <div className="space-y-4">
              {/* Tab selector */}
              <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setErrorMessage('');
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    tab === 'login' 
                      ? 'bg-white text-[#084b3e] shadow-sm' 
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('register');
                    setErrorMessage('');
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    tab === 'register' 
                      ? 'bg-white text-[#084b3e] shadow-sm' 
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Create Account (Register)
                </button>
              </div>

              {/* Offline-first Assurance */}
              <div className="bg-emerald-50/80 border border-emerald-200/80 p-3 rounded-xl flex items-start gap-2 text-xs text-emerald-900">
                <ShieldCheck size={16} className="text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  Data is first saved offline in your device&apos;s <strong>IndexedDB</strong>. As soon as you are connected to the internet, it automatically syncs with the secure Cloud Firestore.
                </span>
              </div>

              {tab === 'login' ? (
                /* Login Form */
                <form onSubmit={handleLogin} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3.5 top-3 text-gray-400" />
                      <input
                        type="tel"
                        required
                        placeholder="017xxxxxxxx"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-3 text-gray-400" />
                      <input
                        type="password"
                        required
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-[#084b3e] text-white rounded-xl text-sm font-bold shadow-md hover:bg-[#0c5e4e] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </button>
                </form>
              ) : (
                /* Register Form */
                <form onSubmit={handleRegister} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Store Name
                    </label>
                    <div className="relative">
                      <Store size={16} className="absolute left-3.5 top-3 text-gray-400" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Al-Barakah Digital Studio"
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3.5 top-3 text-gray-400" />
                      <input
                        type="tel"
                        required
                        placeholder="017xxxxxxxx"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Password (min 6 chars)
                    </label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-3 text-gray-400" />
                      <input
                        type="password"
                        required
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-3 text-gray-400" />
                      <input
                        type="password"
                        required
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-[#084b3e] text-white rounded-xl text-sm font-bold shadow-md hover:bg-[#0c5e4e] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
