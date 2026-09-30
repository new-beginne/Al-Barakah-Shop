import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, ShoppingCart, Users, Package, Wallet, 
  FileBarChart, Settings as SettingsIcon, Leaf, 
  HandCoins, Smartphone, History, Keyboard, Calendar, Clock 
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, shortcut: 'F8' },
  { name: 'Sales', path: '/sales', icon: ShoppingCart, shortcut: 'F1' },
  { name: 'Expenses', path: '/expenses', icon: Wallet, shortcut: 'F2' },
  { name: 'MFS', path: '/mfs', icon: Smartphone, shortcut: 'F3' },
  { name: 'Reports', path: '/reports', icon: FileBarChart, shortcut: 'F4' },
  { name: 'Settings', path: '/settings', icon: SettingsIcon, shortcut: 'F5' },
  { name: 'Customers', path: '/customers', icon: Users, shortcut: 'F6' },
  { name: 'Inventory', path: '/inventory', icon: Package, shortcut: 'F7' },
  { name: 'Borrowings', path: '/borrowings', icon: HandCoins, shortcut: 'F9' },
  { name: 'History', path: '/history', icon: History, shortcut: 'F10' },
];

interface SidebarProps {
  onOpenShortcuts?: () => void;
}

export function Sidebar({ onOpenShortcuts }: SidebarProps) {
  const location = useLocation();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const updateTime = () => setTime(new Date());
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hidden md:flex flex-col w-64 bg-[#084b3e] text-white min-h-screen print:hidden relative overflow-hidden">
      {/* Subtle background decoration */}
      <div className="absolute -bottom-24 -left-16 opacity-10 pointer-events-none">
        <Leaf size={240} className="text-white transform -rotate-45" />
      </div>

      {/* Top Rounded Box: Live Timer, Day & Date */}
      <div className="mx-3.5 mt-3.5 mb-1.5 p-3.5 bg-black/25 backdrop-blur-xs border border-white/10 rounded-2xl shadow-inner text-center relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-10 -right-10 w-20 h-20 bg-emerald-400/10 rounded-full blur-xl pointer-events-none" />

        {/* Day Name with live pulsating dot */}
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-300">
            {format(time, 'EEEE')}
          </span>
        </div>

        {/* Live Timer: (HH:MM:SS) AM/PM */}
        <div className="flex items-baseline justify-center gap-1.5 text-white font-mono py-0.5">
          <span className="text-2xl font-black tracking-wider leading-none drop-shadow-xs">
            {format(time, 'hh:mm:ss')}
          </span>
          <span className="text-xs font-bold text-emerald-200 font-sans tracking-wide">
            {format(time, 'a')}
          </span>
        </div>

        {/* Date: (DD-MM-YY) */}
        <div className="mt-1.5 pt-1.5 border-t border-white/10 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-emerald-100/90">
          <Calendar size={12} className="text-emerald-300 shrink-0" />
          <span className="font-mono tracking-wider font-bold">
            {format(time, 'dd-MM-yy')}
          </span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1.5 z-10 mt-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path; 
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'flex items-center justify-between px-3 py-2.5 rounded-xl transition-all font-medium text-sm group',
                isActive 
                  ? 'bg-[#126b55] text-white shadow-sm' 
                  : 'text-emerald-50 hover:bg-[#126b55]/50 hover:text-white'
              )}
            >
              <div className="flex items-center space-x-3 min-w-0">
                <Icon size={19} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
                <span className="truncate">{item.name}</span>
              </div>
              {item.shortcut && (
                <kbd className="hidden lg:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono text-emerald-200/60 group-hover:text-white bg-black/20 border border-white/10 shrink-0">
                  {item.shortcut}
                </kbd>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Keyboard Shortcuts Trigger Button */}
      {onOpenShortcuts && (
        <div className="px-4 py-2 z-10">
          <button
            type="button"
            onClick={onOpenShortcuts}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-emerald-100 hover:text-white hover:bg-[#126b55]/40 rounded-xl transition-all border border-emerald-400/20 cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-2">
              <Keyboard size={15} className="text-emerald-300" />
              <span>Shortcuts</span>
            </div>
            <kbd className="font-mono text-[10px] bg-black/25 px-1.5 py-0.5 rounded border border-white/10">?</kbd>
          </button>
        </div>
      )}

      <div className="p-5 z-10 flex items-center gap-3 opacity-90 border-t border-white/10">
        <Leaf size={20} className="text-emerald-300 shrink-0" />
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold text-emerald-50 truncate">Grow Your Business</span>
          <span className="text-[10px] text-emerald-200 truncate">Better records. Bigger dreams.</span>
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
