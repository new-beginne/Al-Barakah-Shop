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
    if (exp.title?.includes('Pay: bKash')) return 'bKash';
    if (exp.title?.includes('Pay: Nagad')) return 'Nagad';
    if (exp.title?.includes('Pay: Rocket')) return 'Rocket';
    if (exp.title?.includes('Pay: Due')) return 'Due';
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
      alert("Please select a service or expense category.");
      return;
    }

    const price = parseFloat(amount) || 0;
    if (price <= 0) {
      alert("Please enter a valid expense amount.");
      return;
    }

    let finalTitle = selectedService;
    if (selectedService === 'Other') {
      if (!customServiceName.trim()) {
        alert("Please enter a custom service name.");
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
      alert('Error saving expense. Please try again.');
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
      alert('Failed to delete expense. Please try again.');
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
      {detailsExpense && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 my-8">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#084b3e] to-[#0c5e4e] text-white p-6 relative">
              <button
                onClick={() => setDetailsExpense(null)}
                className="absolute top-5 right-5 text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
              <div className="flex items-center gap-2 text-emerald-200 text-xs font-bold uppercase tracking-wider mb-1">
                <span>Expense Details</span>
                <span>•</span>
                <span>#{detailsExpense.id}</span>
              </div>
              <h3 className="text-2xl font-black">{getExpenseDisplayTitle(detailsExpense)}</h3>
              <div className="flex items-center gap-3 mt-2 text-xs font-medium text-white/90">
                <span className="flex items-center gap-1">
                  <Calendar size={13} /> {formatDateStr(detailsExpense.date)}
                </span>
                {detailsExpense.time && (
                  <span className="flex items-center gap-1">
                    <Clock size={13} /> {detailsExpense.time}
                  </span>
                )}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Financial Highlight Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 text-center">
                  <span className="text-[11px] font-bold text-gray-400 block uppercase">Expense Amount</span>
                  <span className="text-2xl font-black text-rose-600 mt-0.5 block">
                    Tk {(detailsExpense.amount || 0).toLocaleString()}
                  </span>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-center flex flex-col items-center justify-center">
                  <span className="text-[11px] font-bold text-gray-400 block uppercase mb-1">Payment Method</span>
                  <span className="text-base font-black text-gray-900">
                    {getExpensePaymentMethod(detailsExpense)}
                  </span>
                </div>
              </div>

              {/* Detail Items List */}
              <div className="bg-gray-50/70 rounded-2xl p-4 divide-y divide-gray-100 border border-gray-100 space-y-2 text-xs">
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500 font-bold">Transaction Date</span>
                  <span className="font-extrabold text-gray-900">{formatDateStr(detailsExpense.date)}</span>
                </div>
                {detailsExpense.time && (
                  <div className="flex justify-between py-1.5">
                    <span className="text-gray-500 font-bold">Transaction Time</span>
                    <span className="font-extrabold text-gray-900">{detailsExpense.time}</span>
                  </div>
                )}
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500 font-bold">Category / Title</span>
                  <span className="font-extrabold text-gray-900">{getExpenseDisplayTitle(detailsExpense)}</span>
                </div>
                {getExpenseQuantity(detailsExpense) && (
                  <div className="flex justify-between py-1.5">
                    <span className="text-gray-500 font-bold">Quantity</span>
                    <span className="font-extrabold text-gray-900">{getExpenseQuantity(detailsExpense)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500 font-bold">Payment Method</span>
                  <span className="font-extrabold text-gray-900">{getExpensePaymentMethod(detailsExpense)}</span>
                </div>
                {detailsExpense.note && (
                  <div className="flex justify-between py-1.5">
                    <span className="text-gray-500 font-bold">Note / Remarks</span>
                    <span className="font-extrabold text-gray-900 text-right max-w-[260px] break-words">
                      {detailsExpense.note}
                    </span>
                  </div>
                )}
                {detailsExpense.createdAt && (
                  <div className="flex justify-between py-1.5">
                    <span className="text-gray-500 font-bold">Recorded At</span>
                    <span className="font-medium text-gray-500">
                      {format(new Date(detailsExpense.createdAt), 'dd MMM yyyy, hh:mm a')}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(detailsExpense)}
                  className="flex-1 py-3 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 border border-red-100"
                >
                  <Trash2 size={16} /> Delete Expense
                </button>
                <button
                  type="button"
                  onClick={() => setDetailsExpense(null)}
                  className="py-3 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={28} />
            </div>
            <h3 className="text-lg font-black text-gray-900 text-center">Delete Expense?</h3>
            <p className="text-xs text-gray-500 text-center mt-2 font-medium">
              Are you sure you want to delete <span className="font-bold text-gray-800">#{deleteTarget.id} ({getExpenseDisplayTitle(deleteTarget)})</span>?
              {getExpensePaymentMethod(deleteTarget) !== 'Due' && (
                <span className="block mt-1 text-emerald-600 font-bold">
                  Tk {(deleteTarget.amount || 0).toLocaleString()} will be refunded to your {getExpensePaymentMethod(deleteTarget)} balance.
                </span>
              )}
            </p>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
