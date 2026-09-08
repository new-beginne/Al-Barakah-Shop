import React, { useState, useMemo } from 'react';
import { db, MfsTransaction, getRecordMetadata } from '../db/db';
import { setAccountBalance, adjustAccountBalance } from '../services/accountService';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  CheckCircle2, 
  Wallet, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Trash2, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  X, 
  Smartphone,
  Info,
  Sliders,
  Check
} from 'lucide-react';

const OPERATORS = ['bKash', 'Nagad', 'Rocket', 'Upay'] as const;
type OperatorType = typeof OPERATORS[number];

const TRANSACTION_TYPES = [
  { id: 'Cash-Out', label: 'Cash-Out', direction: 'out', desc: 'Wallet: -Amt -Charge | Cash: +Amt' },
  { id: 'Send Money (Out)', label: 'Send Money (Out)', direction: 'out', desc: 'Wallet: -Amt -Charge | Cash: +Amt' },
  { id: 'Send Money (In)', label: 'Send Money (In)', direction: 'in', desc: 'Wallet: +Amt -Charge | Cash: -Amt' },
  { id: 'Cash-In', label: 'Cash-In', direction: 'in', desc: 'Wallet: +Amt -Charge | Cash: -Amt' },
  { id: 'Recharge', label: 'Recharge', direction: 'out', desc: 'Wallet: -Amt -Charge | Cash: +Amt' },
] as const;

