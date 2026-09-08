import React, { useState, useEffect, useMemo } from 'react';
import { db, ServiceRate, ExpenseService, Account } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { exportDB, importInto } from 'dexie-export-import';
import { 
  Download, 
  Upload, 
  Trash2, 
  CheckCircle2, 
  Save, 
  Edit2, 
  X, 
  Wrench, 
  ShieldCheck, 
  AlertTriangle, 
  Cloud, 
  RefreshCw, 
  User, 
  Store, 
  LogIn, 
  Shield, 
  Lock, 
  Check,
  Wallet,
  Banknote,
  Smartphone,
  Coins,
  Plus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from './AuthModal';
import { format } from 'date-fns';
import { 
  initDefaultAccounts, 
  setAccountBalance, 
  DEFAULT_ACCOUNTS
} from '../services/accountService';

export function Settings() {
  const [successMsg, setSuccessMsg] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { user, profile, isOnline, syncStatus, lastSynced, triggerSync } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Sub-tab for "Service Name" section: 'sell' | 'expense'
  const [serviceSubTab, setServiceSubTab] = useState<'sell' | 'expense'>('sell');

  // Sales Services (pure service name, just like expense)
  const services = useLiveQuery(() => db.services.toArray()) || [];
  const [sName, setSName] = useState('');
  const [editSalesServiceId, setEditSalesServiceId] = useState<number | null>(null);

  // Expense Services
  const expenseServices = useLiveQuery(() => db.expenseServices.toArray()) || [];
  const [expName, setExpName] = useState('');
  const [editExpServiceId, setEditExpServiceId] = useState<number | null>(null);

  // Deletion Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    type: 'sell' | 'expense';
    name: string;
  } | null>(null);

  // Backup restore confirmation state
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);

  // Main Settings Navtabs: 'services' | 'balance'
  const [activeSettingsTab, setActiveSettingsTab] = useState<'services' | 'balance'>('services');

  // Balance Management: Exactly 4 options (Cash, bKash, Nagad, Rocket)
  const rawAccounts = useLiveQuery(() => db.accounts.toArray()) || [];
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

  const handleAddBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(balanceAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount greater than 0.');
      return;
    }

    setIsSubmittingBalance(true);
    try {
      const targetAcc = accounts.find(a => a.id === selectedAccountOption);
      const accName = targetAcc ? targetAcc.name : selectedAccountOption;
      const currentBal = targetAcc?.balance || 0;
      const newBal = currentBal + amount;

      await setAccountBalance(
        selectedAccountOption, 
        newBal, 
        balanceNote.trim() || `Added Tk ${amount.toLocaleString()}`
      );
      setSuccessMsg(`Successfully added Tk ${amount.toLocaleString()} to "${accName}"! New balance: Tk ${newBal.toLocaleString()}`);

      setBalanceAmount('');
      setBalanceNote('');
      setTimeout(() => setSuccessMsg(''), 4500);
    } catch (err) {
      console.error('Error submitting balance:', err);
      alert('Failed to add balance. Please try again.');
    } finally {
      setIsSubmittingBalance(false);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await exportDB(db);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `AlBarakah_Backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      setSuccessMsg('Backup downloaded successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      console.error('Export error:', error);
      alert('Backup failed.');
    }
  };

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
      
      // Auto-sync to cloud after import if online
      if (isOnline && user) {
        setIsSyncing(true);
        await triggerSync();
        setIsSyncing(false);
      }
      
      setSuccessMsg('Data imported and merged successfully. Reloading...');
      setTimeout(() => {
        setSuccessMsg('');
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Import error:', error);
      alert('Restore failed.');
    } finally {
      setPendingRestoreFile(null);
    }
  };

  // Sales Service Operations (pure Service Name add/edit/delete)
  const handleSaveSalesService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sName.trim()) return;

    if (editSalesServiceId) {
      await db.services.update(editSalesServiceId, {
        name: sName.trim(),
        updatedAt: new Date().toISOString(),
      });
      setSuccessMsg('Sell service updated.');
      setEditSalesServiceId(null);
    } else {
      const now = new Date().toISOString();
      const newService: ServiceRate = {
        name: sName.trim(),
        defaultCost: 0,
        defaultPrice: 0,
        createdAt: now,
        updatedAt: now,
      };
      await db.services.add(newService);
      setSuccessMsg('Sell service added.');
    }

    setSName('');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleEditSalesService = (s: ServiceRate) => {
    setEditSalesServiceId(s.id!);
    setSName(s.name);
  };

  const handleCancelEditSalesService = () => {
    setEditSalesServiceId(null);
    setSName('');
  };

  // Expense Service Operations (pure Service Name add/edit/delete)
  const handleSaveExpService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expName.trim()) return;

    if (editExpServiceId) {
      await db.expenseServices.update(editExpServiceId, { 
        name: expName.trim(),
        updatedAt: new Date().toISOString()
      });
      setSuccessMsg('Expense service updated.');
      setEditExpServiceId(null);
    } else {
      const now = new Date().toISOString();
      await db.expenseServices.add({ 
        name: expName.trim(),
        createdAt: now,
        updatedAt: now
      });
      setSuccessMsg('Expense service added.');
    }

    setExpName('');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleEditExpService = (exp: ExpenseService) => {
    setEditExpServiceId(exp.id!);
    setExpName(exp.name);
  };

  const handleCancelEditExpService = () => {
    setEditExpServiceId(null);
    setExpName('');
  };

  // Execute confirmed deletion
  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === 'sell') {
        await db.services.delete(deleteTarget.id);
        if (editSalesServiceId === deleteTarget.id) {
          handleCancelEditSalesService();
        }
        setSuccessMsg(`"${deleteTarget.name}" deleted.`);
      } else {
        await db.expenseServices.delete(deleteTarget.id);
        if (editExpServiceId === deleteTarget.id) {
          handleCancelEditExpService();
        }
        setSuccessMsg(`"${deleteTarget.name}" deleted.`);
      }
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-6xl mx-auto mb-16 md:mb-0 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-xs text-gray-500 font-medium">Manage preset services, account balances and settings.</p>
        </div>

        {/* Top Navtabs: Services and Add Balance */}
        <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveSettingsTab('services')}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-lg text-xs sm:text-sm font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSettingsTab === 'services'
                ? 'bg-[#084b3e] text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Wrench size={16} />
            <span>Services</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSettingsTab('balance')}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-lg text-xs sm:text-sm font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSettingsTab === 'balance'
                ? 'bg-[#084b3e] text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Wallet size={16} />
            <span>Add Balance</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-gray-100 border border-[#084b3e] rounded-xl flex items-center text-gray-900 font-bold text-xs sm:text-sm tracking-wider uppercase">
          <CheckCircle2 className="mr-2 shrink-0" size={18} />
          {successMsg}
        </div>
      )}

      {/* When Services is selected: Show Services section in full width */}
      {activeSettingsTab === 'services' && (
        <div className="w-full bg-white rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100">
          
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Wrench size={20} className="text-gray-900" />
              <h2 className="text-lg font-black text-gray-900 uppercase tracking-wider">Services</h2>
            </div>
            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
              {serviceSubTab === 'sell' ? `${services.length} Sell Services` : `${expenseServices.length} Expense Services`}
            </span>
          </div>

          <p className="text-xs text-gray-500 mb-4 font-medium">
            Manage preset service names for sales and expenses.
          </p>

          {/* Sub-tabs: Sell & Expense */}
          <div className="flex bg-gray-100 p-1 rounded-xl mb-5">
            <button
              onClick={() => {
                setServiceSubTab('sell');
                handleCancelEditExpService();
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all ${
                serviceSubTab === 'sell'
                  ? 'bg-[#084b3e] text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sell
            </button>
            <button
              onClick={() => {
                setServiceSubTab('expense');
                handleCancelEditSalesService();
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all ${
                serviceSubTab === 'expense'
                  ? 'bg-[#084b3e] text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Expense
            </button>
          </div>

          {/* Sell Sub-tab Content (Pure Service Name, identical to Expense) */}
          {serviceSubTab === 'sell' && (
            <div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-700 mb-3 flex items-center justify-between">
                  <span>{editSalesServiceId ? 'Edit Sell Service' : 'Add New Sell Service'}</span>
                  {editSalesServiceId && (
                    <span className="text-[10px] bg-emerald-100 text-[#126b55] px-2 py-0.5 rounded font-bold">Editing</span>
                  )}
                </h3>

                <form onSubmit={handleSaveSalesService} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Service Name</label>
                    <input 
                      type="text" 
                      required
                      value={sName}
                      onChange={e => setSName(e.target.value)}
                      placeholder="e.g. Passport Photo, NID Service, Photocopy"
                      className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-[#084b3e] outline-none text-xs sm:text-sm font-medium bg-white"
                    />
                  </div>
                  
                  <div className="flex gap-2 pt-1">
                    <button 
                      type="submit" 
                      className="flex-1 bg-[#084b3e] text-white text-xs sm:text-sm font-bold py-2.5 rounded-xl hover:bg-[#126b55] transition-colors flex items-center justify-center uppercase tracking-wider shadow-sm"
                    >
                      <Save size={16} className="mr-1.5"/> {editSalesServiceId ? 'Update Service' : 'Add Service'}
                    </button>
                    {editSalesServiceId && (
                      <button 
                        type="button" 
                        onClick={handleCancelEditSalesService} 
                        className="px-4 bg-gray-200 text-gray-800 text-xs sm:text-sm font-bold rounded-xl hover:bg-gray-300 transition-colors flex items-center justify-center"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Sell Services List */}
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1 mb-1">
                  <span className="text-xs font-black uppercase tracking-wider text-gray-500">Sell Services ({services.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {services.map(s => (
                    <div key={s.id} className="flex justify-between items-center bg-gray-50 border border-gray-100 p-3 rounded-xl hover:border-gray-300 transition-colors">
                      <span className="font-bold text-gray-900 text-xs sm:text-sm truncate mr-2">{s.name}</span>
                      <div className="flex items-center space-x-1 shrink-0">
                        <button 
                          onClick={() => handleEditSalesService(s)}
                          title="Edit"
                          className="text-[#084b3e] hover:text-[#126b55] bg-white border border-gray-100 hover:bg-emerald-50 p-2 rounded-xl transition-colors cursor-pointer"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => setDeleteTarget({ id: s.id!, type: 'sell', name: s.name })}
                          title="Delete"
                          className="text-red-600 hover:text-red-800 bg-white border border-gray-100 hover:bg-red-50 p-2 rounded-xl transition-colors cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {services.length === 0 && (
                    <div className="col-span-full">
                      <p className="text-xs text-gray-400 text-center py-6 border border-dashed border-gray-100 rounded-xl">
                        No sell services added yet.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Expense Sub-tab Content */}
          {serviceSubTab === 'expense' && (
            <div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-700 mb-3 flex items-center justify-between">
                  <span>{editExpServiceId ? 'Edit Expense Service' : 'Add New Expense Service'}</span>
                  {editExpServiceId && (
                    <span className="text-[10px] bg-emerald-100 text-[#126b55] px-2 py-0.5 rounded font-bold">Editing</span>
                  )}
                </h3>

                <form onSubmit={handleSaveExpService} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Expense Service Name</label>
                    <input 
                      type="text" 
                      required
                      value={expName}
                      onChange={e => setExpName(e.target.value)}
                      placeholder="e.g. Shop Rent, Electricity Bill, Paper"
                      className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-[#084b3e] outline-none text-xs sm:text-sm font-medium bg-white"
                    />
                  </div>
                  
                  <div className="flex gap-2 pt-1">
                    <button 
                      type="submit" 
                      className="flex-1 bg-[#084b3e] text-white text-xs sm:text-sm font-bold py-2.5 rounded-xl hover:bg-[#126b55] transition-colors flex items-center justify-center uppercase tracking-wider shadow-sm"
                    >
                      <Save size={16} className="mr-1.5"/> {editExpServiceId ? 'Update Expense' : 'Add Expense'}
                    </button>
                    {editExpServiceId && (
                      <button 
                        type="button" 
                        onClick={handleCancelEditExpService} 
                        className="px-4 bg-gray-200 text-gray-800 text-xs sm:text-sm font-bold rounded-xl hover:bg-gray-300 transition-colors flex items-center justify-center"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Expense Services List */}
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1 mb-1">
                  <span className="text-xs font-black uppercase tracking-wider text-gray-500">Expense Services ({expenseServices.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {expenseServices.map(exp => (
                    <div key={exp.id} className="flex justify-between items-center bg-gray-50 border border-gray-100 p-3 rounded-xl hover:border-gray-300 transition-colors">
                      <span className="font-bold text-gray-900 text-xs sm:text-sm truncate mr-2">{exp.name}</span>
                      <div className="flex items-center space-x-1 shrink-0">
                        <button 
                          onClick={() => handleEditExpService(exp)}
                          title="Edit"
                          className="text-[#084b3e] hover:text-[#126b55] bg-white border border-gray-100 hover:bg-emerald-50 p-2 rounded-xl transition-colors cursor-pointer"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => setDeleteTarget({ id: exp.id!, type: 'expense', name: exp.name })}
                          title="Delete"
                          className="text-red-600 hover:text-red-800 bg-white border border-gray-100 hover:bg-red-50 p-2 rounded-xl transition-colors cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {expenseServices.length === 0 && (
                    <div className="col-span-full">
                      <p className="text-xs text-gray-400 text-center py-6 border border-dashed border-gray-100 rounded-xl">
                        No expense services added yet.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* When Add Balance is selected: Show Add Balance section in full width */}
      {activeSettingsTab === 'balance' && (
        <div className="w-full bg-white rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100">
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-[#084b3e]">
                  <Wallet size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900 uppercase tracking-wider">
                    Add Balance
                  </h2>
                  <p className="text-xs text-gray-500 font-medium">
                    Add funds to Cash, bKash, Nagad, or Rocket account.
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right bg-emerald-50/50 sm:bg-transparent px-3 py-1.5 sm:p-0 rounded-xl border border-emerald-100 sm:border-0 w-full sm:w-auto">
                <span className="text-[10px] uppercase font-bold text-gray-500 block tracking-wider">
                  Total Balance
                </span>
                <span className="text-base sm:text-lg font-black text-[#084b3e]">
                  Tk {totalCapital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* All Details in One Card: 4 Accounts Balance Strip */}
            <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-100 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-gray-600">
                  Accounts Balance Overview
                </span>
                <span className="text-[10px] font-bold text-gray-400">
                  (Click to select account)
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {accounts.map(acc => {
                  const isSelected = selectedAccountOption === acc.id;
                  let borderBadge = 'border-emerald-200 bg-white text-[#084b3e]';
                  let icon = <Banknote size={16} className="text-[#084b3e]" />;
                  let label = 'Cash';

                  if (acc.id === 'bkash') {
                    borderBadge = 'border-pink-200 bg-white text-[#e2136e]';
                    icon = <Smartphone size={16} className="text-[#e2136e]" />;
                    label = 'bKash';
                  } else if (acc.id === 'nagad') {
                    borderBadge = 'border-orange-200 bg-white text-[#d97706]';
                    icon = <Smartphone size={16} className="text-[#d97706]" />;
                    label = 'Nagad';
                  } else if (acc.id === 'rocket') {
                    borderBadge = 'border-purple-200 bg-white text-purple-700';
                    icon = <Smartphone size={16} className="text-purple-700" />;
                    label = 'Rocket';
                  }

                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setSelectedAccountOption(acc.id as any)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected 
                          ? 'ring-2 ring-[#084b3e] border-[#084b3e] bg-emerald-50/40 shadow-xs' 
                          : `${borderBadge} hover:border-gray-300 hover:shadow-xs`
                      }`}
                      title={`Select ${label}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        {icon}
                        <span className="text-xs font-bold text-gray-800 truncate">
                          {label}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-gray-400 block tracking-wider">
                          Balance
                        </span>
                        <span className="text-xs sm:text-sm font-black text-gray-900 truncate block">
                          Tk {(acc.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Balance Entry Form */}
            <form onSubmit={handleAddBalanceSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Account Dropdown (Cash, bKash, Nagad, Rocket) */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Select Account *
                  </label>
                  <select 
                    value={selectedAccountOption}
                    onChange={e => setSelectedAccountOption(e.target.value as any)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-[#084b3e] outline-none text-xs sm:text-sm font-bold text-gray-900 bg-white cursor-pointer"
                  >
                    <option value="cash">Cash</option>
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                    <option value="rocket">Rocket</option>
                  </select>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Amount to Add (Tk) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">Tk</span>
                    <input 
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      value={balanceAmount}
                      onChange={e => setBalanceAmount(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-xl focus:border-[#084b3e] outline-none text-xs sm:text-sm font-black text-gray-900 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Note / Description */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Note / Description (Optional)
                </label>
                <input 
                  type="text"
                  value={balanceNote}
                  onChange={e => setBalanceNote(e.target.value)}
                  placeholder="e.g. Cash drawer deposit, bank withdrawal"
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:border-[#084b3e] outline-none text-xs sm:text-sm font-medium bg-white"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-1">
                <button 
                  type="submit"
                  disabled={isSubmittingBalance}
                  className="w-full sm:w-auto px-6 py-2.5 bg-[#084b3e] text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-[#126b55] transition-colors flex items-center justify-center gap-1.5 uppercase tracking-wider shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Plus size={16} />
                  <span>{isSubmittingBalance ? 'Adding...' : 'Add Balance'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Second Row Grid: Profile, Security & Backup */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Cloud Account & User Profile Card (6 columns on lg) */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* Cloud Account & User Profile Card */}
          <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Cloud className="text-[#084b3e]" size={20} />
                <h2 className="text-base sm:text-lg font-black text-gray-900 uppercase tracking-wider">
                  Cloud Profile & Sync
                </h2>
              </div>
              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            {user ? (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-emerald-800">Store Name</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                      Active
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-gray-900 truncate">
                    {profile?.storeName || 'Al-Barakah Store'}
                  </h3>
                  <p className="text-xs text-gray-600 font-medium">
                    Phone: {profile?.phone || '017xxxxxxxx'}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                  <span>Last Cloud Backup:</span>
                  <span className="font-semibold text-gray-700">
                    {lastSynced ? format(new Date(lastSynced), 'dd/MM/yyyy hh:mm a') : 'Not synced yet'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      setIsSyncing(true);
                      const res = await triggerSync();
                      setIsSyncing(false);
                      if (res.success) {
                        setSuccessMsg('Cloud backup synced successfully!');
                        setTimeout(() => setSuccessMsg(''), 3000);
                      }
                    }}
                    disabled={isSyncing || !isOnline}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-[#084b3e] text-white rounded-xl text-xs font-bold shadow-sm hover:bg-[#0c5e4e] transition-all disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                    <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(true)}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 border border-gray-300 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 transition-colors"
                  >
                    <User size={14} />
                    <span>View Profile</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-gray-600 leading-relaxed">
                  Create an account with your store name, phone number, and password. Logging in from any device will instantly restore all your sales, expenses, and records from the cloud.
                </p>

                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 bg-[#084b3e] hover:bg-[#126b55] text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-sm text-xs sm:text-sm uppercase tracking-wider cursor-pointer"
                >
                  <LogIn size={16} />
                  <span>Login / Create Store Account</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Cyber Security & Backup (6 columns on lg) */}
        <div className="lg:col-span-6 space-y-6">

          {/* Cyber Security & Data Encryption Shield Card */}
          <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-emerald-600" size={20} />
                <h2 className="text-base sm:text-lg font-black text-gray-900 uppercase tracking-wider">
                  Cyber Security Shield
                </h2>
              </div>
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                ACTIVE
              </span>
            </div>

            <p className="text-xs text-gray-500 mb-4 font-medium leading-relaxed">
              Multi-layer enterprise security and cryptographic tamper-proofing protect all your sales, expenses, and transaction records against unauthorized access and cyber attacks:
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-2.5 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg shrink-0 mt-0.5">
                  <Lock size={13} />
                </div>
                <div>
                  <div className="font-bold text-gray-900">SHA-256 Cryptographic Hash</div>
                  <div className="text-[11px] text-gray-500">Every record is fingerprinted with a unique SHA-256 hash to prevent client-side or transit data tampering.</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg shrink-0 mt-0.5">
                  <Shield size={13} />
                </div>
                <div>
                  <div className="font-bold text-gray-900">Anti-XSS & Injection Protection</div>
                  <div className="text-[11px] text-gray-500">All input fields and payload records are automatically sanitized to neutralize malicious scripts and injection vectors.</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg shrink-0 mt-0.5">
                  <Check size={13} />
                </div>
                <div>
                  <div className="font-bold text-gray-900">Brute-Force & Rate Limiting</div>
                  <div className="text-[11px] text-gray-500">Repeated failed password attempts trigger automatic temporary account lockouts to prevent automated credential attacks.</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg shrink-0 mt-0.5">
                  <ShieldCheck size={13} />
                </div>
                <div>
                  <div className="font-bold text-gray-900">Owner-Isolated Cloud Rules</div>
                  <div className="text-[11px] text-gray-500">Enforced Firestore security rules guarantee that records can only ever be accessed or modified by their verified store owner.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6 border border-gray-100">
            <h2 className="text-lg font-black text-gray-900 mb-2 border-b border-gray-100 pb-3 uppercase tracking-wider">Backup & Restore</h2>
            <p className="text-xs text-gray-500 mb-5 font-medium leading-relaxed">
              All data is stored safely in IndexedDB on this device. Download regular backup files to keep your records protected.
            </p>
            <div className="space-y-3">
              <button 
                onClick={handleExport}
                className="w-full flex items-center justify-center space-x-2 bg-[#084b3e] hover:bg-[#126b55] text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-sm text-xs sm:text-sm uppercase tracking-wider cursor-pointer"
              >
                <Download size={18} />
                <span>Download Backup</span>
              </button>
              
              <div className="relative">
                <input 
                  type="file" 
                  accept=".json"
                  onChange={handleImport}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <button 
                  type="button"
                  className="w-full flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 px-4 rounded-xl transition-colors border border-gray-300 text-xs sm:text-sm uppercase tracking-wider"
                >
                  <Upload size={18} />
                  <span>Restore from File</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-4 sm:p-5 border border-gray-100">
            <div className="flex items-center gap-2 mb-2 text-gray-900 font-bold text-xs uppercase tracking-wider">
              <ShieldCheck size={18} />
              <span>Offline & Local Storage</span>
            </div>
            <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
              Al-Barakah Digital Manager operates 100% offline. All transactions and customer data remain safely on your device.
            </p>
          </div>

        </div>

      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div 
          className="fixed inset-0 bg-[#084b3e]/60 backdrop-blur-xs flex items-center justify-center z-[200] p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 transform transition-all animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-red-100 border border-red-200 text-red-600 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={28} />
              </div>
              
              <h3 className="text-lg font-black text-gray-900 mb-1">
                Delete Service
              </h3>
              
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Are you sure you want to remove this service from the presets? Existing records will remain intact.
              </p>

              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 mb-6 text-left">
                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">
                  {deleteTarget.type === 'sell' ? 'Sell Service' : 'Expense Service'}
                </div>
                <div className="text-sm font-black text-gray-900 break-words">
                  {deleteTarget.name}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold text-xs sm:text-sm hover:bg-gray-50 transition-colors uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 shadow-sm uppercase tracking-wider cursor-pointer"
                >
                  <Trash2 size={16} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {pendingRestoreFile && (
        <div 
          className="fixed inset-0 bg-[#084b3e]/60 backdrop-blur-xs flex items-center justify-center z-[200] p-4"
          onClick={() => setPendingRestoreFile(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 transform transition-all animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-amber-100 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={28} />
              </div>
              
              <h3 className="text-lg font-black text-gray-900 mb-1">
                Confirm Restore
              </h3>
              
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Warning: Restoring will merge the imported records into your current database. Existing entries with matching IDs will be updated. Continue?
              </p>

              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 mb-6 text-left text-xs font-bold text-gray-800 truncate">
                File: {pendingRestoreFile.name}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPendingRestoreFile(null)}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold text-xs sm:text-sm hover:bg-gray-50 uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRestore}
                  className="flex-1 px-4 py-3 rounded-xl bg-[#084b3e] hover:bg-[#126b55] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm uppercase tracking-wider cursor-pointer"
                >
                  <Upload size={16} />
                  <span>Restore</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auth & Sync Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}
