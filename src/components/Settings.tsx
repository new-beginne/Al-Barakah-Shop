import React, { useState, useEffect, useMemo } from 'react';
import { db, ServiceRate, ExpenseService, Account, BalanceLog } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { exportDB, importInto } from 'dexie-export-import';
import { 
  Download, 
  Upload, 
  Trash2, 
  CheckCircle2, 
  Edit2, 
  X, 
  Wrench, 
  ShieldCheck, 
  AlertTriangle, 
  Cloud, 
  RefreshCw, 
  User, 
  LogIn, 
  Wallet, 
  Banknote, 
  Smartphone, 
  Plus, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  SlidersHorizontal, 
  Calendar, 
  Clock, 
  ArrowRight,
  Shield,
  Layers,
  History,
  Check,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from './AuthModal';
import { format } from 'date-fns';
import { 
  initDefaultAccounts, 
  addBalanceWithLog,
  editBalanceWithLog,
  updateBalanceLog,
  deleteBalanceLog,
  DEFAULT_ACCOUNTS
} from '../services/accountService';
import { recordActivityLog } from '../services/activityLogService';
import { DataManagementSettings } from './DataManagementSettings';

export function Settings() {
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { user, profile, isOnline, syncStatus, lastSynced, triggerSync } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Navigation Tabs: 'services' | 'balance' | 'backup' | 'data'
  const [activeSettingsTab, setActiveSettingsTab] = useState<'services' | 'balance' | 'backup' | 'data'>('services');

  // Sub-tab for Services: 'sell' | 'expense'
  const [serviceSubTab, setServiceSubTab] = useState<'sell' | 'expense'>('sell');
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');

  // Service Add/Edit Modal
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [serviceModalType, setServiceModalType] = useState<'sell' | 'expense'>('sell');
  const [serviceFormName, setServiceFormName] = useState('');
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);

  // Sales Services
  const services = useLiveQuery(() => db.services.toArray()) || [];
  // Expense Services
  const expenseServices = useLiveQuery(() => db.expenseServices.toArray()) || [];

  // Deletion Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    type: 'sell' | 'expense';
    name: string;
  } | null>(null);

  // Backup restore confirmation state
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);

  // Balance Management: Exactly 4 options (Cash, bKash, Nagad, Rocket)
  const rawAccounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const [isAddBalanceModalOpen, setIsAddBalanceModalOpen] = useState(false);
  const [selectedAccountOption, setSelectedAccountOption] = useState<'cash' | 'bkash' | 'nagad' | 'rocket'>('cash');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceNote, setBalanceNote] = useState('');
  const [isSubmittingBalance, setIsSubmittingBalance] = useState(false);

  useEffect(() => {
    initDefaultAccounts();
  }, []);

  // Filter accounts strictly to the 4 options
  const accounts = useMemo(() => {
    const list = rawAccounts.length > 0 ? rawAccounts : DEFAULT_ACCOUNTS.map(d => ({ ...d, createdAt: '', updatedAt: '' }));
    const order: Array<'cash' | 'bkash' | 'nagad' | 'rocket'> = ['cash', 'bkash', 'nagad', 'rocket'];
    return order.map(id => {
      const found = list.find(a => a.id === id);
      if (found) return found;
      const def = DEFAULT_ACCOUNTS.find(d => d.id === id);
      return { 
        id, 
        name: def?.name || id, 
        type: (id === 'cash' ? 'cash' : 'mfs') as any, 
        balance: 0, 
        createdAt: '', 
        updatedAt: '' 
      };
    });
  }, [rawAccounts]);

  const totalCapital = useMemo(() => {
    return accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  }, [accounts]);

  // Balance Logs & History States
  const rawBalanceLogs = useLiveQuery(() => db.balanceLogs.orderBy('id').reverse().toArray()) || [];
  const [historyAccountFilter, setHistoryAccountFilter] = useState<'all' | 'cash' | 'bkash' | 'nagad' | 'rocket'>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const historyPerPage = 8;

  // Direct Balance Calibration / Edit Modal State
  const [isCalibrateModalOpen, setIsCalibrateModalOpen] = useState(false);
  const [calibrateAccountId, setCalibrateAccountId] = useState<'cash' | 'bkash' | 'nagad' | 'rocket'>('cash');
  const [calibrateNewBalance, setCalibrateNewBalance] = useState('');
  const [calibrateNote, setCalibrateNote] = useState('');
  const [isSubmittingCalibrate, setIsSubmittingCalibrate] = useState(false);

  // Edit Existing History Log Modal State
  const [editingLog, setEditingLog] = useState<BalanceLog | null>(null);
  const [editLogAmount, setEditLogAmount] = useState('');
  const [editLogNote, setEditLogNote] = useState('');
  const [editLogDate, setEditLogDate] = useState('');
  const [isSubmittingEditLog, setIsSubmittingEditLog] = useState(false);

  // Delete History Log Modal State
  const [deletingLog, setDeletingLog] = useState<BalanceLog | null>(null);
  const [revertBalanceOnDelete, setRevertBalanceOnDelete] = useState(true);
  const [isDeletingLog, setIsDeletingLog] = useState(false);

  const filteredBalanceLogs = useMemo(() => {
    return rawBalanceLogs.filter(log => {
      if (historyAccountFilter !== 'all' && log.accountId !== historyAccountFilter) {
        return false;
      }
      if (historySearchQuery.trim()) {
        const q = historySearchQuery.toLowerCase();
        const noteMatch = (log.note || '').toLowerCase().includes(q);
        const accMatch = (log.accountName || '').toLowerCase().includes(q);
        const dateMatch = (log.date || '').includes(q);
        if (!noteMatch && !accMatch && !dateMatch) return false;
      }
      return true;
    });
  }, [rawBalanceLogs, historyAccountFilter, historySearchQuery]);

  const totalHistoryPages = Math.ceil(filteredBalanceLogs.length / historyPerPage) || 1;
  const paginatedBalanceLogs = useMemo(() => {
    const start = (historyPage - 1) * historyPerPage;
    return filteredBalanceLogs.slice(start, start + historyPerPage);
  }, [filteredBalanceLogs, historyPage, historyPerPage]);

  // Filtered Services
  const filteredSalesServices = useMemo(() => {
    if (!serviceSearchQuery.trim()) return services;
    return services.filter(s => s.name.toLowerCase().includes(serviceSearchQuery.toLowerCase()));
  }, [services, serviceSearchQuery]);

  const filteredExpenseServices = useMemo(() => {
    if (!serviceSearchQuery.trim()) return expenseServices;
    return expenseServices.filter(e => e.name.toLowerCase().includes(serviceSearchQuery.toLowerCase()));
  }, [expenseServices, serviceSearchQuery]);

  // Service Modal handlers
  const openAddServiceModal = (type: 'sell' | 'expense') => {
    setServiceModalType(type);
    setEditingServiceId(null);
    setServiceFormName('');
    setIsServiceModalOpen(true);
  };

  const openEditServiceModal = (type: 'sell' | 'expense', item: { id?: number; name: string }) => {
    setServiceModalType(type);
    setEditingServiceId(item.id || null);
    setServiceFormName(item.name);
    setIsServiceModalOpen(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceFormName.trim()) return;

    const now = new Date().toISOString();
    const cleanName = serviceFormName.trim();

    if (serviceModalType === 'sell') {
      if (editingServiceId) {
        await db.services.update(editingServiceId, {
          name: cleanName,
          updatedAt: now,
        });
        setSuccessMsg(`Sales service "${cleanName}" updated.`);
      } else {
        const newService: ServiceRate = {
          name: cleanName,
          defaultCost: 0,
          defaultPrice: 0,
          createdAt: now,
          updatedAt: now,
        };
        await db.services.add(newService);
        setSuccessMsg(`Sales service "${cleanName}" added.`);
      }
    } else {
      if (editingServiceId) {
        await db.expenseServices.update(editingServiceId, {
          name: cleanName,
          updatedAt: now,
        });
        setSuccessMsg(`Expense service "${cleanName}" updated.`);
      } else {
        await db.expenseServices.add({
          name: cleanName,
          createdAt: now,
          updatedAt: now,
        });
        setSuccessMsg(`Expense service "${cleanName}" added.`);
      }
    }

    setIsServiceModalOpen(false);
    setServiceFormName('');
    setEditingServiceId(null);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  // Execute confirmed deletion of preset service
  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === 'sell') {
        await db.services.delete(deleteTarget.id);
        await recordActivityLog({
          action: 'DELETE',
          module: 'Services',
          title: `Deleted Sales preset service: "${deleteTarget.name}"`,
          details: `Removed service preset ID #${deleteTarget.id}`,
        });
        setSuccessMsg(`"${deleteTarget.name}" deleted.`);
      } else {
        await db.expenseServices.delete(deleteTarget.id);
        await recordActivityLog({
          action: 'DELETE',
          module: 'Services',
          title: `Deleted Expense preset service: "${deleteTarget.name}"`,
          details: `Removed expense preset ID #${deleteTarget.id}`,
        });
        setSuccessMsg(`"${deleteTarget.name}" deleted.`);
      }
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setDeleteTarget(null);
    }
  };

  // Add Balance Submit
  const handleAddBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(balanceAmount);
    if (isNaN(amount) || amount <= 0) {
      setErrorMsg('Please enter a valid amount greater than 0.');
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }

    setIsSubmittingBalance(true);
    try {
      const targetAcc = accounts.find(a => a.id === selectedAccountOption);
      const accName = targetAcc ? targetAcc.name : selectedAccountOption;

      const result = await addBalanceWithLog(
        selectedAccountOption, 
        amount, 
        balanceNote.trim() || `Added Tk ${amount.toLocaleString()}`
      );
      setSuccessMsg(`Added Tk ${amount.toLocaleString()} to ${accName}! New balance: Tk ${result.newBalance.toLocaleString()}`);

      setBalanceAmount('');
      setBalanceNote('');
      setIsAddBalanceModalOpen(false);
      setHistoryPage(1);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error submitting balance:', err);
      setErrorMsg('Failed to add balance. Please try again.');
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setIsSubmittingBalance(false);
    }
  };

  // Calibrate Balance Submit
  const handleDirectCalibrateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newBal = parseFloat(calibrateNewBalance);
    if (isNaN(newBal) || newBal < 0) {
      setErrorMsg('Please enter a valid balance amount (0 or more).');
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }

    setIsSubmittingCalibrate(true);
    try {
      const targetAcc = accounts.find(a => a.id === calibrateAccountId);
      const accName = targetAcc ? targetAcc.name : calibrateAccountId;

      await editBalanceWithLog(
        calibrateAccountId,
        newBal,
        calibrateNote.trim() || `Balance calibrated to Tk ${newBal.toLocaleString()}`
      );

      setSuccessMsg(`Balance for "${accName}" set to Tk ${newBal.toLocaleString()}!`);
      setIsCalibrateModalOpen(false);
      setCalibrateNewBalance('');
      setCalibrateNote('');
      setHistoryPage(1);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error calibrating balance:', err);
      setErrorMsg('Failed to update balance. Please try again.');
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setIsSubmittingCalibrate(false);
    }
  };

  // History Log Edit/Delete
  const handleStartEditLog = (log: BalanceLog) => {
    setEditingLog(log);
    setEditLogAmount(String(log.amount));
    setEditLogNote(log.note || '');
    setEditLogDate(log.date || format(new Date(), 'yyyy-MM-dd'));
  };

  const handleUpdateLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog?.id) return;
    const newAmt = parseFloat(editLogAmount);
    if (isNaN(newAmt)) {
      setErrorMsg('Please enter a valid amount.');
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }

    setIsSubmittingEditLog(true);
    try {
      await updateBalanceLog(editingLog.id, {
        amount: newAmt,
        note: editLogNote.trim(),
        date: editLogDate
      });
      setSuccessMsg('Balance history entry updated.');
      setEditingLog(null);
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err) {
      console.error('Error updating log:', err);
      setErrorMsg('Failed to update history log.');
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setIsSubmittingEditLog(false);
    }
  };

  const handleDeleteLogConfirm = async () => {
    if (!deletingLog?.id) return;
    setIsDeletingLog(true);
    try {
      await deleteBalanceLog(deletingLog.id, revertBalanceOnDelete);
      setSuccessMsg('History entry deleted.');
      setDeletingLog(null);
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err) {
      console.error('Error deleting log:', err);
      setErrorMsg('Failed to delete history entry.');
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setIsDeletingLog(false);
    }
  };

  // Export JSON
  const handleExport = async () => {
    try {
      const blob = await exportDB(db);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `AlBarakah_Backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      setSuccessMsg('Database backup downloaded successfully.');
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (error) {
      console.error('Export error:', error);
      setErrorMsg('Backup failed. Please check browser storage permissions.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  // Import JSON
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingRestoreFile(file);
      e.target.value = '';
    }
  };

  const confirmRestore = async () => {
    if (!pendingRestoreFile) return;
    try {
      await importInto(db, pendingRestoreFile, {
        overwriteValues: true,
        clearTablesBeforeImport: false
      });
      
      if (isOnline && user) {
        setIsSyncing(true);
        await triggerSync();
        setIsSyncing(false);
      }
      
      setSuccessMsg('Data restored successfully. Reloading application...');
      setTimeout(() => {
        setSuccessMsg('');
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Import error:', error);
      setErrorMsg('Restore failed. Please check file format.');
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setPendingRestoreFile(null);
    }
  };

  const getAccountIcon = (id: string) => {
    if (id === 'cash') return <Banknote size={18} className="text-emerald-700" />;
    return <Smartphone size={18} className="text-[#084b3e]" />;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 font-medium">Manage preset services, account balances, backups and data cleanup</p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {activeSettingsTab === 'services' && (
            <button
              onClick={() => openAddServiceModal(serviceSubTab)}
              className="w-full sm:w-auto bg-[#084b3e] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#0c5e4e] transition-colors flex items-center justify-center gap-2 shadow-sm text-sm cursor-pointer"
            >
              <Plus size={18} />
              Add {serviceSubTab === 'sell' ? 'Sales' : 'Expense'} Service
            </button>
          )}

          {activeSettingsTab === 'balance' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  setSelectedAccountOption('cash');
                  setIsAddBalanceModalOpen(true);
                }}
                className="flex-1 sm:flex-initial bg-[#084b3e] text-white px-4 py-2.5 rounded-xl font-bold hover:bg-[#0c5e4e] transition-colors flex items-center justify-center gap-2 shadow-sm text-xs sm:text-sm cursor-pointer"
              >
                <Plus size={16} />
                Add Balance
              </button>
              <button
                onClick={() => {
                  setCalibrateAccountId('cash');
                  const acc = accounts.find(a => a.id === 'cash');
                  setCalibrateNewBalance(acc ? String(acc.balance) : '0');
                  setIsCalibrateModalOpen(true);
                }}
                className="flex-1 sm:flex-initial bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 shadow-sm text-xs sm:text-sm cursor-pointer"
              >
                <Edit2 size={16} />
                Calibrate
              </button>
            </div>
          )}

          {activeSettingsTab === 'backup' && (
            <button
              onClick={handleExport}
              className="w-full sm:w-auto bg-[#084b3e] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#0c5e4e] transition-colors flex items-center justify-center gap-2 shadow-sm text-sm cursor-pointer"
            >
              <Download size={18} />
              Download Backup
            </button>
          )}
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-sm">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Notification */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-sm">
          <AlertCircle size={18} className="shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 4 Summary Stat Cards (Exact same design language as Borrowings.tsx) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <div className="text-sm font-bold text-gray-500 mb-1">Total Balance</div>
          <div className="text-2xl font-black text-gray-900">Tk {totalCapital.toLocaleString()}</div>
          <div className="text-xs text-gray-400 font-medium mt-1">Across 4 store accounts</div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <div className="text-sm font-bold text-emerald-600 mb-1">Preset Services</div>
          <div className="text-2xl font-black text-emerald-700">{services.length + expenseServices.length} items</div>
          <div className="text-xs text-emerald-600/80 font-medium mt-1">
            {services.length} Sales • {expenseServices.length} Expenses
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <div className="text-sm font-bold text-blue-600 mb-1">Cloud Sync Status</div>
          <div className="text-lg font-black text-blue-900 truncate">
            {user ? (user.displayName || user.email) : 'Local Storage Mode'}
          </div>
          <div className="text-xs text-gray-400 font-medium mt-1">
            {user ? 'Cloud account connected' : '100% Offline & Private'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <div className="text-sm font-bold text-gray-500 mb-1">Balance Logs</div>
          <div className="text-2xl font-black text-gray-900">{rawBalanceLogs.length} Records</div>
          <div className="text-xs text-gray-400 font-medium mt-1">Audited history entries</div>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-3">
        <button
          onClick={() => setActiveSettingsTab('services')}
          className={`px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
            activeSettingsTab === 'services'
              ? 'bg-[#084b3e] text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <SlidersHorizontal size={16} />
          <span>Preset Services ({services.length + expenseServices.length})</span>
        </button>

        <button
          onClick={() => setActiveSettingsTab('balance')}
          className={`px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
            activeSettingsTab === 'balance'
              ? 'bg-[#084b3e] text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Wallet size={16} />
          <span>Account Balances (Tk {totalCapital.toLocaleString()})</span>
        </button>

        <button
          onClick={() => setActiveSettingsTab('backup')}
          className={`px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
            activeSettingsTab === 'backup'
              ? 'bg-[#084b3e] text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Cloud size={16} />
          <span>Backup & Cloud</span>
        </button>

        <button
          onClick={() => setActiveSettingsTab('data')}
          className={`px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
            activeSettingsTab === 'data'
              ? 'bg-rose-700 text-white shadow-sm'
              : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
          }`}
        >
          <Trash2 size={16} />
          <span>Data Cleanup</span>
        </button>
      </div>

      {/* TAB 1: PRESET SERVICES */}
      {activeSettingsTab === 'services' && (
        <div className="space-y-4">
          {/* Sub-tabs: Sales vs Expense */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="inline-flex bg-gray-100 p-1 rounded-xl border border-gray-200">
              <button
                type="button"
                onClick={() => setServiceSubTab('sell')}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  serviceSubTab === 'sell'
                    ? 'bg-white text-[#084b3e] shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Sales Services ({services.length})
              </button>
              <button
                type="button"
                onClick={() => setServiceSubTab('expense')}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  serviceSubTab === 'expense'
                    ? 'bg-white text-[#084b3e] shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Expense Services ({expenseServices.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder={`Search ${serviceSubTab === 'sell' ? 'sales' : 'expense'} services...`}
                value={serviceSearchQuery}
                onChange={(e) => setServiceSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none text-xs sm:text-sm transition-all shadow-sm font-medium"
              />
            </div>
          </div>

          {/* Services Table Card (Exact same layout as Borrowings.tsx table) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50/50 text-gray-500 font-bold border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4">Service Name</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Added Date</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {serviceSubTab === 'sell' ? (
                    filteredSalesServices.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                          <SlidersHorizontal size={40} className="mx-auto text-gray-300 mb-2" />
                          <p className="font-bold text-sm">No sales services found</p>
                          <p className="text-xs text-gray-400 mt-1">Click "Add Sales Service" to register preset services.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredSalesServices.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-bold text-gray-900">{s.name}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                              Sales Preset
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-500">
                            {s.createdAt ? format(new Date(s.createdAt), 'dd/MM/yyyy') : 'Preset'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditServiceModal('sell', s)}
                                className="p-2 text-gray-600 hover:text-[#084b3e] hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                                title="Edit service"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget({ id: s.id!, type: 'sell', name: s.name })}
                                className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                title="Delete service"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )
                  ) : (
                    filteredExpenseServices.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                          <SlidersHorizontal size={40} className="mx-auto text-gray-300 mb-2" />
                          <p className="font-bold text-sm">No expense services found</p>
                          <p className="text-xs text-gray-400 mt-1">Click "Add Expense Service" to register preset categories.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredExpenseServices.map((exp) => (
                        <tr key={exp.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-bold text-gray-900">{exp.name}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                              Expense Preset
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-500">
                            {exp.createdAt ? format(new Date(exp.createdAt), 'dd/MM/yyyy') : 'Preset'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditServiceModal('expense', exp)}
                                className="p-2 text-gray-600 hover:text-[#084b3e] hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                                title="Edit service"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget({ id: exp.id!, type: 'expense', name: exp.name })}
                                className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                title="Delete service"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACCOUNT BALANCES */}
      {activeSettingsTab === 'balance' && (
        <div className="space-y-6">
          {/* 4 Accounts Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {accounts.map((acc) => (
              <div 
                key={acc.id} 
                className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-xl bg-gray-50">
                      {getAccountIcon(acc.id)}
                    </div>
                    <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider">
                      {acc.id === 'cash' ? 'Primary' : 'MFS Wallet'}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-gray-600">{acc.name}</div>
                  <div className="text-2xl font-black text-gray-900 mt-1">
                    Tk {(acc.balance || 0).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-50">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAccountOption(acc.id as any);
                      setIsAddBalanceModalOpen(true);
                    }}
                    className="flex-1 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-[#084b3e] rounded-lg text-xs font-bold transition-colors text-center cursor-pointer"
                  >
                    + Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCalibrateAccountId(acc.id as any);
                      setCalibrateNewBalance(String(acc.balance || 0));
                      setIsCalibrateModalOpen(true);
                    }}
                    className="flex-1 py-1.5 px-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-bold transition-colors text-center cursor-pointer"
                  >
                    Set Exact
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Balance History Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden space-y-4 p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-black text-gray-900">Balance History & Calibration Logs</h2>
                <p className="text-xs text-gray-500 font-medium">Record of all balance additions and manual adjustments</p>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <select
                  value={historyAccountFilter}
                  onChange={(e) => {
                    setHistoryAccountFilter(e.target.value as any);
                    setHistoryPage(1);
                  }}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none cursor-pointer"
                >
                  <option value="all">All Accounts</option>
                  <option value="cash">Cash</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="rocket">Rocket</option>
                </select>

                <div className="relative flex-1 sm:w-60">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={historySearchQuery}
                    onChange={(e) => {
                      setHistorySearchQuery(e.target.value);
                      setHistoryPage(1);
                    }}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 outline-none focus:bg-white focus:border-[#084b3e]"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50/50 text-gray-500 font-bold border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3">Date & Time</th>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Description / Note</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedBalanceLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                        <History size={36} className="mx-auto text-gray-300 mb-2" />
                        <p className="font-bold text-xs">No balance history logs found</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedBalanceLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3.5 text-xs text-gray-600 font-medium">
                          <div className="font-bold text-gray-900">{log.date}</div>
                          <div className="text-[11px] text-gray-400">{log.time}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-800">
                            {log.accountName}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-bold text-emerald-700">
                          +Tk {Number(log.amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-600 max-w-xs truncate">
                          {log.note || '-'}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditLog(log)}
                              className="p-1.5 text-gray-500 hover:text-[#084b3e] hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit log entry"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingLog(log);
                                setRevertBalanceOnDelete(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete log entry"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalHistoryPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-500 font-medium">
                  Showing page {historyPage} of {totalHistoryPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={historyPage === 1}
                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                    className="p-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-bold px-2 text-gray-700">{historyPage} / {totalHistoryPages}</span>
                  <button
                    type="button"
                    disabled={historyPage === totalHistoryPages}
                    onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                    className="p-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: BACKUP & CLOUD */}
      {activeSettingsTab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Cloud Sync & Account */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-[#084b3e]">
                <Cloud size={22} />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900">Cloud Sync & Storage</h2>
                <p className="text-xs text-gray-500 font-medium">Real-time backup to secure cloud server</p>
              </div>
            </div>

            {user ? (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">Store Account:</span>
                    <span className="font-bold text-gray-900">{profile?.storeName || 'My Store'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">Email / Phone:</span>
                    <span className="font-bold text-gray-900">{user.email || profile?.phone || 'Online Account'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">Network Status:</span>
                    <span className={`font-bold ${isOnline ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {isOnline ? 'Connected (Online)' : 'Offline (Local mode)'}
                    </span>
                  </div>
                  {lastSynced && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 font-medium">Last Cloud Sync:</span>
                      <span className="text-gray-700">{format(new Date(lastSynced), 'dd/MM/yyyy hh:mm a')}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setIsSyncing(true);
                      await triggerSync();
                      setIsSyncing(false);
                      setSuccessMsg('Cloud sync completed.');
                      setTimeout(() => setSuccessMsg(''), 3000);
                    }}
                    disabled={isSyncing || !isOnline}
                    className="flex-1 py-2.5 bg-[#084b3e] text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm hover:bg-[#0c5e4e] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
                    <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(true)}
                    className="py-2.5 px-4 border border-gray-200 text-gray-700 rounded-xl text-xs sm:text-sm font-bold hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <User size={16} />
                    <span>Profile</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-gray-600 leading-relaxed font-medium">
                  Connect your store to Google Firebase cloud storage. Access your sales records, expenses, dues, and customer lists from your mobile phone and desktop computer simultaneously.
                </p>

                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 bg-[#084b3e] hover:bg-[#0c5e4e] text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-sm text-sm cursor-pointer"
                >
                  <LogIn size={18} />
                  <span>Login / Register Store Account</span>
                </button>
              </div>
            )}
          </div>

          {/* Card 2: Offline JSON Backup & Restore */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900">Local JSON Backup & Restore</h2>
                <p className="text-xs text-gray-500 font-medium">Direct backup file download and restoration</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed font-medium">
              Save a complete snapshot of your entire IndexedDB database to your computer or phone as a JSON file. You can restore this file at any time even without an internet connection.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleExport}
                className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-50 hover:bg-gray-100 text-gray-900 border border-gray-200 rounded-xl font-bold text-xs sm:text-sm transition-colors shadow-sm cursor-pointer"
              >
                <Download size={18} className="text-[#084b3e]" />
                <span>Export JSON Backup</span>
              </button>

              <label className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-50 hover:bg-gray-100 text-gray-900 border border-gray-200 rounded-xl font-bold text-xs sm:text-sm transition-colors shadow-sm cursor-pointer">
                <Upload size={18} className="text-blue-600" />
                <span>Restore from File</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-2.5">
              <ShieldCheck size={16} className="text-emerald-700 mt-0.5 shrink-0" />
              <div className="text-[11px] text-gray-600 font-medium leading-relaxed">
                All records remain 100% offline and encrypted in your browser's private local IndexedDB storage.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DATA CLEANUP */}
      {activeSettingsTab === 'data' && (
        <DataManagementSettings />
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT PRESET SERVICE */}
      {/* ========================================================================= */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="bg-[#084b3e] text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="font-black text-lg">
                  {editingServiceId ? 'Edit Preset Service' : 'Add Preset Service'}
                </h3>
                <p className="text-xs text-emerald-100 font-medium mt-0.5">
                  {serviceModalType === 'sell' ? 'Sales service catalog' : 'Expense category service'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsServiceModalOpen(false)}
                className="text-emerald-200 hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveService} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Service Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={serviceModalType === 'sell' ? 'e.g. Passport Photo, NID Print' : 'e.g. Electricity Bill, Paper Roll'}
                  value={serviceFormName}
                  onChange={(e) => setServiceFormName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsServiceModalOpen(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#084b3e] hover:bg-[#0c5e4e] text-white rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-sm cursor-pointer"
                >
                  {editingServiceId ? 'Update Service' : 'Save Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD BALANCE */}
      {/* ========================================================================= */}
      {isAddBalanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="bg-[#084b3e] text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="font-black text-lg">Add Account Balance</h3>
                <p className="text-xs text-emerald-100 font-medium mt-0.5">Deposit cash or add funds to a wallet</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddBalanceModalOpen(false)}
                className="text-emerald-200 hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddBalanceSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Select Account
                </label>
                <select
                  value={selectedAccountOption}
                  onChange={(e) => setSelectedAccountOption(e.target.value as any)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none cursor-pointer"
                >
                  <option value="cash">Cash in Hand</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="rocket">Rocket</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Amount (Tk) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  placeholder="e.g. 5000"
                  value={balanceAmount}
                  onChange={(e) => setBalanceAmount(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-black focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Note / Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank cash withdrawal, owner deposit"
                  value={balanceNote}
                  onChange={(e) => setBalanceNote(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddBalanceModalOpen(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBalance}
                  className="flex-1 py-2.5 bg-[#084b3e] hover:bg-[#0c5e4e] text-white rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingBalance ? 'Adding...' : 'Deposit Balance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CALIBRATE / SET EXACT BALANCE */}
      {/* ========================================================================= */}
      {isCalibrateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="bg-[#084b3e] text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="font-black text-lg">Calibrate / Set Exact Balance</h3>
                <p className="text-xs text-emerald-100 font-medium mt-0.5">Override account balance to an exact amount</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCalibrateModalOpen(false)}
                className="text-emerald-200 hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleDirectCalibrateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Select Account
                </label>
                <select
                  value={calibrateAccountId}
                  onChange={(e) => {
                    const accId = e.target.value as any;
                    setCalibrateAccountId(accId);
                    const acc = accounts.find(a => a.id === accId);
                    setCalibrateNewBalance(acc ? String(acc.balance) : '0');
                  }}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none cursor-pointer"
                >
                  <option value="cash">Cash in Hand</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="rocket">Rocket</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Exact New Balance (Tk) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  value={calibrateNewBalance}
                  onChange={(e) => setCalibrateNewBalance(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-black focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Reason / Adjustment Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Daily cash physical count check"
                  value={calibrateNote}
                  onChange={(e) => setCalibrateNote(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCalibrateModalOpen(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCalibrate}
                  className="flex-1 py-2.5 bg-[#084b3e] hover:bg-[#0c5e4e] text-white rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingCalibrate ? 'Saving...' : 'Set Balance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: EDIT BALANCE HISTORY LOG */}
      {/* ========================================================================= */}
      {editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="bg-[#084b3e] text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="font-black text-lg">Edit Balance History Log</h3>
                <p className="text-xs text-emerald-100 font-medium mt-0.5">Account: {editingLog.accountName}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingLog(null)}
                className="text-emerald-200 hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateLogSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Amount (Tk)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  value={editLogAmount}
                  onChange={(e) => setEditLogAmount(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-black focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={editLogDate}
                  onChange={(e) => setEditLogDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Note
                </label>
                <input
                  type="text"
                  value={editLogNote}
                  onChange={(e) => setEditLogNote(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEditLog}
                  className="flex-1 py-2.5 bg-[#084b3e] hover:bg-[#0c5e4e] text-white rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingEditLog ? 'Saving...' : 'Update Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: DELETE HISTORY LOG CONFIRMATION */}
      {/* ========================================================================= */}
      {deletingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900">Delete Balance Log Entry?</h3>
                <p className="text-xs text-gray-500 font-medium">Log ID #{deletingLog.id} • {deletingLog.accountName}</p>
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl text-xs space-y-1">
              <div>Amount: <span className="font-bold text-gray-900">Tk {deletingLog.amount.toLocaleString()}</span></div>
              <div>Date: <span className="font-bold text-gray-900">{deletingLog.date}</span></div>
              {deletingLog.note && <div>Note: <span className="text-gray-600">{deletingLog.note}</span></div>}
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer p-2 bg-amber-50 rounded-xl border border-amber-200">
              <input
                type="checkbox"
                checked={revertBalanceOnDelete}
                onChange={(e) => setRevertBalanceOnDelete(e.target.checked)}
                className="mt-0.5 rounded text-[#084b3e] focus:ring-[#084b3e]"
              />
              <div className="text-xs text-amber-950">
                <span className="font-bold">Revert Account Balance:</span>
                <p className="text-[11px] text-amber-800">Deduct Tk {deletingLog.amount.toLocaleString()} from current balance.</p>
              </div>
            </label>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingLog(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingLog}
                onClick={handleDeleteLogConfirm}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isDeletingLog ? 'Deleting...' : 'Delete Log'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: DELETE PRESET SERVICE CONFIRMATION */}
      {/* ========================================================================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900">Delete Preset Service?</h3>
                <p className="text-xs text-gray-500 font-medium">This item will be removed from your catalog.</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 font-medium">
              Are you sure you want to delete <span className="font-bold text-gray-900">"{deleteTarget.name}"</span>?
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-sm cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: CONFIRM RESTORE BACKUP */}
      {/* ========================================================================= */}
      {pendingRestoreFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-blue-600">
              <div className="p-2.5 bg-blue-50 rounded-xl">
                <Upload size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900">Restore from File?</h3>
                <p className="text-xs text-gray-500 font-medium">{pendingRestoreFile.name}</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed font-medium">
              This will merge and restore transactions, customers, dues, and service records from the selected backup file into your IndexedDB database.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPendingRestoreFile(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRestore}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-sm cursor-pointer"
              >
                Restore Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cloud Store Account Auth Modal */}
      {isAuthModalOpen && (
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />
      )}
    </div>
  );
}
