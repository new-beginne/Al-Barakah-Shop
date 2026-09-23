import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { AuthModal } from './AuthModal';
import { 
  Store, Phone, Lock, ArrowLeft, CheckCircle2, AlertCircle, 
  KeyRound, ShieldCheck, UserCheck, Calendar, LogOut, RefreshCw, Eye, EyeOff, LogIn
} from 'lucide-react';
import { format } from 'date-fns';

export function StoreProfile() {
  const { user, profile, isOnline, syncStatus, lastSynced, updateStorePassword, updateStoreName, logout, triggerSync } = useAuth();
  const navigate = useNavigate();
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwError, setPwError] = useState('');

  // Store name update state
  const [isEditingName, setIsEditingName] = useState(false);
  const [storeNameInput, setStoreNameInput] = useState(profile?.storeName || '');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameSuccess, setNameSuccess] = useState('');
  const [nameError, setNameError] = useState('');

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);

  // Handle password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (!newPassword) {
      setPwError('Please enter a new password');
      return;
    }

    if (newPassword.length < 6) {
      setPwError('Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match');
      return;
    }

    setPwLoading(true);
    const res = await updateStorePassword(newPassword);
    setPwLoading(false);

    if (res.success) {
      setPwSuccess('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwSuccess(''), 4000);
    } else {
      setPwError(res.error || 'Failed to update password');
    }
  };

  // Handle store name update
  const handleSaveStoreName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError('');
    setNameSuccess('');

    if (!storeNameInput.trim()) {
      setNameError('Store name cannot be empty');
      return;
    }

    setNameLoading(true);
    const res = await updateStoreName(storeNameInput.trim());
    setNameLoading(false);

    if (res.success) {
      setNameSuccess('Store name updated successfully!');
      setIsEditingName(false);
      setTimeout(() => setNameSuccess(''), 3000);
    } else {
      setNameError(res.error || 'Failed to update store name');
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    await triggerSync();
    setIsSyncing(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6 space-y-5 animate-fadeIn">
      {/* Top Bar / Header */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            title="Go Back"
            className="p-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors shadow-xs"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              Store Profile
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              Store details and security settings
            </p>
          </div>
        </div>

        {user ? (
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-colors shadow-xs"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsAuthOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#084b3e] text-white hover:bg-[#0c5e4e] text-xs font-bold transition-all shadow-xs"
          >
            <LogIn size={14} />
            <span>Login</span>
          </button>
        )}
      </div>

      {/* Main Profile Info Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="bg-[#084b3e] text-white p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white p-1 border-2 border-emerald-300 shadow-md flex items-center justify-center shrink-0">
              <img 
                src="/logo.png?v=2" 
                alt="Store Logo" 
                className="w-full h-full object-contain rounded-xl"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-wide">
                  {profile?.storeName || 'Al-Barakah Digital Studio'}
                </h2>
                <span className="inline-flex items-center gap-1 bg-emerald-500/30 text-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/30">
                  <UserCheck size={11} /> Active
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5 font-medium flex items-center gap-1.5">
                <Phone size={13} className="text-emerald-300" />
                {profile?.phone ? `+88 ${profile.phone}` : 'No phone number set'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setStoreNameInput(profile?.storeName || '');
              setIsEditingName(!isEditingName);
            }}
            className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition-all border border-white/20 self-end sm:self-auto"
          >
            {isEditingName ? 'Cancel' : 'Edit Name'}
          </button>
        </div>

        {/* Edit Store Name Inline Form */}
        {isEditingName && (
          <form onSubmit={handleSaveStoreName} className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex flex-col sm:flex-row gap-2.5">
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-gray-700 mb-1">
                New Store Name
              </label>
              <input
                type="text"
                value={storeNameInput}
                onChange={(e) => setStoreNameInput(e.target.value)}
                placeholder="e.g. Al-Barakah Digital Studio"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#084b3e]"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={nameLoading}
                className="px-4 py-2 bg-[#084b3e] text-white text-xs font-bold rounded-xl hover:bg-[#0c5e4e] transition-all disabled:opacity-50"
              >
                {nameLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        )}

        {/* Name notification message */}
        {nameSuccess && (
          <div className="m-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            {nameSuccess}
          </div>
        )}
        {nameError && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            {nameError}
          </div>
        )}

        {/* Detail List */}
        <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 font-semibold">
              <Store size={15} className="text-gray-400" />
              <span>Business Type:</span>
              <span className="text-gray-900 font-bold ml-auto">Digital Studio & Online Service</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 font-semibold">
              <Phone size={15} className="text-gray-400" />
              <span>Registered Phone:</span>
              <span className="text-gray-900 font-bold ml-auto">{profile?.phone || 'N/A'}</span>
            </div>
          </div>

          <div className="space-y-3 pt-3 sm:pt-0 sm:pl-4">
            <div className="flex items-center gap-2 text-xs text-gray-500 font-semibold">
              <Calendar size={15} className="text-gray-400" />
              <span>Account Created:</span>
              <span className="text-gray-900 font-bold ml-auto">
                {profile?.createdAt ? format(new Date(profile.createdAt), 'dd MMMM, yyyy') : 'Active'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 font-semibold">
              <ShieldCheck size={15} className="text-emerald-600" />
              <span>Cloud Backup:</span>
              <span className="text-emerald-700 font-bold ml-auto">
                {syncStatus === 'synced' ? 'Synced (Auto Backup)' : 'Active'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Password Change Minimalist Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center">
              <KeyRound size={16} />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900">
                Change Password
              </h3>
              <p className="text-xs text-gray-500">
                Enter your new password and confirm to update
              </p>
            </div>
          </div>
        </div>

        {!user ? (
          <div className="p-6 text-center space-y-3">
            <p className="text-xs text-gray-600 font-medium">
              Please log in with your phone number and password to change your password.
            </p>
            <button
              type="button"
              onClick={() => setIsAuthOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#084b3e] text-white rounded-xl text-xs font-bold hover:bg-[#0c5e4e] transition-all shadow-xs"
            >
              <LogIn size={14} />
              <span>Login</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handlePasswordChange} className="p-5 sm:p-6 space-y-4">
            {pwSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{pwSuccess}</span>
              </div>
            )}

            {pwError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle size={16} className="text-red-600 shrink-0" />
                <span>{pwError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* New Password */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-3 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#084b3e] transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full pl-3 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#084b3e] transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={pwLoading}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#084b3e] text-white rounded-xl text-xs font-extrabold hover:bg-[#0c5e4e] transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {pwLoading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Updating password...</span>
                  </>
                ) : (
                  <>
                    <Lock size={14} />
                    <span>Update Password</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Cloud & Data Status Minimal Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="text-xs font-bold text-gray-800">
              {isOnline ? 'Internet Connected (Online)' : 'Offline Mode'}
            </span>
          </div>
          <p className="text-xs text-gray-500 font-medium">
            Last Cloud Backup: {lastSynced ? format(new Date(lastSynced), 'dd/MM/yy, hh:mm a') : 'Sync Now'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleManualSync}
          disabled={isSyncing || !isOnline}
          className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
          {isSyncing ? 'Syncing...' : 'Sync Cloud Now'}
        </button>
      </div>

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}
