import React, { useState, useEffect, useMemo } from 'react';
import { db, Expense, getRecordMetadata } from '../db/db';
import { adjustAccountBalance, mapPaymentMethodToAccountId } from '../services/accountService';
import { logExpenseDelete } from '../services/activityLogService';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { 
  Receipt, 
  Wallet, 
  TrendingDown, 
  Clock, 
  Calendar, 
  Search, 
  Trash2, 
  X, 
  CheckCircle2, 
  ChevronRight, 
  FileText, 
  AlertCircle, 
  Layers
} from 'lucide-react';
import { formatDateStr } from '../utils/dateFormatter';
import { Modal } from './common/Modal';

const DEFAULT_EXPENSE_SERVICES = [
  'Shop Rent',
  'Electricity Bill',
  'Internet Bill',
  'Paper/Ink Purchase',
  'Snacks/Tea',
  'Stationery & Office Supplies',
  'Hardware / Maintenance',
  'Staff Salary / Honorarium'
];

export function Expenses() {
  const expenseServices = useLiveQuery(() => db.expenseServices.toArray()) || [];
  const allExpenses = useLiveQuery(() => db.expenses.orderBy('id').reverse().toArray()) || [];

  // Seed default expense services if empty
  useEffect(() => {
    const seed = async () => {
      const count = await db.expenseServices.count();
      if (count === 0) {
        for (const name of DEFAULT_EXPENSE_SERVICES) {
          await db.expenseServices.add({ name });
        }
      }
    };
    seed();
  }, []);

  // Modals & Feedback
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [detailsExpense, setDetailsExpense] = useState<Expense | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Filters & Search for History Table
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'amount-high' | 'amount-low'>('newest');

  // Form State (Always visible on top)
  const [selectedService, setSelectedService] = useState('');
  const [customServiceName, setCustomServiceName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  // Date metrics calculations
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const now = new Date();
  const monthStartStr = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEndStr = format(endOfMonth(now), 'yyyy-MM-dd');

  const todayExpenses = useMemo(() => {
    return allExpenses.filter(e => e.date === todayStr);
  }, [allExpenses, todayStr]);

  const todayExpensesTotal = useMemo(() => {
    return todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [todayExpenses]);

  const monthExpensesTotal = useMemo(() => {
    return allExpenses
      .filter(e => e.date >= monthStartStr && e.date <= monthEndStr)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [allExpenses, monthStartStr, monthEndStr]);

  // Helpers to parse legacy / structured expense records
  const getExpensePaymentMethod = (exp: Expense): string => {
    if (exp.paymentMethod) return exp.paymentMethod;
    const match = exp.title?.match(/\bPay:\s*(bKash|Nagad|Rocket|Due|Cash|Bank)\b/i);
    if (match) {
      const found = match[1].toLowerCase();
      if (found === 'bkash') return 'bKash';
      if (found === 'nagad') return 'Nagad';
      if (found === 'rocket') return 'Rocket';
      if (found === 'due') return 'Due';
      if (found === 'bank') return 'Bank';
      return 'Cash';
    }
    return 'Cash';
  };

  const getExpenseQuantity = (exp: Expense): string => {
    if (exp.quantity) return String(exp.quantity);
    const match = exp.title?.match(/Qty:\s*([^,)]+)/i);
    return match ? match[1].trim() : '';
  };

  const getExpenseDisplayTitle = (exp: Expense): string => {
    if (exp.category && exp.category !== 'Other' && !exp.category.includes('Pay:')) {
      return exp.category;
    }
    const clean = exp.title?.replace(/\s*\([^)]*\)/g, '').trim();
    return clean || exp.title || 'General Expense';
  };

  const resetForm = () => {
    setSelectedService('');
    setCustomServiceName('');
    setQuantity('');
    setAmount('');
    setNote('');
    setPaymentMethod('Cash');
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedService) {
      setErrorMsg("Please select a service or expense category.");
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }

    const price = parseFloat(amount) || 0;
    if (price <= 0) {
      setErrorMsg("Please enter a valid expense amount.");
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }

    let finalTitle = selectedService;
    if (selectedService === 'Other') {
      if (!customServiceName.trim()) {
        setErrorMsg("Please enter a custom service name.");
        setTimeout(() => setErrorMsg(''), 4000);
        return;
      }
      finalTitle = customServiceName.trim();
    }

    const qtyTrimmed = quantity.trim();
    const qtyString = qtyTrimmed ? `Qty: ${qtyTrimmed}, ` : '';
    const meta = getRecordMetadata();

    const newExpense: Expense = {
      date: meta.date,
      time: meta.time,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      title: `${finalTitle} (${qtyString}Pay: ${paymentMethod})`,
      amount: price,
      category: finalTitle,
      note: note.trim() || undefined,
      paymentMethod,
      quantity: qtyTrimmed || undefined
    };

    try {
      await db.expenses.add(newExpense);

      // Deduct expense from corresponding account balance
      if (paymentMethod !== 'Due') {
        const targetAccountId = mapPaymentMethodToAccountId(paymentMethod) || 'cash';
        await adjustAccountBalance(targetAccountId, -price);
      }

      setSuccessMsg(`Expense of Tk ${price.toLocaleString()} recorded successfully!`);
      resetForm();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Failed to record expense:', err);
      setErrorMsg('Error saving expense. Please try again.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget?.id) return;
    try {
      const expAmount = deleteTarget.amount || 0;
      const method = getExpensePaymentMethod(deleteTarget);

      // Refund account balance if not Due
      if (method !== 'Due') {
        const targetAccountId = mapPaymentMethodToAccountId(method) || 'cash';
        await adjustAccountBalance(targetAccountId, expAmount);
      }

      await db.expenses.delete(deleteTarget.id);
      await logExpenseDelete(deleteTarget);
      setDeleteTarget(null);
      setDetailsExpense(null);
      setSuccessMsg(`Expense #${deleteTarget.id} deleted and balance restored.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Failed to delete expense:', err);
      setErrorMsg('Failed to delete expense. Please try again.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  // Filtered & Sorted Last 10 Expenses
  const last10Expenses = useMemo(() => {
    let list = [...allExpenses];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(e => 
        e.title?.toLowerCase().includes(q) ||
        e.category?.toLowerCase().includes(q) ||
        e.note?.toLowerCase().includes(q) ||
        e.date?.includes(q)
      );
    }

    // Filter by payment method
    if (paymentFilter !== 'all') {
      list = list.filter(e => getExpensePaymentMethod(e) === paymentFilter);
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'amount-high') return (b.amount || 0) - (a.amount || 0);
      if (sortBy === 'amount-low') return (a.amount || 0) - (b.amount || 0);
      // 'newest' default
      return (b.id || 0) - (a.id || 0);
    });

    // Exactly the last 10 transactions
    return list.slice(0, 10);
  }, [allExpenses, searchQuery, paymentFilter, sortBy]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-[#084b3e] rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md">
          <Receipt size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Expenses</h1>
          <p className="text-sm text-gray-500 font-medium">Record shop expenses & track spending</p>
        </div>
      </div>

      {/* 3 Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Today's Expenses</p>
            <p className="text-2xl font-black text-gray-900">Tk {todayExpensesTotal.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <TrendingDown size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">This Month</p>
            <p className="text-2xl font-black text-gray-900">Tk {monthExpensesTotal.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#084b3e] flex items-center justify-center shrink-0">
            <Layers size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Today's Entries</p>
            <p className="text-2xl font-black text-[#084b3e]">{todayExpenses.length} Records</p>
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMsg && (
        <div className="bg-emerald-50 text-emerald-700 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm border border-emerald-100 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Notification Banner */}
      {errorMsg && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm border border-red-100 animate-in fade-in slide-in-from-top-2">
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* EXPENSE ENTRY FORM CARD (ON TOP) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#084b3e] flex items-center justify-center font-bold">
              <Receipt size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">New Expense Entry</h2>
            </div>
          </div>
          {(amount || selectedService || note || quantity) && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-gray-400 hover:text-gray-700 font-bold underline px-2 py-1"
            >
              Reset Form
            </button>
          )}
        </div>

        <form onSubmit={handleAddExpense} className="space-y-5">
          {/* Row 1: Service Name & Quantity Side by Side */}
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                  Service / Expense Name <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="w-full px-4 py-3 sm:py-3.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none text-base font-semibold shadow-sm transition-all text-gray-900"
                >
                  <option value="" disabled>Select service / expense...</option>
                  {expenseServices.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                  <option value="Other" className="font-bold">+ Other / Custom Expense</option>
                </select>
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                  Quantity
                </label>
                <input
                  type="text"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="1"
                  className="w-full px-4 py-3 sm:py-3.5 border border-gray-200 rounded-xl text-center font-black text-base text-gray-900 focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none transition-all"
                />
              </div>
            </div>

            {/* Custom Service Name if 'Other' is selected */}
            {selectedService === 'Other' && (
              <div className="mt-3 animate-in fade-in">
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                  Custom Expense Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customServiceName}
                  onChange={(e) => setCustomServiceName(e.target.value)}
                  placeholder="Enter custom expense title..."
                  className="w-full px-4 py-3 sm:py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none text-base font-medium"
                />
              </div>
            )}
          </div>

          {/* Row 2: Expense Amount (Tk) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
              Expense Amount (Tk) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-base">Tk</span>
              <input
                type="number"
                step="any"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-11 pr-4 py-3 sm:py-3.5 border border-gray-200 rounded-xl font-black text-lg text-gray-900 focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none transition-all"
              />
            </div>
          </div>

          {/* Row 3: Note */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
              Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any remarks, voucher number, or vendor info..."
              className="w-full px-4 py-3 sm:py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] outline-none text-base font-medium transition-all"
            />
          </div>

          {/* Row 4: Payment Method */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
              Payment Method
            </label>
            <div className="grid grid-cols-5 gap-2.5">
              {['Cash', 'bKash', 'Nagad', 'Rocket', 'Due'].map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`py-3 px-2 text-sm font-bold rounded-xl border transition-all text-center ${
                    paymentMethod === method
                      ? (method === 'Due' ? 'bg-red-600 border-red-600 text-white shadow-sm' : 'bg-[#084b3e] border-[#084b3e] text-white shadow-sm')
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Row 5: Save Expense Button */}
          <div className="pt-3">
            <button
              type="submit"
              className="w-full py-4 px-6 bg-[#084b3e] hover:bg-[#0c5e4e] active:scale-[0.99] text-white font-black rounded-xl text-lg tracking-wide transition-all shadow-md flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <CheckCircle2 size={24} />
              Save Expense
            </button>
          </div>
        </form>
      </div>

      {/* RECORD TABLE (LAST 10 TRANSACTIONS ONLY) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-gray-900">Recent Expense Records</h2>
              <span className="text-xs font-bold bg-emerald-50 text-[#084b3e] px-2.5 py-0.5 rounded-full border border-emerald-100">
                Last 10 Transactions
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] transition-all text-xs font-medium"
              />
            </div>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#084b3e] bg-gray-50"
            >
              <option value="all">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="bKash">bKash</option>
              <option value="Nagad">Nagad</option>
              <option value="Rocket">Rocket</option>
              <option value="Due">Due</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#084b3e] bg-gray-50"
            >
              <option value="newest">Newest First</option>
              <option value="amount-high">Amount (High to Low)</option>
              <option value="amount-low">Amount (Low to High)</option>
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          {last10Expenses.length > 0 ? (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50/80 text-gray-500 font-bold text-xs uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Expense & Quantity</th>
                  <th className="py-3.5 px-4">Payment</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                  <th className="py-3.5 px-4 text-center">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {last10Expenses.map((exp) => {
                  const method = getExpensePaymentMethod(exp);
                  const title = getExpenseDisplayTitle(exp);
                  const qty = getExpenseQuantity(exp);

                  return (
                    <tr 
                      key={exp.id} 
                      onClick={() => setDetailsExpense(exp)}
                      className="hover:bg-emerald-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 text-gray-600 font-medium">
                        <div className="font-bold text-gray-900 group-hover:text-[#084b3e] transition-colors">
                          {formatDateStr(exp.date)}
                        </div>
                        <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Clock size={12} /> {exp.time || '—'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900 flex items-center gap-2">
                          <span>{title}</span>
                          {qty && (
                            <span className="text-[11px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              x{qty}
                            </span>
                          )}
                        </div>
                        {exp.note && (
                          <div className="text-xs text-gray-400 truncate max-w-xs mt-0.5">{exp.note}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          method === 'Cash' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          method === 'bKash' ? 'bg-pink-50 text-pink-700 border border-pink-100' :
                          method === 'Nagad' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                          method === 'Rocket' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                          'bg-red-50 text-red-700 border border-red-100'
                        }`}>
                          {method}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span className="font-black text-rose-600 text-base">
                          -Tk {(exp.amount || 0).toLocaleString()}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setDetailsExpense(exp)}
                          title="View Details"
                          className="p-1.5 text-gray-500 hover:text-[#084b3e] hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold mx-auto"
                        >
                          <FileText size={16} />
                          <span className="hidden sm:inline">Details</span>
                          <ChevronRight size={14} className="text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Receipt size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="font-bold text-gray-700">No expense transactions found</p>
              <p className="text-xs text-gray-400 mt-1">Fill out the form above to record an expense.</p>
            </div>
          )}
        </div>
      </div>

      {/* TRANSACTION DETAILS MODAL */}
      <Modal
        isOpen={!!detailsExpense}
        onClose={() => setDetailsExpense(null)}
        title="Expense Details"
        maxWidth="md"
      >
        {detailsExpense && (
          <div className="space-y-4">
            <div className="text-center pb-2">
              <span className="text-[12px] font-bold text-gray-400 uppercase tracking-wider block">Expense Amount</span>
              <span className="text-2xl font-black text-rose-600">
                Tk {(detailsExpense.amount || 0).toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-gray-500 block mt-1">
                {getExpenseDisplayTitle(detailsExpense)} (#{detailsExpense.id})
              </span>
            </div>

            <div className="bg-[#f7f8fa] rounded-[12px] p-3.5 border border-[#d8e0e8] divide-y divide-gray-200/60 text-xs">
              <div className="flex justify-between py-2">
                <span className="text-[#4b5870] font-semibold">Date & Time</span>
                <span className="font-bold text-[#202b3d]">
                  {formatDateStr(detailsExpense.date)} {detailsExpense.time ? `• ${detailsExpense.time}` : ''}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-[#4b5870] font-semibold">Category / Title</span>
                <span className="font-bold text-[#202b3d]">{getExpenseDisplayTitle(detailsExpense)}</span>
              </div>
              {getExpenseQuantity(detailsExpense) && (
                <div className="flex justify-between py-2">
                  <span className="text-[#4b5870] font-semibold">Quantity</span>
                  <span className="font-bold text-[#202b3d]">{getExpenseQuantity(detailsExpense)}</span>
                </div>
              )}
              <div className="flex justify-between py-2">
                <span className="text-[#4b5870] font-semibold">Payment Method</span>
                <span className="font-bold text-[#202b3d]">{getExpensePaymentMethod(detailsExpense)}</span>
              </div>
              {detailsExpense.note && (
                <div className="flex justify-between py-2">
                  <span className="text-[#4b5870] font-semibold">Note / Remarks</span>
                  <span className="font-bold text-[#202b3d] text-right max-w-[200px] break-words">
                    {detailsExpense.note}
                  </span>
                </div>
              )}
              {detailsExpense.createdAt && (
                <div className="flex justify-between py-2">
                  <span className="text-[#4b5870] font-semibold">Recorded At</span>
                  <span className="font-medium text-gray-500">
                    {format(new Date(detailsExpense.createdAt), 'dd MMM yyyy, hh:mm a')}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(detailsExpense)}
                className="flex-1 min-h-[47px] h-[47px] px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 font-[750] text-[13px] rounded-[12px] border border-rose-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={15} /> Delete
              </button>
              <button
                type="button"
                onClick={() => setDetailsExpense(null)}
                className="flex-1 min-h-[47px] h-[47px] px-4 bg-[#f7f8fa] hover:bg-[#eef2f5] border border-[#d8e0e8] text-[#4b5870] hover:text-[#202b3d] font-[750] text-[13px] rounded-[12px] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Expense"
        maxWidth="sm"
      >
        {deleteTarget && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-[#4b5870] leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-[#202b3d]">#{deleteTarget.id} ({getExpenseDisplayTitle(deleteTarget)})</span>?
              {getExpensePaymentMethod(deleteTarget) !== 'Due' && (
                <span className="block mt-2 text-xs text-[#075e4f] font-semibold bg-[#075e4f]/5 p-2 rounded-lg border border-[#075e4f]/15">
                  Tk {(deleteTarget.amount || 0).toLocaleString()} will be refunded to your {getExpensePaymentMethod(deleteTarget)} balance.
                </span>
              )}
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 min-h-[47px] h-[47px] bg-[#f7f8fa] hover:bg-[#eef2f5] border border-[#d8e0e8] text-[#4b5870] hover:text-[#202b3d] font-[750] text-[13px] rounded-[12px] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 min-h-[47px] h-[47px] bg-rose-600 hover:bg-rose-700 text-white font-[750] text-[13px] rounded-[12px] shadow-[0_2px_3px_rgba(225,29,72,0.2)] transition-colors cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
