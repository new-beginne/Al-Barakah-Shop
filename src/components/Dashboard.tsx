import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Link } from 'react-router-dom';
import { 
  format, subDays, subMonths, startOfMonth, endOfMonth, 
  parseISO, eachDayOfInterval 
} from 'date-fns';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Plus, Minus, ArrowUpRight, ArrowDownRight, Wallet, Activity, ArrowRight, CircleDollarSign, AlertCircle, ShoppingCart, Smartphone, FileText, TrendingUp, BarChart2 } from 'lucide-react';
import { SalesEntry } from './SalesEntry';
import { Expenses } from './Expenses';
import { MfsLedger } from './MfsLedger';
import { Reports } from './Reports';

export function Dashboard() {
  const [filterType, setFilterType] = useState('today');
  const [customStart, setCustomStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [activeTab, setActiveTab] = useState('overview');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  const today = format(new Date(), 'yyyy-MM-dd');
  
  // Fetch all data
  const allSales = useLiveQuery(() => db.sales.orderBy('id').reverse().toArray()) || [];
  const allMfs = useLiveQuery(() => db.mfs.orderBy('id').reverse().toArray()) || [];
  const allExpenses = useLiveQuery(() => db.expenses.orderBy('id').reverse().toArray()) || [];
  const allDues = useLiveQuery(() => db.dues.toArray()) || [];
  const allAccounts = useLiveQuery(() => db.accounts.toArray()) || [];

  // Calculate Date Range
  let startDate = new Date();
  let endDate = new Date();

  if (filterType === 'last7') {
    startDate = subDays(new Date(), 6);
  } else if (filterType === 'last30') {
    startDate = subDays(new Date(), 29);
  } else if (filterType === 'lastMonth') {
    const lastMonth = subMonths(new Date(), 1);
    startDate = startOfMonth(lastMonth);
    endDate = endOfMonth(lastMonth);
  } else if (filterType === 'custom') {
    startDate = parseISO(customStart);
    endDate = parseISO(customEnd);
  }

  if (isNaN(startDate.getTime())) startDate = new Date();
  if (isNaN(endDate.getTime())) endDate = new Date();

  const startStr = format(startDate, 'yyyy-MM-dd');
  const endStr = format(endDate, 'yyyy-MM-dd');
  const isDateInRange = (dateStr: string) => dateStr >= startStr && dateStr <= endStr;

  // Filtered Data based on Date Range
  const filteredSales = allSales.filter(s => isDateInRange(s.date));
  const filteredExpenses = allExpenses.filter(e => isDateInRange(e.date));

  const totalSalesRange = filteredSales.reduce((acc, sale) => acc + sale.amount, 0);
  const totalExpensesRange = filteredExpenses.reduce((acc, exp) => acc + exp.amount, 0);

  // Today-specific stats
  const todaySales = allSales.filter(s => s.date === today);
  const totalProfitToday = todaySales.reduce((acc, sale) => acc + sale.profit, 0);
  const todayMfs = allMfs.filter(m => m.date === today);
  const mfsProfitToday = todayMfs.reduce((acc, m) => acc + m.profit, 0);
  const netProfitToday = totalProfitToday + mfsProfitToday;

  const cashReceivedToday = todaySales.reduce((acc, sale) => {
    if (sale.paymentMethod === 'Due') {
      return acc + (sale.paidAmount !== undefined ? sale.paidAmount : 0);
    }
    return acc + sale.amount;
  }, 0);
  const expensesToday = allExpenses.filter(e => e.date === today).reduce((acc, e) => acc + e.amount, 0);
  const mfsCashImpact = todayMfs.reduce((acc, m) => {
    // Send Money (Out) & Cash-Out & Recharge: Cash in hand increases
    // Send Money (In) & Cash-In: Cash in hand decreases
    if (
      m.type === 'Cash-Out' || 
      m.type === 'Send Money (Out)' || 
      m.type === 'Send-Money-Out' || 
      m.type === 'Recharge'
    ) {
      return acc + m.amount;
    }
    if (
      m.type === 'Cash-In' || 
      m.type === 'Send Money (In)' || 
      m.type === 'Send-Money-In'
    ) {
      return acc - m.amount;
    }
    return acc;
  }, 0);
  const cashOnHandTodayFlow = cashReceivedToday + mfsCashImpact - expensesToday; 
  const cashAccount = allAccounts.find(a => a.id === 'cash');
  const cashOnHand = cashAccount ? cashAccount.balance : cashOnHandTodayFlow;
  // Exactly 4 accounts: Cash, bKash, Nagad, Rocket
  const targetAccountsList = useMemo(() => {
    const order = ['cash', 'bkash', 'nagad', 'rocket'];
    return order.map(id => {
      const found = allAccounts.find(a => a.id === id);
      const defaultName = id === 'cash' ? 'Cash' : id === 'bkash' ? 'bKash' : id === 'nagad' ? 'Nagad' : 'Rocket';
      return found || { id, name: defaultName, balance: 0 };
    });
  }, [allAccounts]);
  const totalCapitalFunds = targetAccountsList.reduce((sum, a) => sum + (a.balance || 0), 0);

  const totalDues = allDues.reduce((acc, due) => acc + (due.totalAmount - due.paidAmount), 0);

  // Chart Data
  let chartDays: Date[] = [];
  try {
    chartDays = eachDayOfInterval({ start: startDate, end: endDate });
  } catch(e) {
    chartDays = [new Date()];
  }

  const chartData = chartDays.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const daySales = allSales.filter(s => s.date === dayStr).reduce((acc, s) => acc + s.amount, 0);
    const dayExpenses = allExpenses.filter(e => e.date === dayStr).reduce((acc, e) => acc + e.amount, 0);
    return {
      name: format(day, 'dd MMM'), 
      Sales: daySales,
      Expenses: dayExpenses,
      NetCashflow: daySales - dayExpenses,
    };
  });

  const filterOptions = [
    { id: 'today', label: 'Today' },
    { id: 'last7', label: '7 Days' },
    { id: 'last30', label: '30 Days' },
    { id: 'lastMonth', label: 'Last Month' },
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
            <h2 className="text-2xl font-black text-gray-900 tracking-tight group-hover:text-[#084b3e] transition-colors">Tk {totalSalesRange.toFixed(2)}</h2>
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
            <h2 className="text-2xl font-black text-gray-900 tracking-tight group-hover:text-[#084b3e] transition-colors">Tk {totalExpensesRange.toFixed(2)}</h2>
            <p className="text-[10px] mt-1 text-gray-400 font-medium">Selected Range</p>
          </div>
        </div>

        {/* Today's Profit */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-purple-200 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 group-hover:scale-110 group-hover:bg-purple-100 transition-all duration-300">
              <Activity size={20} />
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 group-hover:text-gray-700 transition-colors">Today's Profit</span>
            </div>
            <ArrowUpRight size={16} className="text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight group-hover:text-purple-700 transition-colors">Tk {netProfitToday.toFixed(2)}</h2>
            <p className="text-[10px] mt-1 text-gray-400 font-medium">Net Profit (Sales + MFS)</p>
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
            <h2 className="text-2xl font-black text-gray-900 tracking-tight group-hover:text-sky-600 transition-colors">Tk {cashOnHand.toFixed(2)}</h2>
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
            <h2 className="text-2xl font-black text-gray-900 tracking-tight group-hover:text-rose-600 transition-colors">Tk {totalDues.toFixed(2)}</h2>
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
              Accounts & Wallets Balance (বর্তমান ব্যালেন্স)
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-500">
              Total Funds: <strong className="text-gray-900 font-black">Tk {totalCapitalFunds.toLocaleString()}</strong>
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
                  {acc.id === 'cash' ? 'Cash (হাতে নগদ)' : acc.name}
                </span>
                <span className="text-xs sm:text-sm font-black mt-1 truncate">
                  Tk {(acc.balance || 0).toLocaleString()}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-900 flex items-center gap-2">
                  <TrendingUp size={18} className="text-[#084b3e]" />
                  Cashflow Overview
                </h2>
                <p className="text-xs text-gray-500 mt-1 font-medium">Daily sales, expenses, and net profit trends</p>
              </div>

              {/* Chart Toggle */}
              <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setChartType('line')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    chartType === 'line'
                      ? 'bg-white text-[#084b3e] shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <TrendingUp size={14} />
                  Line Chart
                </button>
                <button
                  type="button"
                  onClick={() => setChartType('bar')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    chartType === 'bar'
                      ? 'bg-white text-[#084b3e] shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <BarChart2 size={14} />
                  Bar Chart
                </button>
              </div>
            </div>

            <div className="h-80 sm:h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'line' ? (
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 11, fill: '#64748b', fontWeight: 600}} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 11, fill: '#64748b', fontWeight: 600}} 
                    />
                    <Tooltip 
                      cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }} 
                      contentStyle={{
                        borderRadius: '8px', 
                        border: '1px solid #e2e8f0', 
                        backgroundColor: '#ffffff', 
                        boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.08)', 
                        fontWeight: 'bold',
                        fontSize: '12px'
                      }} 
                      formatter={(value: any) => [`Tk ${Number(value || 0).toLocaleString('en-IN')}`, '']}
                    />
                    <Legend 
                      iconType="circle" 
                      wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '16px' }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="Sales" 
                      name="Sales" 
                      stroke="#084b3e" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: '#084b3e', strokeWidth: 2, stroke: '#ffffff' }} 
                      activeDot={{ r: 6, stroke: '#084b3e', strokeWidth: 2, fill: '#ffffff' }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="Expenses" 
                      name="Expenses" 
                      stroke="#ef4444" 
                      strokeWidth={2.5} 
                      strokeDasharray="4 4" 
                      dot={{ r: 3, fill: '#ef4444', strokeWidth: 1, stroke: '#ffffff' }} 
                      activeDot={{ r: 5, stroke: '#ef4444', strokeWidth: 2, fill: '#ffffff' }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="NetCashflow" 
                      name="Net Profit" 
                      stroke="#2563eb" 
                      strokeWidth={2} 
                      dot={{ r: 3, fill: '#2563eb', strokeWidth: 1, stroke: '#ffffff' }} 
                      activeDot={{ r: 5, stroke: '#2563eb', strokeWidth: 2, fill: '#ffffff' }} 
                    />
                  </LineChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#64748b', fontWeight: 600}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#64748b', fontWeight: 600}} />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}} 
                      contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#fff', boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.08)', fontWeight: 'bold'}} 
                      formatter={(value: any) => [`Tk ${Number(value || 0).toLocaleString('en-IN')}`, '']}
                    />
                    <Legend iconType="square" wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '16px' }} />
                    <Bar dataKey="Sales" name="Sales" fill="#084b3e" radius={[4, 4, 0, 0]} barSize={26} />
                    <Bar dataKey="Expenses" name="Expenses" fill="#f87171" radius={[4, 4, 0, 0]} barSize={26} />
                  </BarChart>
                )}
              </ResponsiveContainer>
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