export function MfsLedger() {
  const [operator, setOperator] = useState<OperatorType>('bKash');
  const [type, setType] = useState<string>('Cash-Out');
  const [amount, setAmount] = useState('');
  const [charge, setCharge] = useState('');
  const [profit, setProfit] = useState('');
  const [recipientNumber, setRecipientNumber] = useState('');
  const [note, setNote] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // History table filter states
  const [historyOperatorFilter, setHistoryOperatorFilter] = useState<string>('all');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<MfsTransaction | null>(null);

  // Set / Adjust Balance modal state
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustOperator, setAdjustOperator] = useState<OperatorType>('bKash');
  const [adjustNewBalance, setAdjustNewBalance] = useState('');
  const [adjustNote, setAdjustNote] = useState('Manual Balance Correction');

  const allMfs = useLiveQuery(() => db.mfs.toArray()) || [];

  // Sort chronological for balance calculation, and descending for table display
  const sortedAscending = useMemo(() => {
    return [...allMfs].sort((a, b) => {
      const timeA = `${a.date} ${a.time || ''}`;
      const timeB = `${b.date} ${b.time || ''}`;
      return timeA.localeCompare(timeB) || (a.id || 0) - (b.id || 0);
    });
  }, [allMfs]);

  const sortedDescending = useMemo(() => {
    return [...sortedAscending].reverse();
  }, [sortedAscending]);

  // Current balance per operator
  const getBalance = (op: string) => {
    const txs = sortedAscending.filter(m => m.operator === op);
    return txs.length > 0 ? txs[txs.length - 1].balanceAfter : 0;
  };

  const balances: Record<OperatorType, number> = {
    bKash: getBalance('bKash'),
    Nagad: getBalance('Nagad'),
    Rocket: getBalance('Rocket'),
    Upay: getBalance('Upay'),
  };

  // Default charge suggestion when amount or type changes
  const handleAmountChange = (val: string) => {
    setAmount(val);
    const num = parseFloat(val) || 0;
    if (num > 0) {
      if (type === 'Cash-Out') {
        // Standard agent/customer cash out rate 18.50 per 1000
        const calculatedCharge = ((num / 1000) * 18.50).toFixed(2);
        setCharge(calculatedCharge);
        // Default agent commission ~4.10 tk per 1000
        const calcProfit = ((num / 1000) * 4.10).toFixed(2);
        setProfit(calcProfit);
      } else if (type === 'Send Money (Out)') {
        // bKash app send money charge is 5 tk for >25000 or custom fee
        setCharge('5');
        setProfit('5');
      } else {
        setCharge('0');
        setProfit('0');
      }
    } else {
      setCharge('');
      setProfit('');
    }
  };

  const handleTypeChange = (newType: string) => {
    setType(newType);
    const num = parseFloat(amount) || 0;
    if (num > 0) {
      if (newType === 'Cash-Out') {
        setCharge(((num / 1000) * 18.50).toFixed(2));
        setProfit(((num / 1000) * 4.10).toFixed(2));
      } else if (newType === 'Send Money (Out)') {
        setCharge('5');
        setProfit('5');
      } else {
        setCharge('0');
        setProfit('0');
      }
    }
  };

  // Calculations for preview
  const amtNum = parseFloat(amount) || 0;
  const chargeNum = parseFloat(charge) || 0;
  const profitNum = parseFloat(profit) || 0;
  const currentBal = balances[operator];

  // Mathematical logic according to user's exact specification:
  // "charge always amar balance komabe"
  // Cash-Out: Wallet decreases (-amt -charge), Cash increases (+amt)
  // Send Money (Out): Wallet decreases (-amt -charge), Cash increases (+amt)
  // Recharge: Wallet decreases (-amt -charge), Cash increases (+amt)
  // Send Money (In): Wallet increases (+amt -charge), Cash decreases (-amt)
  // Cash-In: Wallet increases (+amt -charge), Cash decreases (-amt)
  let walletDiff = 0;
  let cashDiff = 0;

  if (amtNum > 0) {
    if (type === 'Cash-Out' || type === 'Send Money (Out)' || type === 'Recharge') {
      walletDiff = - (amtNum + chargeNum);
      cashDiff = + amtNum;
    } else if (type === 'Send Money (In)' || type === 'Cash-In') {
      walletDiff = + amtNum - chargeNum;
      cashDiff = - amtNum;
    }
  }

  const previewNewBal = currentBal + walletDiff;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amtNum <= 0) return;

    const meta = getRecordMetadata();
    const finalBalanceAfter = currentBal + walletDiff;

    const tx: MfsTransaction = {
      date: meta.date,
      time: meta.time,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      operator,
      type,
      amount: amtNum,
      charge: chargeNum,
      profit: profitNum,
      balanceAfter: finalBalanceAfter,
      recipientNumber: recipientNumber.trim() || undefined,
      note: note.trim() || undefined,
    };

    await db.mfs.add(tx);

    // Sync account balances
    try {
      const opAccountId = operator.toLowerCase();
      await setAccountBalance(opAccountId, finalBalanceAfter);
      if (cashDiff !== 0) {
        await adjustAccountBalance('cash', cashDiff);
      }
    } catch (err) {
      console.error('Failed to update account balance in MFS:', err);
    }

    setSuccessMsg(`Transaction recorded: ${operator} ${type} of Tk ${amtNum.toLocaleString()} (Charge: Tk ${chargeNum})`);
    setAmount('');
    setCharge('');
    setProfit('');
    setRecipientNumber('');
    setNote('');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Save manual balance adjustment
  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const newBalNum = parseFloat(adjustNewBalance);
    if (isNaN(newBalNum)) return;

    const meta = getRecordMetadata();
    const currentOperatorBal = balances[adjustOperator];
    const diff = newBalNum - currentOperatorBal;

    const tx: MfsTransaction = {
      date: meta.date,
      time: meta.time,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      operator: adjustOperator,
      type: 'Balance-Adjust',
      amount: Math.abs(diff),
      charge: 0,
      profit: 0,
      balanceAfter: newBalNum,
      note: adjustNote || 'Manual Balance Calibration',
    };

    await db.mfs.add(tx);

    try {
      await setAccountBalance(adjustOperator.toLowerCase(), newBalNum, adjustNote || 'Manual Balance Calibration');
    } catch (err) {
      console.error('Failed to sync adjusted balance to accounts:', err);
    }

    setIsAdjustModalOpen(false);
    setSuccessMsg(`${adjustOperator} balance set to Tk ${newBalNum.toLocaleString()}`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Confirm delete transaction
  const handleConfirmDelete = async () => {
    if (!deleteTarget || !deleteTarget.id) return;
    await db.mfs.delete(deleteTarget.id);
    setDeleteTarget(null);
    setSuccessMsg('MFS Transaction removed.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Filtered transactions for the ledger table
  const filteredHistory = sortedDescending.filter(t => {
    if (historyOperatorFilter !== 'all' && t.operator !== historyOperatorFilter) return false;
    if (historyTypeFilter !== 'all' && t.type !== historyTypeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchOp = t.operator.toLowerCase().includes(q);
      const matchType = t.type.toLowerCase().includes(q);
      const matchNote = t.note?.toLowerCase().includes(q);
      const matchPhone = t.recipientNumber?.toLowerCase().includes(q);
      const matchAmt = t.amount.toString().includes(q);
      if (!matchOp && !matchType && !matchNote && !matchPhone && !matchAmt) return false;
    }
    return true;
  });

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto mb-16 md:mb-0 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              MFS Digital Wallet Ledger
            </h1>
            <span className="text-xs font-black bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full border border-gray-100">
              {allMfs.length}
            </span>
          </div>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            bKash, Nagad, Rocket & Upay Cash-Out, Send Money (In/Out) with exact charge deductions
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setAdjustOperator(operator);
            setAdjustNewBalance(balances[operator].toString());
            setIsAdjustModalOpen(true);
          }}
          className="flex items-center gap-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-3.5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-xs cursor-pointer"
        >
          <Sliders size={14} />
          <span>Set / Adjust Balance</span>
        </button>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center font-bold text-xs sm:text-sm tracking-wide animate-in fade-in duration-150">
          <CheckCircle2 className="mr-2 shrink-0 text-emerald-600" size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* OPERATOR BALANCE CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* bKash */}
        <div 
          onClick={() => setOperator('bKash')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
            operator === 'bKash'
              ? 'bg-[#e2136e]/5 border-[#e2136e] shadow-xs ring-1 ring-[#e2136e]/30'
              : 'bg-white border-gray-100 hover:border-gray-300'
          }`}
        >
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-black tracking-wider text-[#e2136e]">bKash (বিকাশ)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#e2136e]"></span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
            Tk {balances.bKash.toLocaleString()}
          </p>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100/80">
            <span className="text-[11px] text-gray-500 font-medium">Digital Balance</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAdjustOperator('bKash');
                setAdjustNewBalance(balances.bKash.toString());
                setIsAdjustModalOpen(true);
              }}
              className="text-[10px] font-bold text-gray-500 hover:text-gray-900 hover:underline"
            >
              Adjust
            </button>
          </div>
        </div>

        {/* Nagad */}
        <div 
          onClick={() => setOperator('Nagad')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
            operator === 'Nagad'
              ? 'bg-[#f7941d]/5 border-[#f7941d] shadow-xs ring-1 ring-[#f7941d]/30'
              : 'bg-white border-gray-100 hover:border-gray-300'
          }`}
        >
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-black tracking-wider text-[#f7941d]">Nagad (নগদ)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#f7941d]"></span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
            Tk {balances.Nagad.toLocaleString()}
          </p>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100/80">
            <span className="text-[11px] text-gray-500 font-medium">Digital Balance</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAdjustOperator('Nagad');
                setAdjustNewBalance(balances.Nagad.toString());
                setIsAdjustModalOpen(true);
              }}
              className="text-[10px] font-bold text-gray-500 hover:text-gray-900 hover:underline"
            >
              Adjust
            </button>
          </div>
        </div>

        {/* Rocket */}
        <div 
          onClick={() => setOperator('Rocket')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
            operator === 'Rocket'
              ? 'bg-[#8c3494]/5 border-[#8c3494] shadow-xs ring-1 ring-[#8c3494]/30'
              : 'bg-white border-gray-100 hover:border-gray-300'
          }`}
        >
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-black tracking-wider text-[#8c3494]">Rocket (রকেট)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#8c3494]"></span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
            Tk {balances.Rocket.toLocaleString()}
          </p>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100/80">
            <span className="text-[11px] text-gray-500 font-medium">Digital Balance</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAdjustOperator('Rocket');
                setAdjustNewBalance(balances.Rocket.toString());
                setIsAdjustModalOpen(true);
              }}
              className="text-[10px] font-bold text-gray-500 hover:text-gray-900 hover:underline"
            >
              Adjust
            </button>
          </div>
        </div>

        {/* Upay */}
        <div 
          onClick={() => setOperator('Upay')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
            operator === 'Upay'
              ? 'bg-[#00457c]/5 border-[#00457c] shadow-xs ring-1 ring-[#00457c]/30'
              : 'bg-white border-gray-100 hover:border-gray-300'
          }`}
        >
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-black tracking-wider text-[#00457c]">Upay (উপায়)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#00457c]"></span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
            Tk {balances.Upay.toLocaleString()}
          </p>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100/80">
            <span className="text-[11px] text-gray-500 font-medium">Digital Balance</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAdjustOperator('Upay');
                setAdjustNewBalance(balances.Upay.toString());
                setIsAdjustModalOpen(true);
              }}
              className="text-[10px] font-bold text-gray-500 hover:text-gray-900 hover:underline"
            >
              Adjust
            </button>
          </div>
        </div>
      </div>

      {/* NEW TRANSACTION FORM */}
      <div className="bg-white rounded-[24px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-5 sm:p-7">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#084b3e]/10 text-[#084b3e] flex items-center justify-center font-black">
              <Smartphone size={18} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-gray-900">New MFS Transaction</h2>
              <p className="text-[11px] text-gray-500 font-medium">
                Active Wallet: <span className="font-bold text-gray-800">{operator}</span> (Current Balance: Tk {currentBal.toLocaleString()})
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Operator Selector Pills */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-2">
              Select Operator
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {OPERATORS.map(op => {
                const isSelected = operator === op;
                let activeBorder = 'border-[#084b3e] bg-[#084b3e] text-white';
                if (op === 'bKash') activeBorder = 'border-[#e2136e] bg-[#e2136e] text-white shadow-xs';
                if (op === 'Nagad') activeBorder = 'border-[#f7941d] bg-[#f7941d] text-white shadow-xs';
                if (op === 'Rocket') activeBorder = 'border-[#8c3494] bg-[#8c3494] text-white shadow-xs';
                if (op === 'Upay') activeBorder = 'border-[#00457c] bg-[#00457c] text-white shadow-xs';

                return (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setOperator(op)}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      isSelected 
                        ? activeBorder 
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                    }`}
                  >
                    <span>{op}</span>
                    {isSelected && <Check size={14} strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Transaction Type Buttons */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-2">
              Transaction Type (লেনদেনের ধরণ)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {TRANSACTION_TYPES.map(t => {
                const isSelected = type === t.id;
                const isOut = t.direction === 'out';

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleTypeChange(t.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      isSelected
                        ? isOut
                          ? 'border-red-500 bg-red-50/70 text-red-950 ring-1 ring-red-300'
                          : 'border-emerald-600 bg-emerald-50/70 text-emerald-950 ring-1 ring-emerald-300'
                        : 'border-gray-200 bg-gray-50/60 hover:bg-gray-100/80 text-gray-700'
                    }`}
                  >
                    <div className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected 
                        ? isOut ? 'bg-red-500 text-white' : 'bg-emerald-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {isOut ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-xs sm:text-sm tracking-tight">{t.label}</div>
                      <div className="text-[10px] opacity-75 font-medium mt-0.5 leading-tight">{t.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount and Charge Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Amount */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[12px] font-bold text-gray-700">
                  Amount (Tk) <span className="text-red-500">*</span>
                </label>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">TK</span>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={amount}
                  onChange={e => handleAmountChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black text-gray-900 focus:bg-white focus:border-[#084b3e] focus:ring-1 focus:ring-[#084b3e] outline-none transition-all"
                />
              </div>

              {/* Quick Amount Presets */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[500, 1000, 2000, 5000, 10000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleAmountChange(amt.toString())}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                  >
                    Tk {amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Charge Field (Crucial User Requirement!) */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[12px] font-bold text-gray-700">
                  Charge (Tk)
                </label>
                <span className="text-[10px] font-medium text-red-600">
                  Always reduces {operator} balance
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-red-500">TK</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={charge}
                  onChange={e => setCharge(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-3 py-2.5 bg-red-50/40 border border-red-200 rounded-xl text-sm font-black text-red-700 focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                />
              </div>

              {/* Quick Charge Presets */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => setCharge('0')}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  Tk 0
                </button>
                <button
                  type="button"
                  onClick={() => setCharge('5')}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  Tk 5
                </button>
                <button
                  type="button"
                  onClick={() => setCharge('10')}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  Tk 10
                </button>
                {amtNum > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setCharge(((amtNum / 1000) * 14.90).toFixed(2))}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 hover:bg-red-200 text-red-800"
                      title="bKash App / Priyo Agent rate"
                    >
                      14.90/k
                    </button>
                    <button
                      type="button"
                      onClick={() => setCharge(((amtNum / 1000) * 18.50).toFixed(2))}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 hover:bg-red-200 text-red-800"
                      title="USSD Standard Rate"
                    >
                      18.50/k
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Profit / Commission */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[12px] font-bold text-gray-700">
                  Agent Profit / Fee (Tk)
                </label>
                <span className="text-[10px] font-medium text-emerald-600">
                  Shop commission
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-emerald-600">TK</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={profit}
                  onChange={e => setProfit(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-3 py-2.5 bg-emerald-50/40 border border-emerald-200 rounded-xl text-sm font-black text-emerald-800 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none transition-all"
                />
              </div>

              {/* Profit presets */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => setProfit('0')}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  Tk 0
                </button>
                <button
                  type="button"
                  onClick={() => setProfit('5')}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-800"
                >
                  Tk 5
                </button>
                <button
                  type="button"
                  onClick={() => setProfit('10')}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-800"
                >
                  Tk 10
                </button>
                {amtNum > 0 && (
                  <button
                    type="button"
                    onClick={() => setProfit(((amtNum / 1000) * 4.10).toFixed(2))}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-800"
                    title="Agent ~4.10 tk per 1000"
                  >
                    4.10/k
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Optional Phone Number & Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-[12px] font-bold text-gray-700 mb-1.5">
                Recipient / Customer Mobile No. (Optional)
              </label>
              <input
                type="tel"
                value={recipientNumber}
                onChange={e => setRecipientNumber(e.target.value)}
                placeholder="017xxxxxxxx"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:border-[#084b3e] outline-none"
              />
            </div>

            <div>
              <label className="block text-[12px] font-bold text-gray-700 mb-1.5">
                Transaction ID / Reference Note (Optional)
              </label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="e.g. TrxID 9H23K4..., Customer Name"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:border-[#084b3e] outline-none"
              />
            </div>
          </div>

          {/* LIVE IMPACT SUMMARY CARD */}
          {amtNum > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-600">
                <Info size={14} className="text-[#084b3e]" />
                <span>Live Transaction Impact Preview</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Wallet Balance Change */}
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                    {operator} Wallet Balance
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-sm font-bold text-gray-500 line-through">
                      Tk {currentBal.toLocaleString()}
                    </span>
                    <span className="text-base sm:text-lg font-black text-gray-900">
                      Tk {previewNewBal.toLocaleString()}
                    </span>
                  </div>
                  <p className={`text-[11px] font-bold mt-1 ${walletDiff < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {walletDiff < 0 ? '' : '+'}{walletDiff.toLocaleString()} Tk 
                    {chargeNum > 0 && ` (Incl. Tk ${chargeNum} charge)`}
                  </p>
                </div>

                {/* Cash Drawer Effect */}
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Physical Cash Drawer
                  </span>
                  <div className="text-base sm:text-lg font-black mt-1">
                    <span className={cashDiff >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                      {cashDiff >= 0 ? '+ Tk ' : '- Tk '}
                      {Math.abs(cashDiff).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-gray-500 mt-1">
                    {cashDiff >= 0 ? 'Cash received in shop' : 'Cash paid out from shop'}
                  </p>
                </div>

                {/* Profit Recorded */}
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Recorded Shop Profit
                  </span>
                  <div className="text-base sm:text-lg font-black text-emerald-700 mt-1">
                    + Tk {profitNum.toLocaleString()}
                  </div>
                  <p className="text-[11px] font-medium text-gray-500 mt-1">
                    Will reflect in today's profit
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={amtNum <= 0}
              className="w-full bg-[#084b3e] hover:bg-[#126b55] disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-[0_2px_8px_-2px_rgba(8,75,62,0.3)] flex items-center justify-center gap-2 cursor-pointer text-sm uppercase tracking-wider"
            >
              <CheckCircle2 size={18} />
              <span>Save {operator} Transaction</span>
            </button>
          </div>
        </form>
      </div>

      {/* TRANSACTION HISTORY TABLE */}
      <div className="bg-white rounded-[24px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
        {/* Table Filters Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
          <div>
            <h3 className="text-base font-black text-gray-900">MFS Transaction Ledger</h3>
            <p className="text-xs text-gray-500 font-medium">History of all digital transactions with charge details</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Operator Filter */}
            <select
              value={historyOperatorFilter}
              onChange={e => setHistoryOperatorFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none"
            >
              <option value="all">All Operators</option>
              {OPERATORS.map(op => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>

            {/* Type Filter */}
            <select
              value={historyTypeFilter}
              onChange={e => setHistoryTypeFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none"
            >
              <option value="all">All Types</option>
              {TRANSACTION_TYPES.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
              <option value="Balance-Adjust">Balance-Adjust</option>
            </select>

            {/* Search */}
            <div className="relative min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Search history..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none"
              />
            </div>
          </div>
        </div>

        {/* Transactions List */}
        {filteredHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 text-[10px] sm:text-xs font-black text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Operator</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Number / Note</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right text-red-600">Charge</th>
                  <th className="py-3 px-4 text-right text-emerald-700">Profit</th>
                  <th className="py-3 px-4 text-right">Balance After</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-medium">
                {filteredHistory.map(tx => {
                  let opBadge = 'bg-gray-100 text-gray-800';
                  if (tx.operator === 'bKash') opBadge = 'bg-[#e2136e]/10 text-[#e2136e] border border-[#e2136e]/20';
                  if (tx.operator === 'Nagad') opBadge = 'bg-[#f7941d]/10 text-[#f7941d] border border-[#f7941d]/20';
                  if (tx.operator === 'Rocket') opBadge = 'bg-[#8c3494]/10 text-[#8c3494] border border-[#8c3494]/20';
                  if (tx.operator === 'Upay') opBadge = 'bg-[#00457c]/10 text-[#00457c] border border-[#00457c]/20';

                  const isOut = tx.type === 'Cash-Out' || tx.type === 'Send Money (Out)' || tx.type === 'Recharge';

                  return (
                    <tr key={tx.id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Date & Time */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-gray-900">{tx.date}</div>
                        {tx.time && <div className="text-[10px] text-gray-400 font-mono">{tx.time}</div>}
                      </td>

                      {/* Operator */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider ${opBadge}`}>
                          {tx.operator}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          isOut ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                        }`}>
                          {isOut ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                          <span>{tx.type}</span>
                        </span>
                      </td>

                      {/* Number / Note */}
                      <td className="py-3 px-4 max-w-xs truncate">
                        {tx.recipientNumber && (
                          <div className="font-bold text-gray-900">{tx.recipientNumber}</div>
                        )}
                        {tx.note && (
                          <div className="text-[11px] text-gray-500 truncate">{tx.note}</div>
                        )}
                        {!tx.recipientNumber && !tx.note && (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-black text-gray-900 text-sm">
                        Tk {tx.amount.toLocaleString()}
                      </td>

                      {/* Charge */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-bold text-red-600">
                        {tx.charge > 0 ? `Tk ${tx.charge.toLocaleString()}` : 'Tk 0'}
                      </td>

                      {/* Profit */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-bold text-emerald-700">
                        {tx.profit > 0 ? `+Tk ${tx.profit.toLocaleString()}` : 'Tk 0'}
                      </td>

                      {/* Balance After */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-black text-gray-900">
                        Tk {(tx.balanceAfter || 0).toLocaleString()}
                      </td>

                      {/* Delete */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(tx)}
                          className="w-7 h-7 inline-flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Record"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-gray-400">
            <Smartphone size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm font-bold text-gray-600">No MFS records found</p>
            <p className="text-xs text-gray-400 mt-0.5">Use the form above to record your first transaction.</p>
          </div>
        )}
      </div>

      {/* ADJUST BALANCE MODAL */}
      {isAdjustModalOpen && (
        <div 
          className="fixed inset-0 bg-[#084b3e]/20 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
          onClick={() => setIsAdjustModalOpen(false)}
        >
          <div 
            className="bg-white rounded-[24px] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] w-full max-w-md overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-5 sm:p-6 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-800">
                  <Sliders size={16} />
                </div>
                <h2 className="text-base font-bold text-gray-900">
                  Adjust Wallet Balance
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-gray-700 mb-1.5">
                  Operator
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {OPERATORS.map(op => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => {
                        setAdjustOperator(op);
                        setAdjustNewBalance(balances[op].toString());
                      }}
                      className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all ${
                        adjustOperator === op
                          ? 'bg-[#084b3e] text-white border-[#084b3e]'
                          : 'bg-gray-50 text-gray-700 border-gray-200'
                      }`}
                    >
                      {op}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs">
                <span className="text-gray-500 font-medium">Current Calculated Balance:</span>
                <span className="font-black text-gray-900 ml-1.5">
                  Tk {balances[adjustOperator].toLocaleString()}
                </span>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-gray-700 mb-1.5">
                  Actual Current Balance (Tk) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">TK</span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={adjustNewBalance}
                    onChange={e => setAdjustNewBalance(e.target.value)}
                    placeholder="Enter current app balance"
                    className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black focus:bg-white focus:border-[#084b3e] outline-none"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-gray-700 mb-1.5">
                  Adjustment Reason / Note
                </label>
                <input
                  type="text"
                  value={adjustNote}
                  onChange={e => setAdjustNote(e.target.value)}
                  placeholder="e.g. Opening Balance, Daily Audit"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:border-[#084b3e] outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#084b3e] hover:bg-[#126b55] text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  Update Balance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div 
          className="fixed inset-0 bg-[#084b3e]/20 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div 
            className="bg-white rounded-[24px] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] w-full max-w-sm overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150 p-6 text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={26} strokeWidth={2.5} />
            </div>

            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Delete MFS Record?
            </h3>
            <p className="text-xs text-gray-500 mb-4 font-medium">
              Are you sure you want to remove this {deleteTarget.operator} {deleteTarget.type} record of Tk {deleteTarget.amount.toLocaleString()}?
            </p>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
