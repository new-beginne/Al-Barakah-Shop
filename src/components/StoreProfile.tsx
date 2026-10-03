import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { AuthModal } from './AuthModal';
import { 
  Store, Phone, Lock, ArrowLeft, CheckCircle2, AlertCircle, 
  KeyRound, ShieldCheck, UserCheck, Calendar, LogOut, RefreshCw, 
  Eye, EyeOff, LogIn, Camera, Upload, Trash2, ShieldAlert, 
  AlertTriangle, X, Cloud, CloudCheck, HardDrive, Edit3, Check
} from 'lucide-react';
import { format } from 'date-fns';

export function StoreProfile() {
  const { 
    user, profile, isOnline, syncStatus, lastSynced, 
    updateStorePassword, updateStoreName, updateStorePhoto, 
    logout, deleteAccount, triggerSync 
  } = useAuth();
  const navigate = useNavigate();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Profile Photo state
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoSuccess, setPhotoSuccess] = useState('');
  const [photoError, setPhotoError] = useState('');

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwError, setPwError] = useState('');

  // Delete Account state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Store name update state
  const [isEditingName, setIsEditingName] = useState(false);
  const [storeNameInput, setStoreNameInput] = useState(profile?.storeName || '');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameSuccess, setNameSuccess] = useState('');
  const [nameError, setNameError] = useState('');

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState('');

  // Handle Photo Upload
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please select a valid image file (PNG, JPG, WebP).');
      setTimeout(() => setPhotoError(''), 4000);
      return;
    }

    setPhotoLoading(true);
    setPhotoError('');
    setPhotoSuccess('');

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          try {
            // Compress/resize to max 256x256
            const canvas = document.createElement('canvas');
            const maxDim = 256;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxDim) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              }
            } else {
              if (height > maxDim) {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
              await updateStorePhoto(compressedDataUrl);
              setPhotoSuccess('Store photo updated successfully.');
              setTimeout(() => setPhotoSuccess(''), 3500);
            }
          } catch (err: any) {
            setPhotoError('Failed to process image file.');
            setTimeout(() => setPhotoError(''), 4000);
          } finally {
            setPhotoLoading(false);
          }
        };
        img.onerror = () => {
          setPhotoError('Invalid image file format.');
          setPhotoLoading(false);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setPhotoError('Failed to read image file.');
      setPhotoLoading(false);
    }
  };

  const handleResetPhoto = async () => {
    setPhotoLoading(true);
    try {
      await updateStorePhoto('');
      setPhotoSuccess('Logo reset to default.');
      setTimeout(() => setPhotoSuccess(''), 3000);
    } catch (err: any) {
      setPhotoError('Failed to reset logo.');
    } finally {
      setPhotoLoading(false);
    }
  };

  // Handle password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (!newPassword) {
      setPwError('Please enter a new password.');
      return;
    }

    if (newPassword.length < 6) {
      setPwError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match.');
      return;
    }

    setPwLoading(true);
    const res = await updateStorePassword(newPassword);
    setPwLoading(false);

    if (res.success) {
      setPwSuccess('Password updated successfully.');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwSuccess(''), 4000);
    } else {
      setPwError(res.error || 'Failed to update password.');
    }
  };

  // Handle delete account submit
  const handleDeleteAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError('');

    const cleanConfirm = deleteConfirmationText.trim().toUpperCase();
    if (cleanConfirm !== 'DELETE') {
      setDeleteError('Please type "DELETE" exactly to confirm.');
      return;
    }

    if (!deletePassword) {
      setDeleteError('Please enter your account password.');
      return;
    }

    setIsDeletingAccount(true);
    const res = await deleteAccount(deletePassword);
    setIsDeletingAccount(false);

    if (res.success) {
      setIsDeleteModalOpen(false);
      navigate('/');
    } else {
      setDeleteError(res.error || 'Failed to delete account.');
    }
  };

  // Handle store name update
  const handleSaveStoreName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError('');
    setNameSuccess('');

    if (!storeNameInput.trim()) {
      setNameError('Store name cannot be empty.');
      return;
    }

    setNameLoading(true);
    const res = await updateStoreName(storeNameInput.trim());
    setNameLoading(false);

    if (res.success) {
      setNameSuccess('Store name updated successfully.');
      setIsEditingName(false);
      setTimeout(() => setNameSuccess(''), 3000);
    } else {
      setNameError(res.error || 'Failed to update store name.');
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncFeedback('');
    const res = await triggerSync();
    setIsSyncing(false);
    if (res.success) {
      setSyncFeedback('Cloud sync completed successfully.');
      setTimeout(() => setSyncFeedback(''), 3500);
    } else {
      setSyncFeedback(res.message || 'Sync failed. Check connection.');
      setTimeout(() => setSyncFeedback(''), 4000);
    }
  };

  const currentStoreName = profile?.storeName || 'Al-Barakah Digital Studio';

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 sm:py-7 space-y-6 animate-fadeIn pb-16">
      {/* Top Bar / Navigation Header */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            title="Go Back"
            className="w-9 h-9 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-colors shadow-xs cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              Store Profile
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              Manage your shop identity, cloud synchronization, and security
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 hover:border-red-200 hover:bg-red-50 text-gray-700 hover:text-red-600 text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsAuthOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#084b3e] text-white hover:bg-[#0c5e4e] text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <LogIn size={14} />
            <span>Login / Register</span>
          </button>
        )}
      </div>

      {/* Global Alerts / Toasts */}
      {photoSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn shadow-xs">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{photoSuccess}</span>
        </div>
      )}
      {photoError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn shadow-xs">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span>{photoError}</span>
        </div>
      )}
      {syncFeedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn shadow-xs">
          <CloudCheck size={16} className="text-emerald-600 shrink-0" />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* Hero Store Profile Banner Card */}
      <div className="bg-gradient-to-br from-[#084b3e] via-[#095748] to-[#06382e] text-white rounded-3xl p-6 sm:p-7 shadow-md relative overflow-hidden">
        {/* Subtle decorative circle glow */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-teal-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4 sm:gap-5">
            {/* Store Avatar with Camera Hover Button */}
            <div className="relative group shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-white p-1 border-2 border-emerald-300/80 shadow-md flex items-center justify-center overflow-hidden">
                <img 
                  src={profile?.photoURL || '/logo.png?v=2'} 
                  alt="Shop Logo" 
                  className="w-full h-full object-cover rounded-xl"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/logo.png?v=2';
                  }}
                />
              </div>

              {/* Upload Trigger Overlay */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={photoLoading}
                title="Change Store Photo"
                className="absolute inset-0 bg-black/60 hover:bg-black/75 text-white rounded-2xl flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[10px] font-bold"
              >
                {photoLoading ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <>
                    <Camera size={20} />
                    <span className="mt-1">Change</span>
                  </>
                )}
              </button>

              <input 
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageFileChange}
                className="hidden"
              />
            </div>

            {/* Store Details */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {currentStoreName}
                </h2>
                <span className="inline-flex items-center gap-1 bg-emerald-400/20 text-emerald-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                  <UserCheck size={12} /> Active
                </span>
              </div>

              <p className="text-xs text-emerald-100/90 font-medium">
                Digital Studio & Online Service
              </p>

              <div className="flex items-center gap-3 pt-1 text-xs text-emerald-200">
                <span className="flex items-center gap-1 font-semibold">
                  <Phone size={13} className="text-emerald-300" />
                  {profile?.phone ? `+88 ${profile.phone}` : 'No phone linked'}
                </span>
              </div>

              {/* Action buttons under photo on mobile/desktop */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-bold bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-xl border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Upload size={13} />
                  <span>Upload Photo</span>
                </button>
                {profile?.photoURL && (
                  <button
                    type="button"
                    onClick={handleResetPhoto}
                    className="text-xs font-bold text-emerald-200 hover:text-white px-2 py-1.5 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Reset to default logo"
                  >
                    <Trash2 size={13} />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Edit Name Button */}
          <button
            type="button"
            onClick={() => {
              setStoreNameInput(currentStoreName);
              setIsEditingName(!isEditingName);
            }}
            className="px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition-all border border-white/20 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shadow-xs shrink-0"
          >
            <Edit3 size={14} />
            <span>{isEditingName ? 'Cancel' : 'Edit Name'}</span>
          </button>
        </div>

        {/* Inline Store Name Edit Form */}
        {isEditingName && (
          <form onSubmit={handleSaveStoreName} className="mt-5 p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 space-y-3 animate-fadeIn">
            <label className="block text-xs font-bold text-emerald-100">
              Update Store Name
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={storeNameInput}
                onChange={(e) => setStoreNameInput(e.target.value)}
                placeholder="Enter store name"
                className="flex-1 px-3.5 py-2 bg-white text-gray-900 border border-transparent rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={nameLoading}
                  className="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-bold text-xs rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {nameLoading ? <RefreshCw size={13} className="animate-spin" /> : <Check size={14} />}
                  <span>Save</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
            {nameError && (
              <p className="text-xs text-rose-200 font-semibold">{nameError}</p>
            )}
          </form>
        )}
      </div>

      {/* Name Update Success/Error Feedback */}
      {nameSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn shadow-xs">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{nameSuccess}</span>
        </div>
      )}

      {/* Quick Overview Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-1">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold">
            <Store size={15} className="text-gray-400" />
            <span>Business Type</span>
          </div>
          <p className="text-sm font-bold text-gray-900 truncate">
            Digital Studio
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-1">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold">
            <Phone size={15} className="text-gray-400" />
            <span>Store Contact</span>
          </div>
          <p className="text-sm font-bold text-gray-900 truncate">
            {profile?.phone ? `+88 ${profile.phone}` : 'Unregistered'}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-1">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold">
            <Cloud size={15} className="text-emerald-600" />
            <span>Cloud Backup</span>
          </div>
          <p className="text-sm font-bold text-emerald-700 truncate">
            {syncStatus === 'synced' ? 'Active & Synced' : isOnline ? 'Online' : 'Offline Mode'}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-1">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold">
            <Calendar size={15} className="text-gray-400" />
            <span>Member Since</span>
          </div>
          <p className="text-sm font-bold text-gray-900 truncate">
            {profile?.createdAt ? format(new Date(profile.createdAt), 'dd MMM yyyy') : 'Active Store'}
          </p>
        </div>
      </div>

      {/* Cloud Synchronization Card */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
              <Cloud size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-gray-900">
                  Cloud Data Synchronization
                </h3>
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Automatically saves sales, expenses, and MFS transactions to your Google Cloud database
              </p>
              <p className="text-[11px] text-gray-400 mt-1 font-medium">
                Last cloud backup: {lastSynced ? format(new Date(lastSynced), 'dd/MM/yyyy, hh:mm a') : 'Never synced'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing || !isOnline}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer shrink-0"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Cloud Now'}</span>
          </button>
        </div>
      </div>

      {/* Security & Password Card */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-gray-100 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
            <KeyRound size={20} />
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900">
              Security & Password
            </h3>
            <p className="text-xs text-gray-500">
              Update your master security password for account access
            </p>
          </div>
        </div>

        {!user ? (
          <div className="p-6 text-center space-y-3">
            <p className="text-xs text-gray-600 font-medium max-w-md mx-auto">
              Please log in to your account with your registered phone number and password to manage security settings.
            </p>
            <button
              type="button"
              onClick={() => setIsAuthOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#084b3e] text-white rounded-xl text-xs font-bold hover:bg-[#0c5e4e] transition-all shadow-xs cursor-pointer"
            >
              <LogIn size={14} />
              <span>Login to Account</span>
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
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
                <span>{pwError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#084b3e] transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

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
                    className="w-full pl-3.5 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#084b3e] transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
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
                className="w-full sm:w-auto px-5 py-2.5 bg-[#084b3e] hover:bg-[#0c5e4e] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {pwLoading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Updating password...</span>
                  </>
                ) : (
                  <>
                    <Lock size={14} />
                    <span>Save Password</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Account Session Card */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-base font-black text-gray-900 flex items-center gap-2">
            <LogOut size={16} className="text-gray-500" />
            <span>Account Session</span>
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            {user ? `Logged in: ${user.email}` : 'No account logged in (Guest offline mode)'}
          </p>
        </div>

        {user ? (
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsAuthOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#084b3e] hover:bg-[#0c5e4e] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
          >
            <LogIn size={14} />
            <span>Login to Account</span>
          </button>
        )}
      </div>

      {/* Danger Zone: Delete Account & Data */}
      {user && (
        <div className="bg-rose-50/50 rounded-3xl border border-rose-200 p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-black text-rose-950">
                    Delete Store Account
                  </h4>
                  <span className="text-[10px] bg-rose-200 text-rose-900 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Permanent
                  </span>
                </div>
                <p className="text-xs text-rose-800/90 font-medium mt-1 leading-relaxed max-w-xl">
                  Permanently erase all cloud backups (sales, expenses, dues, MFS records), store profile, and offline local data on this device.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setDeletePassword('');
                setDeleteConfirmationText('');
                setDeleteError('');
                setIsDeleteModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
            >
              <Trash2 size={14} />
              <span>Delete Account</span>
            </button>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={() => setIsDeleteModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3 border border-red-100">
              <ShieldAlert size={28} strokeWidth={2.5} />
            </div>
            <h3 className="font-bold text-xl text-[#182236] mb-1 text-center">Permanently Delete Account</h3>
            <p className="text-xs text-rose-600 font-semibold mb-5 text-center">Warning: This action cannot be undone</p>

            <div className="space-y-4">
              <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-900 space-y-1.5">
                <p className="font-bold">Proceeding will permanently wipe:</p>
                <ul className="list-disc pl-5 space-y-1 font-medium text-rose-800">
                  <li>Sales, expenses, dues, MFS & reports</li>
                  <li>Store profile ({user?.email})</li>
                  <li>Local IndexedDB offline storage</li>
                </ul>
              </div>

              {deleteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              <form id="delete-account-form" onSubmit={handleDeleteAccountSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                    Type <span className="text-rose-600 font-mono font-black">DELETE</span> to confirm:
                  </label>
                  <input
                    type="text"
                    required
                    value={deleteConfirmationText}
                    onChange={(e) => setDeleteConfirmationText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-mono font-bold text-[#1d2939] focus:bg-white focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 transition-all text-center tracking-wider"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                    Account Password:
                  </label>
                  <div className="relative">
                    <input
                      type={showDeletePassword ? 'text' : 'password'}
                      required
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="Enter your account password"
                      className="w-full h-[47px] pl-4 pr-10 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-semibold text-[#1d2939] focus:bg-white focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeletePassword(!showDeletePassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showDeletePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    disabled={isDeletingAccount}
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="flex-1 py-3 font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isDeletingAccount}
                    className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isDeletingAccount ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={14} />
                        <span>Delete Account</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal for Login/Registration */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}
