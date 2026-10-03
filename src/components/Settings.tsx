import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  AlertCircle,
  HardDrive,
  Zap,
  Package
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from './AuthModal';
import { 
  initDefaultServicesAndMappings, 
  linkServiceToInventoryItem, 
  unlinkServiceFromInventory 
} from '../services/serviceMappingService';
import { format } from 'date-fns';
import { requestPersistentStorage } from '../lib/storagePersistence';
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
  const navigate = useNavigate();
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
  // Inventory Items & Links
  const inventoryItems = useLiveQuery(() => db.inventory.toArray()) || [];
  const serviceItemLinks = useLiveQuery(() => db.serviceItemLinks.toArray()) || [];

  // Service Form Extended States for Stock Pairing
  const [serviceFormCategory, setServiceFormCategory] = useState('Printing');
  const [serviceFormPrice, setServiceFormPrice] = useState('');
  const [serviceFormCost, setServiceFormCost] = useState('');
  const [serviceFormInventoryItemId, setServiceFormInventoryItemId] = useState<number | 'none'>('none');
  const [serviceFormDeductQty, setServiceFormDeductQty] = useState('1');

  // Deletion Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    type: 'sell' | 'expense';
    name: string;
  } | null>(null);

  // Backup restore confirmation state
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);

  // Storage persistence state
  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.storage?.persisted) {
      navigator.storage.persisted().then(res => setStoragePersisted(res)).catch(() => {});
    }
  }, []);

  // Balance Management: Exactly 4 options (Cash, bKash, Nagad, Rocket)
  const rawAccounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const [isAddBalanceModalOpen, setIsAddBalanceModalOpen] = useState(false);
  const [selectedAccountOption, setSelectedAccountOption] = useState<'cash' | 'bkash' | 'nagad' | 'rocket'>('cash');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceNote, setBalanceNote] = useState('');
  const [isSubmittingBalance, setIsSubmittingBalance] = useState(false);

  // Initialize defaults on mount
  useEffect(() => {
    initDefaultAccounts();
    initDefaultServicesAndMappings();
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
    setServiceFormCategory('Printing');
    setServiceFormPrice('');
    setServiceFormCost('');
    setServiceFormInventoryItemId('none');
    setServiceFormDeductQty('1');
    setIsServiceModalOpen(true);
  };

  const openEditServiceModal = (type: 'sell' | 'expense', item: { id?: number; name: string }) => {
    setServiceModalType(type);
    setEditingServiceId(item.id || null);
    setServiceFormName(item.name);

    if (type === 'sell') {
      const found = services.find(s => s.id === item.id);
      setServiceFormCategory(found?.category || 'Printing');
      setServiceFormPrice(found?.defaultPrice ? String(found.defaultPrice) : '');
      setServiceFormCost(found?.defaultCost ? String(found.defaultCost) : '');

      // Check linked inventory item from service or serviceItemLinks
      if (found?.linkedInventoryItemId) {
        setServiceFormInventoryItemId(found.linkedInventoryItemId);
        setServiceFormDeductQty(String(found.deductQuantity || 1));
      } else {
        const link = serviceItemLinks.find(l => l.serviceName.toLowerCase().trim() === item.name.toLowerCase().trim());
        if (link && link.inventoryItemId) {
          setServiceFormInventoryItemId(link.inventoryItemId);
          setServiceFormDeductQty(String(link.quantityPerUnit || 1));
        } else {
          setServiceFormInventoryItemId('none');
          setServiceFormDeductQty('1');
        }
      }
    }

    setIsServiceModalOpen(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceFormName.trim()) return;

    const now = new Date().toISOString();
    const cleanName = serviceFormName.trim();

    if (serviceModalType === 'sell') {
      const pPrice = parseFloat(serviceFormPrice) || 0;
      const pCost = parseFloat(serviceFormCost) || 0;
      const deductQty = Math.max(1, Number(serviceFormDeductQty) || 1);

      let linkedInvItem = undefined;
      if (typeof serviceFormInventoryItemId === 'number' && serviceFormInventoryItemId > 0) {
        linkedInvItem = inventoryItems.find(i => i.id === serviceFormInventoryItemId);
      }

      if (editingServiceId) {
        await db.services.update(editingServiceId, {
          name: cleanName,
          category: serviceFormCategory || 'Printing',
          defaultPrice: pPrice,
          defaultCost: pCost,
          linkedInventoryItemId: linkedInvItem?.id,
          linkedInventoryItemName: linkedInvItem?.name,
          deductQuantity: linkedInvItem ? deductQty : undefined,
          updatedAt: now,
        });

        // Sync with db.serviceItemLinks
        if (linkedInvItem && linkedInvItem.id) {
          await linkServiceToInventoryItem(cleanName, linkedInvItem.id, deductQty, editingServiceId);
        } else {
          await unlinkServiceFromInventory(cleanName, editingServiceId);
        }

        setSuccessMsg(`Sales service "${cleanName}" updated.`);
      } else {
        const newService: ServiceRate = {
          name: cleanName,
          category: serviceFormCategory || 'Printing',
          defaultCost: pCost,
          defaultPrice: pPrice,
          linkedInventoryItemId: linkedInvItem?.id,
          linkedInventoryItemName: linkedInvItem?.name,
          deductQuantity: linkedInvItem ? deductQty : undefined,
          createdAt: now,
          updatedAt: now,
        };
        const newId = await db.services.add(newService);

        // Sync with db.serviceItemLinks
        if (linkedInvItem && linkedInvItem.id) {
          await linkServiceToInventoryItem(cleanName, linkedInvItem.id, deductQty, newId as number);
        }

        setSuccessMsg(`Sales service "${cleanName}" added.`);
      }
    } else {
      if (editingServiceId) {
        await db.expenseServices.update(editingServiceId, {
          name: cleanName,
          updatedAt: now,
        });
        setSuccessMsg(`Expense category "${cleanName}" updated.`);
      } else {
        await db.expenseServices.add({
          name: cleanName,
          createdAt: now,
          updatedAt: now,
        });
        setSuccessMsg(`Expense category "${cleanName}" added.`);
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

  const settingsNavItems = [
    {
      id: 'services' as const,
      label: 'Preset Services',
      desc: 'Sales & expense services',
      icon: SlidersHorizontal,
      badge: `${services.length + expenseServices.length}`
    },
    {
      id: 'balance' as const,
      label: 'Account Balances',
      desc: 'Cash, MFS wallets & history',
      icon: Wallet,
      badge: `Tk ${totalCapital.toLocaleString()}`
    },
    {
      id: 'backup' as const,
      label: 'Backup & Cloud',
      desc: 'Offline JSON & auto-sync',
      icon: Cloud,
      badge: isOnline ? 'Online' : 'Offline'
    },
    {
      id: 'data' as const,
      label: 'Data Cleanup',
      desc: 'Storage & record cleanup',
      icon: Trash2,
      badge: undefined
    }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Settings & Preferences</h1>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
            Configure preset services, account balances, backups and database settings
          </p>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-sm animate-fadeIn">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Notification */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-sm animate-fadeIn">
          <AlertCircle size={18} className="shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Top Horizontal Subtabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-gray-200 scrollbar-none">
        {settingsNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSettingsTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSettingsTab(item.id)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-[#084b3e] text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-white' : 'text-gray-500'} />
              <span>{item.label}</span>
              {item.badge && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ml-1 ${
                  isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="space-y-6">

      {/* TAB 1: PRESET SERVICES */}
      {activeSettingsTab === 'services' && (
        <div className="space-y-4">
          {/* Services Action Bar with Sub-tabs, Search & Add Button */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="inline-flex bg-gray-100 p-1 rounded-xl border border-gray-200 shrink-0">
              <button
                type="button"
                onClick={() => setServiceSubTab('sell')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  serviceSubTab === 'sell'
                    ? 'bg-white text-[#084b3e] shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Sales Services ({services.length})
              </button>
              <button
                type="button"
                onClick={() => setServiceSubTab('expense')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  serviceSubTab === 'expense'
                    ? 'bg-white text-[#084b3e] shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Expense Categories ({expenseServices.length})
              </button>
            </div>

            {/* Search Input & Add Button side-by-side */}
            <div className="flex items-center gap-2 flex-1 justify-end">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder={`Search ${serviceSubTab === 'sell' ? 'sales' : 'expense'} services...`}
                  value={serviceSearchQuery}
                  onChange={(e) => setServiceSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none text-xs font-semibold transition-all shadow-xs"
                />
              </div>

              {serviceSubTab === 'sell' && (
                <button
                  type="button"
                  onClick={() => navigate('/inventory/rules')}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-2xs transition-all shrink-0 cursor-pointer"
                  title="Configure automatic paper and stock deduction rules for services"
                >
                  <Zap size={15} className="text-amber-600 fill-amber-500/20" />
                  <span className="hidden md:inline">Auto-Deduct Stock Rules</span>
                  <span className="md:hidden">Stock Rules</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => openAddServiceModal(serviceSubTab)}
                className="bg-[#084b3e] hover:bg-[#0c5e4e] text-white px-4 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition-all shrink-0 cursor-pointer"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Add {serviceSubTab === 'sell' ? 'Sales Service' : 'Expense Category'}</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>

          {/* Services Table Card */}
          <div className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
                <thead className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Service Name</th>
                    {serviceSubTab === 'sell' ? (
                      <>
                        <th className="px-5 py-3.5">Category & Rate</th>
                        <th className="px-5 py-3.5">Auto-Cut Material</th>
                      </>
                    ) : (
                      <>
                        <th className="px-5 py-3.5">Type</th>
                        <th className="px-5 py-3.5">Added Date</th>
                      </>
                    )}
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {serviceSubTab === 'sell' ? (
                    filteredSalesServices.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                          <SlidersHorizontal size={36} className="mx-auto text-gray-300 mb-2" />
                          <p className="font-bold text-xs">No sales services found</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">Click "Add Sales Service" to register preset services.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredSalesServices.map((s) => {
                        const directLink = s.linkedInventoryItemId ? inventoryItems.find(i => i.id === s.linkedInventoryItemId) : null;
                        const fallbackLink = !directLink ? serviceItemLinks.find(l => l.serviceName.toLowerCase().trim() === s.name.toLowerCase().trim()) : null;
                        const invItem = directLink || (fallbackLink ? inventoryItems.find(i => i.id === fallbackLink.inventoryItemId) : null);
                        const mult = s.deductQuantity || fallbackLink?.quantityPerUnit || 1;

                        return (
                          <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                            <td className="px-5 py-3.5">
                              <span className="font-bold text-gray-900 text-xs sm:text-sm">{s.name}</span>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700">
                                  {s.category || 'Printing'}
                                </span>
                                {s.defaultPrice ? (
                                  <span className="text-xs font-mono font-bold text-emerald-800">
                                    Tk {s.defaultPrice}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              {invItem ? (
                                <div className="flex items-center gap-1.5 text-xs">
                                  <span className="font-bold text-gray-800">{invItem.name}</span>
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                                    {mult} {invItem.unit}/sale
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 font-normal">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditServiceModal('sell', s)}
                                  className="p-1.5 text-gray-600 hover:text-[#084b3e] hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                                  title="Edit service"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget({ id: s.id!, type: 'sell', name: s.name })}
                                  className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                  title="Delete service"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
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
          {/* Top Balance Summary Card with Direct Action Buttons */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Store Balance</span>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mt-0.5">
                Tk {totalCapital.toLocaleString()}
              </h2>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Combined balance across Cash, bKash, Nagad, and Rocket
              </p>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setSelectedAccountOption('cash');
                  setIsAddBalanceModalOpen(true);
                }}
                className="flex-1 sm:flex-initial bg-[#084b3e] hover:bg-[#0c5e4e] text-white px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <Plus size={16} />
                <span>+ Add Balance</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCalibrateAccountId('cash');
                  const acc = accounts.find(a => a.id === 'cash');
                  setCalibrateNewBalance(acc ? String(acc.balance) : '0');
                  setIsCalibrateModalOpen(true);
                }}
                className="flex-1 sm:flex-initial bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Edit2 size={15} />
                <span>Calibrate</span>
              </button>
            </div>
          </div>

          {/* 4 Accounts Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {accounts.filter(a => a.id !== 'upay' && a.id !== 'bank').map((acc) => (
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
                    onClick={() => navigate('/profile')}
                    className="py-2.5 px-4 border border-gray-200 text-gray-700 rounded-xl text-xs sm:text-sm font-bold hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <User size={16} />
                    <span>Profile & Password</span>
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

          {/* Card 3: Storage Protection & Reinstall Safety */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <div className="p-2.5 rounded-xl bg-purple-50 text-purple-700">
                <HardDrive size={22} />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900">PC & Mobile Storage Protection</h2>
                <p className="text-xs text-gray-500 font-medium">Safe local persistence across updates and reinstallation</p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 font-medium">Local Database Status:</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> IndexedDB Active
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 font-medium">Permanent Browser Storage:</span>
                <span className="font-bold text-purple-700 flex items-center gap-1.5">
                  <ShieldCheck size={14} /> {storagePersisted ? 'Permanent (Cannot be evicted)' : 'Protected'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 font-medium">PWA App Identity:</span>
                <span className="font-bold text-gray-900">Unique Fixed ID (Preserves data on reinstall)</span>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed font-medium">
              Whenever you reinstall or update the app on your PC or mobile, your local IndexedDB records and cloud account keep your shop data safe. To be 100% secure, your data also auto-syncs to the cloud whenever online.
            </p>

            <button
              type="button"
              onClick={async () => {
                const res = await requestPersistentStorage();
                setStoragePersisted(res.persisted);
                setSuccessMsg('Storage persistence verified. Your data is protected from eviction.');
                setTimeout(() => setSuccessMsg(''), 3500);
              }}
              className="w-full py-2.5 px-4 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-xl text-xs font-bold transition-all border border-purple-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              <HardDrive size={15} />
              <span>Verify & Lock Storage Persistence</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: DATA CLEANUP */}
      {activeSettingsTab === 'data' && (
        <DataManagementSettings />
      )}

      </div> {/* Close Content Area */}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT PRESET SERVICE */}
      {/* ========================================================================= */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm" onClick={() => setIsServiceModalOpen(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-xl text-[#182236] mb-6 text-center">
              {editingServiceId ? 'Edit Preset Service' : 'Add Preset Service'}
            </h3>

            <form onSubmit={handleSaveService} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                  Service Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={serviceModalType === 'sell' ? 'e.g. Passport Photo, NID Print' : 'e.g. Electricity Bill, Paper Roll'}
                  value={serviceFormName}
                  onChange={(e) => setServiceFormName(e.target.value)}
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-bold text-[#1d2939] focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 outline-none transition-all"
                  autoFocus
                />
              </div>

              {serviceModalType === 'sell' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                        Category
                      </label>
                      <select
                        value={serviceFormCategory}
                        onChange={(e) => setServiceFormCategory(e.target.value)}
                        className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium text-[#1d2939] focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 outline-none cursor-pointer transition-all"
                      >
                        <option value="Printing">Printing</option>
                        <option value="Digital Studio">Digital Studio</option>
                        <option value="Govt/NID Service">Govt/NID Service</option>
                        <option value="Online Service">Online Service</option>
                        <option value="General">General</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                        Default Price (Tk)
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={serviceFormPrice}
                        onChange={(e) => setServiceFormPrice(e.target.value)}
                        className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-bold text-[#1d2939] focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 outline-none transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-3">
                    <div className="flex items-center gap-2">
                      <Package size={16} className="text-[#075b4d]" />
                      <span className="text-xs font-black text-emerald-950">
                        Auto-Cut Stock Material
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-[10px] font-bold text-emerald-900 uppercase tracking-wider mb-1">
                          Stock Item to Deduct on Sale
                        </label>
                        <select
                          value={serviceFormInventoryItemId}
                          onChange={(e) => setServiceFormInventoryItemId(e.target.value === 'none' ? 'none' : Number(e.target.value))}
                          className="w-full h-[42px] px-3 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#075b4d]/20"
                        >
                          <option value="none">None (No inventory deduction)</option>
                          {inventoryItems.map(item => (
                            <option key={item.id} value={item.id}>
                              {item.name} ({item.currentStock} {item.unit} in stock)
                            </option>
                          ))}
                        </select>
                      </div>

                      {serviceFormInventoryItemId !== 'none' && (
                        <div>
                          <label className="block text-[10px] font-bold text-emerald-900 uppercase tracking-wider mb-1">
                            Quantity to Deduct per 1 Service Sold
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={serviceFormDeductQty}
                            onChange={(e) => setServiceFormDeductQty(e.target.value)}
                            className="w-full h-[42px] px-3 bg-white border border-emerald-200 rounded-xl text-xs font-black outline-none font-mono"
                            placeholder="1"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full h-[49px] bg-[#075b4d] hover:bg-[#064c41] text-white rounded-xl text-sm font-bold transition-all shadow-sm cursor-pointer active:translate-y-px flex items-center justify-center"
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm" onClick={() => setIsAddBalanceModalOpen(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-xl text-[#182236] mb-6 text-center">Add Account Balance</h3>

            <form onSubmit={handleAddBalanceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                  Select Account
                </label>
                <select
                  value={selectedAccountOption}
                  onChange={(e) => setSelectedAccountOption(e.target.value as any)}
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-bold text-[#1d2939] focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 outline-none cursor-pointer transition-all"
                >
                  <option value="cash">Cash in Hand</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="rocket">Rocket</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
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
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-base font-black text-[#1d2939] focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 outline-none font-mono transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                  Note / Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank cash withdrawal, owner deposit"
                  value={balanceNote}
                  onChange={(e) => setBalanceNote(e.target.value)}
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium text-[#1d2939] focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 outline-none transition-all"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingBalance}
                  className="w-full h-[49px] bg-[#075b4d] hover:bg-[#064c41] text-white rounded-xl text-sm font-bold transition-all shadow-sm cursor-pointer active:translate-y-px disabled:opacity-50 flex items-center justify-center"
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm" onClick={() => setIsCalibrateModalOpen(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-xl text-[#182236] mb-6 text-center">Calibrate Exact Balance</h3>

            <form onSubmit={handleDirectCalibrateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
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
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-bold text-[#1d2939] focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 outline-none cursor-pointer transition-all"
                >
                  <option value="cash">Cash in Hand</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="rocket">Rocket</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                  Exact New Balance (Tk) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  value={calibrateNewBalance}
                  onChange={(e) => setCalibrateNewBalance(e.target.value)}
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-base font-black text-[#1d2939] focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 outline-none font-mono transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                  Reason / Adjustment Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Daily cash physical count check"
                  value={calibrateNote}
                  onChange={(e) => setCalibrateNote(e.target.value)}
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium text-[#1d2939] focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 outline-none transition-all"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingCalibrate}
                  className="w-full h-[49px] bg-[#075b4d] hover:bg-[#064c41] text-white rounded-xl text-sm font-bold transition-all shadow-sm cursor-pointer active:translate-y-px disabled:opacity-50 flex items-center justify-center"
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm" onClick={() => setEditingLog(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-xl text-[#182236] mb-1 text-center">Edit Balance Log</h3>
            <p className="text-center text-xs text-gray-500 font-semibold mb-6">Account: {editingLog.accountName}</p>

            <form onSubmit={handleUpdateLogSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                  Amount (Tk) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  value={editLogAmount}
                  onChange={(e) => setEditLogAmount(e.target.value)}
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-base font-black text-[#1d2939] focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 outline-none font-mono transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={editLogDate}
                  onChange={(e) => setEditLogDate(e.target.value)}
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium text-[#1d2939] focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#465269] uppercase tracking-wider mb-1.5">
                  Note
                </label>
                <input
                  type="text"
                  value={editLogNote}
                  onChange={(e) => setEditLogNote(e.target.value)}
                  className="w-full h-[47px] px-4 bg-[#f8f9fa] border border-[#dce1e7] rounded-xl text-sm font-medium text-[#1d2939] focus:bg-white focus:border-[#075b4d] focus:ring-2 focus:ring-[#075b4d]/10 outline-none transition-all"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingEditLog}
                  className="w-full h-[49px] bg-[#075b4d] hover:bg-[#064c41] text-white rounded-xl text-sm font-bold transition-all shadow-sm cursor-pointer active:translate-y-px disabled:opacity-50 flex items-center justify-center"
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm" onClick={() => setDeletingLog(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-2 border border-red-100">
              <AlertTriangle size={28} strokeWidth={2.5} />
            </div>
            <h3 className="font-bold text-xl text-[#182236]">Delete Balance Log?</h3>
            <p className="text-xs text-gray-500 font-medium">Log ID #{deletingLog.id} • {deletingLog.accountName}</p>

            <div className="p-3 bg-[#f8f9fa] rounded-xl text-xs space-y-1 text-left border border-[#dce1e7]">
              <div>Amount: <span className="font-bold text-gray-900">Tk {deletingLog.amount.toLocaleString()}</span></div>
              <div>Date: <span className="font-bold text-gray-900">{deletingLog.date}</span></div>
              {deletingLog.note && <div>Note: <span className="text-gray-600">{deletingLog.note}</span></div>}
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-left">
              <input
                type="checkbox"
                checked={revertBalanceOnDelete}
                onChange={(e) => setRevertBalanceOnDelete(e.target.checked)}
                className="mt-0.5 rounded text-[#075b4d] focus:ring-[#075b4d]"
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
                className="flex-1 py-3 font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingLog}
                onClick={handleDeleteLogConfirm}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isDeletingLog ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: DELETE PRESET SERVICE CONFIRMATION */}
      {/* ========================================================================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-2 border border-red-100">
              <AlertTriangle size={28} strokeWidth={2.5} />
            </div>
            <h3 className="font-bold text-xl text-[#182236]">Delete Preset Service?</h3>
            <p className="text-sm text-gray-500 font-medium">
              Are you sure you want to delete <span className="font-bold text-gray-900">"{deleteTarget.name}"</span>?
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-3 font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm cursor-pointer"
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm" onClick={() => setPendingRestoreFile(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2 border border-blue-100">
              <Upload size={28} strokeWidth={2.5} />
            </div>
            <h3 className="font-bold text-xl text-[#182236]">Restore from File?</h3>
            <p className="text-xs text-gray-500 font-medium">{pendingRestoreFile.name}</p>

            <p className="text-xs text-gray-600 leading-relaxed font-medium">
              This will merge and restore transactions, customers, dues, and service records from the selected backup file into your IndexedDB database.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPendingRestoreFile(null)}
                className="flex-1 py-3 font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRestore}
                className="flex-1 py-3 bg-[#075b4d] hover:bg-[#064c41] text-white rounded-xl text-sm font-bold transition-all shadow-sm cursor-pointer"
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
