import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Link } from 'react-router-dom';
import { 
  format, subDays, subMonths, startOfMonth, endOfMonth, 
  startOfYear, endOfYear, parseISO, startOfDay, endOfDay 
} from 'date-fns';
import { 
  ArrowUpRight, Wallet, Activity, ArrowRight, CircleDollarSign, 
  ShoppingCart, Package, Coins 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Dashboard() {
  const [filterType, setFilterType] = useState('today');
  const [customStart, setCustomStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { isBalanceVisible } = useAuth();

  const today = format(new Date(), 'yyyy-MM-dd');
  
  const formatCurrency = (val: number | undefined) => {
    if (!isBalanceVisible) return '****';
    return (val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Fetch all data
  const allSales = useLiveQuery(() => db.sales.orderBy('id').reverse().toArray()) || [];
  const allMfs = useLiveQuery(() => db.mfs.orderBy('id').reverse().toArray()) || [];
  const allExpenses = useLiveQuery(() => db.expenses.orderBy('id').reverse().toArray()) || [];
  const allDues = useLiveQuery(() => db.dues.toArray()) || [];
  const allAccounts = useLiveQuery(() => db.accounts.toArray()) || [];

  // Calculate Date Range
  let startDate = startOfDay(new Date());
  let endDate = endOfDay(new Date());

  if (filterType === 'last7') {
    startDate = startOfDay(subDays(new Date(), 6));
    endDate = endOfDay(new Date());
  } else if (filterType === 'last30') {
    startDate = startOfDay(subDays(new Date(), 29));
    endDate = endOfDay(new Date());
  } else if (filterType === 'lastMonth') {
    const lastMonth = subMonths(new Date(), 1);
    startDate = startOfMonth(lastMonth);
    endDate = endOfMonth(lastMonth);
  } else if (filterType === 'thisYear') {
    startDate = startOfYear(new Date());
    endDate = endOfYear(new Date());
  } else if (filterType === 'custom') {
    startDate = startOfDay(parseISO(customStart));
    endDate = endOfDay(parseISO(customEnd));
  }

  if (isNaN(startDate.getTime())) startDate = startOfDay(new Date());
  if (isNaN(endDate.getTime())) endDate = endOfDay(new Date());

  const startStr = format(startDate, 'yyyy-MM-dd');
  const endStr = format(endDate, 'yyyy-MM-dd');
  const isDateInRange = (dateStr: string) => dateStr >= startStr && dateStr <= endStr;

  // Filtered Data based on Date Range
  const filteredSales = allSales.filter(s => isDateInRange(s.date));
  const filteredExpenses = allExpenses.filter(e => isDateInRange(e.date));
  const filteredMfs = allMfs.filter(m => isDateInRange(m.date));

  const totalSalesRange = filteredSales.reduce((acc, sale) => acc + (sale.amount || 0), 0);
  const totalExpensesRange = filteredExpenses.reduce((acc, exp) => acc + (exp.amount || 0), 0);
  const salesProfitRange = filteredSales.reduce((acc, s) => acc + (s.profit || 0), 0);
  const mfsProfitRange = filteredMfs.reduce((acc, m) => acc + (m.profit || 0), 0);
  const totalProfitRange = (salesProfitRange + mfsProfitRange) - totalExpensesRange;

  // Today-specific stats
  const todaySales = allSales.filter(s => s.date === today);
  const totalProfitToday = todaySales.reduce((acc, sale) => acc + (sale.profit || 0), 0);
  const todayMfs = allMfs.filter(m => m.date === today);
  const mfsProfitToday = todayMfs.reduce((acc, m) => acc + (m.profit || 0), 0);
  const expensesToday = allExpenses.filter(e => e.date === today).reduce((acc, e) => acc + (e.amount || 0), 0);
  const netProfitToday = (totalProfitToday + mfsProfitToday) - expensesToday;

  const cashReceivedToday = todaySales.reduce((acc, sale) => {
    const method = (sale.paymentMethod || 'cash').toLowerCase().trim();
    if (method === 'due') {
      return acc + (sale.paidAmount !== undefined ? sale.paidAmount : 0);
    }
    if (method === 'cash') {
      return acc + sale.amount;
    }
    return acc;
  }, 0);
  const cashExpensesToday = allExpenses
    .filter(e => e.date === today && (e.paymentMethod || 'Cash').toLowerCase().trim() === 'cash')
    .reduce((acc, e) => acc + e.amount, 0);
  const mfsCashImpact = todayMfs.reduce((acc, m) => {
    const type = m.type.toLowerCase();
    if (type === 'cash-out') {
      return acc - m.amount;
    } else {
      return acc + m.amount;
    }
  }, 0);
  const netCashInflowToday = (cashReceivedToday + mfsCashImpact) - cashExpensesToday;

  // Unpaid Dues Total (from allDues where status !== 'Paid')
  const totalUnpaidDues = allDues
    .filter(d => d.status !== 'Paid')
    .reduce((acc, d) => acc + ((d.totalAmount || 0) - (d.paidAmount || 0)), 0);

  // Capital Funds in Accounts
  const totalCapitalFunds = allAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

  const targetAccountIds = ['cash', 'bkash', 'nagad', 'rocket'];
  const targetAccountsList = targetAccountIds.map(id => {
    const found = allAccounts.find(a => a.id.toLowerCase() === id.toLowerCase());
    return {
      id,
      name: found ? found.name : id.toUpperCase(),
      balance: found ? found.balance : 0,
      type: found ? found.type : 'other'
    };
  });

  // Recent transactions list
  const recentActivities = useMemo(() => {
    const list: Array<{
      key: string;
      type: 'sale' | 'expense' | 'mfs';
      title: string;
      subtitle?: string;
      amount: number;
      profit?: number;
      date: string;
      time?: string;
      timestamp: number;
    }> = [];

    allSales.slice(0, 10).forEach(s => {
      list.push({
        key: `sale-${s.id}`,
        type: 'sale',
        title: s.serviceName,
        subtitle: s.customerName || s.paymentMethod,
        amount: s.amount || 0,
        profit: s.profit,
        date: s.date,
        time: s.time,
        timestamp: new Date(`${s.date} ${s.time || '00:00:00'}`).getTime() || (s.id || 0)
      });
    });

    allExpenses.slice(0, 10).forEach(e => {
      list.push({
        key: `exp-${e.id}`,
        type: 'expense',
        title: e.title,
        subtitle: e.category,
        amount: e.amount || 0,
        date: e.date,
        time: e.time,
        timestamp: new Date(`${e.date} ${e.time || '00:00:00'}`).getTime() || (e.id || 0)
      });
    });

    allMfs.slice(0, 10).forEach(m => {
      list.push({
        key: `mfs-${m.id}`,
        type: 'mfs',
        title: `${m.operator} ${m.type}`,
        subtitle: m.recipientNumber || (m.profit ? `Profit: Tk ${m.profit}` : undefined),
        amount: m.amount || 0,
        profit: m.profit,
        date: m.date,
        time: m.time,
        timestamp: new Date(`${m.date} ${m.time || '00:00:00'}`).getTime() || (m.id || 0)
      });
    });

    list.sort((a, b) => b.timestamp - a.timestamp);
    return list.slice(0, 8);
  }, [allSales, allExpenses, allMfs]);

  const filterOptions = [
    { id: 'today', label: 'Today' },
    { id: 'last7', label: '7 Days' },
    { id: 'last30', label: '30 Days' },
    { id: 'lastMonth', label: 'Last Month' },
    { id: 'thisYear', label: 'This Year' },
    { id: 'custom', label: 'Custom' },
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto mb-16 md:mb-0 bg-white min-h-screen text-gray-900">
      
      {/* Header & Minimalist Filters */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight uppercase">Overview</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">Business Performance Metrics</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex flex-wrap gap-2">
            {filterOptions.map(opt => (
              <button
                key={opt.id}
                onClick={() => setFilterType(opt.id)}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border rounded-md transition-all cursor-pointer ${
                  filterType === opt.id 
                    ? 'bg-[#084b3e] text-white border-[#084b3e] shadow-md' 
                    : 'bg-white text-gray-500 border-gray-100 hover:border-[#084b3e] hover:text-gray-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {filterType === 'custom' && (
            <div className="flex items-center gap-2 border border-[#084b3e] rounded-md px-2 bg-white">
              <input 
                type="date" 
                value={customStart} 
                onChange={e => setCustomStart(e.target.value)}
                className="p-2 text-xs font-bold outline-none bg-transparent"
              />
              <span className="text-gray-900 font-bold">-</span>
              <input 
                type="date" 
                value={customEnd} 
                onChange={e => setCustomEnd(e.target.value)}
                className="p-2 text-xs font-bold outline-none bg-transparent"
              />
            </div>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Total Sales */}
        <Link 
          to="/sales"
          title="Click to view all Sales"
          className="border border-gray-100 rounded-2xl p-5 sm:p-6 bg-white shadow-xs flex flex-col justify-between hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Sales</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <ShoppingCart size={16} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              Tk {formatCurrency(filterType === 'today' ? totalProfitToday : totalSalesRange)}
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-500 font-medium">
            <span>{filterType === 'today' ? `${todaySales.length} sales today` : `${filteredSales.length} sales in range`}</span>
            <span className="text-blue-600 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              <span>View</span>
              <ArrowRight size={12} />
            </span>
          </div>
        </Link>

        {/* Card 2: Total Expenses */}
        <Link 
          to="/expenses"
          title="Click to view all Expenses"
          className="border border-gray-100 rounded-2xl p-5 sm:p-6 bg-white shadow-xs flex flex-col justify-between hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Expenses</span>
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Wallet size={16} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              Tk {formatCurrency(filterType === 'today' ? expensesToday : totalExpensesRange)}
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-500 font-medium">
            <span>{filterType === 'today' ? 'Today\'s spend' : `${filteredExpenses.length} entries`}</span>
            <span className="text-rose-600 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              <span>View</span>
              <ArrowRight size={12} />
            </span>
          </div>
        </Link>

        {/* Card 3: Gross Profit */}
        <Link 
          to="/reports"
          title="Click to view Profit & Loss Reports"
          className="border border-gray-100 rounded-2xl p-5 sm:p-6 bg-white shadow-xs flex flex-col justify-between hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Gross Profit</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#084b3e] flex items-center justify-center group-hover:scale-105 transition-transform">
                <CircleDollarSign size={16} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[#084b3e] tracking-tight">
              Tk {formatCurrency(filterType === 'today' ? netProfitToday : totalProfitRange)}
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-500 font-medium">
            <span>Sales & MFS profit</span>
            <span className="text-[#084b3e] font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              <span>Reports</span>
              <ArrowRight size={12} />
            </span>
          </div>
        </Link>

        {/* Card 4: Unpaid Dues */}
        <Link 
          to="/customers"
          title="Click to view Customer Dues"
          className="border border-gray-100 rounded-2xl p-5 sm:p-6 bg-white shadow-xs flex flex-col justify-between hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Unpaid Dues</span>
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Coins size={16} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-orange-600 tracking-tight">
              Tk {formatCurrency(totalUnpaidDues)}
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-500 font-medium">
            <span>Customer receivables</span>
            <span className="text-orange-600 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              <span>Collect</span>
              <ArrowRight size={12} />
            </span>
          </div>
        </Link>
      </div>

      {/* Account Balances Quick Strip (Cash, bKash, Nagad, Rocket) */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-100 shadow-xs mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-[#084b3e]" />
            <span className="text-xs font-black uppercase tracking-wider text-gray-800">
              Accounts & Wallets Balance
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-500">
              Total Funds: <strong className="text-gray-900 font-black">Tk {isBalanceVisible ? totalCapitalFunds.toLocaleString() : '****'}</strong>
            </span>
            <Link
              to="/settings"
              className="text-[11px] font-bold text-[#084b3e] hover:underline flex items-center gap-1"
            >
              <span>Edit in Settings</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2.5">
          {targetAccountsList.map(acc => {
            const isCash = acc.id === 'cash';
            const isBkash = acc.id === 'bkash';
            const isNagad = acc.id === 'nagad';
            const isRocket = acc.id === 'rocket';

            let badgeColor = 'text-gray-700 bg-gray-50 hover:border-gray-300';
            if (isCash) badgeColor = 'text-[#084b3e] bg-emerald-50 border-emerald-100 hover:border-[#084b3e]/40';
            else if (isBkash) badgeColor = 'text-[#e2136e] bg-pink-50 border-pink-100 hover:border-[#e2136e]/40';
            else if (isNagad) badgeColor = 'text-[#d97706] bg-orange-50 border-orange-100 hover:border-[#d97706]/40';
            else if (isRocket) badgeColor = 'text-purple-700 bg-purple-50 border-purple-100 hover:border-purple-300';

            const destination = isCash ? '/expenses' : '/mfs';

            return (
              <Link 
                key={acc.id} 
                to={destination}
                title={`Open ${acc.name} transactions`}
                className={`p-2.5 rounded-xl border ${badgeColor} flex flex-col justify-between transition-all hover:shadow-xs cursor-pointer group`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase truncate">
                    {acc.id === 'cash' ? 'Cash' : acc.name}
                  </span>
                  <ArrowUpRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="text-xs sm:text-sm font-black mt-1 truncate">
                  Tk {isBalanceVisible ? (acc.balance || 0).toLocaleString() : '****'}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Transactions & Activity (Clean, fast, no empty graphs!) */}
      <div className="border border-gray-100 rounded-2xl p-5 sm:p-6 bg-white shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 flex items-center gap-2">
              <Activity size={18} className="text-[#084b3e]" />
              Recent Activity & Transactions
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">
              Latest sales, expenses, and mobile banking entries
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/reports"
              className="text-xs font-bold text-[#084b3e] hover:underline flex items-center gap-1"
            >
              <span>View Full Reports</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {recentActivities.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-sm font-medium text-gray-600">No transactions recorded yet</p>
            <p className="text-xs mt-1">Start by recording your first sale, expense, or MFS transaction.</p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <Link to="/sales" className="px-3 py-1.5 bg-[#084b3e] text-white rounded-lg text-xs font-bold shadow-xs">
                + New Sale
              </Link>
              <Link to="/expenses" className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold shadow-xs">
                + Add Expense
              </Link>
              <Link to="/mfs" className="px-3 py-1.5 bg-pink-600 text-white rounded-lg text-xs font-bold shadow-xs">
                + MFS Entry
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentActivities.map((item) => (
              <div key={item.key} className="py-3 flex items-center justify-between text-xs hover:bg-gray-50/50 px-2 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold ${
                    item.type === 'sale' ? 'bg-blue-50 text-blue-700' :
                    item.type === 'expense' ? 'bg-rose-50 text-rose-700' :
                    'bg-pink-50 text-pink-700'
                  }`}>
                    {item.type === 'sale' ? <ShoppingCart size={15} /> :
                     item.type === 'expense' ? <Wallet size={15} /> :
                     <Coins size={15} />}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-xs sm:text-sm">{item.title}</div>
                    <div className="text-[11px] text-gray-400">
                      {item.date} {item.time ? `• ${item.time}` : ''} {item.subtitle ? `• ${item.subtitle}` : ''}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-black text-xs sm:text-sm ${
                    item.type === 'sale' ? 'text-emerald-700' :
                    item.type === 'expense' ? 'text-rose-600' :
                    'text-gray-900'
                  }`}>
                    {item.type === 'expense' ? `- Tk ${item.amount.toLocaleString()}` : `Tk ${item.amount.toLocaleString()}`}
                  </div>
                  {item.profit !== undefined && item.profit > 0 ? (
                    <div className="text-[10px] text-emerald-600 font-semibold">
                      Profit: Tk {item.profit.toLocaleString()}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
