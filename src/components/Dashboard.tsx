import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Link } from 'react-router-dom';
import { 
  format, subDays, subMonths, startOfMonth, endOfMonth, 
  startOfYear, endOfYear, parseISO, eachDayOfInterval, startOfDay, endOfDay 
} from 'date-fns';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Plus, Minus, ArrowUpRight, ArrowDownRight, Wallet, Activity, ArrowRight, CircleDollarSign, AlertCircle, ShoppingCart, Smartphone, FileText, TrendingUp, BarChart2 } from 'lucide-react';
import { SalesEntry } from './SalesEntry';
import { Expenses } from './Expenses';
import { MfsLedger } from './MfsLedger';
import { Reports } from './Reports';
import { useAuth } from '../context/AuthContext';

export function Dashboard() {
  const [filterType, setFilterType] = useState('today');
  const [customStart, setCustomStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [activeTab, setActiveTab] = useState('overview');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
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
    // Cash-Out: Customer receives cash from drawer -> Cash in hand decreases
    // Cash-In, Recharge, Send Money: Customer gives cash to shop -> Cash in hand increases
    if (m.type === 'Cash-Out') {
      return acc - m.amount;
    }
    if (m.type === 'Cash-In' || m.type === 'Recharge') {
      return acc + m.amount;
    }
    if (
      m.type === 'Send Money' ||
      m.type === 'Send Money (Out)' || 
      m.type === 'Send-Money-Out'
    ) {
      return acc + (m.amount + (m.charge || 0));
    }
    return acc;
  }, 0);
  const cashOnHandTodayFlow = cashReceivedToday + mfsCashImpact - cashExpensesToday; 
  const cashAccount = allAccounts.find(a => a.id === 'cash');
  const cashOnHand = cashAccount ? cashAccount.balance : cashOnHandTodayFlow;
  
  // All active accounts (Cash, bKash, Nagad, Rocket)
  const targetAccountsList = useMemo(() => {
    const defaultAccountsOrder = ['cash', 'bkash', 'nagad', 'rocket'];
    const list: Array<{ id: string; name: string; balance: number; type?: string }> = [];
    
    defaultAccountsOrder.forEach(id => {
      const found = allAccounts.find(a => a.id === id);
      if (found) {
        list.push(found);
      } else {
        const defaultName = id === 'cash' ? 'Cash' : id === 'bkash' ? 'bKash' : id === 'nagad' ? 'Nagad' : 'Rocket';
        list.push({ id, name: defaultName, balance: 0, type: id === 'cash' ? 'cash' : 'mfs' });
      }
    });

    allAccounts.forEach(acc => {
      if (acc.id === 'upay' || acc.id === 'bank') return;
      if (!list.some(item => item.id === acc.id)) {
        list.push(acc);
      }
    });

    return list;
  }, [allAccounts]);
  const totalCapitalFunds = targetAccountsList.reduce((sum, a) => sum + (a.balance || 0), 0);

  const totalDues = allDues.reduce((acc, due) => acc + (due.totalAmount - due.paidAmount), 0);

  // Daily Chart Data derived directly from the active filter and transactions
  const chartData = useMemo(() => {
    if (filterType === 'today') {
      // 2-hour timeline intervals across today: 08:00 to 22:00
      const slots = [
        { label: '08:00', startHour: 0, endHour: 8 },
        { label: '10:00', startHour: 8, endHour: 10 },
        { label: '12:00', startHour: 10, endHour: 12 },
        { label: '14:00', startHour: 12, endHour: 14 },
        { label: '16:00', startHour: 14, endHour: 16 },
        { label: '18:00', startHour: 16, endHour: 18 },
        { label: '20:00', startHour: 18, endHour: 20 },
        { label: '22:00', startHour: 20, endHour: 24 },
      ];

      const getHourFromItem = (item: { createdAt?: string; time?: string }) => {
        if (item.createdAt) {
          const d = new Date(item.createdAt);
          if (!isNaN(d.getTime())) return d.getHours();
        }
        if (item.time) {
          const m = item.time.match(/(\d+):(\d+)(?::\d+)?\s*(AM|PM)/i);
          if (m) {
            let h = parseInt(m[1], 10);
            const isPM = m[3].toUpperCase() === 'PM';
            if (isPM && h < 12) h += 12;
            if (!isPM && h === 12) h = 0;
            return h;
          }
        }
        return 12;
      };

      return slots.map(slot => {
        const slotSales = todaySales.filter(s => {
          const h = getHourFromItem(s);
          return h >= slot.startHour && h < slot.endHour;
        });
        const slotExpenses = allExpenses.filter(e => {
          if (e.date !== today) return false;
          const h = getHourFromItem(e);
          return h >= slot.startHour && h < slot.endHour;
        });
        const slotMfs = todayMfs.filter(m => {
          const h = getHourFromItem(m);
          return h >= slot.startHour && h < slot.endHour;
        });

        const sell = slotSales.reduce((sum, s) => sum + (s.amount || 0), 0);
        const expense = slotExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const salesProfit = slotSales.reduce((sum, s) => sum + (s.profit || 0), 0);
        const mfsProfit = slotMfs.reduce((sum, m) => sum + (m.profit || 0), 0);
        const profit = (salesProfit + mfsProfit) - expense;

        return {
          name: slot.label,
          fullDate: `Today at ${slot.label}`,
          Sell: sell,
          Expense: expense,
          Profit: profit,
        };
      });
    }

    if (filterType === 'thisYear') {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const currentYear = new Date().getFullYear();

      return monthNames.map((monthName, idx) => {
        const monthNumStr = String(idx + 1).padStart(2, '0');
        const prefix = `${currentYear}-${monthNumStr}`;

        const monthSales = allSales.filter(s => s.date && s.date.startsWith(prefix));
        const monthExpenses = allExpenses.filter(e => e.date && e.date.startsWith(prefix));
        const monthMfs = allMfs.filter(m => m.date && m.date.startsWith(prefix));

        const sell = monthSales.reduce((sum, s) => sum + (s.amount || 0), 0);
        const expense = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const salesProfit = monthSales.reduce((sum, s) => sum + (s.profit || 0), 0);
        const mfsProfit = monthMfs.reduce((sum, m) => sum + (m.profit || 0), 0);
        const profit = (salesProfit + mfsProfit) - expense;

        return {
          name: monthName,
          fullDate: `${monthName} ${currentYear}`,
          Sell: sell,
          Expense: expense,
          Profit: profit,
        };
      });
    }

    // For multi-day ranges (7 Days, 30 Days, Last Month, Custom):
    let days: Date[] = [];
    try {
      const actualStart = startDate <= endDate ? startDate : endDate;
      const actualEnd = startDate <= endDate ? endDate : startDate;
      days = eachDayOfInterval({ start: actualStart, end: actualEnd });
    } catch {
      days = [new Date()];
    }

    // Sort strictly chronological: earliest on left to latest on right
    days.sort((a, b) => a.getTime() - b.getTime());

    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const daySales = filteredSales.filter(s => s.date === dayStr);
      const dayExpenses = filteredExpenses.filter(e => e.date === dayStr);
      const dayMfs = filteredMfs.filter(m => m.date === dayStr);

      const sell = daySales.reduce((sum, s) => sum + (s.amount || 0), 0);
      const expense = dayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const salesProfit = daySales.reduce((sum, s) => sum + (s.profit || 0), 0);
      const mfsProfit = dayMfs.reduce((sum, m) => sum + (m.profit || 0), 0);
      const profit = (salesProfit + mfsProfit) - expense;

      return {
        name: format(day, 'dd/MM'),
        fullDate: format(day, 'dd MMM yyyy'),
        Sell: sell,
        Expense: expense,
        Profit: profit,
      };
    });
  }, [filterType, todaySales, allExpenses, today, todayMfs, startDate, endDate, filteredSales, filteredExpenses, filteredMfs, allSales]);

  const filterOptions = [
    { id: 'today', label: 'Today' },
    { id: 'last7', label: '7 Days' },
    { id: 'last30', label: '30 Days' },
    { id: 'lastMonth', label: 'Last Month' },
    { id: 'thisYear', label: 'This Year (Monthly)' },
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
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border rounded-md transition-all ${
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

      {/* High Contrast Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        
        {/* Total Sales */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-200 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 group-hover:bg-emerald-100 transition-all duration-300">
              <Wallet size={20} />
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 group-hover:text-gray-700 transition-colors">Total Sales</span>
            </div>
            <ArrowUpRight size={16} className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight group-hover:text-[#084b3e] transition-colors">Tk {formatCurrency(totalSalesRange)}</h2>
            <p className="text-[10px] mt-1 text-gray-400 font-medium">Selected Range</p>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-200 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-[#084b3e] group-hover:scale-110 group-hover:bg-emerald-100 transition-all duration-300">
              <Activity size={20} />
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 group-hover:text-gray-700 transition-colors">Total Expenses</span>
            </div>
            <ArrowUpRight size={16} className="text-[#084b3e] opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight group-hover:text-[#084b3e] transition-colors">Tk {formatCurrency(totalExpensesRange)}</h2>
            <p className="text-[10px] mt-1 text-gray-400 font-medium">Selected Range</p>
          </div>
        </div>

        {/* Profit Card */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-purple-200 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 group-hover:scale-110 group-hover:bg-purple-100 transition-all duration-300">
              <Activity size={20} />
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 group-hover:text-gray-700 transition-colors">
                {filterType === 'today' ? "Today's Profit" : "Total Profit"}
              </span>
            </div>
            <ArrowUpRight size={16} className="text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight group-hover:text-purple-700 transition-colors">
              Tk {formatCurrency(filterType === 'today' ? netProfitToday : totalProfitRange)}
            </h2>
            <p className="text-[10px] mt-1 text-gray-400 font-medium">
              {filterType === 'today' ? 'Net Profit (Today)' : 'Selected Range'}
            </p>
          </div>
        </div>

        {/* Cash On Hand */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-sky-200 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-sky-50 text-sky-500 group-hover:scale-110 group-hover:bg-sky-100 transition-all duration-300">
              <CircleDollarSign size={20} />
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 group-hover:text-gray-700 transition-colors">Cash On Hand</span>
            </div>
            <ArrowUpRight size={16} className="text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight group-hover:text-sky-600 transition-colors">Tk {formatCurrency(cashOnHand)}</h2>
            <p className="text-[10px] mt-1 text-gray-400 font-medium">Excluding dues</p>
          </div>
        </div>

        {/* Total Due */}
        <Link 
          to="/customers"
          className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-rose-200 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group cursor-pointer"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-500 group-hover:scale-110 group-hover:bg-rose-100 transition-all duration-300">
              <Wallet size={20} />
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 group-hover:text-gray-700 transition-colors">Total Due</span>
            </div>
            <ArrowUpRight size={16} className="text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight group-hover:text-rose-600 transition-colors">Tk {formatCurrency(totalDues)}</h2>
            <p className="text-[10px] mt-1 text-gray-400 font-medium">Pending Balance</p>
          </div>
        </Link>
      </div>

      {/* Account Balances Quick Strip (4 Accounts: Cash, bKash, Nagad, Rocket) */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-100 shadow-xs mb-2">
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

            let badgeColor = 'text-gray-700 bg-gray-50';
            if (isCash) badgeColor = 'text-[#084b3e] bg-emerald-50 border-emerald-100';
            else if (isBkash) badgeColor = 'text-[#e2136e] bg-pink-50 border-pink-100';
            else if (isNagad) badgeColor = 'text-[#d97706] bg-orange-50 border-orange-100';
            else if (isRocket) badgeColor = 'text-purple-700 bg-purple-50 border-purple-100';

            return (
              <div key={acc.id} className={`p-2.5 rounded-xl border ${badgeColor} flex flex-col justify-between`}>
                <span className="text-[10px] font-bold uppercase truncate">
                  {acc.id === 'cash' ? 'Cash' : acc.name}
                </span>
                <span className="text-xs sm:text-sm font-black mt-1 truncate">
                  Tk {isBalanceVisible ? (acc.balance || 0).toLocaleString() : '****'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content: Chart & Quick Actions (Full Width) */}
      <div className="w-full flex flex-col gap-8">
        
        {/* Quick Action Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 bg-white p-2.5 rounded-2xl border border-gray-100 shadow-sm relative z-10">
          {[
            { id: 'sales', label: 'Sell', icon: ShoppingCart, color: 'emerald' },
            { id: 'expenses', label: 'Expense', icon: Wallet, color: 'rose' },
            { id: 'mfs', label: 'MFS', icon: Smartphone, color: 'purple' },
            { id: 'reports', label: 'Reports', icon: FileText, color: 'sky' }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(isActive ? 'overview' : tab.id as any)}
                className={`flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl font-bold text-[13px] uppercase tracking-wider transition-all duration-300 ${
                  isActive 
                    ? 'bg-[#084b3e] text-white shadow-md shadow-[#084b3e]/20 scale-[1.02]' 
                    : 'bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50 hover:shadow-sm border border-transparent hover:border-gray-100'
                }`}
              >
                <tab.icon 
                  size={18} 
                  className={`transition-transform duration-300 ${isActive ? 'opacity-100 scale-110' : 'opacity-70'}`} 
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Content Area */}
        {activeTab === 'overview' && (
          <div className="border border-gray-100 rounded-md p-5 sm:p-6 bg-white shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-900 flex items-center gap-2">
                  <TrendingUp size={18} className="text-[#084b3e]" />
                  Cashflow Overview
                </h2>
                <p className="text-xs text-gray-500 mt-0.5 font-medium">
                  {filterType === 'today' ? "Today's Timeline" : "Daily Trends"}
                </p>
              </div>

              {/* Chart Type Toggle */}
              <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setChartType('line')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                    chartType === 'line'
                      ? 'bg-white text-[#084b3e] shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  title="Smooth Line Chart"
                >
                  <TrendingUp size={13} />
                  Line
                </button>
                <button
                  type="button"
                  onClick={() => setChartType('bar')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                    chartType === 'bar'
                      ? 'bg-white text-[#084b3e] shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  title="Bar Chart"
                >
                  <BarChart2 size={13} />
                  Bar
                </button>
              </div>
            </div>

            <div className="h-80 sm:h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'line' ? (
                  <LineChart 
                    data={chartData} 
                    margin={{ top: 15, right: 15, left: 0, bottom: 10 }}
                  >
                    {/* Clean solid horizontal grid lines */}
                    <CartesianGrid vertical={false} stroke="#e2e8f0" />
                    
                    {/* X-Axis */}
                    <XAxis 
                      dataKey="name" 
                      axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }} 
                      tickLine={{ stroke: '#cbd5e1' }} 
                      tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} 
                      padding={{ left: 16, right: 16 }}
                      angle={-35}
                      textAnchor="end"
                      height={50}
                      interval={filterType === 'last30' ? 2 : 0}
                    />
                    
                    {/* Y-Axis */}
                    <YAxis 
                      axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }} 
                      tickLine={{ stroke: '#cbd5e1' }} 
                      tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} 
                    />
                    
                    <Tooltip 
                      cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }} 
                      contentStyle={{
                        borderRadius: '8px', 
                        border: '1px solid #e2e8f0', 
                        backgroundColor: '#ffffff', 
                        boxShadow: '0 4px 14px -2px rgba(0, 0, 0, 0.08)', 
                        fontWeight: 'bold',
                        fontSize: '12px'
                      }} 
                      formatter={(value: any, name: any) => [`Tk ${Number(value || 0).toLocaleString('en-IN')}`, name]}
                      labelFormatter={(label: any, payload: any) => {
                        const fullDate = payload?.[0]?.payload?.fullDate;
                        return fullDate || label;
                      }}
                    />

                    {/* 1. Sell: Smooth Blue Spline Curve rising and falling like wave */}
                    <Line 
                      type="natural" 
                      dataKey="Sell" 
                      name="Sell" 
                      stroke="#2563eb" 
                      strokeWidth={2.5} 
                      dot={false} 
                      activeDot={{ r: 6, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }} 
                    />

                    {/* 2. Expense: Smooth Red Spline Curve */}
                    <Line 
                      type="natural" 
                      dataKey="Expense" 
                      name="Expense" 
                      stroke="#ef4444" 
                      strokeWidth={2.5} 
                      dot={false} 
                      activeDot={{ r: 6, fill: '#ef4444', stroke: '#ffffff', strokeWidth: 2 }} 
                    />

                    {/* 3. Profit: Smooth Green Spline Curve */}
                    <Line 
                      type="natural" 
                      dataKey="Profit" 
                      name="Profit" 
                      stroke="#10b981" 
                      strokeWidth={2.5} 
                      dot={false} 
                      activeDot={{ r: 6, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }} 
                    />
                  </LineChart>
                ) : (
                  <BarChart 
                    data={chartData} 
                    margin={{ top: 15, right: 15, left: 0, bottom: 10 }}
                  >
                    <CartesianGrid vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }} 
                      tickLine={{ stroke: '#cbd5e1' }} 
                      tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} 
                      angle={-35}
                      textAnchor="end"
                      height={50}
                      interval={filterType === 'last30' ? 2 : 0}
                    />
                    <YAxis 
                      axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }} 
                      tickLine={{ stroke: '#cbd5e1' }} 
                      tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} 
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }} 
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#fff', boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.08)', fontWeight: 'bold' }} 
                      formatter={(value: any, name: any) => [`Tk ${Number(value || 0).toLocaleString('en-IN')}`, name]}
                      labelFormatter={(label: any, payload: any) => {
                        const fullDate = payload?.[0]?.payload?.fullDate;
                        return fullDate || label;
                      }}
                    />
                    <Bar dataKey="Sell" name="Sell" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="Expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="Profit" name="Profit" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Bottom Color Indicator */}
            <div className="flex items-center justify-center gap-6 pt-4 mt-2 border-t border-gray-100 text-xs font-bold">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#2563eb] inline-block shadow-xs" />
                <span className="text-gray-700 font-semibold">Sell</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#ef4444] inline-block shadow-xs" />
                <span className="text-gray-700 font-semibold">Expense</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#10b981] inline-block shadow-xs" />
                <span className="text-gray-700 font-semibold">Profit</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <div className="border border-gray-100 rounded-md bg-white overflow-hidden shadow-sm">
            <SalesEntry />
          </div>
        )}
        {activeTab === 'expenses' && (
          <div className="border border-gray-100 rounded-md bg-white overflow-hidden shadow-sm">
            <Expenses />
          </div>
        )}
        {activeTab === 'mfs' && (
          <div className="border border-gray-100 rounded-md bg-white overflow-hidden shadow-sm">
            <MfsLedger />
          </div>
        )}
        {activeTab === 'reports' && (
          <div className="border border-gray-100 rounded-md bg-white overflow-hidden shadow-sm">
            <Reports />
          </div>
        )}

      </div>
    </div>
  );
}

