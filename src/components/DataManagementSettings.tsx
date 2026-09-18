import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Trash2, 
  AlertTriangle, 
  Calendar, 
  CheckSquare, 
  Square, 
  History, 
  Layers, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { 
  getCustomRangePreview, 
  executeCustomRangeDelete, 
  executeAllDataReset,
  RangePreviewResult 
} from '../services/dataManagementService';

export function DataManagementSettings() {
  const navigate = useNavigate();

  // Current counts in DB
  const salesCount = useLiveQuery(() => db.sales.count()) ?? 0;
  const expensesCount = useLiveQuery(() => db.expenses.count()) ?? 0;
  const mfsCount = useLiveQuery(() => db.mfs.count()) ?? 0;
  const duesCount = useLiveQuery(() => db.dues.count()) ?? 0;
  const customersCount = useLiveQuery(() => db.customers.count()) ?? 0;
  const borrowingsCount = useLiveQuery(() => db.borrowings.count()) ?? 0;
  const historyLogsCount = useLiveQuery(() => db.activityLogs.count()) ?? 0;

  // Custom Range State
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [rangeStartDate, setRangeStartDate] = useState(todayStr);
  const [rangeEndDate, setRangeEndDate] = useState(todayStr);

  const [rangeModules, setRangeModules] = useState({
    sales: true,
    expenses: true,
    mfs: true,
    borrowings: true,
  });

  const [adjustBalancesOnRangeDelete, setAdjustBalancesOnRangeDelete] = useState(true);
  const [rangePreview, setRangePreview] = useState<RangePreviewResult | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Range Delete Confirmation Modal
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);
  const [isDeletingRange, setIsDeletingRange] = useState(false);

  // Delete All State
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [resetAccounts, setResetAccounts] = useState(true);
  const [wipeCustomers, setWipeCustomers] = useState(false);
  const [wipePresets, setWipePresets] = useState(false);
  const [confirmInputText, setConfirmInputText] = useState('');
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Feedback message
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  // Date Range Quick Preset Handlers
  const handleSetPreset = (type: 'today' | '7days' | 'this_month' | 'last_month') => {
    const today = new Date();
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
        message: `Successfully deleted ${res.deletedCounts.total} records between ${rangeStartDate} and ${rangeEndDate}. Action logged in History.`,
      });
      setTimeout(() => setNotification(null), 6000);
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

  // Execute Delete All
  const handleConfirmDeleteAll = async () => {
    if (confirmInputText.trim().toUpperCase() !== 'DELETE') return;
    setIsDeletingAll(true);
    try {
      const res = await executeAllDataReset({
        resetAccounts,
        wipeCustomers,
        wipePresets,
      });

      setIsDeleteAllModalOpen(false);
      setConfirmInputText('');
      setNotification({
        type: 'success',
        message: `Database reset complete. Cleared ${res.counts.total} records. Action logged in History.`,
      });
      setTimeout(() => setNotification(null), 6000);
    } catch (err) {
      console.error(err);
      setNotification({
        type: 'error',
        message: 'Failed to reset database. Please try again.',
      });
    } finally {
      setIsDeletingAll(false);
    }
  };

  const totalCurrentTransactions = salesCount + expensesCount + mfsCount + duesCount + borrowingsCount;

  return (
    <div className="space-y-6">
      
      {/* Notification */}
      {notification && (
        <div 
          className={`p-4 rounded-2xl flex items-center gap-3 border shadow-xs animate-in fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="text-emerald-600 shrink-0" size={20} />
          ) : (
            <AlertTriangle className="text-rose-600 shrink-0" size={20} />
          )}
          <span className="text-xs sm:text-sm font-bold flex-1">{notification.message}</span>
          <button 
            type="button" 
            onClick={() => navigate('/history')}
            className="px-3 py-1 bg-white border rounded-xl text-xs font-black uppercase tracking-wider text-gray-800 hover:bg-gray-50 shrink-0"
          >
            View History
          </button>
        </div>
      )}

      {/* History Notification Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-[#084b3e] to-[#126b55] text-white p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <History size={24} className="text-emerald-300" />
          </div>
          <div>
            <h3 className="text-base font-black uppercase tracking-wider">
              Automatic Audit & History Tracking
            </h3>
            <p className="text-xs text-emerald-100/80 font-medium mt-0.5">
              Every delete, range deletion, edit, and reset is automatically recorded with date & timestamp.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/history')}
          className="px-4 py-2.5 bg-white text-[#084b3e] hover:bg-emerald-50 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-xs cursor-pointer shrink-0"
        >
          <span>View History Logs ({historyLogsCount})</span>
          <ArrowRight size={15} />
        </button>
      </div>

      {/* SECTION 1: CUSTOM RANGE DATA DELETION */}
      <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-6 border border-gray-100 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-gray-900 uppercase tracking-wider">
                Delete Custom Range Data
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                Select a start and end date to remove matching transactions from your database.
              </p>
            </div>
          </div>

          <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 self-start sm:self-auto">
            Safe & Logged in History
          </span>
        </div>

        {/* Date Presets and Pickers */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              1. Choose Date Range:
            </label>
            <div className="flex items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => handleSetPreset('today')}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-md font-bold text-gray-700 cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset('7days')}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-md font-bold text-gray-700 cursor-pointer"
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset('this_month')}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-md font-bold text-gray-700 cursor-pointer"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset('last_month')}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-md font-bold text-gray-700 cursor-pointer"
              >
                Last Month
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Start Date</span>
              <input
                type="date"
                value={rangeStartDate}
                onChange={e => setRangeStartDate(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-800 focus:bg-white focus:border-[#084b3e] outline-none"
              />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-gray-400 block mb-1">End Date</span>
              <input
                type="date"
                value={rangeEndDate}
                onChange={e => setRangeEndDate(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-800 focus:bg-white focus:border-[#084b3e] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Modules to include */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
            2. Select Transaction Types to Delete:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() => toggleModule('sales')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                rangeModules.sales 
                  ? 'bg-emerald-50/60 border-emerald-300 text-[#084b3e]' 
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
              }`}
            >
              <div>
                <span className="text-xs font-black block">Sales</span>
                <span className="text-[10px] opacity-75">{rangePreview?.salesCount ?? 0} matching</span>
              </div>
              {rangeModules.sales ? <CheckSquare size={18} /> : <Square size={18} />}
            </button>

            <button
              type="button"
              onClick={() => toggleModule('expenses')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                rangeModules.expenses 
                  ? 'bg-emerald-50/60 border-emerald-300 text-[#084b3e]' 
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
              }`}
            >
              <div>
                <span className="text-xs font-black block">Expenses</span>
                <span className="text-[10px] opacity-75">{rangePreview?.expensesCount ?? 0} matching</span>
              </div>
              {rangeModules.expenses ? <CheckSquare size={18} /> : <Square size={18} />}
            </button>

            <button
              type="button"
              onClick={() => toggleModule('mfs')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                rangeModules.mfs 
                  ? 'bg-emerald-50/60 border-emerald-300 text-[#084b3e]' 
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
              }`}
            >
              <div>
                <span className="text-xs font-black block">MFS Transactions</span>
                <span className="text-[10px] opacity-75">{rangePreview?.mfsCount ?? 0} matching</span>
              </div>
              {rangeModules.mfs ? <CheckSquare size={18} /> : <Square size={18} />}
            </button>

            <button
              type="button"
              onClick={() => toggleModule('borrowings')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                rangeModules.borrowings 
                  ? 'bg-emerald-50/60 border-emerald-300 text-[#084b3e]' 
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
              }`}
            >
              <div>
                <span className="text-xs font-black block">Borrowings</span>
                <span className="text-[10px] opacity-75">{rangePreview?.borrowingsCount ?? 0} matching</span>
              </div>
              {rangeModules.borrowings ? <CheckSquare size={18} /> : <Square size={18} />}
            </button>
          </div>
        </div>

        {/* Balance adjustment option */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={adjustBalancesOnRangeDelete}
              onChange={e => setAdjustBalancesOnRangeDelete(e.target.checked)}
              className="mt-0.5 rounded text-[#084b3e] focus:ring-[#084b3e]"
            />
            <div className="text-xs font-medium text-amber-950 leading-snug">
              <span className="font-bold">Auto-Reconcile Account Balances (Recommended):</span>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Reverses cash collected from deleted sales and restores cash deducted by deleted expenses.
              </p>
            </div>
          </label>
        </div>

        {/* Live Matching Summary Card */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Records Matching This Range:
            </span>
            <div className="text-base sm:text-lg font-black text-gray-900 mt-0.5">
              {isLoadingPreview ? (
                <span>Calculating...</span>
              ) : (
                <span>
                  {rangePreview?.totalRecords ?? 0} Total Records Found
                  {rangePreview && rangePreview.totalRecords > 0 && (
                    <span className="text-xs font-normal text-gray-500 ml-2">
                      (Sales: {rangePreview.salesCount}, Expenses: {rangePreview.expensesCount}, MFS: {rangePreview.mfsCount}, Borrowings: {rangePreview.borrowingsCount})
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
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs sm:text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={16} />
            <span>Delete Range Data ({rangePreview?.totalRecords ?? 0})</span>
          </button>
        </div>

      </div>

      {/* SECTION 2: DELETE ALL DATA (FACTORY RESET) */}
      <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-6 border border-rose-100 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-50 text-rose-700">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-rose-950 uppercase tracking-wider">
                Delete All Data / Full Reset
              </h2>
              <p className="text-xs text-rose-700 font-medium">
                Reset your store records or perform a clean start.
              </p>
            </div>
          </div>

          <span className="text-[11px] font-bold text-rose-800 bg-rose-50 px-3 py-1 rounded-full border border-rose-200 self-start sm:self-auto">
            High Safety Safeguards
          </span>
        </div>

        {/* Database overview counts */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-center">
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Sales</span>
            <span className="text-base font-black text-gray-900">{salesCount}</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Expenses</span>
            <span className="text-base font-black text-gray-900">{expensesCount}</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">MFS</span>
            <span className="text-base font-black text-gray-900">{mfsCount}</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Dues</span>
            <span className="text-base font-black text-gray-900">{duesCount}</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Borrowings</span>
            <span className="text-base font-black text-gray-900">{borrowingsCount}</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Customers</span>
            <span className="text-base font-black text-gray-900">{customersCount}</span>
          </div>
        </div>

        <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={18} />
            <div className="text-xs text-rose-900 leading-relaxed">
              <strong>Warning:</strong> Clicking Delete All will permanently clear all transaction records ({totalCurrentTransactions} records). An audit log of this action will be saved in your <strong>History</strong> tab.
            </div>
          </div>

          <div className="pt-2 border-t border-rose-200/60 space-y-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800">
              <input
                type="checkbox"
                checked={resetAccounts}
                onChange={e => setResetAccounts(e.target.checked)}
                className="rounded text-rose-600 focus:ring-rose-600"
              />
              <span>Also reset Account Balances (Cash, bKash, Nagad, Rocket) to Tk 0.00</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800">
              <input
                type="checkbox"
                checked={wipeCustomers}
                onChange={e => setWipeCustomers(e.target.checked)}
                className="rounded text-rose-600 focus:ring-rose-600"
              />
              <span>Also delete Customer Directory ({customersCount} Customers)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800">
              <input
                type="checkbox"
                checked={wipePresets}
                onChange={e => setWipePresets(e.target.checked)}
                className="rounded text-rose-600 focus:ring-rose-600"
              />
              <span>Also clear preset Service Names</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={totalCurrentTransactions === 0}
            onClick={() => {
              setConfirmInputText('');
              setIsDeleteAllModalOpen(true);
            }}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs sm:text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Trash2 size={16} />
            <span>Delete All Records ({totalCurrentTransactions})</span>
          </button>
        </div>
      </div>

      {/* CONFIRMATION MODAL: Custom Range Delete */}
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
                <h3 className="text-lg font-black text-gray-900">Confirm Range Deletion</h3>
                <p className="text-xs text-gray-500">{rangeStartDate} to {rangeEndDate}</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to permanently delete all <strong>{rangePreview.totalRecords}</strong> records within this date range?
            </p>

            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs space-y-1 font-medium">
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
                <span>{adjustBalancesOnRangeDelete ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>

            <p className="text-[11px] text-gray-400">
              Note: This action will be logged in your <strong>History</strong> tab for future reference.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsRangeModalOpen(false)}
                className="px-4 py-2.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingRange}
                onClick={handleConfirmRangeDelete}
                className="px-5 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 size={14} />
                <span>{isDeletingRange ? 'Deleting Records...' : 'Confirm & Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: Delete All Data */}
      {isDeleteAllModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsDeleteAllModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-2xl">
                <ShieldAlert size={26} />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">Confirm Full Reset</h3>
                <p className="text-xs text-rose-600 font-bold">This cannot be undone!</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              This will permanently delete all transactions ({totalCurrentTransactions} records).
              {resetAccounts && ' Account balances will be reset to Tk 0.00.'}
              {wipeCustomers && ' Customer list will be emptied.'}
            </p>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-950 font-medium">
              To confirm this action, please type <strong>DELETE</strong> in the box below:
            </div>

            <div>
              <input
                type="text"
                placeholder="Type DELETE to confirm"
                value={confirmInputText}
                onChange={e => setConfirmInputText(e.target.value)}
                className="w-full p-2.5 border-2 border-rose-300 focus:border-rose-600 rounded-xl text-xs sm:text-sm font-black text-rose-900 outline-none uppercase text-center"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsDeleteAllModalOpen(false)}
                className="px-4 py-2.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmInputText.trim().toUpperCase() !== 'DELETE' || isDeletingAll}
                onClick={handleConfirmDeleteAll}
                className="px-5 py-2.5 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider"
              >
                <Trash2 size={14} />
                <span>{isDeletingAll ? 'Resetting DB...' : 'I Understand, Delete All'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
