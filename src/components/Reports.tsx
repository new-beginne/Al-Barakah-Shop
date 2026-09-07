import React, { useState, useMemo } from 'react';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, subDays, startOfMonth, subMonths, endOfMonth } from 'date-fns';
import { 
  Printer, 
  Calendar, 
  Download, 
  X, 
  Eye, 
  CheckCircle2, 
  Loader2, 
  Phone, 
  ChevronDown, 
  FileText, 
  Layers,
  Check
} from 'lucide-react';
import { generateStatementPdf } from '../utils/pdfExport';

export function Reports() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const last7Str = format(subDays(new Date(), 7), 'yyyy-MM-dd');
  const lastMonthStartStr = format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd');
  const lastMonthEndStr = format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd');

  const [dateFilter, setDateFilter] = useState('today');
  const [customStart, setCustomStart] = useState(todayStr);
  const [customEnd, setCustomEnd] = useState(todayStr);
  
  const [activeTab, setActiveTab] = useState<'all' | 'sales' | 'expenses' | 'mfs'>('all');
  const [selectedTx, setSelectedTx] = useState<any>(null); // For popup details
  const [isExporting, setIsExporting] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [showPdfOptions, setShowPdfOptions] = useState(false);

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

  // Unified audit ledger items combining sales, expenses, and MFS
  const unifiedItems = useMemo(() => {
    const items: Array<{
      id: string;
      originalId: number;
      date: string;
      time?: string;
      type: 'sell' | 'cost' | 'mfs';
      typeLabel: string; // 'Sell' | 'Cost' | 'MFS'
      title: string;
      detail?: string;
      customerName?: string;
      paymentMethod?: string;
      amount: number;
      cost: number;
      profit: number;
      rawItem: any;
    }> = [];

    sales.forEach(s => {
      items.push({
        id: `sale-${s.id}`,
        originalId: s.id!,
        date: s.date,
        time: s.time,
        type: 'sell',
        typeLabel: 'Sell',
        title: s.serviceName + (s.quantity && s.quantity != 1 && s.quantity !== '1' ? ` (${s.quantity})` : ''),
        detail: s.note,
        customerName: s.customerName,
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
        typeLabel: 'Cost',
        title: e.title,
        detail: e.note || e.category,
        paymentMethod: 'Cash/Operating',
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

    // Sort chronologically descending
    items.sort((a, b) => {
      const dateTimeA = `${a.date} ${a.time || ''}`;
      const dateTimeB = `${b.date} ${b.time || ''}`;
      return dateTimeB.localeCompare(dateTimeA);
    });

    return items;
  }, [sales, expenses, mfs]);

  // Summaries
  const totalSales = sales.reduce((a, b) => a + b.amount, 0);
  const salesProfit = sales.reduce((a, b) => a + b.profit, 0);
  const totalExpense = expenses.reduce((a, b) => a + b.amount, 0);
  const mfsProfit = mfs.reduce((a, b) => a + b.profit, 0);
  const netProfit = (salesProfit + mfsProfit) - totalExpense;

  const getRangeLabel = () => {
    if (dateFilter === 'all') return 'All Time';
    if (dateFilter === 'today') return `Today (${todayStr})`;
    if (dateFilter === 'last7') return `Last 7 Days (${last7Str} to ${todayStr})`;
    if (dateFilter === 'lastMonth') return `Last Month (${lastMonthStartStr} to ${lastMonthEndStr})`;
    return `Custom (${customStart} to ${customEnd})`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async (mode: 'active' | 'full' = 'active') => {
    if (isExporting) return;
    try {
      setIsExporting(true);
      setShowPdfOptions(false);
      
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
      setTimeout(() => setPdfSuccess(false), 3000);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Could not export PDF. You can also click "Print Statement" and choose "Save as PDF".');
    } finally {
      setIsExporting(false);
    }
  };

  const DetailTile = ({
    label,
    value,
    variant = 'default',
    colSpan = 1
  }: {
    label: string;
    value: React.ReactNode;
    variant?: 'default' | 'profit' | 'due' | 'cost' | 'subtle';
    colSpan?: 1 | 2;
  }) => {
    let styleClasses = 'bg-gray-50 border-gray-100 text-gray-900';
    let labelClasses = 'text-gray-500';

    if (variant === 'profit') {
      styleClasses = 'bg-emerald-50/70 border-emerald-200 text-emerald-800';
      labelClasses = 'text-emerald-700';
    } else if (variant === 'due') {
      styleClasses = 'bg-red-50/70 border-red-200 text-red-700';
      labelClasses = 'text-red-600';
    } else if (variant === 'cost') {
      styleClasses = 'bg-amber-50/60 border-amber-200 text-amber-900';
      labelClasses = 'text-amber-700';
    } else if (variant === 'subtle') {
      styleClasses = 'bg-gray-50/50 border-gray-100 text-gray-600';
      labelClasses = 'text-gray-400';
    }

    return (
      <div className={`p-2.5 rounded-xl border flex flex-col justify-center min-w-0 ${styleClasses} ${colSpan === 2 ? 'col-span-2' : 'col-span-1'}`}>
        <span className={`text-[10px] font-bold uppercase tracking-wider truncate ${labelClasses}`}>
          {label}
        </span>
        <div className="text-xs sm:text-sm font-black mt-0.5 break-words">
          {value}
        </div>
      </div>
    );
  };

  const DetailRow = ({ label, value, highlight = false }: { label: string, value: string | number, highlight?: boolean }) => (
    <div className="flex justify-between items-center py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-black text-right ${highlight ? 'text-gray-900 text-base' : 'text-gray-800'}`}>{value}</span>
    </div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto overflow-x-hidden p-2.5 sm:p-4 md:p-6 mb-20 md:mb-6">
      
      {/* Filtering Section (Hidden on Print) */}
      <div className="w-full flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 sm:p-4 rounded-xl border border-gray-100 print:hidden mb-4 sm:mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Calendar size={18} className="text-gray-500 shrink-0" />
            <select 
              value={dateFilter} 
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-gray-50 border border-gray-300 text-xs sm:text-sm font-bold p-2 sm:p-2.5 rounded-xl focus:border-[#084b3e] outline-none w-full sm:w-auto"
            >
              <option value="today">Today</option>
              <option value="last7">Last 7 Days</option>
              <option value="lastMonth">Last Month</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input 
                type="date" 
                value={customStart} 
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-xs sm:text-sm font-bold p-2 rounded-xl focus:border-[#084b3e] outline-none w-full sm:w-auto"
              />
              <span className="text-gray-500 font-bold text-xs uppercase">to</span>
              <input 
                type="date" 
                value={customEnd} 
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-xs sm:text-sm font-bold p-2 rounded-xl focus:border-[#084b3e] outline-none w-full sm:w-auto"
              />
            </div>
          )}
        </div>
      </div>

        {/* Printable Area Starts Here */}
      <div id="printable-report" className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-6 md:p-8 print:border-none print:shadow-none print:p-0 overflow-hidden">
        
        {/* Header / Shop Identity */}
        <div className="text-center mb-6 sm:mb-8 border-b border-gray-100 pb-4 sm:pb-6 print:border-b-2 print:border-black print:pb-4 print:mb-4">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 uppercase tracking-tight">Al-Barakah Digital Studio & Online Service</h1>
          <p className="text-gray-500 font-bold uppercase tracking-wider text-xs sm:text-sm mt-1 print:text-black">
            Official Financial Statement & Account Ledger
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2.5">
            <span className="text-[11px] sm:text-xs font-bold text-gray-900 bg-gray-100 print:bg-transparent print:border print:border-black px-3 py-1 rounded-md uppercase tracking-wider">
              Statement: {activeTab === 'all' ? 'FULL AUDIT' : activeTab.toUpperCase()}
            </span>
            <span className="text-[11px] sm:text-xs font-bold text-gray-700 print:text-black bg-gray-100 print:bg-transparent print:border print:border-gray-400 px-3 py-1 rounded-md uppercase tracking-wider">
              {getRangeLabel()}
            </span>
            <span className="text-[10px] sm:text-[11px] text-gray-400 print:text-gray-700 font-medium py-1">
              Generated: {format(new Date(), 'dd/MM/yyyy, hh:mm a')}
            </span>
          </div>
        </div>

        {/* Summary Widgets */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8 print:mb-5">
          <div className="bg-white border border-gray-100 print:border-black p-4 sm:p-5 rounded-xl shadow-sm flex flex-col justify-between">
            <p className="text-[11px] sm:text-xs font-bold text-gray-500 print:text-black uppercase tracking-wider mb-1">Total Sales</p>
            <p className="text-2xl sm:text-3xl font-black text-gray-900">Tk {totalSales.toFixed(2)}</p>
            <p className="text-[11px] font-bold text-gray-400 print:text-gray-700 mt-1 uppercase tracking-wider">Profit: Tk {salesProfit.toFixed(2)}</p>
          </div>
          <div className="bg-white border border-gray-100 print:border-black p-4 sm:p-5 rounded-xl shadow-sm flex flex-col justify-between">
            <p className="text-[11px] sm:text-xs font-bold text-gray-500 print:text-black uppercase tracking-wider mb-1">Total Expenses</p>
            <p className="text-2xl sm:text-3xl font-black text-gray-900">Tk {totalExpense.toFixed(2)}</p>
            <p className="text-[11px] font-bold text-gray-400 print:text-gray-700 mt-1 uppercase tracking-wider">Costs & Bills</p>
          </div>
          <div className="bg-[#084b3e] p-4 sm:p-5 rounded-xl shadow-sm flex flex-col justify-between text-white print:bg-white print:border print:border-black print:text-black">
            <p className="text-[11px] sm:text-xs font-bold text-gray-400 print:text-black uppercase tracking-wider mb-1">Net Profit</p>
            <p className="text-2xl sm:text-3xl font-black">Tk {netProfit.toFixed(2)}</p>
            <p className="text-[10px] font-bold text-gray-400 print:text-gray-700 mt-1 uppercase tracking-wider">Sales + MFS - Expenses</p>
          </div>
        </div>

        {/* Tabs and Quick Export Button (Hidden on Print) */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-gray-100 mb-4 sm:mb-6 print:hidden gap-3 pb-2">
          <div className="flex space-x-1 sm:space-x-2 w-full sm:w-auto">
            {(['all', 'sales', 'expenses', 'mfs'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 sm:flex-none px-3 sm:px-5 py-2.5 font-bold text-xs sm:text-sm uppercase tracking-wider transition-colors whitespace-nowrap rounded-xl cursor-pointer ${
                  activeTab === tab 
                    ? 'bg-[#084b3e] text-white shadow-sm' 
                    : 'bg-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                {tab === 'all' ? 'Full Audit' : tab === 'sales' ? 'Sales' : tab === 'expenses' ? 'Expenses' : 'MFS'}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button 
              onClick={() => handleExportPDF(activeTab === 'all' ? 'full' : 'active')}
              disabled={isExporting}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#084b3e] hover:bg-[#126b55] disabled:bg-gray-400 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors shadow-sm whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : pdfSuccess ? <Check size={16} className="text-white" /> : <Download size={16} />}
              <span>
                {isExporting ? 'Generating...' : pdfSuccess ? 'Downloaded' : 
                  activeTab === 'all' ? 'Export Full Audit' : 
                  activeTab === 'sales' ? 'Export Sales Report' : 
                  activeTab === 'expenses' ? 'Export Expense Report' : 
                  'Export MFS Report'
                }
              </span>
            </button>
          </div>
        </div>

        {/* Print Only Header for Tables */}
        <div className="hidden print:block mb-3">
          <h2 className="text-base font-black uppercase tracking-wider">
            {activeTab === 'all' ? 'FULL AUDIT & FINANCIAL LEDGER (ALL TRANSACTIONS)' : `${activeTab.toUpperCase()} TRANSACTIONS`}
          </h2>
        </div>

        {/* Helper info banner */}
        <div className="text-[11px] text-gray-500 font-medium mb-2.5 flex items-center justify-between print:hidden">
          <span className="flex items-center gap-1 text-gray-600"><Eye size={13} className="text-gray-900" /> Click row for details</span>
          <span className="font-bold text-gray-900">
            Total: {activeTab === 'all' ? unifiedItems.length : activeTab === 'sales' ? sales.length : activeTab === 'expenses' ? expenses.length : mfs.length}
          </span>
        </div>

        {/* 
          100% Fixed Layout Tables - Zero horizontal/landscape scroll on any screen size.
          Percentages strictly total 100% for both mobile (<md) and desktop (md+).
        */}
        
        {/* Full Audit Single Unified Table */}
        {activeTab === 'all' && (
          <div className="w-full border border-gray-100 print:border-black rounded-xl overflow-hidden bg-white">
            <table className="w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="bg-[#084b3e] text-white text-[10px] sm:text-xs uppercase tracking-wider select-none print:bg-black print:text-white">
                  {/* Mobile: 20% | Desktop: 14% | Print: 14% */}
                  <th className="w-[20%] md:w-[14%] print:w-[14%] p-2 sm:p-3 font-black truncate">Date</th>
                  {/* Mobile: 18% | Desktop: 11% | Print: 11% */}
                  <th className="w-[18%] md:w-[11%] print:w-[11%] p-2 sm:p-3 text-center font-black truncate">Type</th>
                  {/* Mobile: 36% | Desktop: 31% | Print: 31% */}
                  <th className="w-[36%] md:w-[31%] print:w-[31%] p-2 sm:p-3 font-black truncate">Particulars</th>
                  {/* Desktop Only + Print: 12% */}
                  <th className="hidden md:table-cell print:table-cell md:w-[12%] print:w-[12%] p-2 sm:p-3 font-black truncate">Payment / Ref</th>
                  {/* Mobile: 26% | Desktop: 11% | Print: 11% */}
                  <th className="w-[26%] md:w-[11%] print:w-[11%] p-2 sm:p-3 text-right font-black truncate">Amount</th>
                  {/* Desktop Only + Print: 10% */}
                  <th className="hidden md:table-cell print:table-cell md:w-[10%] print:w-[10%] p-2 sm:p-3 text-right font-black truncate">Cost</th>
                  {/* Desktop Only + Print: 11% */}
                  <th className="hidden md:table-cell print:table-cell md:w-[11%] print:w-[11%] p-2 sm:p-3 text-right font-black truncate">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white text-xs">
                {unifiedItems.map((item) => {
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
                      className={`transition-colors cursor-pointer active:bg-gray-100 ${
                        isDue 
                          ? 'bg-red-50/40 hover:bg-red-50/80 border-l-4 border-l-red-500' 
                          : isCost
                          ? 'hover:bg-rose-50/40'
                          : 'hover:bg-gray-50'
                      }`}
                      title="Click for full details"
                    >
                      {/* Date & Time */}
                      <td className="p-2 sm:p-3 text-[11px] sm:text-xs text-gray-700 font-medium truncate">
                        <div className="font-semibold text-gray-900 leading-tight">{item.date}</div>
                        {item.time && <div className="text-[10px] text-gray-400 font-medium leading-tight">{item.time}</div>}
                      </td>

                      {/* Indicator Column (Sell, Cost, MFS) */}
                      <td className="p-2 sm:p-3 text-center truncate">
                        {isSale && (
                          <span className="inline-flex items-center justify-center px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 print:bg-transparent print:border-black print:text-black">
                            Sell
                          </span>
                        )}
                        {isCost && (
                          <span className="inline-flex items-center justify-center px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300 print:bg-transparent print:border-black print:text-black">
                            Cost
                          </span>
                        )}
                        {isMfs && (
                          <span className="inline-flex items-center justify-center px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-300 print:bg-transparent print:border-black print:text-black">
                            MFS
                          </span>
                        )}
                      </td>

                      {/* Particulars / Title (+ Note / Customer on mobile) */}
                      <td className="p-2 sm:p-3 overflow-hidden">
                        <div className="font-bold text-gray-900 text-[11px] sm:text-xs truncate flex items-center gap-1">
                          <span>{item.title}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-400 font-medium truncate">
                          {item.customerName && (
                            <span className="text-gray-600 font-semibold truncate">
                              {item.customerName}
                            </span>
                          )}
                          {item.detail && <span className="truncate">({item.detail})</span>}
                        </div>
                      </td>

                      {/* Payment / Ref (Desktop & Print) */}
                      <td className="hidden md:table-cell print:table-cell p-2 sm:p-3 truncate">
                        {isDue ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-red-100 text-red-700 border border-red-300 print:border-black print:text-black">
                            DUE
                          </span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-900 border border-gray-100 print:bg-transparent">
                            {item.paymentMethod || (isCost ? 'Cash/Bank' : 'Direct')}
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="p-2 sm:p-3 text-right font-black text-[11px] sm:text-xs truncate">
                        <span className={isCost ? 'text-rose-700' : isDue ? 'text-red-600' : 'text-gray-900'}>
                          Tk {item.amount.toLocaleString()}
                        </span>
                        {/* Mobile subtext for profit */}
                        <div className="md:hidden text-[9px] font-bold">
                          {item.profit >= 0 ? (
                            <span className="text-emerald-700">+Tk {item.profit}</span>
                          ) : (
                            <span className="text-rose-600">-Tk {Math.abs(item.profit)}</span>
                          )}
                        </div>
                      </td>

                      {/* Cost (Desktop & Print) */}
                      <td className="hidden md:table-cell print:table-cell p-2 sm:p-3 text-right text-gray-500 text-xs truncate">
                        Tk {item.cost.toLocaleString()}
                      </td>

                      {/* Profit (Desktop & Print) */}
                      <td className="hidden md:table-cell print:table-cell p-2 sm:p-3 text-right font-bold text-xs truncate">
                        {item.profit >= 0 ? (
                          <span className="text-emerald-700 font-black">+Tk {item.profit.toLocaleString()}</span>
                        ) : (
                          <span className="text-rose-600 font-black">-Tk {Math.abs(item.profit).toLocaleString()}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {unifiedItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400 font-bold uppercase tracking-wider text-xs">
                      No transactions found in this period
                    </td>
                  </tr>
                )}
              </tbody>
              {unifiedItems.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-100 text-gray-900 font-black text-[11px] sm:text-xs border-t-2 border-gray-300 print:bg-white print:border-t-2 print:border-black">
                    <td colSpan={2} className="p-2 sm:p-3 uppercase">Total ({unifiedItems.length} items)</td>
                    <td className="p-2 sm:p-3 hidden md:table-cell print:table-cell">-</td>
                    <td className="hidden md:table-cell print:table-cell p-2 sm:p-3 text-center">-</td>
                    <td className="p-2 sm:p-3 text-right font-black text-gray-900">
                      Tk {unifiedItems.reduce((a, b) => a + b.amount, 0).toLocaleString()}
                    </td>
                    <td className="hidden md:table-cell print:table-cell p-2 sm:p-3 text-right text-gray-600 font-bold">
                      Tk {unifiedItems.reduce((a, b) => a + b.cost, 0).toLocaleString()}
                    </td>
                    <td className={`hidden md:table-cell print:table-cell p-2 sm:p-3 text-right font-black ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {netProfit >= 0 ? '+' : ''}Tk {netProfit.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
        
        {/* Sales Table */}
        {activeTab === 'sales' && (
          <div className="w-full border border-gray-100 print:border-black rounded-xl overflow-hidden bg-white">
            <table className="w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="bg-[#084b3e] text-white text-[10px] sm:text-xs uppercase tracking-wider select-none print:bg-black print:text-white">
                  {/* Mobile: 22% | Desktop: 15% | Print: 15% */}
                  <th className="w-[22%] md:w-[15%] print:w-[15%] p-2 sm:p-3 font-black truncate">Date</th>
                  {/* Mobile: 36% | Desktop: 27% | Print: 27% */}
                  <th className="w-[36%] md:w-[27%] print:w-[27%] p-2 sm:p-3 font-black truncate">Service</th>
                  {/* Desktop Only + Print: 14% */}
                  <th className="hidden md:table-cell print:table-cell md:w-[14%] print:w-[14%] p-2 sm:p-3 font-black truncate">Payment</th>
                  {/* Mobile: 21% | Desktop: 14% | Print: 14% */}
                  <th className="w-[21%] md:w-[14%] print:w-[14%] p-2 sm:p-3 text-right font-black truncate">Sell</th>
                  {/* Desktop Only + Print: 14% */}
                  <th className="hidden md:table-cell print:table-cell md:w-[14%] print:w-[14%] p-2 sm:p-3 text-right font-black truncate">Cost</th>
                  {/* Mobile: 21% | Desktop: 16% | Print: 16% */}
                  <th className="w-[21%] md:w-[16%] print:w-[16%] p-2 sm:p-3 text-right font-black truncate">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white text-xs">
                {sales.map((s) => {
                  const isDue = s.paymentMethod === 'Due';
                  return (
                    <tr 
                      key={s.id} 
                      onClick={() => setSelectedTx({ type: 'sales', data: s })}
                      className={`transition-colors cursor-pointer active:bg-gray-100 ${
                        isDue ? 'bg-red-50/40 hover:bg-red-50/80 border-l-4 border-l-red-500' : 'hover:bg-gray-50'
                      }`}
                      title="Click for full details"
                    >
                      {/* Date & Time */}
                      <td className="p-2 sm:p-3 text-[11px] sm:text-xs text-gray-700 font-medium truncate">
                        <div className="font-semibold text-gray-900 leading-tight">{s.date}</div>
                        {s.time && <div className="text-[10px] text-gray-400 font-medium leading-tight">{s.time}</div>}
                      </td>

                      {/* Service Name (+ Payment badge & note on mobile) */}
                      <td className="p-2 sm:p-3 overflow-hidden">
                        <div className="font-bold text-gray-900 text-[11px] sm:text-xs truncate flex items-center gap-1">
                          <span>{s.serviceName}</span>
                          {s.quantity && s.quantity != 1 && s.quantity !== '1' ? (
                            <span className="text-[10px] font-black text-gray-500 bg-gray-100 px-1 py-0.2 rounded border border-gray-100 shrink-0">
                              {s.quantity}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {isDue ? (
                            <span className="md:hidden inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-red-100 text-red-700 border border-red-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                              DUE
                            </span>
                          ) : (
                            <span className="md:hidden inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-gray-100 text-gray-800 border border-gray-100 truncate">
                              {s.paymentMethod}
                            </span>
                          )}
                          {s.note && <span className="text-[10px] text-gray-400 font-medium truncate">({s.note})</span>}
                        </div>
                      </td>

                      {/* Payment Method (Desktop + Print) */}
                      <td className="hidden md:table-cell print:table-cell p-2 sm:p-3 truncate">
                        {isDue ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700 border border-red-300 shadow-xs print:border-black print:text-black">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse print:hidden"></span>
                            DUE
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-900 border border-gray-100 print:bg-transparent">
                            {s.paymentMethod}
                          </span>
                        )}
                      </td>

                      {/* Sell Price */}
                      <td className="p-2 sm:p-3 text-right font-black text-[11px] sm:text-xs truncate">
                        {isDue ? (
                          <div>
                            <span className="text-red-600 font-black">Tk {s.amount}</span>
                            <div className="text-[9px] font-bold text-red-500 uppercase tracking-tight">Due</div>
                          </div>
                        ) : (
                          <span className="text-gray-900">Tk {s.amount}</span>
                        )}
                      </td>

                      {/* Cost (Desktop + Print) */}
                      <td className="hidden md:table-cell print:table-cell p-2 sm:p-3 text-right text-gray-500 text-xs truncate">
                        Tk {s.cost || 0}
                      </td>

                      {/* Profit */}
                      <td className="p-2 sm:p-3 text-right font-bold text-green-700 text-[11px] sm:text-xs truncate">
                        +Tk {s.profit}
                      </td>
                    </tr>
                  );
                })}
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400 font-bold uppercase tracking-wider text-xs">
                      No sales records found
                    </td>
                  </tr>
                )}
              </tbody>
              {sales.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-100 text-gray-900 font-black text-[11px] sm:text-xs border-t-2 border-gray-300 print:bg-white print:border-t-2 print:border-black">
                    <td colSpan={2} className="p-2 sm:p-3 uppercase">Total ({sales.length} items)</td>
                    <td className="hidden md:table-cell print:table-cell p-2 sm:p-3 text-center">-</td>
                    <td className="p-2 sm:p-3 text-right font-black text-gray-900">Tk {totalSales.toLocaleString()}</td>
                    <td className="hidden md:table-cell print:table-cell p-2 sm:p-3 text-right text-gray-600 font-bold">Tk {sales.reduce((a, b) => a + (b.cost || 0), 0).toLocaleString()}</td>
                    <td className="p-2 sm:p-3 text-right text-green-700 font-black">+Tk {salesProfit.toLocaleString()}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Expenses Table */}
        {activeTab === 'expenses' && (
          <div className="w-full border border-gray-100 print:border-black rounded-xl overflow-hidden bg-white">
            <table className="w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="bg-[#084b3e] text-white text-[10px] sm:text-xs uppercase tracking-wider select-none print:bg-black print:text-white">
                  {/* Mobile: 26% | Desktop: 18% | Print: 18% */}
                  <th className="w-[26%] md:w-[18%] print:w-[18%] p-2 sm:p-3 font-black truncate">Date</th>
                  {/* Mobile: 46% | Desktop: 44% | Print: 40% */}
                  <th className="w-[46%] md:w-[44%] print:w-[40%] p-2 sm:p-3 font-black truncate">Service / Item</th>
                  {/* Desktop Only + Print: 18% */}
                  <th className="hidden md:table-cell print:table-cell md:w-[18%] print:w-[22%] p-2 sm:p-3 font-black truncate">Note</th>
                  {/* Mobile: 28% | Desktop: 20% | Print: 20% */}
                  <th className="w-[28%] md:w-[20%] print:w-[20%] p-2 sm:p-3 text-right font-black truncate">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white text-xs">
                {expenses.map((e) => (
                  <tr 
                    key={e.id} 
                    onClick={() => setSelectedTx({ type: 'expenses', data: e })}
                    className="hover:bg-gray-50 transition-colors cursor-pointer active:bg-gray-100"
                    title="Click for full details"
                  >
                    {/* Date & Time */}
                    <td className="p-2 sm:p-3 text-[11px] sm:text-xs text-gray-700 font-medium truncate">
                      <div className="font-semibold text-gray-900 leading-tight">{e.date}</div>
                      {e.time && <div className="text-[10px] text-gray-400 font-medium leading-tight">{e.time}</div>}
                    </td>

                    {/* Description / Service (+ note on mobile) */}
                    <td className="p-2 sm:p-3 overflow-hidden">
                      <div className="font-bold text-gray-900 text-[11px] sm:text-xs truncate">{e.title}</div>
                      {e.note && <div className="text-[10px] text-gray-400 font-medium truncate md:hidden">Note: {e.note}</div>}
                    </td>

                    {/* Note (Desktop + Print) */}
                    <td className="hidden md:table-cell print:table-cell p-2 sm:p-3 text-gray-500 font-medium text-xs truncate">
                      {e.note || '-'}
                    </td>

                    {/* Amount */}
                    <td className="p-2 sm:p-3 text-right font-black text-red-600 text-[11px] sm:text-xs truncate">
                      Tk {e.amount}
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-400 font-bold uppercase tracking-wider text-xs">
                      No expense records found
                    </td>
                  </tr>
                )}
              </tbody>
              {expenses.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-100 text-gray-900 font-black text-[11px] sm:text-xs border-t-2 border-gray-300 print:bg-white print:border-t-2 print:border-black">
                    <td colSpan={2} className="p-2 sm:p-3 uppercase">Total ({expenses.length} records)</td>
                    <td className="hidden md:table-cell print:table-cell p-2 sm:p-3">-</td>
                    <td className="p-2 sm:p-3 text-right text-red-600 font-black">Tk {totalExpense.toLocaleString()}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* MFS Table */}
        {activeTab === 'mfs' && (
          <div className="w-full border border-gray-100 print:border-black rounded-xl overflow-hidden bg-white">
            <table className="w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="bg-[#084b3e] text-white text-[10px] sm:text-xs uppercase tracking-wider select-none print:bg-black print:text-white">
                  {/* Mobile: 25% | Desktop: 15% | Print: 15% */}
                  <th className="w-[25%] md:w-[15%] print:w-[15%] p-2 sm:p-3 font-black truncate">Date</th>
                  {/* Mobile: 25% | Desktop: 15% | Print: 15% */}
                  <th className="w-[25%] md:w-[15%] print:w-[15%] p-2 sm:p-3 font-black truncate">Operator</th>
                  {/* Mobile: 22% | Desktop: 15% | Print: 14% */}
                  <th className="w-[22%] md:w-[15%] print:w-[14%] p-2 sm:p-3 text-center font-black truncate">Type</th>
                  {/* Mobile: 28% | Desktop: 18% | Print: 18% */}
                  <th className="w-[28%] md:w-[18%] print:w-[18%] p-2 sm:p-3 text-right font-black truncate">Amount</th>
                  {/* Desktop Only + Print: 18% */}
                  <th className="hidden md:table-cell print:table-cell md:w-[18%] print:w-[18%] p-2 sm:p-3 text-right font-black truncate">Profit</th>
                  {/* Desktop Only + Print: 19% */}
                  <th className="hidden md:table-cell print:table-cell md:w-[19%] print:w-[20%] p-2 sm:p-3 text-right font-black truncate">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white text-xs">
                {mfs.map((m) => (
                  <tr 
                    key={m.id} 
                    onClick={() => setSelectedTx({ type: 'mfs', data: m })}
                    className="hover:bg-gray-50 transition-colors cursor-pointer active:bg-gray-100"
                    title="Click for full details"
                  >
                    {/* Date */}
                    <td className="p-2 sm:p-3 text-[11px] sm:text-xs text-gray-700 font-medium truncate">
                      <div className="font-semibold text-gray-900 leading-tight">{m.date}</div>
                      {m.time && <div className="text-[10px] text-gray-400 font-medium leading-tight">{m.time}</div>}
                    </td>

                    {/* Operator */}
                    <td className="p-2 sm:p-3 font-bold text-gray-900 text-[11px] sm:text-xs truncate">
                      {m.operator}
                    </td>

                    {/* Type badge */}
                    <td className="p-2 sm:p-3 text-center overflow-hidden">
                      <span className="bg-gray-100 text-gray-900 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-gray-100 inline-block truncate max-w-full print:border-black">
                        {m.type}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="p-2 sm:p-3 text-right font-black text-gray-900 text-[11px] sm:text-xs truncate">
                      {m.amount}
                    </td>

                    {/* Profit (Desktop + Print) */}
                    <td className="hidden md:table-cell print:table-cell p-2 sm:p-3 text-right font-bold text-green-700 text-xs truncate">
                      +{m.profit}
                    </td>

                    {/* Balance (Desktop + Print) */}
                    <td className="hidden md:table-cell print:table-cell p-2 sm:p-3 text-right text-gray-500 font-medium text-xs truncate">
                      {m.balanceAfter}
                    </td>
                  </tr>
                ))}
                {mfs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400 font-bold uppercase tracking-wider text-xs">
                      No MFS records found
                    </td>
                  </tr>
                )}
              </tbody>
              {mfs.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-100 text-gray-900 font-black text-[11px] sm:text-xs border-t-2 border-gray-300 print:bg-white print:border-t-2 print:border-black">
                    <td colSpan={3} className="p-2 sm:p-3 uppercase">Total ({mfs.length} trx)</td>
                    <td className="p-2 sm:p-3 text-right font-black">Tk {mfs.reduce((a, b) => a + b.amount, 0).toLocaleString()}</td>
                    <td className="hidden md:table-cell print:table-cell p-2 sm:p-3 text-right text-green-700 font-black">+Tk {mfsProfit.toLocaleString()}</td>
                    <td className="hidden md:table-cell print:table-cell p-2 sm:p-3 text-right text-gray-500">-</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Printable Signature & Verification Section */}
        <div className="hidden print:flex justify-between items-end pt-12 mt-8 border-t border-gray-300 text-xs font-bold text-gray-800">
          <div>
            <div className="w-48 border-b border-gray-500 mb-1.5"></div>
            <p className="font-black text-gray-900">Prepared By (Manager)</p>
            <p className="text-[10px] text-gray-500 font-normal">Al-Barakah Digital Studio</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-400 font-normal">System Generated Statement</p>
            <p className="text-[10px] text-gray-500 font-semibold">{format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</p>
          </div>
          <div className="text-right">
            <div className="w-48 border-b border-gray-500 mb-1.5 ml-auto"></div>
            <p className="font-black text-gray-900">Authorized Signature & Seal</p>
            <p className="text-[10px] text-gray-500 font-normal">Verified Statement</p>
          </div>
        </div>

      </div>

      {/* Transaction Details Modal */}
      {selectedTx && (() => {
        const data = selectedTx.data;
        const saleCustomerName = selectedTx.type === 'sales' ? data.customerName?.trim() : '';
        const registeredCustomer = saleCustomerName
          ? customers.find(c => c.name.toLowerCase().trim() === saleCustomerName.toLowerCase().trim())
          : null;
        const hasCustomerDetails = !!saleCustomerName;
        const customerPhone = data.customerPhone?.trim() || registeredCustomer?.phone || '';

        return (
          <div 
            className="fixed inset-0 bg-[#084b3e]/60 backdrop-blur-xs flex items-center justify-center z-[100] p-3 print:hidden"
            onClick={() => setSelectedTx(null)}
          >
            <div 
              className="bg-white rounded-xl shadow-xl w-full max-w-[340px] sm:max-w-[360px] overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[88vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Header: Large Customer Name if available, otherwise large Service Name */}
              <div className="p-3 border-b border-gray-100 bg-gray-50 flex items-start justify-between gap-2">
                <div className="overflow-hidden flex-1">
                  {hasCustomerDetails ? (
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-base font-black text-gray-900 leading-snug truncate" title={saleCustomerName}>
                          {saleCustomerName}
                        </h3>
                        {registeredCustomer ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-1.5 py-0.2 rounded-sm shrink-0">
                            <CheckCircle2 size={10} />
                            Registered
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-gray-500 bg-gray-200 px-1.5 py-0.2 rounded-sm shrink-0">
                            Customer
                          </span>
                        )}
                      </div>
                      {customerPhone && (
                        <p className="text-[11px] text-gray-600 font-bold mt-0.5 flex items-center gap-1">
                          <Phone size={10} className="text-gray-400 shrink-0" />
                          <span className="font-mono">{customerPhone}</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-base font-black text-gray-900 leading-snug truncate">
                          {selectedTx.type === 'sales'
                            ? data.serviceName
                            : (selectedTx.type === 'expenses'
                                ? (data.title || 'Expense')
                                : `${data.operator} (${data.type})`)}
                        </h3>
                        {data.category && (
                          <span className="text-[9px] font-bold bg-gray-200 text-gray-700 px-1.5 py-0.2 rounded-sm shrink-0">
                            {data.category}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                        {data.date} {data.time ? `• ${data.time}` : ''}
                      </p>
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => setSelectedTx(null)} 
                  className="text-gray-400 hover:text-gray-900 p-1 rounded-md transition-colors shrink-0 cursor-pointer"
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body: Compact 2-Grid Layout */}
              <div className="p-3 overflow-y-auto">
                <div className="grid grid-cols-2 gap-1.5">
                  {selectedTx.type === 'sales' && (
                    <>
                      {/* If customer was in header, show Service in grid */}
                      {hasCustomerDetails && (
                        <DetailTile 
                          label="Service" 
                          value={data.serviceName} 
                          colSpan={1} 
                        />
                      )}
                      <DetailTile 
                        label="Category" 
                        value={data.category || 'Digital Studio'} 
                        colSpan={hasCustomerDetails ? 1 : 2} 
                      />
                      <DetailTile 
                        label="Payment" 
                        value={
                          data.paymentMethod === 'Due' ? (
                            <span className="text-red-600 font-black">Due</span>
                          ) : (
                            data.paymentMethod || 'Cash'
                          )
                        } 
                      />
                      <DetailTile 
                        label="Date" 
                        value={data.time ? `${data.date} ${data.time}` : data.date} 
                      />
                      <DetailTile 
                        label="Sell" 
                        value={`Tk ${data.amount}`} 
                      />
                      {data.quantity && data.quantity != 1 && data.quantity !== '1' ? (
                        <DetailTile 
                          label="Qty & Rate" 
                          value={`${data.quantity} @ Tk ${data.unitPrice || (data.amount / (parseInt(data.quantity as string) || 1)).toFixed(1)}`} 
                        />
                      ) : null}
                      <DetailTile 
                        label="Cost" 
                        value={`Tk ${data.cost || 0}`} 
                        variant="cost"
                      />
                      <DetailTile 
                        label="Profit" 
                        value={`+Tk ${data.profit}`} 
                        variant="profit"
                        colSpan={data.paymentMethod === 'Due' ? 1 : 2}
                      />

                      {data.paymentMethod === 'Due' && (
                        <>
                          <DetailTile 
                            label="Due Remaining" 
                            value={`Tk ${data.dueAmount !== undefined ? data.dueAmount : data.amount}`} 
                            variant="due"
                            colSpan={1}
                          />
                          <DetailTile 
                            label="Paid Deposit" 
                            value={`Tk ${data.paidAmount !== undefined ? data.paidAmount : 0}`} 
                            colSpan={2}
                          />
                        </>
                      )}

                      {data.note && (
                        <DetailTile 
                          label="Note" 
                          value={data.note} 
                          colSpan={2}
                          variant="subtle"
                        />
                      )}
                    </>
                  )}

                  {selectedTx.type === 'expenses' && (
                    <>
                      <DetailTile 
                        label="Category" 
                        value={data.category || 'Expense'} 
                      />
                      <DetailTile 
                        label="Payment" 
                        value="Cash" 
                      />
                      <DetailTile 
                        label="Amount" 
                        value={`Tk ${data.amount}`} 
                        variant="due"
                        colSpan={2}
                      />
                      <DetailTile 
                        label="Date" 
                        value={data.time ? `${data.date} ${data.time}` : data.date} 
                        colSpan={2}
                      />
                      {data.note && (
                        <DetailTile 
                          label="Note" 
                          value={data.note} 
                          colSpan={2}
                          variant="subtle"
                        />
                      )}
                    </>
                  )}

                  {selectedTx.type === 'mfs' && (
                    <>
                      <DetailTile 
                        label="Operator" 
                        value={data.operator} 
                      />
                      <DetailTile 
                        label="Type" 
                        value={data.type} 
                      />
                      <DetailTile 
                        label="Amount" 
                        value={`Tk ${data.amount}`} 
                        colSpan={2}
                      />
                      <DetailTile 
                        label="Charge" 
                        value={`Tk ${data.charge || 0}`} 
                        variant="cost"
                      />
                      <DetailTile 
                        label="Profit" 
                        value={`+Tk ${data.profit || 0}`} 
                        variant="profit"
                      />
                      <DetailTile 
                        label="Balance" 
                        value={`Tk ${data.balanceAfter || 0}`} 
                      />
                      <DetailTile 
                        label="Date" 
                        value={data.time ? `${data.date} ${data.time}` : data.date} 
                      />
                      {data.note && (
                        <DetailTile 
                          label="Note / TrxID" 
                          value={data.note} 
                          colSpan={2}
                          variant="subtle"
                        />
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-2.5 border-t border-gray-100 bg-gray-50 flex justify-end">
                <button 
                  onClick={() => setSelectedTx(null)} 
                  className="w-full bg-[#084b3e] hover:bg-[#126b55] transition-colors text-white font-bold py-2 rounded-xl uppercase tracking-wider text-xs shadow-xs cursor-pointer"
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
