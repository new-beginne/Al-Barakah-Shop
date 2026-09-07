import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar, BottomNav } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { SalesEntry } from './components/SalesEntry';
import { MfsLedger } from './components/MfsLedger';
import { Expenses } from './components/Expenses';
import { Reports } from './components/Reports';
import { Settings } from './components/Settings';
import { Customers } from './components/Customers';
import { CustomerProfile } from './components/CustomerProfile';
import { Menu, User, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';

function TopHeader() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex justify-between items-center z-10 shrink-0 sticky top-0 print:hidden">
      <div className="flex items-center gap-4">
        <button className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg">
          <Menu size={24} />
        </button>
        <div className="flex items-center gap-3">
          <div className="text-3xl hidden sm:block">👋</div>
          <div className="flex flex-col">
            <h2 className="text-lg font-extrabold text-gray-900 leading-tight">Welcome Back!</h2>
            <p className="text-[11px] font-medium text-gray-500 hidden sm:block">Manage your sales, stock and accounts with ease.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Date & Time */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-gray-200 text-sm font-bold text-gray-700 shadow-sm">
            <CalendarIcon size={16} className="text-gray-400"/> 
            {format(time, 'dd/MM/yyyy')}
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-gray-200 text-sm font-bold text-gray-700 shadow-sm">
            <Clock size={16} className="text-gray-400"/> 
            {format(time, 'hh:mm a')}
          </div>
        </div>
        {/* User profile */}
        <div className="w-10 h-10 rounded-full bg-[#084b3e] flex items-center justify-center text-white shadow-sm cursor-pointer hover:bg-[#126b55] transition-colors">
          <User size={20} strokeWidth={2.5} />
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-[#f4f8f7] font-sans print:block print:min-h-0 print:bg-white">
        {/* Desktop Sidebar */}
        <Sidebar />
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col w-full min-w-0 h-screen overflow-hidden print:h-auto print:overflow-visible print:w-full print:p-0 print:m-0">
          <TopHeader />
          <main className="flex-1 overflow-y-auto w-full p-0 sm:p-4 md:p-6 print:p-0">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/sales" element={<SalesEntry />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/:id" element={<CustomerProfile />} />
              <Route path="/mfs" element={<MfsLedger />} />
              <Route path="/dues" element={<Navigate to="/customers" replace />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>

        {/* Mobile Bottom Navigation */}
        <BottomNav />
      </div>
    </Router>
  );
}
