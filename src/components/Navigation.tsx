import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Users, Package, Wallet, FileBarChart, Settings as SettingsIcon, Store, Leaf, Menu } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Sales', path: '/sales', icon: ShoppingCart },
  { name: 'Customers', path: '/customers', icon: Users },
  { name: 'Items', path: '/mfs', icon: Package },
  { name: 'Expenses', path: '/expenses', icon: Wallet },
  { name: 'Reports', path: '/reports', icon: FileBarChart },
  { name: 'Settings', path: '/settings', icon: SettingsIcon },
];

export function Sidebar() {
  const location = useLocation();
  const { profile } = useAuth();

  return (
    <div className="hidden md:flex flex-col w-64 bg-[#084b3e] text-white min-h-screen print:hidden relative overflow-hidden">
      {/* Subtle background decoration */}
      <div className="absolute -bottom-24 -left-16 opacity-10 pointer-events-none">
        <Leaf size={240} className="text-white transform -rotate-45" />
      </div>

      <div className="p-5 flex items-center gap-3">
        <div className="bg-emerald-50 text-[#084b3e] p-2 rounded-xl shrink-0">
          <Store size={28} strokeWidth={2.5} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-base font-extrabold tracking-wide leading-tight truncate">
            {profile?.storeName || 'AL-BARAKAH'}
          </span>
          <span className="text-[10px] font-medium text-emerald-100/70 uppercase tracking-wider truncate">
            {profile?.phone ? `+88 ${profile.phone}` : 'Business Accounts'}
          </span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-2 z-10 mt-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path === '/' && location.pathname === '/sales'); 
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'flex items-center space-x-3 p-3 rounded-xl transition-all font-medium text-sm',
                isActive 
                  ? 'bg-[#126b55] text-white shadow-sm' 
                  : 'text-emerald-50 hover:bg-[#126b55]/50 hover:text-white'
              )}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-6 z-10 flex items-center gap-3 opacity-90 mt-auto">
        <Leaf size={22} className="text-emerald-300" />
        <div className="flex flex-col">
          <span className="text-xs font-bold text-emerald-50">Grow Your Business</span>
          <span className="text-[10px] text-emerald-200">Better records. Bigger dreams.</span>
        </div>
      </div>
    </div>
  );
}

export function BottomNav() {
  const location = useLocation();

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around items-center h-16 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50 overflow-x-auto px-2 print:hidden pb-safe">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={clsx(
              'flex flex-col items-center justify-center min-w-[60px] h-full space-y-1 transition-colors',
              isActive ? 'text-[#084b3e]' : 'text-gray-400 hover:text-[#084b3e]'
            )}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-bold">{item.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
