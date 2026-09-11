import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar, BottomNav } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { SalesEntry } from './components/SalesEntry';
import { MfsLedger } from './components/MfsLedger';
import { Expenses } from './components/Expenses';
import { Reports } from './components/Reports';
import { Settings } from './components/Settings';
import { Customers } from './components/Customers';
import { CustomerProfile } from './components/CustomerProfile';
import { Menu, User, Calendar as CalendarIcon, Clock, WifiOff, Cloud, RefreshCw, Store, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';

function TopHeader() {
  const [time, setTime] = useState(new Date());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const { user, profile, isOnline, syncStatus, triggerSync, isBalanceVisible, toggleBalanceVisibility } = useAuth();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 sm:px-6 py-3.5 flex justify-between items-center z-10 shrink-0 sticky top-0 print:hidden">
        <div className="flex items-center gap-3 sm:gap-4">
          <button className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="text-2xl sm:text-3xl hidden sm:block">👋</div>
            <div className="flex flex-col">
              <h2 className="text-base sm:text-lg font-extrabold text-gray-900 leading-tight">
                {profile?.storeName ? profile.storeName : 'Welcome Back!'}
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
              {format(time, 'dd/MM/yyyy')}
            </div>
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full border border-gray-200 text-xs font-bold text-gray-700 shadow-sm">
              <Clock size={14} className="text-gray-400"/> 
              {format(time, 'hh:mm a')}
            </div>
          </div>

          {/* User profile button / Login Trigger */}
          {user ? (
            <button
              type="button"
              onClick={() => setIsAuthOpen(true)}
              title="View Store Profile & Sync"
              className="flex items-center gap-2 bg-[#084b3e] text-white pl-2 pr-3 py-1 rounded-full shadow-sm hover:bg-[#0c5e4e] transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white">
                <Store size={14} />
              </div>
              <span className="text-xs font-bold max-w-[100px] truncate hidden sm:inline">
                {profile?.storeName || 'Profile'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsAuthOpen(true)}
              className="flex items-center gap-1.5 bg-[#084b3e] text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-sm hover:bg-[#0c5e4e] transition-all"
            >
              <User size={14} />
              <span>Login / Cloud Backup</span>
            </button>
          )}

        </div>
      </header>

      {/* Auth & Sync Modal */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
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
                <Route path="/dues" element={<Navigate to="/customers" replace />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </main>
          </div>

          {/* Mobile Bottom Navigation */}
          <BottomNav />
        </div>
      </Router>
    </AuthProvider>
  );
}
