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
import { ShortcutsModal } from './components/ShortcutsModal';
import { Inventory } from './components/Inventory';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { WifiOff, Cloud, RefreshCw, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import { NotificationCenter } from './components/NotificationCenter';
import { ErrorBoundary } from './components/ErrorBoundary';

import { useAppNotifications } from './hooks/useAppNotifications';
import { initDefaultAccounts } from './services/accountService';
import { initDefaultInventory } from './services/inventoryService';
import { isQuotaExceededBlocked } from './services/syncService';

interface TopHeaderProps {
  onOpenShortcuts?: () => void;
}

function TopHeader({ onOpenShortcuts }: TopHeaderProps) {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const { user, profile, isOnline, syncStatus, triggerSync, isBalanceVisible, toggleBalanceVisibility } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 sm:px-6 py-3.5 flex justify-between items-center z-10 shrink-0 sticky top-0 print:hidden">
        <div className="flex items-center gap-3">
          <div className="md:hidden flex items-center shrink-0">
            <img 
              src={profile?.photoURL || '/logo.png?v=2'} 
              alt="Logo" 
              className="w-9 h-9 rounded-full border border-emerald-100 object-cover shadow-xs bg-white p-0.5"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/logo.png?v=2';
              }}
            />
          </div>
          <div className="flex flex-col">
            <h1 className="text-base sm:text-xl font-black text-gray-900 tracking-tight leading-tight">
              {profile?.storeName || 'Al-Barakah Digital Studio'}
            </h1>
            <span className="text-[11px] font-semibold text-emerald-800 tracking-wide">
              Digital Studio & Online Service
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          
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
              title={isQuotaExceededBlocked() ? "Local storage is 100% active and safe" : "Click to sync cloud backup"}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 cursor-pointer"
            >
              {syncStatus === 'syncing' ? (
                <>
                  <RefreshCw size={13} className="animate-spin text-emerald-700" />
                  <span className="hidden sm:inline">Syncing...</span>
                </>
              ) : isQuotaExceededBlocked() ? (
                <>
                  <ShieldCheck size={14} className="text-emerald-700" />
                  <span className="hidden sm:inline">Local Safe</span>
                </>
              ) : (
                <>
                  <Cloud size={14} className="text-emerald-700" />
                  <span className="hidden sm:inline">Cloud Synced</span>
                </>
              )}
            </button>
          )}

          {/* Balance Visibility Toggle */}
          <button 
            type="button"
            onClick={toggleBalanceVisibility}
            title={isBalanceVisible ? 'Hide sensitive data' : 'Show sensitive data'}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 shadow-xs transition-colors cursor-pointer"
          >
            {isBalanceVisible ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>

          {/* Notifications */}
          <NotificationCenter />

          {/* Shop Circular Profile Icon */}
          <button
            type="button"
            onClick={() => navigate('/profile')}
            title={`Store Profile: ${profile?.storeName || 'Al-Barakah Digital Studio'}`}
            className="w-9 h-9 rounded-full overflow-hidden bg-white border-2 border-emerald-400/80 shadow-xs hover:border-[#084b3e] hover:shadow-md hover:scale-105 transition-all cursor-pointer flex items-center justify-center p-0.5 shrink-0"
          >
            <img 
              src={profile?.photoURL || '/logo.png?v=2'} 
              alt="Shop Profile" 
              className="w-full h-full object-cover rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/logo.png?v=2';
              }}
            />
          </button>

        </div>
      </header>

      {/* Auth & Sync Modal */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
}

function ShopContent() {
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  useKeyboardShortcuts({
    onOpenShortcuts: () => setIsShortcutsOpen(true),
    onCloseModals: () => setIsShortcutsOpen(false),
  });

  return (
    <div className="flex min-h-screen bg-[#f4f8f7] font-sans print:block print:min-h-0 print:bg-white">
      {/* Desktop Sidebar */}
      <Sidebar onOpenShortcuts={() => setIsShortcutsOpen(true)} />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col w-full min-w-0 h-screen overflow-hidden print:h-auto print:overflow-visible print:w-full print:p-0 print:m-0">
        <TopHeader onOpenShortcuts={() => setIsShortcutsOpen(true)} />
        <main className="flex-1 overflow-y-auto w-full p-0 sm:p-4 md:p-6 pb-24 sm:pb-4 md:pb-6 print:p-0">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/sales" element={<SalesEntry />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/:id" element={<CustomerProfile />} />
              <Route path="/mfs" element={<MfsLedger />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/borrowings" element={<Borrowings />} />
              <Route path="/dues" element={<Navigate to="/customers" replace />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/history" element={<HistoryView />} />
              <Route path="/profile" element={<StoreProfile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />

      {/* Keyboard Shortcuts Cheatsheet Modal */}
      <ShortcutsModal 
        isOpen={isShortcutsOpen} 
        onClose={() => setIsShortcutsOpen(false)} 
      />
    </div>
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
          Verifying security and session...
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
      <ShopContent />
    </Router>
  );
}

export default function App() {
  useAppNotifications();

  useEffect(() => {
    initDefaultAccounts();
    initDefaultInventory();
  }, []);
  
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
