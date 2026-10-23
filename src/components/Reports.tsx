import React, { useState, useMemo } from 'react';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { 
  FileBarChart,
  TrendingUp, 
  Receipt, 
  Coins, 
  Search, 
  Printer, 
  Download, 
  X, 
  Loader2, 
  Check 
} from 'lucide-react';
import { generateStatementPdf, printStatement } from '../utils/pdfExport';
import { formatDateStr } from '../utils/dateFormatter';
import { Modal } from './common/Modal';

export function Reports() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const last7Str = format(subDays(new Date(), 7), 'yyyy-MM-dd');
  const thisMonthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const thisMonthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

  // Filters & State
  const [dateFilter, setDateFilter] = useState<'today' | 'last7' | 'month' | 'all' | 'custom'>('today');
  const [customStart, setCustomStart] = useState(todayStr);
  const [customEnd, setCustomEnd] = useState(todayStr);
  const [activeTab, setActiveTab] = useState<'all' | 'sales' | 'expenses' | 'mfs'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'amount-high' | 'profit-high'>('newest');

  // Modal & Action states
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [pdfError, setPdfError] = useState('');

  // Compute active date range
  const { start, end } = useMemo(() => {
    if (dateFilter === 'last7') return { start: last7Str, end: todayStr };
    if (dateFilter === 'month') return { start: thisMonthStart, end: thisMonthEnd };
    if (dateFilter === 'custom') return { start: customStart, end: customEnd };
    return { start: todayStr, end: todayStr };
  }, [dateFilter, todayStr, last7Str, thisMonthStart, thisMonthEnd, customStart, customEnd]);

  // Live queries
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

  // Summary Metrics
  const totalSales = useMemo(() => sales.reduce((a, b) => a + (b.amount || 0), 0), [sales]);
  const salesProfit = useMemo(() => sales.reduce((a, b) => a + (b.profit || 0), 0), [sales]);
  const totalExpense = useMemo(() => expenses.reduce((a, b) => a + (b.amount || 0), 0), [expenses]);
  const mfsProfit = useMemo(() => mfs.reduce((a, b) => a + (b.profit || 0), 0), [mfs]);
  const netProfit = useMemo(() => (salesProfit + mfsProfit) - totalExpense, [salesProfit, mfsProfit, totalExpense]);

  // Unified items list
  const unifiedItems = useMemo(() => {
    const list: Array<{
      id: string;
      originalId: number;
      date: string;
      time?: string;
      type: 'sale' | 'expense' | 'mfs';
      typeLabel: string;
      title: string;
      subtitle?: string;
      customerName?: string;
      paymentMethod: string;
      amount: number;
      cost: number;
      profit: number;
      raw: any;
    }> = [];

    sales.forEach(s => {
      list.push({
        id: `sale-${s.id}`,
        originalId: s.id!,
        date: s.date,
        time: s.time,
        type: 'sale',
        typeLabel: 'Sale',
        title: s.serviceName + (s.quantity && s.quantity !== 1 && s.quantity !== '1' ? ` (x${s.quantity})` : ''),
        subtitle: s.note,
        customerName: s.customerName,
        paymentMethod: s.paymentMethod || 'Cash',
        amount: s.amount || 0,
        cost: s.cost || 0,
        profit: s.profit || 0,
        raw: s
      });
    });

    expenses.forEach(e => {
      list.push({
        id: `expense-${e.id}`,
        originalId: e.id!,
        date: e.date,
        time: e.time,
        type: 'expense',
        typeLabel: 'Expense',
        title: e.title,
        subtitle: e.category,
        paymentMethod: e.paymentMethod || 'Cash',
        amount: e.amount || 0,
        cost: e.amount || 0,
        profit: -(e.amount || 0),
        raw: e
      });
    });

    mfs.forEach(m => {
      list.push({
        id: `mfs-${m.id}`,
        originalId: m.id!,
        date: m.date,
        time: m.time,
        type: 'mfs',
        typeLabel: 'MFS',
        title: `${m.operator} ${m.type}`,
        subtitle: m.balanceAfter !== undefined ? `Bal: Tk ${m.balanceAfter.toLocaleString()}` : (m.charge ? `Fee: Tk ${m.charge}` : undefined),
        paymentMethod: m.operator,
        amount: m.amount || 0,
        cost: 0,
        profit: m.profit || 0,
        raw: m
      });
    });

    return list;
  }, [sales, expenses, mfs]);

  // Tab counts
  const allCount = unifiedItems.length;
  const salesCount = sales.length;
  const expensesCount = expenses.length;
  const mfsCount = mfs.length;

  // Filtered & Sorted items
  const filteredAndSortedItems = useMemo(() => {
    let list = [...unifiedItems];

    if (activeTab === 'sales') {
      list = list.filter(i => i.type === 'sale');
    } else if (activeTab === 'expenses') {
      list = list.filter(i => i.type === 'expense');
    } else if (activeTab === 'mfs') {
      list = list.filter(i => i.type === 'mfs');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(i => 
        i.title.toLowerCase().includes(q) ||
        (i.subtitle && i.subtitle.toLowerCase().includes(q)) ||
        (i.customerName && i.customerName.toLowerCase().includes(q)) ||
        i.paymentMethod.toLowerCase().includes(q) ||
        i.date.includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'amount-high') {
        return b.amount - a.amount;
      }
      if (sortBy === 'profit-high') {
        return b.profit - a.profit;
      }
      const dtA = `${a.date} ${a.time || ''}`;
      const dtB = `${b.date} ${b.time || ''}`;
      return dtB.localeCompare(dtA);
    });

    return list;
  }, [unifiedItems, activeTab, searchQuery, sortBy]);

  const getRangeLabel = () => {
    if (dateFilter === 'all') return 'All Time';
    if (dateFilter === 'today') return `Today (${todayStr})`;
    if (dateFilter === 'last7') return `Last 7 Days (${last7Str} to ${todayStr})`;
    if (dateFilter === 'month') return `This Month (${thisMonthStart} to ${thisMonthEnd})`;
    return `Period: ${customStart} to ${customEnd}`;
  };

  // PDF Export
  const handleExportPDF = async () => {
    if (isExporting) return;
    try {
      setIsExporting(true);
      await generateStatementPdf({
        sales,
        expenses,
        mfs,
        periodLabel: getRangeLabel(),
        activeTab,
        mode: activeTab === 'all' ? 'full' : 'active',
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
      setPdfError('Could not export PDF statement. Please try again.');
      setTimeout(() => setPdfError(''), 4000);
    } finally {
      setIsExporting(false);
    }
  };

  // Print
  const handlePrint = async () => {
    try {
      await printStatement({
        sales,
        expenses,
        mfs,
        periodLabel: getRangeLabel(),
        activeTab,
        mode: activeTab === 'all' ? 'full' : 'active',
        totalSales,
        salesProfit,
        totalExpense,
        mfsProfit,
        netProfit,
      });
    } catch (err) {
      console.error('Print error:', err);
      window.print();
    }
  };

  // Calculated totals for table footer
  const totalTableAmount = filteredAndSortedItems.reduce((acc, item) => acc + item.amount, 0);
  const totalTableProfit = filteredAndSortedItems.reduce((acc, item) => acc + item.profit, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#084b3e] rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md">
            <FileBarChart size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Reports</h1>
            <p className="text-sm text-gray-500 font-medium">Financial breakdown & audit statements</p>
          </div>
        </div>

        {/* Action Buttons: Print & Export */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <Printer size={15} />
            <span>Print</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="px-4 py-2 bg-[#084b3e] hover:bg-[#0c5e4e] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : pdfSuccess ? (
              <Check size={15} />
            ) : (
              <Download size={15} />
            )}
            <span>{isExporting ? 'Generating...' : pdfSuccess ? 'Downloaded!' : 'Export Statement'}</span>
          </button>
        </div>
      </div>

      {pdfError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center justify-between">
          <span>{pdfError}</span>
          <button onClick={() => setPdfError('')} className="p-1 hover:text-red-900 cursor-pointer"><X size={14} /></button>
        </div>
      )}

      {/* 2. Top Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Sales */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Sales</p>
            <p className="text-2xl font-black text-gray-900">Tk {totalSales.toLocaleString()}</p>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Receipt size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Expenses</p>
            <p className="text-2xl font-black text-gray-900">Tk {totalExpense.toLocaleString()}</p>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#084b3e] flex items-center justify-center shrink-0">
            <Coins size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Net Profit</p>
            <p className={`text-2xl font-black ${netProfit >= 0 ? 'text-[#084b3e]' : 'text-rose-600'}`}>
              Tk {netProfit.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Main Data Card with Ultra-Simple Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {/* Top Controls: Tabs, Search & Filters */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 mb-4 border-b border-gray-100">
          {/* Simple Tab Buttons */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            {(['all', 'sales', 'expenses', 'mfs'] as const).map(tab => {
              const count = tab === 'all' ? allCount : tab === 'sales' ? salesCount : tab === 'expenses' ? expensesCount : mfsCount;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === tab
                      ? 'bg-white text-gray-900 shadow-2xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <span className="capitalize">{tab === 'all' ? 'All' : tab}</span>
                  <span className="text-[10px] text-gray-400 font-semibold">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Search Box */}
            <div className="relative flex-1 sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#084b3e] bg-gray-50"
              />
            </div>

            {/* Period Filter */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#084b3e] bg-gray-50 cursor-pointer"
            >
              <option value="today">Today</option>
              <option value="last7">Last 7 Days</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range</option>
            </select>

            {dateFilter === 'custom' && (
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-2 py-1 border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#084b3e] bg-gray-50"
                />
                <span className="text-xs text-gray-400">-</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-2 py-1 border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#084b3e] bg-gray-50"
                />
              </div>
            )}

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#084b3e] bg-gray-50 cursor-pointer"
            >
              <option value="newest">Newest</option>
              <option value="amount-high">Amount (High)</option>
              <option value="profit-high">Profit (High)</option>
            </select>
          </div>
        </div>

        {/* ULTRA-SIMPLE, CLEAN TABLE */}
        <div className="overflow-x-auto">
          {filteredAndSortedItems.length > 0 ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Particulars / Description</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAndSortedItems.map((item) => {
                  const isExpense = item.type === 'expense';
                  return (
                    <tr 
                      key={item.id}
                      onClick={() => setSelectedTx(item)}
                      className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                    >
                      {/* Date */}
                      <td className="py-3 px-3 text-gray-600 whitespace-nowrap">
                        <div className="font-semibold text-gray-900">{formatDateStr(item.date)}</div>
                        {item.time && <div className="text-[10px] text-gray-400">{item.time}</div>}
                      </td>

                      {/* Description */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-gray-900">{item.title}</div>
                        {item.customerName && (
                          <div className="text-[11px] text-gray-500">Customer: {item.customerName}</div>
                        )}
                        {item.subtitle && !item.customerName && (
                          <div className="text-[11px] text-gray-400">{item.subtitle}</div>
                        )}
                      </td>

                      {/* Type */}
                      <td className="py-3 px-3 whitespace-nowrap text-gray-600 font-medium">
                        {item.typeLabel}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3 px-3 whitespace-nowrap text-gray-600">
                        {item.paymentMethod}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-3 text-right font-bold text-gray-900 whitespace-nowrap">
                        {isExpense ? '-Tk ' : 'Tk '}{item.amount.toLocaleString()}
                      </td>

                      {/* Profit */}
                      <td className={`py-3 px-3 text-right font-semibold whitespace-nowrap ${
                        item.profit > 0 ? 'text-emerald-600' :
                        item.profit < 0 ? 'text-rose-600' :
                        'text-gray-400'
                      }`}>
                        {item.profit > 0 ? '+' : ''}Tk {item.profit.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Clean Simple Total Footer */}
              <tfoot>
                <tr className="border-t-2 border-gray-200 font-bold bg-gray-50/50 text-gray-900">
                  <td colSpan={4} className="py-3 px-3">
                    Total ({filteredAndSortedItems.length} items)
                  </td>
                  <td className="py-3 px-3 text-right text-sm">
                    Tk {totalTableAmount.toLocaleString()}
                  </td>
                  <td className={`py-3 px-3 text-right text-sm ${
                    totalTableProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    Tk {totalTableProfit.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <div className="text-center py-10 text-gray-400">
              <p className="text-sm font-medium text-gray-600">No transactions found</p>
              <p className="text-xs text-gray-400 mt-0.5">Try adjusting your date range or search query</p>
            </div>
          )}
        </div>
      </div>

      {/* Transaction Details Modal */}
      <Modal
        isOpen={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        title={selectedTx ? `${selectedTx.typeLabel} Details` : 'Transaction Details'}
        maxWidth="sm"
      >
        {selectedTx && (
          <div className="space-y-4">
            <div className="text-center pb-2 border-b border-[#d8e0e8]/60">
              <h4 className="font-bold text-[15px] text-[#202b3d]">{selectedTx.title}</h4>
              <p className="text-[12px] font-semibold text-[#8b95a3]">{selectedTx.typeLabel} #{selectedTx.originalId}</p>
            </div>

            <div className="bg-[#f7f8fa] border border-[#d8e0e8] rounded-[12px] p-3 text-[13px] space-y-2">
              <div className="flex justify-between py-1 border-b border-[#d8e0e8]/50">
                <span className="text-[#8b95a3]">Date</span>
                <span className="font-semibold text-[#202b3d]">{formatDateStr(selectedTx.date)} {selectedTx.time || ''}</span>
              </div>
              {selectedTx.customerName && (
                <div className="flex justify-between py-1 border-b border-[#d8e0e8]/50">
                  <span className="text-[#8b95a3]">Customer</span>
                  <span className="font-semibold text-[#202b3d]">{selectedTx.customerName}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-[#d8e0e8]/50">
                <span className="text-[#8b95a3]">Method</span>
                <span className="font-semibold text-[#202b3d]">{selectedTx.paymentMethod}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#d8e0e8]/50">
                <span className="text-[#8b95a3]">Amount</span>
                <span className="font-bold text-[#202b3d]">Tk {selectedTx.amount?.toLocaleString()}</span>
              </div>
              {selectedTx.type === 'sale' && (
                <div className="flex justify-between py-1 border-b border-[#d8e0e8]/50">
                  <span className="text-[#8b95a3]">Cost</span>
                  <span className="font-semibold text-[#202b3d]">Tk {selectedTx.cost?.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-[#d8e0e8]/50">
                <span className="text-[#8b95a3]">Profit</span>
                <span className={`font-bold ${selectedTx.profit >= 0 ? 'text-[#075e4f]' : 'text-rose-600'}`}>
                  {selectedTx.profit >= 0 ? '+Tk ' : '-Tk '}{Math.abs(selectedTx.profit || 0).toLocaleString()}
                </span>
              </div>
              {selectedTx.subtitle && (
                <div className="flex justify-between py-1">
                  <span className="text-[#8b95a3]">Note</span>
                  <span className="text-[#202b3d] font-medium">{selectedTx.subtitle}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedTx(null)}
              className="w-full min-h-[45px] bg-[#f7f8fa] hover:bg-[#eef2f5] border border-[#d8e0e8] text-[#4b5870] hover:text-[#202b3d] font-[750] text-[13px] rounded-[12px] transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
