import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Sidebar, BottomNav } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { SalesEntry } from './components/SalesEntry';
import { MfsLedger } from './components/MfsLedger';
import { Expenses } from './components/Expenses';
import { Reports } from './components/Reports';
import { Settings } from './components/Settings';
import { Customers } from './components/Customers';
import { CustomerProfile } from './components/CustomerProfile';
import { Borrowings } from './components/Borrowings';
import { HistoryView } from './components/HistoryView';
import { StoreProfile } from './components/StoreProfile';
import { LoginScreen } from './components/LoginScreen';
import { Menu, User, Calendar as CalendarIcon, Clock, WifiOff, Cloud, RefreshCw, Store, Eye, EyeOff, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import { NotificationCenter } from './components/NotificationCenter';

import { useAppNotifications } from './hooks/useAppNotifications';
import { initDefaultAccounts } from './services/accountService';

function TopHeader() {
  const [time, setTime] = useState(new Date());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const { user, profile, isOnline, syncStatus, triggerSync, isBalanceVisible, toggleBalanceVisibility, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const updateTime = () => setTime(new Date());
    updateTime();
    const timer = setInterval(updateTime, 1000);

    // Sync immediately when tab gains focus or user returns
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateTime();
      }
    };

    window.addEventListener('focus', updateTime);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', updateTime);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <>
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 sm:px-6 py-3.5 flex justify-between items-center z-10 shrink-0 sticky top-0 print:hidden">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="md:hidden flex items-center shrink-0">
            <img 
              src="/logo.png?v=2" 
              alt="Al-Barakah Logo" 
              className="w-9 h-9 rounded-full border border-emerald-100 object-contain shadow-xs bg-white p-0.5"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="text-2xl sm:text-3xl hidden sm:block">👋</div>
            <div className="flex flex-col">
              <h2 className="text-base sm:text-lg font-extrabold text-gray-900 leading-tight">
                {profile?.storeName ? profile.storeName : 'Al-Barakah Digital'}
              </h2>
              <p className="text-[11px] font-medium text-gray-500 hidden sm:block">
                {user ? `Phone: ${profile?.phone || ''} • Cloud Sync Enabled` : 'Manage your sales, stock and accounts with ease.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-4">
          
          {/* Offline badge */}
          {!isOnline && (
            <div className="flex items-center gap-1.5 bg-red-50 text-red-700 px-2.5 sm:px-3 py-1 rounded-full border border-red-200 text-[11px] font-bold uppercase tracking-wider shadow-sm animate-pulse">
              <WifiOff size={13} />
              <span className="hidden sm:inline">Offline</span>
            </div>
          )}

          {/* Cloud Sync Status Pill (when logged in) */}
          {user && (
            <button
              type="button"
              onClick={() => triggerSync()}
              title="Click to sync cloud backup"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
            >
              {syncStatus === 'syncing' ? (
                <>
                  <RefreshCw size={13} className="animate-spin text-emerald-700" />
                  <span className="hidden sm:inline">Syncing...</span>
                </>
              ) : (
                <>
                  <Cloud size={14} className="text-emerald-700" />
                  <span className="hidden sm:inline">Cloud Synced</span>
                </>
              )}
            </button>
          )}

          {/* Notifications */}
          <NotificationCenter />

          {/* Date, Time & Balance Visibility Toggle */}
          <div className="hidden xl:flex items-center gap-2">
            <button 
              onClick={toggleBalanceVisibility}
              title={isBalanceVisible ? 'Hide sensitive data' : 'Show sensitive data'}
              className="flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1 rounded-full border border-gray-200 shadow-sm transition-colors"
            >
              {isBalanceVisible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full border border-gray-200 text-xs font-bold text-gray-700 shadow-sm">
              <CalendarIcon size={14} className="text-gray-400"/> 
              {format(time, 'dd/MM/yy')}
            </div>
            <div 
              className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full border border-gray-200 text-xs font-bold text-gray-700 shadow-sm"
              title={format(time, 'hh:mm:ss a')}
            >
              <Clock size={14} className="text-gray-400"/> 
              {format(time, 'hh:mm a')}
            </div>
          </div>

          {/* User profile button */}
          <button
            type="button"
            onClick={() => navigate('/profile')}
            title="Store Profile"
            className="flex items-center gap-2 bg-[#084b3e] text-white pl-2 pr-3 py-1 rounded-full shadow-sm hover:bg-[#0c5e4e] transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white">
              <Store size={14} />
            </div>
            <span className="text-xs font-bold max-w-[100px] truncate hidden sm:inline">
              {profile?.storeName || 'Profile'}
            </span>
          </button>

          {/* Quick Lock / Logout Button */}
          <button
            type="button"
            onClick={async () => {
              await logout();
            }}
            title="লগআউট ও দোকান লক করুন (Logout & Lock Shop)"
            className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-200 shadow-xs transition-all cursor-pointer"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">লক / লগআউট</span>
          </button>

        </div>
      </header>

      {/* Auth & Sync Modal */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
}

function AuthenticatedApp() {
  const { user, loading } = useAuth();

  // Loading security check
  if (loading) {
    return (
      <div className="min-h-screen bg-[#084b3e] flex flex-col items-center justify-center p-4 select-none">
        <div className="w-16 h-16 rounded-2xl bg-white p-2 shadow-2xl border-2 border-emerald-300/40 flex items-center justify-center mb-4 animate-bounce">
          <img src="/logo.png?v=2" alt="Logo" className="w-full h-full object-contain rounded-xl" />
        </div>
        <p className="text-base font-black text-white tracking-wide animate-pulse">
          Al-Barakah Digital Studio
        </p>
        <span className="text-xs text-emerald-200 mt-1 font-medium">
          যাচাই করা হচ্ছে ও নিরাপত্তা নিশ্চিত করা হচ্ছে...
        </span>
      </div>
    );
  }

  // When logged out, strictly lock the application and do NOT render any shop data
  if (!user) {
    return <LoginScreen />;
  }

  return (
    <Router>
      <div className="flex min-h-screen bg-[#f4f8f7] font-sans print:block print:min-h-0 print:bg-white">
        {/* Desktop Sidebar */}
        <Sidebar />
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col w-full min-w-0 h-screen overflow-hidden print:h-auto print:overflow-visible print:w-full print:p-0 print:m-0">
          <TopHeader />
          <main className="flex-1 overflow-y-auto w-full p-0 sm:p-4 md:p-6 print:p-0">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/sales" element={<SalesEntry />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/:id" element={<CustomerProfile />} />
              <Route path="/mfs" element={<MfsLedger />} />
              <Route path="/borrowings" element={<Borrowings />} />
              <Route path="/dues" element={<Navigate to="/customers" replace />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/history" element={<HistoryView />} />
              <Route path="/profile" element={<StoreProfile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>

        {/* Mobile Bottom Navigation */}
        <BottomNav />
      </div>
    </Router>
  );
}

export default function App() {
  useAppNotifications();

  useEffect(() => {
    initDefaultAccounts();
  }, []);
  
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
