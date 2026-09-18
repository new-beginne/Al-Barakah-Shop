import React, { useState, useMemo } from 'react';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, subDays, startOfMonth, subMonths, endOfMonth } from 'date-fns';
import { 
  Calendar, 
  Download, 
  Search, 
  FileText, 
  CheckCircle2, 
  TrendingUp, 
  Wallet, 
  Receipt, 
  Coins, 
  Clock, 
  User, 
  X, 
  Loader2, 
  Check, 
  Eye, 
  Printer, 
  Phone,
  ArrowUpRight,
  ArrowDownRight,
  Smartphone
} from 'lucide-react';
import { generateStatementPdf } from '../utils/pdfExport';
import { formatDateStr } from '../utils/dateFormatter';

export function Reports() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const last7Str = format(subDays(new Date(), 7), 'yyyy-MM-dd');
  const lastMonthStartStr = format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd');
  const lastMonthEndStr = format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd');

  const [dateFilter, setDateFilter] = useState('today');
  const [customStart, setCustomStart] = useState(todayStr);
  const [customEnd, setCustomEnd] = useState(todayStr);
  
  const [activeTab, setActiveTab] = useState<'all' | 'sales' | 'expenses' | 'mfs'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'amount-high' | 'profit-high'>('newest');

  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);

  const getRange = () => {
    let start = todayStr, end = todayStr;
    if (dateFilter === 'last7') { start = last7Str; }
    else if (dateFilter === 'lastMonth') { start = lastMonthStartStr; end = lastMonthEndStr; }
    else if (dateFilter === 'custom') { start = customStart; end = customEnd; }
    return { start, end };
  };

  const { start, end } = getRange();

  const customers = useLiveQuery(() => db.customers.toArray()) || [];

  const sales = useLiveQuery(() => {
    if (dateFilter === 'all') return db.sales.orderBy('date').reverse().toArray();
    return db.sales.where('date').between(start, end, true, true).reverse().toArray();
  }, [dateFilter, start, end]) || [];

  const expenses = useLiveQuery(() => {
    if (dateFilter === 'all') return db.expenses.orderBy('date').reverse().toArray();
    return db.expenses.where('date').between(start, end, true, true).reverse().toArray();
  }, [dateFilter, start, end]) || [];

  const mfs = useLiveQuery(() => {
    if (dateFilter === 'all') return db.mfs.orderBy('date').reverse().toArray();
    return db.mfs.where('date').between(start, end, true, true).reverse().toArray();
  }, [dateFilter, start, end]) || [];

  // Unified items combining sales, expenses, and MFS
  const unifiedItems = useMemo(() => {
    const items: Array<{
      id: string;
      originalId: number;
      date: string;
      time?: string;
      type: 'sell' | 'cost' | 'mfs';
      typeLabel: string;
      title: string;
      detail?: string;
      customerName?: string;
      customerPhone?: string;
      paymentMethod?: string;
      amount: number;
      cost: number;
      profit: number;
      rawItem: any;
    }> = [];

    sales.forEach(s => {
      const matchedCust = s.customerName ? customers.find(c => c.name.toLowerCase().trim() === s.customerName?.toLowerCase().trim()) : null;
      items.push({
        id: `sale-${s.id}`,
        originalId: s.id!,
        date: s.date,
        time: s.time,
        type: 'sell',
        typeLabel: 'Sale',
        title: s.serviceName + (s.quantity && s.quantity != 1 && s.quantity !== '1' ? ` (x${s.quantity})` : ''),
        detail: s.note,
        customerName: s.customerName,
        customerPhone: matchedCust?.phone,
        paymentMethod: s.paymentMethod || 'Cash',
        amount: s.amount,
        cost: s.cost || 0,
        profit: s.profit,
        rawItem: s
      });
    });

    expenses.forEach(e => {
      items.push({
        id: `expense-${e.id}`,
        originalId: e.id!,
        date: e.date,
        time: e.time,
        type: 'cost',
        typeLabel: 'Expense',
        title: e.title,
        detail: e.note || e.category,
        paymentMethod: e.paymentMethod || 'Cash',
        amount: e.amount,
        cost: e.amount,
        profit: -e.amount,
        rawItem: e
      });
    });

    mfs.forEach(m => {
      items.push({
        id: `mfs-${m.id}`,
        originalId: m.id!,
        date: m.date,
        time: m.time,
        type: 'mfs',
        typeLabel: 'MFS',
        title: `${m.operator} ${m.type}`,
        detail: `Bal: Tk ${(m.balanceAfter || 0).toLocaleString()}${m.charge ? ` · Fee: Tk ${m.charge}` : ''}`,
        paymentMethod: m.operator,
        amount: m.amount,
        cost: 0,
        profit: m.profit,
        rawItem: m
      });
    });

    return items;
  }, [sales, expenses, mfs]);

  // Overall Summaries
  const totalSales = useMemo(() => sales.reduce((a, b) => a + b.amount, 0), [sales]);
  const salesProfit = useMemo(() => sales.reduce((a, b) => a + b.profit, 0), [sales]);
  const totalExpense = useMemo(() => expenses.reduce((a, b) => a + b.amount, 0), [expenses]);
  const mfsProfit = useMemo(() => mfs.reduce((a, b) => a + b.profit, 0), [mfs]);
  const netProfit = useMemo(() => (salesProfit + mfsProfit) - totalExpense, [salesProfit, mfsProfit, totalExpense]);

  const getRangeLabel = () => {
    if (dateFilter === 'all') return 'All Time';
    if (dateFilter === 'today') return `Today (${todayStr})`;
    if (dateFilter === 'last7') return `Last 7 Days (${last7Str} to ${todayStr})`;
    if (dateFilter === 'lastMonth') return `Last Month (${lastMonthStartStr} to ${lastMonthEndStr})`;
    return `Custom (${customStart} to ${customEnd})`;
  };

  const handleExportPDF = async (mode: 'active' | 'full' = 'active') => {
    if (isExporting) return;
    try {
      setIsExporting(true);
      generateStatementPdf({
        sales,
        expenses,
        mfs,
        periodLabel: getRangeLabel(),
        activeTab,
        mode,
        totalSales,
        salesProfit,
        totalExpense,
        mfsProfit,
        netProfit,
      });

      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 3500);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Could not export PDF statement. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Filtered & Sorted items based on activeTab, search query, and sortBy
  const filteredAndSortedItems = useMemo(() => {
    let list = [...unifiedItems];

    // Tab filter
    if (activeTab === 'sales') {
      list = list.filter(i => i.type === 'sell');
    } else if (activeTab === 'expenses') {
      list = list.filter(i => i.type === 'cost');
    } else if (activeTab === 'mfs') {
      list = list.filter(i => i.type === 'mfs');
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(i => 
        i.title.toLowerCase().includes(q) ||
        (i.detail && i.detail.toLowerCase().includes(q)) ||
        (i.customerName && i.customerName.toLowerCase().includes(q)) ||
        (i.customerPhone && i.customerPhone.includes(q)) ||
        (i.paymentMethod && i.paymentMethod.toLowerCase().includes(q)) ||
        i.date.includes(q)
      );
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'amount-high') {
        return b.amount - a.amount;
      }
      if (sortBy === 'profit-high') {
        return b.profit - a.profit;
      }
      // 'newest' default
      const dateTimeA = `${a.date} ${a.time || ''}`;
      const dateTimeB = `${b.date} ${b.time || ''}`;
      return dateTimeB.localeCompare(dateTimeA);
    });

    return list;
  }, [unifiedItems, activeTab, searchQuery, sortBy]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header & Actions (Identical to Customers.tsx layout) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 font-medium">Financial breakdown, audit ledger & exports</p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => window.print()}
            className="flex-1 sm:flex-initial bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
            title="Print Statement"
          >
            <Printer size={18} />
            <span className="hidden sm:inline">Print</span>
          </button>
          <button
            onClick={() => handleExportPDF(activeTab === 'all' ? 'full' : 'active')}
            disabled={isExporting}
            className="flex-1 sm:flex-initial bg-[#084b3e] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#0c5e4e] transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 text-sm cursor-pointer"
          >
            {isExporting ? <Loader2 size={18} className="animate-spin" /> : pdfSuccess ? <Check size={18} /> : <Download size={18} />}
            <span>{isExporting ? 'Generating...' : pdfSuccess ? 'Downloaded' : 'Export Statement'}</span>
          </button>
        </div>
      </div>

      {/* 3 Top Summary Stat Cards (Identical to Customers.tsx card design) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500">Total Sales</p>
            <p className="text-2xl font-black text-gray-900">Tk {totalSales.toLocaleString()}</p>
            <p className="text-xs font-bold text-emerald-600 mt-0.5">+Tk {salesProfit.toLocaleString()} profit</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
            <Receipt size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500">Total Expenses</p>
            <p className="text-2xl font-black text-gray-900">Tk {totalExpense.toLocaleString()}</p>
            <p className="text-xs font-bold text-gray-400 mt-0.5">{expenses.length} expense records</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#084b3e] flex items-center justify-center shrink-0">
            <Coins size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500">Net Profit</p>
            <p className={`text-2xl font-black ${netProfit >= 0 ? 'text-[#084b3e]' : 'text-red-600'}`}>
              {netProfit >= 0 ? 'Tk ' : '-Tk '}{Math.abs(netProfit).toLocaleString()}
            </p>
            <p className="text-xs font-bold text-gray-400 mt-0.5">Sales + MFS - Expenses</p>
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {pdfSuccess && (
        <div className="bg-emerald-50 text-emerald-700 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm border border-emerald-100 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={18} /> Official financial statement exported successfully!
        </div>
      )}

      {/* Main Content Area (Identical to Customers.tsx card styling) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        
        {/* Category Tabs (Pills) */}
        <div className="flex flex-wrap gap-1.5 p-1.5 bg-gray-100 rounded-xl mb-5">
          {(['all', 'sales', 'expenses', 'mfs'] as const).map(tab => {
            const count = tab === 'all' 
              ? unifiedItems.length 
              : tab === 'sales' 
              ? sales.length 
              : tab === 'expenses' 
              ? expenses.length 
              : mfs.length;

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === tab 
                    ? 'bg-[#084b3e] text-white shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/70'
                }`}
              >
                <span>{tab === 'all' ? 'Full Audit' : tab === 'sales' ? 'Sales' : tab === 'expenses' ? 'Expenses' : 'MFS'}</span>
                <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-black ${
                  activeTab === tab ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Toolbar: Search & Filters (Identical to Customers.tsx) */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          {/* Search Box */}
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search transactions, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#084b3e]/20 focus:border-[#084b3e] transition-all text-sm font-medium"
            />
          </div>

          {/* Filter Selects */}
          <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
            {/* Date Period Filter */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#084b3e] bg-gray-50 w-full sm:w-auto"
              >
                <option value="today">Today</option>
                <option value="last7">Last 7 Days</option>
                <option value="lastMonth">Last Month</option>
                <option value="all">All Time</option>
                <option value="custom">Custom Range</option>
              </select>

              {dateFilter === 'custom' && (
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="px-2.5 py-1.5 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#084b3e] bg-gray-50"
                  />
                  <span className="text-xs text-gray-400 font-bold">to</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="px-2.5 py-1.5 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#084b3e] bg-gray-50"
                  />
                </div>
              )}
            </div>

            {/* Sort Select */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#084b3e] bg-gray-50 w-full sm:w-auto"
            >
              <option value="newest">Newest First</option>
              <option value="amount-high">Highest Amount</option>
              <option value="profit-high">Highest Profit</option>
            </select>
          </div>
        </div>

        {/* Transactions Table (Matching Customers.tsx table layout) */}
        <div className="overflow-x-auto">
          {filteredAndSortedItems.length > 0 ? (
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
                {filteredAndSortedItems.map((item) => {
                  const isSale = item.type === 'sell';
                  const isCost = item.type === 'cost';
                  const isMfs = item.type === 'mfs';
                  const isDue = isSale && item.paymentMethod === 'Due';

                  return (
                    <tr 
                      key={item.id} 
                      onClick={() => setSelectedTx({
                        type: isSale ? 'sales' : isCost ? 'expenses' : 'mfs',
                        data: item.rawItem
                      })}
                      className="hover:bg-gray-50/50 transition-colors cursor-pointer group"
                    >
                      {/* Service / Transaction Info */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                            isSale ? 'bg-emerald-50 text-emerald-600' :
                            isCost ? 'bg-rose-50 text-rose-600' :
                            'bg-sky-50 text-sky-600'
                          }`}>
                            {isSale ? <ArrowUpRight size={16} /> : isCost ? <ArrowDownRight size={16} /> : <Smartphone size={16} />}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 group-hover:text-[#084b3e] transition-colors">
                              {item.title}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                              {item.customerName && (
                                <span className="font-semibold text-gray-600">
                                  {item.customerName}
                                </span>
                              )}
                              {item.detail && <span>• {item.detail}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="py-4 px-4 text-gray-600 font-medium">
                        <div className="font-bold text-gray-900">
                          {formatDateStr(item.date)}
                        </div>
                        {item.time && (
                          <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <Clock size={12} /> {item.time}
                          </div>
                        )}
                      </td>

                      {/* Type & Payment Method */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            isSale ? 'bg-emerald-100 text-emerald-800' :
                            isCost ? 'bg-rose-100 text-rose-800' :
                            'bg-sky-100 text-sky-800'
                          }`}>
                            {item.typeLabel}
                          </span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            isDue ? 'bg-red-50 text-red-600 border border-red-200' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {item.paymentMethod}
                          </span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-4 text-right">
                        <div className={`font-black text-base ${
                          isCost ? 'text-rose-600' : isDue ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {isCost ? '-Tk ' : 'Tk '}{item.amount.toLocaleString()}
                        </div>
                      </td>

                      {/* Profit */}
                      <td className="py-4 px-4 text-right">
                        <div className={`font-black text-sm ${
                          item.profit > 0 ? 'text-emerald-600' : item.profit < 0 ? 'text-rose-600' : 'text-gray-400'
                        }`}>
                          {item.profit > 0 ? '+' : ''}Tk {item.profit.toLocaleString()}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedTx({
                            type: isSale ? 'sales' : isCost ? 'expenses' : 'mfs',
                            data: item.rawItem
                          })}
                          className="p-1.5 text-gray-400 hover:text-[#084b3e] rounded-lg hover:bg-emerald-50 transition-colors flex items-center gap-1 text-xs font-bold mx-auto"
                          title="View Details"
                        >
                          <Eye size={16} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Grand Total Footer */}
              <tfoot>
                <tr className="bg-gray-50/80 font-black text-xs text-gray-900 border-t-2 border-gray-200">
                  <td colSpan={3} className="py-4 px-4 uppercase tracking-wider">
                    Total ({filteredAndSortedItems.length} transactions)
                  </td>
                  <td className="py-4 px-4 text-right text-base text-gray-900">
                    Tk {filteredAndSortedItems.reduce((sum, i) => sum + i.amount, 0).toLocaleString()}
                  </td>
                  <td className={`py-4 px-4 text-right text-base ${
                    filteredAndSortedItems.reduce((sum, i) => sum + i.profit, 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    Tk {filteredAndSortedItems.reduce((sum, i) => sum + i.profit, 0).toLocaleString()}
                  </td>
                  <td className="py-4 px-4"></td>
                </tr>
              </tfoot>
            </table>
          ) : (
            /* Empty State (Identical to Customers.tsx empty state) */
            <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
              <FileText size={32} className="mx-auto text-gray-300 mb-3" />
              <h3 className="text-base font-bold text-gray-900 mb-1">No transactions found</h3>
              <p className="text-sm text-gray-500">Try adjusting your date range or search query.</p>
            </div>
          )}
        </div>
      </div>

      {/* TRANSACTION DETAILS MODAL (Identical styling to Customers.tsx modals) */}
      {selectedTx && (() => {
        const data = selectedTx.data;
        const isSale = selectedTx.type === 'sales';
        const isCost = selectedTx.type === 'expenses';
        const isMfs = selectedTx.type === 'mfs';

        const saleCustomerName = isSale ? data.customerName?.trim() : '';
        const registeredCustomer = saleCustomerName
          ? customers.find(c => c.name.toLowerCase().trim() === saleCustomerName.toLowerCase().trim())
          : null;
        const customerPhone = (data as any).customerPhone?.trim() || registeredCustomer?.phone || '';

        const title = isSale ? data.serviceName : isCost ? (data.title || 'Expense') : `${data.operator} (${data.type})`;

        return (
          <div 
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
            onClick={() => setSelectedTx(null)}
          >
            <div 
              className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-4 border-b border-gray-100 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                      isSale ? 'bg-emerald-100 text-emerald-800' :
                      isCost ? 'bg-rose-100 text-rose-800' :
                      'bg-sky-100 text-sky-800'
                    }`}>
                      {isSale ? 'Sale Record' : isCost ? 'Expense Record' : 'MFS Record'}
                    </span>
                    <span className="text-xs text-gray-400 font-bold">#{data.id}</span>
                  </div>
                  <h3 className="text-xl font-black text-gray-900">{title}</h3>
                </div>
                <button 
                  onClick={() => setSelectedTx(null)} 
                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Customer Banner if Available */}
              {saleCustomerName && (
                <div className="bg-gray-50 rounded-xl p-3.5 mb-4 border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#084b3e] flex items-center justify-center font-bold">
                      <User size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">{saleCustomerName}</p>
                      {customerPhone ? (
                        <p className="text-[11px] text-gray-500 font-mono">{customerPhone}</p>
                      ) : (
                        <p className="text-[10px] text-gray-400">Customer</p>
                      )}
                    </div>
                  </div>
                  {registeredCustomer && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      Registered
                    </span>
                  )}
                </div>
              )}

              {/* Key Financial Cards */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 text-center">
                  <span className="text-[11px] font-bold text-gray-400 uppercase block">Amount</span>
                  <span className="text-xl font-black text-gray-900 mt-0.5 block">
                    Tk {data.amount?.toLocaleString()}
                  </span>
                </div>
                <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-100 text-center">
                  <span className="text-[11px] font-bold text-emerald-700 uppercase block">Profit</span>
                  <span className={`text-xl font-black mt-0.5 block ${data.profit >= 0 ? 'text-[#084b3e]' : 'text-rose-600'}`}>
                    {data.profit >= 0 ? '+Tk ' : '-Tk '}{Math.abs(data.profit || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Details List */}
              <div className="space-y-2.5 text-xs text-gray-600 mb-6 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="font-bold text-gray-400 uppercase">Date & Time</span>
                  <span className="font-extrabold text-gray-900">
                    {formatDateStr(data.date)} {data.time ? `• ${data.time}` : ''}
                  </span>
                </div>

                {isSale && (
                  <>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="font-bold text-gray-400 uppercase">Category</span>
                      <span className="font-extrabold text-gray-900">{data.category || 'Digital Studio'}</span>
                    </div>
                    {data.quantity && (
                      <div className="flex justify-between py-1 border-b border-gray-100">
                        <span className="font-bold text-gray-400 uppercase">Quantity</span>
                        <span className="font-extrabold text-gray-900">{data.quantity}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="font-bold text-gray-400 uppercase">Cost</span>
                      <span className="font-extrabold text-gray-900">Tk {data.cost || 0}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="font-bold text-gray-400 uppercase">Payment Method</span>
                      <span className={`font-black ${data.paymentMethod === 'Due' ? 'text-red-600' : 'text-gray-900'}`}>
                        {data.paymentMethod || 'Cash'}
                      </span>
                    </div>
                  </>
                )}

                {isCost && (
                  <>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="font-bold text-gray-400 uppercase">Category</span>
                      <span className="font-extrabold text-gray-900">{data.category || 'Expense'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="font-bold text-gray-400 uppercase">Payment</span>
                      <span className="font-extrabold text-gray-900">{data.paymentMethod || 'Cash'}</span>
                    </div>
                  </>
                )}

                {isMfs && (
                  <>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="font-bold text-gray-400 uppercase">Operator</span>
                      <span className="font-extrabold text-gray-900">{data.operator}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="font-bold text-gray-400 uppercase">Type</span>
                      <span className="font-extrabold text-gray-900">{data.type}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="font-bold text-gray-400 uppercase">Charge / Fee</span>
                      <span className="font-extrabold text-gray-900">Tk {data.charge || 0}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-100">
                      <span className="font-bold text-gray-400 uppercase">Balance After</span>
                      <span className="font-extrabold text-gray-900">Tk {(data.balanceAfter || 0).toLocaleString()}</span>
                    </div>
                  </>
                )}

                {data.note && (
                  <div className="flex justify-between py-1">
                    <span className="font-bold text-gray-400 uppercase">Note</span>
                    <span className="font-extrabold text-gray-900 max-w-[200px] text-right truncate">{data.note}</span>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button 
                type="button"
                onClick={() => setSelectedTx(null)} 
                className="w-full bg-[#084b3e] hover:bg-[#0c5e4e] text-white font-bold py-3 rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        );
      })()}

      {/* Hidden Printable Statement View (Triggered on Print) */}
      <div id="printable-report" className="hidden print:block bg-white p-6">
        <div className="text-center mb-6 border-b-2 border-black pb-4">
          <h1 className="text-2xl font-black uppercase">Al-Barakah Digital Studio & Online Service</h1>
          <p className="text-xs font-bold uppercase mt-1">Official Financial Statement & Account Ledger</p>
          <p className="text-xs font-medium text-gray-600 mt-1">{getRangeLabel()} • Printed on {format(new Date(), 'dd/MM/yyyy hh:mm a')}</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6 border border-black p-4">
          <div>
            <p className="text-xs font-bold uppercase">Total Sales</p>
            <p className="text-xl font-black">Tk {totalSales.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase">Total Expenses</p>
            <p className="text-xl font-black">Tk {totalExpense.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase">Net Profit</p>
            <p className="text-xl font-black">Tk {netProfit.toLocaleString()}</p>
          </div>
        </div>

        <table className="w-full text-left text-xs border-collapse border border-black">
          <thead>
            <tr className="bg-gray-100 border-b border-black">
              <th className="p-2 border border-black">Date</th>
              <th className="p-2 border border-black">Type</th>
              <th className="p-2 border border-black">Particulars</th>
              <th className="p-2 border border-black text-right">Amount</th>
              <th className="p-2 border border-black text-right">Profit</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedItems.map(item => (
              <tr key={item.id} className="border-b border-gray-300">
                <td className="p-2 border border-black">{formatDateStr(item.date)}</td>
                <td className="p-2 border border-black">{item.typeLabel}</td>
                <td className="p-2 border border-black">{item.title} {item.customerName ? `(${item.customerName})` : ''}</td>
                <td className="p-2 border border-black text-right">Tk {item.amount.toLocaleString()}</td>
                <td className="p-2 border border-black text-right">Tk {item.profit.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-between pt-16 mt-8 border-t border-gray-400 text-xs font-bold">
          <div>
            <div className="w-40 border-b border-black mb-1"></div>
            <p>Prepared By (Manager)</p>
          </div>
          <div className="text-right">
            <div className="w-40 border-b border-black mb-1 ml-auto"></div>
            <p>Authorized Signature</p>
          </div>
        </div>
      </div>
    </div>
  );
}
