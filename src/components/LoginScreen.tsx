import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Lock, Phone, Store, Eye, EyeOff, ShieldCheck, 
  CheckCircle2, AlertCircle, RefreshCw, KeyRound, WifiOff, LogIn, UserPlus
} from 'lucide-react';

export function LoginScreen() {
  const { loginWithPhone, registerWithStore, isOnline } = useAuth();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [storeName, setStoreName] = useState('Al-Barakah Digital Studio');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!phone.trim()) {
      setErrorMessage('দয়া করে আপনার মোবাইল নম্বর লিখুন (Enter phone number)');
      return;
    }
    if (!password) {
      setErrorMessage('দয়া করে পাসওয়ার্ড লিখুন (Enter password)');
      return;
    }

    setLoading(true);
    const res = await loginWithPhone(phone, password);
    setLoading(false);

    if (res.success) {
      setSuccessMessage('সফলভাবে লগইন হয়েছে! অ্যাপ আনলক হচ্ছে...');
    } else {
      setErrorMessage(res.error || 'লগইন ব্যর্থ হয়েছে। ফোন নম্বর বা পাসওয়ার্ড সঠিক কি না দেখুন।');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!storeName.trim()) {
      setErrorMessage('দোকানের নাম লিখুন (Enter store name)');
      return;
    }
    if (!phone.trim()) {
      setErrorMessage('মোবাইল নম্বর লিখুন (Enter phone number)');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('পাসওয়ার্ড কমপক্ষে ৬ ডিজিট বা অক্ষরের হতে হবে (At least 6 characters)');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('পাসওয়ার্ড ও কনফার্ম পাসওয়ার্ড মিলছে না (Passwords do not match)');
      return;
    }

    setLoading(true);
    const res = await registerWithStore(storeName, phone, password);
    setLoading(false);

    if (res.success) {
      setSuccessMessage('একাউন্ট তৈরি সম্পন্ন হয়েছে! অ্যাপে প্রবেশ করা হচ্ছে...');
    } else {
      setErrorMessage(res.error || 'রেজিস্ট্রেশন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#06382e] via-[#084b3e] to-[#04241d] flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Decorative background blurs */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-teal-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Lock Card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-emerald-900/20 relative z-10 animate-fadeIn">
        {/* Card Header */}
        <div className="bg-[#084b3e] px-6 pt-7 pb-6 text-white text-center relative">
          <div className="inline-flex p-2 rounded-2xl bg-white shadow-lg border-2 border-emerald-200/50 mb-3 transform hover:scale-105 transition-transform">
            <img 
              src="/logo.png?v=2" 
              alt="Al-Barakah Logo" 
              className="w-14 h-14 object-contain rounded-xl"
              referrerPolicy="no-referrer"
            />
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Al-Barakah Digital Manager
          </h1>
          <p className="text-xs text-emerald-200/90 font-medium mt-1">
            ডিজিটাল স্টুডিও ও অনলাইন সেবা • শপ একাউন্ট
          </p>

          {/* Security status badge */}
          <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/15 text-[11px] font-bold text-emerald-100">
            <Lock size={12} className="text-amber-300" />
            <span>লগআউট অবস্থায় ডাটা সুরক্ষিত ও লক করা</span>
          </div>

          {!isOnline && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-red-500/20 border border-red-400/30 rounded-full text-[10px] font-bold text-red-200">
              <WifiOff size={11} />
              <span>অফলাইন মোড (Offline Unlock Active)</span>
            </div>
          )}
        </div>

        {/* Tab switcher */}
        <div className="grid grid-cols-2 p-1.5 bg-gray-100/90 border-b border-gray-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'login'
                ? 'bg-white text-[#084b3e] shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <LogIn size={15} />
            <span>লগইন করুন</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'register'
                ? 'bg-white text-[#084b3e] shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <UserPlus size={15} />
            <span>নতুন একাউন্ট</span>
          </button>
        </div>

        {/* Form Container */}
        <div className="p-6 sm:p-7">
          {/* Notifications */}
          {errorMessage && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold flex items-start gap-2.5 animate-shake">
              <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2.5">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <div>{successMessage}</div>
            </div>
          )}

          {/* LOGIN FORM */}
          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  রেজিস্টার্ড মোবাইল নম্বর (Phone Number)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Phone size={16} />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="017xxxxxxxx"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#084b3e] transition-all"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  পাসওয়ার্ড (Password)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <KeyRound size={16} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="আপনার দোকানের পাসওয়ার্ড দিন"
                    className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#084b3e] transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#084b3e] hover:bg-[#0b5c4d] active:scale-[0.99] text-white rounded-xl text-sm font-extrabold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>যাচাই করা হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Lock size={16} />
                      <span>লগইন করুন ও অ্যাপ খুলুন</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* REGISTER FORM */
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  দোকানের নাম (Store Name)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Store size={16} />
                  </div>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="আল-বারাকাহ ডিজিটাল স্টুডিও"
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#084b3e] transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  মোবাইল নম্বর (Phone Number)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Phone size={16} />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="017xxxxxxxx"
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#084b3e] transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  পাসওয়ার্ড (Password)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <KeyRound size={16} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="কমপক্ষে ৬ ডিজিট বা অক্ষর"
                    className="w-full pl-10 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#084b3e] transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  কনফার্ম পাসওয়ার্ড (Confirm Password)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <KeyRound size={16} />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="পাসওয়ার্ডটি পুনরায় লিখুন"
                    className="w-full pl-10 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#084b3e] transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-[#084b3e] hover:bg-[#0b5c4d] active:scale-[0.99] text-white rounded-xl text-sm font-extrabold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>একাউন্ট তৈরি হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      <span>একাউন্ট তৈরি করুন ও শুরু করুন</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Security Guarantee Note */}
          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-center gap-2 text-[11px] font-semibold text-gray-500">
            <ShieldCheck size={14} className="text-emerald-700 shrink-0" />
            <span>লগআউট করলে দোকানের সকল সেলস ও ব্যালেন্স সম্পূর্ণ গোপন থাকবে</span>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <p className="mt-6 text-xs font-medium text-emerald-200/80 text-center relative z-10">
        Al-Barakah Digital Studio & Online Service • Offline & Cloud Secured
      </p>
    </div>
  );
}
