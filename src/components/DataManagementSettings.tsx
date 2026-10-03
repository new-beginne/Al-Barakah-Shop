import React, { useState, useEffect } from 'react';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Trash2, 
  AlertTriangle, 
  Calendar, 
  CheckSquare, 
  Square, 
  History, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowRight, 
  Database,
  ShoppingCart,
  Wallet,
  Smartphone,
  HandCoins,
  Users,
  Check,
  AlertCircle,
  Cloud,
  CloudOff,
  RefreshCw,
  Package,
  Layers
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  getCustomRangePreview, 
  executeCustomRangeDelete, 
  executeClearCloudOnly,
  executeClearLocalOnly,
  executeCompleteMasterWipe,
  RangePreviewResult,
  MasterWipeResult,
  CloudWipeResult
} from '../services/dataManagementService';

export function DataManagementSettings() {
  const navigate = useNavigate();
  const { user, isOnline } = useAuth();

  // Current record counts from IndexedDB
  const salesCount = useLiveQuery(() => db.sales.count()) ?? 0;
  const expensesCount = useLiveQuery(() => db.expenses.count()) ?? 0;
  const mfsCount = useLiveQuery(() => db.mfs.count()) ?? 0;
  const duesCount = useLiveQuery(() => db.dues.count()) ?? 0;
  const customersCount = useLiveQuery(() => db.customers.count()) ?? 0;
  const borrowingsCount = useLiveQuery(() => db.borrowings.count()) ?? 0;
  const inventoryCount = useLiveQuery(() => db.inventory.count()) ?? 0;
  const mfsClosingsCount = useLiveQuery(() => db.mfsClosings.count()) ?? 0;
  const historyLogsCount = useLiveQuery(() => db.activityLogs.count()) ?? 0;
  const paidDuesCount = useLiveQuery(() => db.dues.where('status').equals('paid').count()) ?? 0;

  const totalCoreTransactions = salesCount + expensesCount + mfsCount + duesCount + borrowingsCount;
  const totalAllLocalRecords = totalCoreTransactions + customersCount + inventoryCount + mfsClosingsCount;

  // Custom Range State
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [rangeStartDate, setRangeStartDate] = useState(todayStr);
  const [rangeEndDate, setRangeEndDate] = useState(todayStr);
  const [activeDatePreset, setActiveDatePreset] = useState<'today' | '7days' | 'this_month' | 'last_month' | 'custom'>('today');

  const [rangeModules, setRangeModules] = useState({
    sales: true,
    expenses: true,
    mfs: true,
    borrowings: true,
  });

  const [adjustBalancesOnRangeDelete, setAdjustBalancesOnRangeDelete] = useState(true);
  const [rangePreview, setRangePreview] = useState<RangePreviewResult | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Range Delete Modal
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);
  const [isDeletingRange, setIsDeletingRange] = useState(false);

  // Master Wipe (All Delete: Local + Cloud) Modal
  const [isMasterWipeModalOpen, setIsMasterWipeModalOpen] = useState(false);
  const [wipeMode, setWipeMode] = useState<'all' | 'cloud' | 'local'>('all');
  const [wipeCustomers, setWipeCustomers] = useState(true);
  const [wipePresets, setWipePresets] = useState(false);
  const [confirmInputText, setConfirmInputText] = useState('');
  const [isWipingMaster, setIsWipingMaster] = useState(false);
  const [wipeStepText, setWipeStepText] = useState('');

  // Quick action confirmation states
  const [isClearHistoryConfirmOpen, setIsClearHistoryConfirmOpen] = useState(false);
  const [isClearPaidDuesConfirmOpen, setIsClearPaidDuesConfirmOpen] = useState(false);

  // Notification Banner
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string; details?: string } | null>(null);

  // Expected confirmation phrase based on active wipeMode
  const getExpectedConfirmText = () => {
    if (wipeMode === 'cloud') return 'CLEAR CLOUD';
    if (wipeMode === 'local') return 'CLEAR LOCAL';
    return 'CLEAR ALL';
  };

  const isConfirmInputValid = 
    confirmInputText.trim().toUpperCase() === getExpectedConfirmText() ||
    (wipeMode === 'all' && confirmInputText.trim().toUpperCase() === 'DELETE ALL');

  const openWipeModalWithMode = (mode: 'all' | 'cloud' | 'local') => {
    setWipeMode(mode);
    setConfirmInputText('');
    setIsMasterWipeModalOpen(true);
  };

  const handleConfirmMasterWipe = async () => {
    if (!isConfirmInputValid) return;
    setIsWipingMaster(true);

    try {
      if (wipeMode === 'cloud') {
        setWipeStepText('Deleting cloud records from Google Firebase Firestore...');
        const res = await executeClearCloudOnly();
        setIsMasterWipeModalOpen(false);
        setConfirmInputText('');
        setNotification({
          type: 'success',
          message: `All Cloud Data Successfully Cleared! Removed ${res.deletedDocs} documents.`,
          details: `Firebase Firestore cleaned for ${res.userEmail || 'Store'}. Local IndexedDB records were preserved safely.`
        });
      } else if (wipeMode === 'local') {
        setWipeStepText('Clearing local IndexedDB storage...');
        const res = await executeClearLocalOnly({ wipeCustomers, wipePresets });
        setIsMasterWipeModalOpen(false);
        setConfirmInputText('');
        setNotification({
          type: 'success',
          message: `All Local Data Cleared! Wiped ${res.localCounts.total} local items.`,
          details: 'Local database is 100% clean with Tk 0.00 balance. Firebase Cloud backups were preserved.'
        });
      } else {
        setWipeStepText('Clearing local storage and cloud database...');
        const res: MasterWipeResult = await executeCompleteMasterWipe({
          wipeCustomers,
          wipePresets,
        });

        setIsMasterWipeModalOpen(false);
        setConfirmInputText('');
        setNotification({
          type: 'success',
          message: `All Data Completely Cleared! Wiped ${res.localCounts.total} local items & ${res.cloudResult.deletedDocs} cloud documents.`,
          details: res.cloudResult.userEmail 
            ? `Cleared Firebase Firestore for ${res.cloudResult.userEmail}. Local & Cloud are 100% clean.` 
            : 'Local database is 100% clean. Started fresh with Tk 0.00 balance.'
        });
      }
      setTimeout(() => setNotification(null), 9000);
    } catch (err: any) {
      console.error('Wipe error:', err);
      setNotification({
        type: 'error',
        message: err?.message || 'Failed to complete requested wipe. Please try again.',
      });
    } finally {
      setIsWipingMaster(false);
      setWipeStepText('');
    }
  };

  // Fetch range preview whenever dates or module choices change
  useEffect(() => {
    let isCancelled = false;

    async function fetchPreview() {
      if (!rangeStartDate || !rangeEndDate) return;
      setIsLoadingPreview(true);
      try {
        const preview = await getCustomRangePreview(rangeStartDate, rangeEndDate, rangeModules);
        if (!isCancelled) {
          setRangePreview(preview);
        }
      } catch (err) {
        console.error('Failed to get range preview:', err);
      } finally {
        if (!isCancelled) setIsLoadingPreview(false);
      }
    }

    fetchPreview();
    return () => { isCancelled = true; };
  }, [rangeStartDate, rangeEndDate, rangeModules, salesCount, expensesCount, mfsCount, borrowingsCount]);

  // Date Presets Handler
  const handleSetPreset = (type: 'today' | '7days' | 'this_month' | 'last_month') => {
    const today = new Date();
    setActiveDatePreset(type);
    if (type === 'today') {
      const d = format(today, 'yyyy-MM-dd');
      setRangeStartDate(d);
      setRangeEndDate(d);
    } else if (type === '7days') {
      setRangeStartDate(format(subDays(today, 7), 'yyyy-MM-dd'));
      setRangeEndDate(format(today, 'yyyy-MM-dd'));
    } else if (type === 'this_month') {
      setRangeStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
      setRangeEndDate(format(endOfMonth(today), 'yyyy-MM-dd'));
    } else if (type === 'last_month') {
      const prev = subMonths(today, 1);
      setRangeStartDate(format(startOfMonth(prev), 'yyyy-MM-dd'));
      setRangeEndDate(format(endOfMonth(prev), 'yyyy-MM-dd'));
    }
  };

  const toggleModule = (key: keyof typeof rangeModules) => {
    setRangeModules(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Execute Range Delete
  const handleConfirmRangeDelete = async () => {
    if (!rangePreview || rangePreview.totalRecords === 0) return;
    setIsDeletingRange(true);
    try {
      const res = await executeCustomRangeDelete({
        startDate: rangeStartDate,
        endDate: rangeEndDate,
        modules: rangeModules,
        adjustBalances: adjustBalancesOnRangeDelete,
      });

      setIsRangeModalOpen(false);
      setNotification({
        type: 'success',
        message: `Successfully deleted ${res.deletedCounts.total} records between ${rangeStartDate} and ${rangeEndDate}.`,
        details: 'Changes updated in local storage and synced to cloud.'
      });
      setTimeout(() => setNotification(null), 7000);
    } catch (err) {
      console.error(err);
      setNotification({
        type: 'error',
        message: 'Failed to delete records. Please try again.',
      });
    } finally {
      setIsDeletingRange(false);
    }
  };

  // Quick action: Clear History Logs
  const handleClearHistory = async () => {
    try {
      await db.activityLogs.clear();
      setIsClearHistoryConfirmOpen(false);
      setNotification({
        type: 'success',
        message: 'Audit history logs successfully cleared.',
      });
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      console.error(err);
      setNotification({
        type: 'error',
        message: 'Failed to clear history logs.',
      });
    }
  };

  // Quick action: Clear Paid Dues
  const handleClearPaidDues = async () => {
    try {
      const paid = await db.dues.where('status').equals('paid').toArray();
      const ids = paid.map(d => d.id!).filter(Boolean);
      if (ids.length > 0) {
        await db.dues.bulkDelete(ids);
      }
      setIsClearPaidDuesConfirmOpen(false);
      setNotification({
        type: 'success',
        message: `Removed ${ids.length} settled dues records. Active dues remain safe.`,
      });
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      console.error(err);
      setNotification({
        type: 'error',
        message: 'Failed to clear paid dues.',
      });
    }
  };

  return (
    <div className="space-y-6">

      {/* Notification Toast */}
      {notification && (
        <div 
          className={`p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border shadow-sm animate-in fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}
        >
          <div className="flex items-start gap-3">
            {notification.type === 'success' ? (
              <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={20} />
            ) : (
              <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={20} />
            )}
            <div>
              <span className="text-xs sm:text-sm font-bold block">{notification.message}</span>
              {notification.details && (
                <span className="text-[11px] text-gray-600 font-medium block mt-0.5">
                  {notification.details}
                </span>
              )}
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => navigate('/history')}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 hover:bg-gray-50 shrink-0 transition-colors shadow-xs self-end sm:self-center cursor-pointer"
          >
            View History
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 0: DATABASE & CLOUD STORAGE OVERVIEW */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#084b3e] flex items-center justify-center shrink-0">
              <Database size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-gray-900">Database & Storage Status</h2>
                {user ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/70 border border-emerald-300 px-2 py-0.5 rounded-full">
                    <Cloud size={12} className="text-emerald-700" />
                    <span>Cloud Connected</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                    <CloudOff size={12} className="text-gray-500" />
                    <span>Offline / Local Only</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 font-medium">
                {user ? `Linked with Google account: ${user.email}` : 'All records are saved safely in your device’s local IndexedDB'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/history')}
            className="flex items-center gap-1.5 text-xs font-bold text-[#084b3e] hover:text-[#0c5e4e] bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            <History size={14} />
            <span>Audit History ({historyLogsCount})</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {/* Record count pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Sales</span>
            <span className="text-lg font-black text-gray-900">{salesCount}</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Expenses</span>
            <span className="text-lg font-black text-gray-900">{expensesCount}</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">MFS Transactions</span>
            <span className="text-lg font-black text-gray-900">{mfsCount}</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Dues</span>
            <span className="text-lg font-black text-gray-900">{duesCount}</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Borrowings</span>
            <span className="text-lg font-black text-gray-900">{borrowingsCount}</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Customers</span>
            <span className="text-lg font-black text-gray-900">{customersCount}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: MASTER RESET (ALL DELETE: LOCAL + CLOUD) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl shadow-sm border-2 border-rose-300 p-5 sm:p-6 space-y-5 relative overflow-hidden">
        
        {/* Top Header Badge */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-rose-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <ShieldAlert size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-rose-950">
                  All Delete: Local & Cloud Master Wipe
                </h3>
                <span className="text-[10px] font-black text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-200 uppercase tracking-wider">
                  Complete Reset
                </span>
              </div>
              <p className="text-xs text-rose-700 font-medium mt-0.5">
                Permanently wipes all records from your device (IndexedDB) AND deletes all cloud backups from Google Firebase Firestore.
              </p>
            </div>
          </div>
        </div>

        {/* Cloud & Local Target Card */}
        <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20} />
            <div className="text-xs text-rose-950 leading-relaxed">
              <strong className="font-black text-rose-900 block text-sm mb-0.5">
                This will reset your entire system to a 100% clean state:
              </strong>
              <span>
                All <strong>{totalAllLocalRecords} local items</strong> will be wiped from IndexedDB, all wallet balances (Cash, bKash, Nagad, Rocket) will be reset to <strong>Tk 0.00</strong>, and all <strong>Firestore Cloud collections</strong> will be emptied.
              </span>
            </div>
          </div>

          {/* Account status indicator */}
          <div className="p-3 bg-white rounded-xl border border-rose-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Cloud size={16} className={user ? 'text-emerald-600' : 'text-gray-400'} />
              <span className="font-bold text-gray-800">Target Cloud Account:</span>
              <span className="text-gray-600 font-medium">
                {user ? user.email : 'No Google Account logged in (Local wipe only)'}
              </span>
            </div>
            <span className="font-black text-[11px] px-2.5 py-1 rounded-lg bg-rose-100 text-rose-900 shrink-0">
              {user ? 'Cloud Wipe Active' : 'Offline Device Wipe'}
            </span>
          </div>

          {/* Breakdown Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
            <div className="bg-white/80 p-2.5 rounded-xl border border-rose-100">
              <span className="text-[10px] text-gray-500 font-bold block">Transactions</span>
              <span className="font-black text-rose-900 text-sm">{totalCoreTransactions} cleared</span>
            </div>
            <div className="bg-white/80 p-2.5 rounded-xl border border-rose-100">
              <span className="text-[10px] text-gray-500 font-bold block">Contacts & Dues</span>
              <span className="font-black text-rose-900 text-sm">{duesCount + customersCount} cleared</span>
            </div>
            <div className="bg-white/80 p-2.5 rounded-xl border border-rose-100">
              <span className="text-[10px] text-gray-500 font-bold block">All Balances</span>
              <span className="font-black text-rose-900 text-sm">Reset to Tk 0.00</span>
            </div>
            <div className="bg-white/80 p-2.5 rounded-xl border border-rose-100">
              <span className="text-[10px] text-gray-500 font-bold block">Firebase Cloud</span>
              <span className="font-black text-rose-900 text-sm">12 Collections Wiped</span>
            </div>
          </div>
        </div>

        {/* Action Trigger Options: 3 Options (Cloud Only, Local Only, Both) */}
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            
            {/* OPTION 1: CLEAR ALL CLOUD DATA */}
            <div className="bg-sky-50/70 border-2 border-sky-200 hover:border-sky-300 rounded-2xl p-4 flex flex-col justify-between transition-all">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sky-800">
                  <div className="p-2 rounded-xl bg-sky-100 text-sky-700">
                    <Cloud size={18} />
                  </div>
                  <div>
                    <h4 className="font-black text-xs sm:text-sm text-sky-950">Clear All Cloud Data</h4>
                    <span className="text-[10px] font-bold text-sky-700 block">Cloud data only</span>
                  </div>
                </div>
                <p className="text-[11px] text-sky-800/90 leading-relaxed font-medium">
                  Wipes all cloud backups in Firebase Firestore. Your local device records (IndexedDB) remain 100% intact and safe.
                </p>
              </div>

              <div className="pt-3 border-t border-sky-100 mt-3">
                <button
                  type="button"
                  onClick={() => openWipeModalWithMode('cloud')}
                  disabled={!user || !isOnline}
                  className="w-full py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 size={15} />
                  <span>{user ? 'Clear Cloud Data' : 'Login Required for Cloud'}</span>
                </button>
              </div>
            </div>

            {/* OPTION 2: CLEAR ALL LOCAL DATA */}
            <div className="bg-amber-50/70 border-2 border-amber-200 hover:border-amber-300 rounded-2xl p-4 flex flex-col justify-between transition-all">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-800">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                    <Database size={18} />
                  </div>
                  <div>
                    <h4 className="font-black text-xs sm:text-sm text-amber-950">Clear All Local Data</h4>
                    <span className="text-[10px] font-bold text-amber-700 block">Device data only</span>
                  </div>
                </div>
                <p className="text-[11px] text-amber-800/90 leading-relaxed font-medium">
                  Wipes all local records on this device and resets balances to 0.00. Your online Firebase cloud backups remain 100% safe.
                </p>
              </div>

              <div className="pt-3 border-t border-amber-100 mt-3">
                <button
                  type="button"
                  onClick={() => openWipeModalWithMode('local')}
                  className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Trash2 size={15} />
                  <span>Clear Local Data</span>
                </button>
              </div>
            </div>

            {/* OPTION 3: ALL DELETE: LOCAL + CLOUD */}
            <div className="bg-rose-50/70 border-2 border-rose-300 hover:border-rose-400 rounded-2xl p-4 flex flex-col justify-between transition-all">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-rose-800">
                  <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
                    <ShieldAlert size={18} />
                  </div>
                  <div>
                    <h4 className="font-black text-xs sm:text-sm text-rose-950">All Delete: Local & Cloud</h4>
                    <span className="text-[10px] font-bold text-rose-700 block">Complete Factory Reset</span>
                  </div>
                </div>
                <p className="text-[11px] text-rose-800/90 leading-relaxed font-medium">
                  Permanently wipes both local device and Google Firebase cloud databases (Factory Reset). Completely fresh start.
                </p>
              </div>

              <div className="pt-3 border-t border-rose-100 mt-3">
                <button
                  type="button"
                  onClick={() => openWipeModalWithMode('all')}
                  className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm hover:shadow-rose-600/30 cursor-pointer"
                >
                  <Trash2 size={15} />
                  <span>All Delete: Both (Full Reset)</span>
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: CLEAN DATA BY DATE RANGE (SELECTIVE) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6 space-y-6">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Calendar size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-gray-900">
                  Clean Data by Date Range
                </h3>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Selective
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Delete transactions between two dates (e.g. remove test entries or clean a past week)
              </p>
            </div>
          </div>
        </div>

        {/* Step 1: Select Date Range */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-800 text-[11px] font-black inline-flex items-center justify-center">1</span>
              <span>Select Date Range</span>
            </label>

            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleSetPreset('today')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeDatePreset === 'today'
                    ? 'bg-[#084b3e] text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset('7days')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeDatePreset === '7days'
                    ? 'bg-[#084b3e] text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset('this_month')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeDatePreset === 'this_month'
                    ? 'bg-[#084b3e] text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset('last_month')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeDatePreset === 'last_month'
                    ? 'bg-[#084b3e] text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Last Month
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="text-[11px] font-bold text-gray-600 block mb-1">Start Date (From)</span>
              <input
                type="date"
                value={rangeStartDate}
                onChange={e => {
                  setRangeStartDate(e.target.value);
                  setActiveDatePreset('custom');
                }}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-800 focus:bg-white focus:border-[#084b3e] outline-none transition-all"
              />
            </div>
            <div>
              <span className="text-[11px] font-bold text-gray-600 block mb-1">End Date (To)</span>
              <input
                type="date"
                value={rangeEndDate}
                onChange={e => {
                  setRangeEndDate(e.target.value);
                  setActiveDatePreset('custom');
                }}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-800 focus:bg-white focus:border-[#084b3e] outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Step 2: Choose What to Delete */}
        <div className="space-y-3 pt-4 border-t border-gray-100">
          <label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-800 text-[11px] font-black inline-flex items-center justify-center">2</span>
            <span>Choose Which Records to Include</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Sales Card */}
            <button
              type="button"
              onClick={() => toggleModule('sales')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                rangeModules.sales 
                  ? 'bg-emerald-50/70 border-emerald-400 text-emerald-950 shadow-xs' 
                  : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg ${rangeModules.sales ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  <ShoppingCart size={16} />
                </div>
                <div>
                  <span className="text-xs font-black block">Sales</span>
                  <span className="text-[10px] font-semibold text-gray-500">
                    {rangePreview?.salesCount ?? 0} found in range
                  </span>
                </div>
              </div>
              {rangeModules.sales ? <CheckSquare size={18} className="text-emerald-700" /> : <Square size={18} className="text-gray-400" />}
            </button>

            {/* Expenses Card */}
            <button
              type="button"
              onClick={() => toggleModule('expenses')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                rangeModules.expenses 
                  ? 'bg-emerald-50/70 border-emerald-400 text-emerald-950 shadow-xs' 
                  : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg ${rangeModules.expenses ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  <Wallet size={16} />
                </div>
                <div>
                  <span className="text-xs font-black block">Expenses</span>
                  <span className="text-[10px] font-semibold text-gray-500">
                    {rangePreview?.expensesCount ?? 0} found in range
                  </span>
                </div>
              </div>
              {rangeModules.expenses ? <CheckSquare size={18} className="text-emerald-700" /> : <Square size={18} className="text-gray-400" />}
            </button>

            {/* MFS Card */}
            <button
              type="button"
              onClick={() => toggleModule('mfs')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                rangeModules.mfs 
                  ? 'bg-emerald-50/70 border-emerald-400 text-emerald-950 shadow-xs' 
                  : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg ${rangeModules.mfs ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  <Smartphone size={16} />
                </div>
                <div>
                  <span className="text-xs font-black block">MFS Ledger</span>
                  <span className="text-[10px] font-semibold text-gray-500">
                    {rangePreview?.mfsCount ?? 0} found in range
                  </span>
                </div>
              </div>
              {rangeModules.mfs ? <CheckSquare size={18} className="text-emerald-700" /> : <Square size={18} className="text-gray-400" />}
            </button>

            {/* Borrowings Card */}
            <button
              type="button"
              onClick={() => toggleModule('borrowings')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                rangeModules.borrowings 
                  ? 'bg-emerald-50/70 border-emerald-400 text-emerald-950 shadow-xs' 
                  : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg ${rangeModules.borrowings ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  <HandCoins size={16} />
                </div>
                <div>
                  <span className="text-xs font-black block">Borrowings</span>
                  <span className="text-[10px] font-semibold text-gray-500">
                    {rangePreview?.borrowingsCount ?? 0} found in range
                  </span>
                </div>
              </div>
              {rangeModules.borrowings ? <CheckSquare size={18} className="text-emerald-700" /> : <Square size={18} className="text-gray-400" />}
            </button>
          </div>
        </div>

        {/* Step 3: Balance Adjustment Option */}
        <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3.5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={adjustBalancesOnRangeDelete}
              onChange={e => setAdjustBalancesOnRangeDelete(e.target.checked)}
              className="mt-0.5 rounded text-[#084b3e] focus:ring-[#084b3e] cursor-pointer"
            />
            <div className="text-xs font-medium text-amber-950 leading-relaxed">
              <span className="font-bold">Auto-Reconcile Cash & Account Balances (Recommended)</span>
              <p className="text-[11px] text-amber-800 mt-0.5">
                When enabled, money spent on deleted expenses will be restored back to your cash/wallet, and money collected from deleted sales will be deducted to keep accounts accurate.
              </p>
            </div>
          </label>
        </div>

        {/* Step 4: Preview & Action Bar */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Matching Records in Selected Range:
            </span>
            <div className="text-base sm:text-lg font-black text-gray-900 mt-0.5">
              {isLoadingPreview ? (
                <span className="text-gray-400">Searching records...</span>
              ) : (
                <span>
                  {rangePreview?.totalRecords ?? 0} Total Records Found
                  {rangePreview && rangePreview.totalRecords > 0 && (
                    <span className="text-xs font-medium text-gray-500 ml-2 block sm:inline">
                      (Sales: Tk {rangePreview.salesTotal.toLocaleString()} • Expenses: Tk {rangePreview.expensesTotal.toLocaleString()})
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={!rangePreview || rangePreview.totalRecords === 0 || isLoadingPreview}
            onClick={() => setIsRangeModalOpen(true)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Trash2 size={16} />
            <span>Delete Selected Range ({rangePreview?.totalRecords ?? 0})</span>
          </button>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: QUICK MAINTENANCE TOOLS (ONE-CLICK CLEANERS) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6 space-y-4">
        <div>
          <h3 className="text-base font-black text-gray-900">Quick Maintenance Tools</h3>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Clean up non-essential historical logs or completed records with one click
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Tool 1: Clear History Logs */}
          <div className="border border-gray-200 rounded-xl p-4 flex flex-col justify-between gap-3 bg-gray-50/50">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs sm:text-sm text-gray-900">Activity History Logs</span>
                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                  {historyLogsCount} logs
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Clears past audit trail logs to free up storage space. Your actual sales, expenses, and balances remain completely untouched.
              </p>
            </div>

            <button
              type="button"
              disabled={historyLogsCount === 0}
              onClick={() => setIsClearHistoryConfirmOpen(true)}
              className="w-full py-2 px-3 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-lg font-bold text-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <Trash2 size={13} />
              <span>Clear History Logs</span>
            </button>
          </div>

          {/* Tool 2: Clear Settled Paid Dues */}
          <div className="border border-gray-200 rounded-xl p-4 flex flex-col justify-between gap-3 bg-gray-50/50">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs sm:text-sm text-gray-900">Settled (Paid) Dues</span>
                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                  {paidDuesCount} settled
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Removes customers' past due records that have already been 100% paid off. Active unpaid dues remain completely safe.
              </p>
            </div>

            <button
              type="button"
              disabled={paidDuesCount === 0}
              onClick={() => setIsClearPaidDuesConfirmOpen(true)}
              className="w-full py-2 px-3 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-lg font-bold text-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <Trash2 size={13} />
              <span>Clear Settled Dues</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: MASTER WIPE / DELETE OPTIONS (ALL, CLOUD ONLY, LOCAL ONLY) */}
      {/* ========================================================================= */}
      {isMasterWipeModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => !isWipingMaster && setIsMasterWipeModalOpen(false)}
        >
          <div 
            className={`bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border-2 animate-in fade-in zoom-in-95 space-y-5 my-8 ${
              wipeMode === 'cloud' ? 'border-sky-300' :
              wipeMode === 'local' ? 'border-amber-300' :
              'border-rose-300'
            }`}
            onClick={e => e.stopPropagation()}
          >
            {/* Mode Switcher Tabs */}
            <div className="flex rounded-xl bg-gray-100 p-1 gap-1 text-xs font-bold">
              <button
                type="button"
                disabled={isWipingMaster}
                onClick={() => {
                  setWipeMode('all');
                  setConfirmInputText('');
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  wipeMode === 'all' 
                    ? 'bg-rose-600 text-white shadow-xs' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <ShieldAlert size={14} />
                <span>Both (Local & Cloud)</span>
              </button>
              <button
                type="button"
                disabled={isWipingMaster || !user || !isOnline}
                onClick={() => {
                  setWipeMode('cloud');
                  setConfirmInputText('');
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  wipeMode === 'cloud' 
                    ? 'bg-sky-600 text-white shadow-xs' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Cloud size={14} />
                <span>Cloud Only</span>
              </button>
              <button
                type="button"
                disabled={isWipingMaster}
                onClick={() => {
                  setWipeMode('local');
                  setConfirmInputText('');
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  wipeMode === 'local' 
                    ? 'bg-amber-600 text-white shadow-xs' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Database size={14} />
                <span>Local Only</span>
              </button>
            </div>

            {/* Header */}
            <div className="flex items-start gap-3.5">
              <div className={`p-3 rounded-2xl shrink-0 ${
                wipeMode === 'cloud' ? 'bg-sky-100 text-sky-700' :
                wipeMode === 'local' ? 'bg-amber-100 text-amber-700' :
                'bg-rose-100 text-rose-700'
              }`}>
                {wipeMode === 'cloud' ? <Cloud size={28} /> :
                 wipeMode === 'local' ? <Database size={28} /> :
                 <ShieldAlert size={28} />}
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 leading-tight">
                  {wipeMode === 'cloud' ? 'Clear All Cloud Data' :
                   wipeMode === 'local' ? 'Clear All Local Data' :
                   'All Delete: Local & Cloud Wipe'}
                </h3>
                <p className={`text-xs font-bold mt-0.5 ${
                  wipeMode === 'cloud' ? 'text-sky-700' :
                  wipeMode === 'local' ? 'text-amber-700' :
                  'text-rose-600'
                }`}>
                  {wipeMode === 'cloud' ? 'Delete all cloud backups from Google Firebase Cloud Firestore' :
                   wipeMode === 'local' ? 'Delete local device data completely (Cloud backup remains safe)' :
                   'Permanently delete both local and cloud databases (Full Factory Reset)'}
                </p>
              </div>
            </div>

            {/* Mode-specific Warning Message */}
            {wipeMode === 'cloud' ? (
              <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 text-xs space-y-2 text-sky-950 font-medium">
                <p className="font-bold text-sky-900">
                  You are about to delete all data stored in Google Firebase Cloud Firestore:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-gray-700">
                  <li><strong>Target Account:</strong> {user?.email || 'Logged in account'}</li>
                  <li><strong>Cloud Collections:</strong> Sales, expenses, mfs, dues, customers, inventory and logs in Firestore will be emptied.</li>
                  <li><strong>Local Database:</strong> <span className="font-bold text-emerald-700">100% Safe.</span> All {totalAllLocalRecords} records on this device will NOT be touched.</li>
                </ul>
              </div>
            ) : wipeMode === 'local' ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs space-y-2 text-amber-950 font-medium">
                <p className="font-bold text-amber-900">
                  You are about to wipe all data from this device's local IndexedDB:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-gray-700">
                  <li><strong>Local Records:</strong> All {totalAllLocalRecords} records on this phone/computer will be wiped.</li>
                  <li><strong>Cash & Wallets:</strong> All balances (Cash, bKash, Nagad, Rocket) will be reset to <strong>Tk 0.00</strong>.</li>
                  <li><strong>Google Firebase Cloud:</strong> <span className="font-bold text-emerald-700">100% Preserved.</span> Your cloud backups will NOT be deleted.</li>
                </ul>
              </div>
            ) : (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs space-y-2 text-rose-950 font-medium">
                <p className="font-bold text-rose-900">
                  You are about to completely wipe both your offline device data AND your Google Cloud backups:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-gray-700">
                  <li><strong>Local Database:</strong> {totalAllLocalRecords} records across all IndexedDB tables will be wiped.</li>
                  <li><strong>Cash & Wallets:</strong> Balances for Cash, bKash, Nagad, Rocket reset to <strong>Tk 0.00</strong>.</li>
                  <li>
                    <strong>Google Firebase Firestore:</strong> {user ? `All cloud subcollections for ${user.email} will be permanently erased.` : 'Local storage will be wiped.'}
                  </li>
                </ul>
              </div>
            )}

            {/* Optional Wipe Checkboxes (only for local and all modes) */}
            {wipeMode !== 'cloud' && (
              <div className="space-y-2.5 bg-gray-50 border border-gray-200 rounded-2xl p-4 text-xs font-bold text-gray-800">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wipeCustomers}
                    onChange={e => setWipeCustomers(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-600 cursor-pointer"
                  />
                  <span>Also wipe Customer Directory ({customersCount} Customers)</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wipePresets}
                    onChange={e => setWipePresets(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-600 cursor-pointer"
                  />
                  <span>Also wipe custom Preset Services & Expense Categories</span>
                </label>
              </div>
            )}

            {/* Typing Confirmation Requirement */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-700">
                  Type <strong className={`font-black ${
                    wipeMode === 'cloud' ? 'text-sky-700' :
                    wipeMode === 'local' ? 'text-amber-700' :
                    'text-rose-700'
                  }`}>{getExpectedConfirmText()}</strong> to confirm:
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmInputText(getExpectedConfirmText())}
                  className={`text-[11px] font-bold underline cursor-pointer ${
                    wipeMode === 'cloud' ? 'text-sky-600 hover:text-sky-800' :
                    wipeMode === 'local' ? 'text-amber-600 hover:text-amber-800' :
                    'text-rose-600 hover:text-rose-800'
                  }`}
                >
                  Auto-fill "{getExpectedConfirmText()}"
                </button>
              </div>

              <input
                type="text"
                disabled={isWipingMaster}
                placeholder={getExpectedConfirmText()}
                value={confirmInputText}
                onChange={e => setConfirmInputText(e.target.value)}
                className={`w-full p-3 border-2 rounded-xl text-sm font-black outline-none uppercase text-center tracking-widest ${
                  wipeMode === 'cloud' 
                    ? 'border-sky-300 focus:border-sky-600 text-sky-900 bg-sky-50/30' :
                  wipeMode === 'local' 
                    ? 'border-amber-300 focus:border-amber-600 text-amber-900 bg-amber-50/30' :
                    'border-rose-300 focus:border-rose-600 text-rose-900 bg-rose-50/30'
                }`}
              />
            </div>

            {/* Progress indicator */}
            {isWipingMaster && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs font-bold text-amber-900 animate-pulse">
                <RefreshCw size={16} className="animate-spin text-amber-700" />
                <span>{wipeStepText || 'Processing requested wipe...'}</span>
              </div>
            )}

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                disabled={isWipingMaster}
                onClick={() => setIsMasterWipeModalOpen(false)}
                className="px-4 py-2.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!isConfirmInputValid || isWipingMaster}
                onClick={handleConfirmMasterWipe}
                className={`px-6 py-2.5 text-xs font-black text-white rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md uppercase transition-all ${
                  wipeMode === 'cloud' ? 'bg-sky-600 hover:bg-sky-700' :
                  wipeMode === 'local' ? 'bg-amber-600 hover:bg-amber-700' :
                  'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                <Trash2 size={16} />
                <span>
                  {isWipingMaster ? 'Processing Wipe...' :
                   wipeMode === 'cloud' ? 'Confirm & Wipe Cloud' :
                   wipeMode === 'local' ? 'Confirm & Wipe Local' :
                   'Confirm & Wipe Everything'}
                </span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: RANGE DELETE CONFIRMATION */}
      {/* ========================================================================= */}
      {isRangeModalOpen && rangePreview && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsRangeModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-3 bg-amber-50 rounded-2xl">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">Confirm Date Range Deletion</h3>
                <p className="text-xs text-gray-500 font-semibold">{rangeStartDate} to {rangeEndDate}</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed font-medium">
              You are about to permanently remove <strong>{rangePreview.totalRecords}</strong> matching records from this date range:
            </p>

            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs space-y-1.5 font-medium">
              <div className="flex justify-between">
                <span className="text-gray-500">Sales to delete:</span>
                <span className="font-bold text-gray-900">{rangePreview.salesCount} (Tk {rangePreview.salesTotal.toLocaleString()})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Expenses to delete:</span>
                <span className="font-bold text-gray-900">{rangePreview.expensesCount} (Tk {rangePreview.expensesTotal.toLocaleString()})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">MFS transactions:</span>
                <span className="font-bold text-gray-900">{rangePreview.mfsCount} (Tk {rangePreview.mfsTotal.toLocaleString()})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Borrowings:</span>
                <span className="font-bold text-gray-900">{rangePreview.borrowingsCount}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-200 text-amber-900 font-bold">
                <span>Account Balance Adjustment:</span>
                <span>{adjustBalancesOnRangeDelete ? 'Enabled (Auto-Adjusted)' : 'Disabled'}</span>
              </div>
            </div>

            <p className="text-[11px] text-gray-400">
              Note: This action will be automatically recorded in your History tab.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsRangeModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingRange}
                onClick={handleConfirmRangeDelete}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 size={14} />
                <span>{isDeletingRange ? 'Deleting Records...' : 'Confirm & Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CLEAR HISTORY CONFIRMATION */}
      {/* ========================================================================= */}
      {isClearHistoryConfirmOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsClearHistoryConfirmOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-black text-gray-900">Clear Activity History Logs?</h3>
            <p className="text-xs text-gray-500 font-medium">
              This will remove all {historyLogsCount} audit logs from the History tab. Your actual shop balances and transactions will not be affected.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsClearHistoryConfirmOpen(false)}
                className="px-3.5 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearHistory}
                className="px-4 py-2 text-xs font-bold text-white bg-gray-900 hover:bg-black rounded-xl cursor-pointer"
              >
                Yes, Clear Logs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CLEAR PAID DUES CONFIRMATION */}
      {/* ========================================================================= */}
      {isClearPaidDuesConfirmOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsClearPaidDuesConfirmOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-black text-gray-900">Clear Settled Dues?</h3>
            <p className="text-xs text-gray-500 font-medium">
              This will delete {paidDuesCount} customer due entries that have already been fully paid off. Active pending dues will remain completely safe.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsClearPaidDuesConfirmOpen(false)}
                className="px-3.5 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearPaidDues}
                className="px-4 py-2 text-xs font-bold text-white bg-[#084b3e] hover:bg-[#0c5e4e] rounded-xl cursor-pointer"
              >
                Yes, Clear Settled
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
