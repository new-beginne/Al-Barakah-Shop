import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Link } from 'react-router-dom';
import { 
  format, subDays, subMonths, startOfMonth, endOfMonth, 
  parseISO, eachDayOfInterval 
} from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Plus, Minus, ArrowUpRight, ArrowDownRight, Wallet, Activity, ArrowRight, CircleDollarSign, AlertCircle, ShoppingCart, Smartphone, FileText } from 'lucide-react';
import { SalesEntry } from './SalesEntry';
import { Expenses } from './Expenses';
import { MfsLedger } from './MfsLedger';
import { Reports } from './Reports';

export function Dashboard() {
  const [filterType, setFilterType] = useState('today');
  const [customStart, setCustomStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [activeTab, setActiveTab] = useState('overview');

  const today = format(new Date(), 'yyyy-MM-dd');
  
  // Fetch all data
  const allSales = useLiveQuery(() => db.sales.orderBy('id').reverse().toArray()) || [];
  const allMfs = useLiveQuery(() => db.mfs.orderBy('id').reverse().toArray()) || [];
  const allExpenses = useLiveQuery(() => db.expenses.orderBy('id').reverse().toArray()) || [];
  const allDues = useLiveQuery(() => db.dues.toArray()) || [];

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
    if (m.type === 'Cash-In') return acc + m.amount;
    if (m.type === 'Cash-Out') return acc - m.amount;
    return acc;
  }, 0);
  const cashOnHand = cashReceivedToday + mfsCashImpact - expensesToday; 

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
      Expenses: dayExpenses
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
          <div className="border border-gray-100 rounded-md p-6 bg-white shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-900 mb-6">Cashflow Overview</h2>
            <div className="h-80 sm:h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#71717a', fontWeight: 600}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#71717a', fontWeight: 600}} />
                  <Tooltip 
                    cursor={{fill: '#f4f4f5'}} 
                    contentStyle={{borderRadius: '4px', border: '1px solid #000', backgroundColor: '#fff', color: '#000', fontWeight: 'bold'}} 
                  />
                  <Legend iconType="square" wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '10px' }} />
                  <Bar dataKey="Sales" fill="#000000" radius={[2, 2, 0, 0]} barSize={28} />
                  <Bar dataKey="Expenses" fill="#a1a1aa" radius={[2, 2, 0, 0]} barSize={28} />
                </BarChart>
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

