import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, MfsTransaction, getRecordMetadata } from '../db/db';
import { adjustAccountBalance, editBalanceWithLog } from '../services/accountService';
import { recordActivityLog, logMfsDelete } from '../services/activityLogService';
import {
  Smartphone,
  Trash2,
  Search,
  AlertTriangle,
  CheckCircle2,
  X,
  AlertCircle,
  FileText,
  Eye,
  Clock,
  User
} from 'lucide-react';

const OPERATORS = ['bKash', 'Nagad', 'Rocket'] as const;
type OperatorType = typeof OPERATORS[number];

const TRANSACTION_TYPES = [
  { id: 'Cash-Out', label: 'Cash-Out' },
  { id: 'Cash-In', label: 'Cash-In' },
  { id: 'Recharge', label: 'Recharge' },
  { id: 'Send Money', label: 'Send Money' },
] as const;

type CashoutPreset = 'rate_20' | 'rate_185' | 'rate_15' | 'custom';

export function MfsLedger() {
  // Modal states
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MfsTransaction | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<MfsTransaction | null>(null);

  // Form State
  const [operator, setOperator] = useState<OperatorType>('bKash');
  const [type, setType] = useState<string>('Cash-Out');
  const [cashoutPreset, setCashoutPreset] = useState<CashoutPreset>('rate_20');
  const [amount, setAmount] = useState('');
  const [charge, setCharge] = useState('');
  const [profit, setProfit] = useState('');
  const [recipientNumber, setRecipientNumber] = useState('');
  const [note, setNote] = useState('');

  // Notifications
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [historyOperatorFilter, setHistoryOperatorFilter] = useState<string>('all');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('all');

  // Adjust Balance Modal State
  const [adjustOperator, setAdjustOperator] = useState<OperatorType>('bKash');
  const [adjustNewBalance, setAdjustNewBalance] = useState('');
  const [adjustNote, setAdjustNote] = useState('Manual Balance Calibration');

  // Live queries: Read from both db.accounts and db.mfs
  const allAccounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const allMfs = useLiveQuery(() => db.mfs.toArray()) || [];
  const customers = useLiveQuery(() => db.customers.toArray()) || [];

  const formatDateStr = (dStr: string) => {
    if (!dStr) return '';
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
        const [y, m, d] = dStr.split('-');
        return `${d}/${m}/${y.slice(2)}`;
      }
      return dStr;
    } catch {
      return dStr;
    }
  };

  // Get true account balance from db.accounts
  const getOperatorBalance = (op: OperatorType): number => {
    const targetId = op.toLowerCase();
    const acc = allAccounts.find(a => a.id === targetId || a.name?.toLowerCase() === targetId);
    return acc ? (acc.balance || 0) : 0;
  };

  const cashInHandBalance = useMemo(() => {
    const cashAcc = allAccounts.find(a => a.id === 'cash');
    return cashAcc ? (cashAcc.balance || 0) : 0;
  }, [allAccounts]);

  const balances: Record<OperatorType, number> = useMemo(() => ({
    bKash: getOperatorBalance('bKash'),
    Nagad: getOperatorBalance('Nagad'),
    Rocket: getOperatorBalance('Rocket'),
  }), [allAccounts]);

  // Rate calculation
  const calculateRates = (
    currentType: string,
    _currentOp: OperatorType,
    val: string,
    preset: CashoutPreset
  ): { calculatedCharge: string; calculatedProfit: string } => {
    const num = parseFloat(val) || 0;
    if (num <= 0) return { calculatedCharge: '', calculatedProfit: '0.00' };

    if (currentType === 'Cash-Out') {
      let rate = 20.0;
      if (preset === 'rate_20') rate = 20.0;
      else if (preset === 'rate_185') rate = 18.50;
      else if (preset === 'rate_15') rate = 15.00;
      else if (preset === 'custom') {
        return { calculatedCharge: charge, calculatedProfit: charge || '0.00' };
      }

      const calculated = ((num / 1000) * rate).toFixed(2);
      // For Cash-Out, charge is agent's profit
      return { calculatedCharge: calculated, calculatedProfit: calculated };
    }

    // For Cash-In, Recharge, Send Money: no auto profit (profit = 0.00)
    // Any charge entered will be deducted from the user's wallet account
    return { calculatedCharge: charge || '0.00', calculatedProfit: '0.00' };
  };

  const handleAmountChange = (val: string) => {
    setAmount(val);
    const { calculatedCharge, calculatedProfit } = calculateRates(type, operator, val, cashoutPreset);
    setCharge(calculatedCharge);
    setProfit(calculatedProfit);
  };

  const handleChargeChange = (val: string) => {
    setCharge(val);
    if (type === 'Cash-Out') {
      setProfit(val);
    }
  };

  const handleTypeSelect = (newType: string) => {
    setType(newType);
    if (newType === 'Cash-Out') {
      const { calculatedCharge, calculatedProfit } = calculateRates(newType, operator, amount, cashoutPreset);
      setCharge(calculatedCharge);
      setProfit(calculatedProfit);
    } else {
      // Cash-In, Recharge, Send Money: no profit, default charge 0.00
      setCharge('0.00');
      setProfit('0.00');
    }
  };

  const handleOperatorSelect = (newOp: OperatorType) => {
    setOperator(newOp);
    const { calculatedCharge, calculatedProfit } = calculateRates(type, newOp, amount, cashoutPreset);
    setCharge(calculatedCharge);
    setProfit(calculatedProfit);
  };

  const handleCashoutPresetSelect = (preset: CashoutPreset) => {
    setCashoutPreset(preset);
    if (preset !== 'custom' && type === 'Cash-Out') {
      const { calculatedCharge, calculatedProfit } = calculateRates(type, operator, amount, preset);
      setCharge(calculatedCharge);
      setProfit(calculatedProfit);
    }
  };

  const resetForm = () => {
    setAmount('');
    setCharge('');
    setProfit('');
    setRecipientNumber('');
    setNote('');
  };

  const parsedAmt = parseFloat(amount) || 0;
  const parsedChg = parseFloat(charge) || 0;
  const parsedPrf = parseFloat(profit) || 0;

  const { walletChange, cashChange, effectDescription } = useMemo(() => {
    if (parsedAmt <= 0) {
      if (type === 'Cash-Out') {
        return { walletChange: 0, cashChange: 0, effectDescription: 'Cash decreases • Wallet increases' };
      }
      return { walletChange: 0, cashChange: 0, effectDescription: 'Cash increases • Wallet decreases' };
    }

    if (type === 'Cash-Out') {
      return { 
        walletChange: parsedAmt, 
        cashChange: -parsedAmt,
        effectDescription: 'Cash decreases • Wallet increases'
      };
    }

    // For Cash-In, Recharge, Send Money:
    // Any charge entered is cut from the wallet account: -(amount + charge)
    // Cash drawer receives +amount
    return { 
      walletChange: -(parsedAmt + parsedChg), 
      cashChange: parsedAmt,
      effectDescription: 'Cash increases • Wallet decreases'
    };
  }, [type, parsedAmt, parsedChg]);

  const sortedDescending = useMemo(() => {
    return [...allMfs].sort((a, b) => {
      const timeA = `${a.date} ${a.time || ''}`;
      const timeB = `${b.date} ${b.time || ''}`;
      return timeB.localeCompare(timeA) || (b.id || 0) - (a.id || 0);
    });
  }, [allMfs]);

  const displayHistory = useMemo(() => {
    return sortedDescending.filter(tx => {
      const matchesSearch = 
        (tx.recipientNumber && tx.recipientNumber.includes(searchQuery)) || 
        (tx.note && tx.note.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (tx.operator && tx.operator.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesOp = historyOperatorFilter === 'all' || tx.operator === historyOperatorFilter;
      const matchesType = historyTypeFilter === 'all' || tx.type === historyTypeFilter;
      return matchesSearch && matchesOp && matchesType;
    });
  }, [sortedDescending, searchQuery, historyOperatorFilter, historyTypeFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmt <= 0) {
      setErrorMsg('Please enter a valid amount greater than 0.');
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }

    const currentWalletBal = getOperatorBalance(operator);
    const newWalletBalance = currentWalletBal + walletChange;
    const meta = getRecordMetadata();
    const finalProfit = type === 'Cash-Out' ? parsedChg : parsedPrf;

    try {
      await db.transaction('rw', db.mfs, db.accounts, db.balanceLogs, db.activityLogs, async () => {
        const mfsId = await db.mfs.add({
          date: meta.date,
          time: meta.time,
          createdAt: meta.createdAt,
          updatedAt: meta.updatedAt,
          operator,
          type,
          amount: parsedAmt,
          charge: parsedChg,
          profit: finalProfit,
          balanceAfter: newWalletBalance,
          recipientNumber: recipientNumber.trim() || undefined,
          note: note.trim() || undefined
        });

        await adjustAccountBalance(operator.toLowerCase(), walletChange);

        if (cashChange !== 0) {
          await adjustAccountBalance('cash', cashChange);
        }

        await recordActivityLog({
          action: 'CREATE',
          module: 'MFS',
          entityId: Number(mfsId),
          title: `New MFS: ${operator} ${type} (Tk ${parsedAmt.toLocaleString()})`,
          details: `Recipient: ${recipientNumber.trim() || 'N/A'} • Charge: Tk ${parsedChg} • Profit: Tk ${finalProfit} • Wallet: ${walletChange >= 0 ? `+${walletChange}` : walletChange} • Cash: ${cashChange >= 0 ? `+${cashChange}` : cashChange}`,
          meta: { operator, type, amount: parsedAmt, charge: parsedChg, profit: finalProfit, walletChange, cashChange }
        });
      });

      setSuccessMsg(`Transaction of Tk ${parsedAmt.toLocaleString()} saved successfully.`);
      setTimeout(() => setSuccessMsg(''), 4000);

      resetForm();
    } catch (err) {
      console.error('Failed to save MFS transaction:', err);
      setErrorMsg('Failed to save transaction. Please try again.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const newBal = parseFloat(adjustNewBalance);
    if (isNaN(newBal) || newBal < 0) {
      setErrorMsg('Please enter a valid balance (0 or higher).');
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }
    
    const currentBal = getOperatorBalance(adjustOperator);
    const diff = newBal - currentBal;
    if (diff === 0) {
      setIsAdjustModalOpen(false);
      return;
    }

    const meta = getRecordMetadata();
    try {
      await db.transaction('rw', db.mfs, db.accounts, db.balanceLogs, db.activityLogs, async () => {
        await editBalanceWithLog(adjustOperator.toLowerCase(), newBal, adjustNote);

        const mfsId = await db.mfs.add({
          date: meta.date,
          time: meta.time,
          createdAt: meta.createdAt,
          updatedAt: meta.updatedAt,
          operator: adjustOperator,
          type: 'Adjustment',
          amount: Math.abs(diff),
          charge: 0,
          profit: 0,
          balanceAfter: newBal,
          note: adjustNote
        });

        await recordActivityLog({
          action: 'EDIT',
          module: 'MFS',
          entityId: Number(mfsId),
          title: `Adjusted ${adjustOperator} Balance to Tk ${newBal.toLocaleString()}`,
          details: `Previous: Tk ${currentBal.toLocaleString()} • Diff: ${diff >= 0 ? `+${diff}` : diff} • Reason: ${adjustNote}`,
          meta: { operator: adjustOperator, previousBalance: currentBal, newBalance: newBal, diff }
        });
      });

      setSuccessMsg(`${adjustOperator} balance updated to Tk ${newBal.toLocaleString()}`);
      setTimeout(() => setSuccessMsg(''), 4000);
      setIsAdjustModalOpen(false);
    } catch (err) {
      console.error('Failed to calibrate MFS balance:', err);
      setErrorMsg('Failed to adjust balance.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !deleteTarget.id) return;
    const { id, operator: delOp, amount: delAmt, charge: delChg, type: delType } = deleteTarget;

    let reverseWalletDelta = 0;
    let reverseCashDelta = 0;

    if (delType === 'Cash-Out') {
      reverseWalletDelta = -delAmt;
      reverseCashDelta = delAmt;
    } else {
      // Cash-In, Recharge, Send Money:
      // Originally: wallet = -(delAmt + delChg), cash = +delAmt
      reverseWalletDelta = delAmt + (delChg || 0);
      reverseCashDelta = -delAmt;
    }

    try {
      await db.transaction('rw', db.mfs, db.accounts, db.balanceLogs, db.activityLogs, async () => {
        await db.mfs.delete(id);

        if (reverseWalletDelta !== 0) {
          await adjustAccountBalance(delOp.toLowerCase(), reverseWalletDelta);
        }
        if (reverseCashDelta !== 0) {
          await adjustAccountBalance('cash', reverseCashDelta);
        }

        await logMfsDelete(deleteTarget);
      });

      setSuccessMsg(`Deleted transaction and reverted balances successfully.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Failed to delete MFS transaction:', err);
      setErrorMsg('Failed to delete transaction.');
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setDeleteTarget(null);
    }
  };

  const openAdjustFor = (op: OperatorType, e: React.MouseEvent) => {
    e.stopPropagation();
    setAdjustOperator(op);
    setAdjustNewBalance(balances[op].toString());
    setIsAdjustModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-[#084b3e] rounded-2xl flex items-center gap-2.5 text-sm font-semibold shadow-xs">
          <CheckCircle2 size={18} className="text-[#084b3e] shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center gap-2.5 text-sm font-semibold shadow-xs">
          <AlertCircle size={18} className="text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* MAIN NEW MFS ENTRY CARD (Matching User Provided Design Exactly) */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8 space-y-6">
        
        {/* Card Header */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-[#084b3e] rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xs">
            <Smartphone size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">New MFS Entry</h1>
            <p className="text-xs sm:text-sm text-gray-500 font-medium">Record mobile financial services quickly</p>
          </div>
        </div>

        {/* Operator Balances Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {OPERATORS.map(op => {
            const isSelected = operator === op;
            const bal = balances[op];
            return (
              <div
                key={op}
                onClick={() => handleOperatorSelect(op)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                  isSelected
                    ? 'bg-white border-[#084b3e] ring-2 ring-[#084b3e]/20 shadow-xs'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      op === 'bKash' ? 'bg-pink-600' :
                      op === 'Nagad' ? 'bg-orange-500' :
                      'bg-purple-600'
                    }`} />
                    <span className={`text-sm font-extrabold ${
                      op === 'bKash' ? 'text-pink-600' :
                      op === 'Nagad' ? 'text-orange-500' :
                      'text-purple-700'
                    }`}>
                      {op}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => openAdjustFor(op, e)}
                    className="text-[11px] text-gray-400 hover:text-gray-700 underline font-medium cursor-pointer"
                  >
                    Adjust
                  </button>
                </div>
                <div className="text-xl font-black text-gray-900">
                  Tk {bal.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>

        {/* TRANSACTION TYPE Section */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
            TRANSACTION TYPE
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {TRANSACTION_TYPES.map(t => {
              const isSelected = type === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTypeSelect(t.id)}
                  className={`py-3 px-4 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#084b3e] text-white border-[#084b3e] shadow-xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center border ${
                    isSelected ? 'border-white bg-[#084b3e]' : 'border-gray-300 bg-white'
                  }`}>
                    {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                  </span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Account Effect Indicator Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-500">Account Effect:</span>
              <span className={`px-2.5 py-1 rounded-md font-bold text-xs ${
                cashChange <= 0 
                  ? 'bg-rose-50 text-rose-600 border border-rose-200' 
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                Cash: {cashChange >= 0 ? `+${cashChange}` : cashChange} Tk
              </span>
              <span className={`px-2.5 py-1 rounded-md font-bold text-xs ${
                walletChange >= 0 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-rose-50 text-rose-600 border border-rose-200'
              }`}>
                {operator} Wallet: {walletChange >= 0 ? `+${walletChange}` : walletChange} Tk
              </span>
            </div>
            <div className="text-gray-400 font-medium text-xs">
              {effectDescription}
            </div>
          </div>
        </div>

        {/* TRANSACTION DETAILS Gray Inner Box */}
        <div className="bg-gray-50/70 border border-gray-200/80 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wider">
            <FileText size={16} className="text-gray-500" />
            <span>TRANSACTION DETAILS</span>
          </div>

          {/* Number Field */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
              NUMBER (OPTIONAL)
            </label>
            <input
              type="tel"
              placeholder="e.g. 017XXXXXXXX"
              value={recipientNumber}
              onChange={(e) => setRecipientNumber(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-900 outline-none focus:border-[#084b3e]"
            />
          </div>

          {/* Amount, Charge, Profit 3-Column Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                AMOUNT (TK) *
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="TK 0.00"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-[#084b3e]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                  CHARGE (TK)
                </label>
                {type === 'Cash-Out' && (
                  <div className="flex items-center gap-1">
                    {[
                      { id: 'rate_20', label: '20' },
                      { id: 'rate_185', label: '18.5' },
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleCashoutPresetSelect(p.id as CashoutPreset)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${
                          cashoutPreset === p.id
                            ? 'bg-[#084b3e] text-white border-[#084b3e]'
                            : 'bg-white text-gray-500 border-gray-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={charge}
                onChange={(e) => handleChargeChange(e.target.value)}
                className="w-full px-4 py-3 bg-rose-50/50 border border-rose-200/80 rounded-xl text-sm font-bold text-rose-700 outline-none focus:border-rose-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                PROFIT (TK)
              </label>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={profit}
                onChange={(e) => setProfit(e.target.value)}
                className="w-full px-4 py-3 bg-emerald-50/50 border border-emerald-200/80 rounded-xl text-sm font-bold text-emerald-800 outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          {/* Note Field */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
              NOTE (OPTIONAL)
            </label>
            <input
              type="text"
              placeholder="Any remarks..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-900 outline-none focus:border-[#084b3e]"
            />
          </div>
        </div>

        {/* Save Record Button at bottom right */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            className="w-full sm:w-auto bg-[#084b3e] hover:bg-[#0c5e4e] text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-colors text-sm cursor-pointer"
          >
            <CheckCircle2 size={18} />
            <span>Save Record</span>
          </button>
        </div>
      </div>

      {/* TRANSACTIONS HISTORY & FILTER SECTION */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by recipient phone, note, or operator..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none transition-all shadow-xs font-medium text-xs sm:text-sm"
            />
          </div>
          <select
            value={historyOperatorFilter}
            onChange={(e) => setHistoryOperatorFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 outline-none shadow-xs cursor-pointer text-xs sm:text-sm"
          >
            <option value="all">All Operators</option>
            {OPERATORS.map(op => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
          <select
            value={historyTypeFilter}
            onChange={(e) => setHistoryTypeFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 outline-none shadow-xs cursor-pointer text-xs sm:text-sm"
          >
            <option value="all">All Types</option>
            <option value="Cash-Out">Cash-Out</option>
            <option value="Cash-In">Cash-In</option>
            <option value="Recharge">Recharge</option>
            <option value="Send Money">Send Money</option>
            <option value="Adjustment">Adjustment</option>
          </select>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-gray-900 tracking-tight">Recent Transactions</h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {displayHistory.length}
              </span>
            </div>
            <span className="text-[11px] text-gray-400 font-medium hidden sm:inline">
              Click any row to view full details
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50/80 text-gray-500 font-bold text-xs uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="py-4 px-4">Transaction / Service</th>
                  <th className="py-4 px-4">Date & Time</th>
                  <th className="py-4 px-4">Type & Method</th>
                  <th className="py-4 px-4 text-right">Amount</th>
                  <th className="py-4 px-4 text-right">Profit / Net</th>
                  <th className="py-4 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <FileText size={32} className="mx-auto text-gray-300 mb-3" />
                      <h3 className="text-base font-bold text-gray-900 mb-1">No transactions found</h3>
                      <p className="text-sm text-gray-500">Try adjusting your filters or record a new transaction above.</p>
                    </td>
                  </tr>
                ) : (
                  displayHistory.map((tx) => {
                    const isCashOut = tx.type === 'Cash-Out';
                    const isCashIn = tx.type === 'Cash-In';

                    return (
                      <tr 
                        key={tx.id} 
                        onClick={() => setSelectedTransaction(tx)}
                        className="hover:bg-gray-50/50 transition-colors cursor-pointer group"
                      >
                        {/* Transaction / Service info */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                              tx.operator === 'bKash' ? 'bg-pink-50 text-pink-600' :
                              tx.operator === 'Nagad' ? 'bg-orange-50 text-orange-600' :
                              'bg-purple-50 text-purple-600'
                            }`}>
                              <Smartphone size={16} />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-gray-900 group-hover:text-[#084b3e] transition-colors">
                                {tx.operator} {tx.type}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                                {tx.recipientNumber && (
                                  <span className="font-semibold text-gray-600 font-mono">
                                    {tx.recipientNumber}
                                  </span>
                                )}
                                <span>• Bal: Tk {(tx.balanceAfter || 0).toLocaleString()}</span>
                                {tx.note && <span className="max-w-[120px] truncate" title={tx.note}>• {tx.note}</span>}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Date & Time */}
                        <td className="py-4 px-4 text-gray-600 font-medium">
                          <div className="font-bold text-gray-900">
                            {formatDateStr(tx.date)}
                          </div>
                          {tx.time && (
                            <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                              <Clock size={12} /> {tx.time}
                            </div>
                          )}
                        </td>

                        {/* Type & Method */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                              isCashOut ? 'bg-emerald-100 text-emerald-800' :
                              isCashIn ? 'bg-sky-100 text-sky-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {tx.type}
                            </span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              tx.operator === 'bKash' ? 'bg-pink-100 text-pink-700' :
                              tx.operator === 'Nagad' ? 'bg-orange-100 text-orange-700' :
                              'bg-purple-100 text-purple-700'
                            }`}>
                              {tx.operator}
                            </span>
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="py-4 px-4 text-right">
                          <div className="font-black text-base text-gray-900">
                            Tk {tx.amount.toLocaleString()}
                          </div>
                        </td>

                        {/* Profit / Net */}
                        <td className="py-4 px-4 text-right">
                          <div className="font-black text-sm text-emerald-600">
                            +Tk {(tx.profit || 0).toLocaleString()}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedTransaction(tx)}
                              className="p-1.5 text-gray-400 hover:text-[#084b3e] rounded-lg hover:bg-emerald-50 transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer"
                              title="View Details"
                            >
                              <Eye size={16} />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(tx)}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Transaction"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Grand Total Footer */}
              {displayHistory.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50/80 font-black text-xs text-gray-900 border-t-2 border-gray-200">
                    <td colSpan={3} className="py-4 px-4 uppercase tracking-wider">
                      Total ({displayHistory.length} transactions)
                    </td>
                    <td className="py-4 px-4 text-right text-base text-gray-900 font-mono">
                      Tk {displayHistory.reduce((sum, i) => sum + (i.amount || 0), 0).toLocaleString()}
                    </td>
                    <td className="py-4 px-4 text-right text-base text-emerald-600 font-mono">
                      +Tk {displayHistory.reduce((sum, i) => sum + (i.profit || 0), 0).toLocaleString()}
                    </td>
                    <td className="py-4 px-4"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Adjust Balance Modal */}
      {isAdjustModalOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
          onClick={() => setIsAdjustModalOpen(false)}
        >
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
              <h3 className="font-black text-lg text-gray-900">
                Adjust {adjustOperator} Balance
              </h3>
              <button 
                type="button"
                onClick={() => setIsAdjustModalOpen(false)} 
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSaveAdjustment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                  Operator
                </label>
                <select
                  value={adjustOperator}
                  onChange={(e) => {
                    const newOp = e.target.value as OperatorType;
                    setAdjustOperator(newOp);
                    setAdjustNewBalance(balances[newOp].toString());
                  }}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-[#084b3e]"
                >
                  {OPERATORS.map(op => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                  New Exact Balance (Tk)
                </label>
                <input 
                  type="number" 
                  step="any" 
                  required 
                  value={adjustNewBalance} 
                  onChange={e => setAdjustNewBalance(e.target.value)} 
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-black outline-none font-mono focus:border-[#084b3e]" 
                  autoFocus 
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Current recorded balance: Tk {balances[adjustOperator].toLocaleString()}
                </span>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                  Reason for Adjustment
                </label>
                <input 
                  type="text" 
                  value={adjustNote} 
                  onChange={e => setAdjustNote(e.target.value)} 
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-[#084b3e]" 
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="flex-1 py-2.5 text-xs font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-[#084b3e] text-white font-bold py-2.5 rounded-xl hover:bg-[#0c5e4e] transition-colors shadow-sm cursor-pointer text-xs"
                >
                  Update Balance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div 
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
          onClick={() => setDeleteTarget(null)}
        >
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 text-center shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 border border-rose-100">
              <AlertTriangle size={24} strokeWidth={2.5} />
            </div>
            <h3 className="font-black text-lg text-gray-900 mb-1">Delete Transaction?</h3>
            <p className="text-xs text-gray-500 mb-4 font-medium">
              This will delete the {deleteTarget.operator} {deleteTarget.type} transaction of <span className="font-black text-gray-900 font-mono">Tk {deleteTarget.amount.toLocaleString()}</span> and automatically revert account balances.
            </p>
            <div className="flex gap-2.5">
              <button 
                type="button"
                onClick={() => setDeleteTarget(null)} 
                className="flex-1 py-2.5 font-bold text-xs text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleConfirmDelete} 
                className="flex-1 py-2.5 font-bold text-xs text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-colors shadow-sm cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Details Modal (Matching main Reports tab transaction modal) */}
      {selectedTransaction && (() => {
        const tx = selectedTransaction;
        const recipientPhone = tx.recipientNumber?.trim() || '';
        const matchedCustomer = recipientPhone
          ? customers.find(c => c.phone?.trim() === recipientPhone || (c.name && recipientPhone.toLowerCase() === c.name.toLowerCase().trim()))
          : null;

        const customerName = matchedCustomer?.name || (recipientPhone ? 'Recipient' : '');

        return (
          <div 
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
            onClick={() => setSelectedTransaction(null)}
          >
            <div 
              className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-4 border-b border-gray-100 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      MFS RECORD
                    </span>
                    <span className="text-xs text-gray-400 font-bold">#{tx.id}</span>
                  </div>
                  <h3 className="text-xl font-black text-gray-900">
                    {tx.operator} ({tx.type})
                  </h3>
                </div>
                <button 
                  type="button"
                  onClick={() => setSelectedTransaction(null)} 
                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Customer / Recipient Banner if Available */}
              {(customerName || recipientPhone) && (
                <div className="bg-gray-50 rounded-xl p-3.5 mb-4 border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#084b3e] flex items-center justify-center font-bold">
                      <User size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">{customerName || recipientPhone}</p>
                      {recipientPhone && (
                        <p className="text-[11px] text-gray-500 font-mono">{recipientPhone}</p>
                      )}
                    </div>
                  </div>
                  {matchedCustomer ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      Registered
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      Recipient
                    </span>
                  )}
                </div>
              )}

              {/* Key Financial Cards */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 text-center">
                  <span className="text-[11px] font-bold text-gray-400 uppercase block">Amount</span>
                  <span className="text-xl font-black text-gray-900 mt-0.5 block font-mono">
                    Tk {tx.amount?.toLocaleString()}
                  </span>
                </div>
                <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-100 text-center">
                  <span className="text-[11px] font-bold text-emerald-700 uppercase block">Profit</span>
                  <span className={`text-xl font-black mt-0.5 block font-mono ${(tx.profit || 0) >= 0 ? 'text-[#084b3e]' : 'text-rose-600'}`}>
                    {(tx.profit || 0) >= 0 ? '+Tk ' : '-Tk '}{Math.abs(tx.profit || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Details List (Matching Reports Tab Card) */}
              <div className="space-y-2.5 text-xs text-gray-600 mb-6 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="font-bold text-gray-400 uppercase">Date & Time</span>
                  <span className="font-extrabold text-gray-900 font-mono">
                    {formatDateStr(tx.date)} {tx.time ? `• ${tx.time}` : ''}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="font-bold text-gray-400 uppercase">Operator</span>
                  <span className="font-extrabold text-gray-900">{tx.operator}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="font-bold text-gray-400 uppercase">Type</span>
                  <span className="font-extrabold text-gray-900">{tx.type}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="font-bold text-gray-400 uppercase">Charge / Fee</span>
                  <span className="font-extrabold text-gray-900 font-mono">Tk {tx.charge || 0}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="font-bold text-gray-400 uppercase">Wallet Balance After</span>
                  <span className="font-extrabold text-[#084b3e] font-mono">
                    Tk {(tx.balanceAfter || 0).toLocaleString()}
                  </span>
                </div>

                {tx.note && (
                  <div className="flex justify-between py-1">
                    <span className="font-bold text-gray-400 uppercase">Note</span>
                    <span className="font-extrabold text-gray-900 max-w-[200px] text-right truncate">
                      {tx.note}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = tx;
                    setSelectedTransaction(null);
                    setDeleteTarget(target);
                  }}
                  className="p-3 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Delete transaction"
                >
                  <Trash2 size={18} />
                </button>
                <button 
                  type="button"
                  onClick={() => setSelectedTransaction(null)} 
                  className="flex-1 bg-[#084b3e] hover:bg-[#0c5e4e] text-white font-bold py-3 rounded-xl transition-colors shadow-sm cursor-pointer text-center"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
