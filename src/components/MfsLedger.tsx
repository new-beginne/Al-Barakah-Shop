import React, { useState, useMemo } from 'react';
import { db, MfsTransaction, getRecordMetadata } from '../db/db';
import { setAccountBalance, adjustAccountBalance } from '../services/accountService';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatDateStr } from '../utils/dateFormatter';
import { 
  CheckCircle2, 
  Wallet, 
  Trash2, 
  Search, 
  AlertTriangle, 
  X, 
  Smartphone,
  Sliders,
  ArrowDownLeft,
  ArrowUpRight,
  Circle,
  FileText
} from 'lucide-react';

const OPERATORS = ['bKash', 'Nagad', 'Rocket', 'Upay'] as const;
type OperatorType = typeof OPERATORS[number];

const TRANSACTION_TYPES = [
  { id: 'Cash-Out', label: 'Cash-Out' },
  { id: 'Cash-In', label: 'Cash-In' },
  { id: 'Recharge', label: 'Recharge' },
  { id: 'Send Money', label: 'Send Money' },
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
  const [searchQuery, setSearchQuery] = useState('');
  const [historyOperatorFilter, setHistoryOperatorFilter] = useState<string>('all');
  
  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<MfsTransaction | null>(null);

  // Set / Adjust Balance modal state
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustOperator, setAdjustOperator] = useState<OperatorType>('bKash');
  const [adjustNewBalance, setAdjustNewBalance] = useState('');
  const [adjustNote, setAdjustNote] = useState('Manual Balance Correction');

  const allMfs = useLiveQuery(() => db.mfs.toArray()) || [];

  // Sort chronological for balance calculation
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

  const displayHistory = useMemo(() => {
    return sortedDescending.filter(tx => {
      const matchesSearch = tx.recipientNumber?.includes(searchQuery) || tx.note?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesOp = historyOperatorFilter === 'all' || tx.operator === historyOperatorFilter;
      return matchesSearch && matchesOp;
    }).slice(0, 50);
  }, [sortedDescending, searchQuery, historyOperatorFilter]);

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

  const handleAmountChange = (val: string) => {
    setAmount(val);
    const num = parseFloat(val) || 0;
    if (num > 0) {
      if (type === 'Cash-Out') {
        setCharge(((num / 1000) * 18.50).toFixed(2));
        setProfit(((num / 1000) * 4.10).toFixed(2));
      } else if (type === 'Send Money') {
        setCharge('5');
        setProfit('5');
      } else if (type === 'Cash-In') {
        setCharge('0');
        setProfit(((num / 1000) * 4.10).toFixed(2));
      } else if (type === 'Recharge') {
        setCharge('0');
        setProfit(((num / 1000) * 27.0).toFixed(2)); // typical ~27tk per 1000
      } else {
        setCharge('0');
        setProfit('0');
      }
    } else {
      setCharge('');
      setProfit('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const meta = getRecordMetadata();
    const amt = parseFloat(amount) || 0;
    const chg = parseFloat(charge) || 0;
    const prf = parseFloat(profit) || 0;

    if (amt <= 0) return;

    let walletChange = 0;
    let cashChange = 0;

    if (type === 'Cash-Out') {
      // Cash-Out: Cash in hand decreases (customer receives cash), MFS wallet balance increases
      walletChange = amt;
      cashChange = -amt;
    } else if (type === 'Cash-In') {
      // Cash-In: Cash in hand increases (customer pays cash), MFS wallet balance decreases
      walletChange = -amt;
      cashChange = amt;
    } else if (type === 'Recharge') {
      // Recharge: Cash in hand increases (customer pays cash), MFS wallet balance decreases
      walletChange = -amt;
      cashChange = amt;
    } else if (type === 'Send Money') {
      // Send Money: Cash in hand increases (customer pays amount + charge), MFS wallet balance decreases
      walletChange = -amt;
      cashChange = amt + chg;
    }

    const newBalance = balances[operator] + walletChange;

    await db.transaction('rw', db.mfs, db.accounts, db.balanceLogs, async () => {
      await db.mfs.add({
        date: meta.date,
        time: meta.time,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        operator,
        type,
        amount: amt,
        charge: chg,
        profit: prf,
        balanceAfter: newBalance,
        recipientNumber,
        note
      });

      // Update operator MFS wallet balance
      const accountId = operator.toLowerCase();
      await adjustAccountBalance(accountId, walletChange);
      
      // Update cash in hand balance
      if (cashChange !== 0) {
        await adjustAccountBalance('cash', cashChange);
      }
    });

    setSuccessMsg(`Saved ${operator} ${type}: Cash ${cashChange >= 0 ? `+Tk ${cashChange.toLocaleString()}` : `-Tk ${Math.abs(cashChange).toLocaleString()}`} • ${operator} ${walletChange >= 0 ? `+Tk ${walletChange.toLocaleString()}` : `-Tk ${Math.abs(walletChange).toLocaleString()}`}`);
    setTimeout(() => setSuccessMsg(null), 5000);
    setAmount(''); setCharge(''); setProfit(''); setRecipientNumber(''); setNote('');
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const newBal = parseFloat(adjustNewBalance);
    if (isNaN(newBal)) return;
    
    const diff = newBal - balances[adjustOperator];
    if (diff === 0) {
      setIsAdjustModalOpen(false);
      return;
    }

    const meta = getRecordMetadata();
    await db.transaction('rw', db.mfs, db.accounts, db.balanceLogs, async () => {
      await db.mfs.add({
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
      await setAccountBalance(adjustOperator.toLowerCase(), newBal, adjustNote);
    });

    setIsAdjustModalOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !deleteTarget.id) return;
    const { id, operator: delOp, amount: delAmt, charge: delChg, type: delType } = deleteTarget;

    let walletChange = 0;
    let cashChange = 0;
    
    if (delType === 'Adjustment') {
      const prevTx = sortedAscending.filter(m => m.operator === delOp && m.id! < id);
      const prevBal = prevTx.length > 0 ? prevTx[prevTx.length - 1].balanceAfter : 0;
      walletChange = prevBal - deleteTarget.balanceAfter;
      cashChange = 0;
    } else if (delType === 'Cash-Out') {
      // Reversal: wallet decreases, cash increases
      walletChange = -delAmt;
      cashChange = delAmt;
    } else if (delType === 'Cash-In') {
      // Reversal: wallet increases, cash decreases
      walletChange = delAmt;
      cashChange = -delAmt;
    } else if (delType === 'Recharge') {
      // Reversal: wallet increases, cash decreases
      walletChange = delAmt;
      cashChange = -delAmt;
    } else if (delType === 'Send Money') {
      // Reversal: wallet increases, cash decreases
      walletChange = delAmt;
      cashChange = -(delAmt + (delChg || 0));
    }

    await db.transaction('rw', db.mfs, db.accounts, db.balanceLogs, async () => {
      await db.mfs.delete(id);
      
      const subsequentTxs = sortedAscending.filter(m => m.operator === delOp && m.id! > id);
      for (const tx of subsequentTxs) {
        await db.mfs.update(tx.id!, { balanceAfter: tx.balanceAfter + walletChange });
      }

      await adjustAccountBalance(delOp.toLowerCase(), walletChange);
      if (cashChange !== 0) {
        await adjustAccountBalance('cash', cashChange);
      }
    });

    setDeleteTarget(null);
  };

  return (
    <div className="p-4 md:p-6 mx-auto mb-4 md:mb-0 w-full max-w-4xl">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#084b3e] rounded-full flex items-center justify-center text-white shrink-0 shadow-md">
              <Smartphone size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">New MFS Entry</h1>
              <p className="text-sm text-gray-500 font-medium">Record mobile financial services quickly</p>
            </div>
          </div>
        </div>

        {/* Top Balances */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {OPERATORS.map(op => (
            <div 
              key={op} 
              onClick={() => setOperator(op)}
              className={`p-4 rounded-xl border shadow-sm relative overflow-hidden flex flex-col items-start justify-between cursor-pointer transition-all ${
                operator === op 
                  ? 'bg-white border-[#084b3e] ring-2 ring-[#084b3e]/20 shadow-md' 
                  : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-gray-100'
              }`}
            >
              <div className="flex justify-between w-full mb-2 items-center">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${operator === op ? 'bg-[#084b3e]' : 'bg-transparent'}`} />
                  <span className={`text-xs font-bold ${
                    op === 'bKash' ? 'text-pink-600' :
                    op === 'Nagad' ? 'text-orange-500' :
                    op === 'Rocket' ? 'text-purple-700' : 'text-blue-700'
                  }`}>{op}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setAdjustOperator(op); setAdjustNewBalance(balances[op].toString()); setIsAdjustModalOpen(true); }}
                  className="text-[10px] font-medium text-gray-400 hover:text-gray-900 underline"
                >
                  Adjust
                </button>
              </div>
              <div className="text-xl font-black text-gray-900 pl-3">Tk {balances[op].toLocaleString()}</div>
            </div>
          ))}
        </div>

        {successMsg && (
          <div className="mb-6 bg-emerald-50 text-emerald-700 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm border border-emerald-100 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 size={18} /> {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Type Selection */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">Transaction Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {TRANSACTION_TYPES.map(t => (
                <label 
                  key={t.id}
                  className={`flex items-center space-x-2 cursor-pointer px-4 py-3 border rounded-xl transition-all font-medium text-sm shadow-sm ${
                    type === t.id 
                      ? 'border-[#084b3e] bg-[#084b3e] text-white shadow-md'
                      : 'border-gray-100 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {type === t.id ? <CheckCircle2 size={18} /> : <Circle size={18} className="text-gray-300" />}
                  <input 
                    type="radio" 
                    className="hidden" 
                    checked={type === t.id}
                    onChange={() => { setType(t.id); handleAmountChange(amount); }}
                  />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>

            {/* Live Balance Effect Preview */}
            <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center flex-wrap gap-2">
                <span className="font-bold text-gray-700">Account Effect:</span>
                <span className={`font-black px-2.5 py-0.5 rounded-md border text-[11px] ${
                  type === 'Cash-Out' 
                    ? 'bg-rose-50 text-rose-700 border-rose-200' 
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  Cash: {type === 'Cash-Out' ? `-${parseFloat(amount) || 0}` : `+${(parseFloat(amount) || 0) + (type === 'Send Money' ? (parseFloat(charge) || 0) : 0)}`} Tk
                </span>
                <span className={`font-black px-2.5 py-0.5 rounded-md border text-[11px] ${
                  type === 'Cash-Out' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {operator} Wallet: {type === 'Cash-Out' ? `+${parseFloat(amount) || 0}` : `-${parseFloat(amount) || 0}`} Tk
                </span>
              </div>
              <span className="text-gray-500 font-medium text-[11px]">
                {type === 'Cash-Out' 
                  ? 'Cash decreases • Wallet increases' 
                  : 'Cash increases • Wallet decreases'}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider flex items-center gap-2">
              <FileText size={16} className="text-gray-500" />
              Transaction Details
            </h3>
            
            <div className="space-y-6">
              {/* Number Full Width */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Number (Optional)</label>
                <input
                  type="text"
                  value={recipientNumber}
                  onChange={e => setRecipientNumber(e.target.value)}
                  placeholder="e.g. 017XXXXXXXX"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] transition-colors text-sm font-medium outline-none shadow-sm"
                />
              </div>

              {/* Amount, Charge, Profit Side-by-Side */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Amount (Tk) *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-gray-400">TK</span>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      value={amount}
                      onChange={e => handleAmountChange(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] transition-colors text-base font-black outline-none shadow-sm font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Charge (Tk)</label>
                  <input
                    type="number"
                    step="any"
                    value={charge}
                    onChange={e => setCharge(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-red-50/50 border border-red-100 rounded-xl text-base font-bold text-red-700 outline-none focus:border-red-300 font-mono shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Profit (Tk)</label>
                  <input
                    type="number"
                    step="any"
                    value={profit}
                    onChange={e => setProfit(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-base font-bold text-emerald-700 outline-none focus:border-emerald-300 font-mono shadow-sm"
                  />
                </div>
              </div>

              {/* Note Full Width */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Note (Optional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Any remarks..."
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] transition-colors text-sm font-medium outline-none shadow-sm"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              className="bg-[#084b3e] text-white px-8 py-3.5 rounded-xl font-bold hover:bg-[#0c5e4e] transition-all shadow-md flex items-center justify-center gap-2 hover:-translate-y-0.5"
            >
              <CheckCircle2 size={20} />
              Save Record
            </button>
          </div>
        </form>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 mt-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-xl font-bold text-gray-900">Recent Transactions</h2>
          <div className="flex gap-2 w-full sm:w-auto">
            <select 
              value={historyOperatorFilter}
              onChange={e => setHistoryOperatorFilter(e.target.value)}
              className="text-sm font-bold bg-white border border-gray-200 rounded-xl px-3 py-2 outline-none shadow-sm"
            >
              <option value="all">All Operators</option>
              {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {displayHistory.length > 0 ? (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50/80 text-gray-500 font-bold text-xs uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="py-4 px-4">Date & Info</th>
                  <th className="py-4 px-4 text-right">Amount</th>
                  <th className="py-4 px-4 text-right">Balance</th>
                  <th className="py-4 px-4 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayHistory.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          tx.operator === 'bKash' ? 'bg-pink-50 text-pink-700 border border-pink-100' :
                          tx.operator === 'Nagad' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                          tx.operator === 'Rocket' ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                        }`}>{tx.operator}</span>
                        <span className="font-bold text-gray-900">{tx.type}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDateStr(tx.date)} {tx.time} {tx.recipientNumber && <span className="font-medium text-gray-700 ml-1">• {tx.recipientNumber}</span>}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="font-black text-gray-900 text-base">Tk {tx.amount.toLocaleString()}</div>
                      <div className="text-[10px] text-gray-500 font-medium flex items-center justify-end gap-1.5 mt-0.5">
                        <span className={tx.type === 'Cash-Out' ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                          Cash {tx.type === 'Cash-Out' ? `-${tx.amount}` : `+${tx.amount + (tx.type === 'Send Money' ? (tx.charge || 0) : 0)}`}
                        </span>
                        <span>•</span>
                        <span className={tx.type === 'Cash-Out' ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                          Wallet {tx.type === 'Cash-Out' ? `+${tx.amount}` : `-${tx.amount}`}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right font-black text-[#084b3e] text-base">
                      Tk {(tx.balanceAfter || 0).toLocaleString()}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <button onClick={() => setDeleteTarget(tx)} className="p-2 text-gray-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl">
              <Smartphone size={32} className="mx-auto mb-3 opacity-50 text-gray-300" />
              <p className="text-base font-bold text-gray-600">No transactions yet</p>
              <p className="text-sm text-gray-400 mt-1">Add your first record above.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={() => setIsAdjustModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-gray-900 mb-5 flex justify-between items-center">
              Adjust {adjustOperator} Balance
              <button onClick={() => setIsAdjustModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </h3>
            <form onSubmit={handleSaveAdjustment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Actual Balance (Tk)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-gray-400">TK</span>
                  <input type="number" step="any" required value={adjustNewBalance} onChange={e => setAdjustNewBalance(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-black outline-none font-mono focus:border-[#084b3e]" autoFocus />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Reason</label>
                <input type="text" value={adjustNote} onChange={e => setAdjustNote(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#084b3e]" />
              </div>
              <div className="pt-2">
                <button type="submit" className="w-full bg-[#084b3e] text-white font-bold py-3 rounded-xl hover:bg-[#0c5e4e] transition-colors shadow-sm">Update Balance</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100">
              <AlertTriangle size={28} strokeWidth={2.5} />
            </div>
            <h3 className="font-bold text-xl text-gray-900 mb-2">Delete Transaction?</h3>
            <p className="text-sm text-gray-500 mb-6 font-medium">Remove {deleteTarget.operator} {deleteTarget.type} of <span className="font-black text-gray-900">Tk {deleteTarget.amount}</span>?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={handleConfirmDelete} className="flex-1 py-3 font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-sm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
