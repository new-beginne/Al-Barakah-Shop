import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, ShoppingCart, Users, Package, Wallet, 
  FileBarChart, Settings as SettingsIcon, Leaf, 
  HandCoins, Smartphone, History, Keyboard, Calendar, Download, Menu, X
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { usePwaInstall } from '../hooks/usePwaInstall';

export const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, shortcut: 'F8' },
  { name: 'Sales', path: '/sales', icon: ShoppingCart, shortcut: 'F1' },
  { name: 'Expenses', path: '/expenses', icon: Wallet, shortcut: 'F2' },
  { name: 'MFS', path: '/mfs', icon: Smartphone, shortcut: 'F3' },
  { name: 'Customers & Dues', path: '/customers', icon: Users, shortcut: 'F6' },
  { name: 'Reports', path: '/reports', icon: FileBarChart, shortcut: 'F4' },
  { name: 'Inventory', path: '/inventory', icon: Package, shortcut: 'F7' },
  { name: 'Borrowings', path: '/borrowings', icon: HandCoins, shortcut: 'F9' },
  { name: 'History', path: '/history', icon: History, shortcut: 'F10' },
  { name: 'Settings', path: '/settings', icon: SettingsIcon, shortcut: 'F5' },
];

interface SidebarProps {
  onOpenShortcuts?: () => void;
}

export function Sidebar({ onOpenShortcuts }: SidebarProps) {
  const location = useLocation();
  const [time, setTime] = useState(new Date());
  const { isInstallable, installApp } = usePwaInstall();

  useEffect(() => {
    const updateTime = () => setTime(new Date());
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hidden md:flex flex-col w-64 bg-[#084b3e] text-white min-h-screen print:hidden relative overflow-hidden shrink-0">
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

      <nav className="flex-1 px-4 py-2 space-y-1 z-10 mt-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path; 
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'flex items-center justify-between px-3 py-2 rounded-xl transition-all font-medium text-sm group',
                isActive 
                  ? 'bg-[#126b55] text-white shadow-sm' 
                  : 'text-emerald-50 hover:bg-[#126b55]/50 hover:text-white'
              )}
            >
              <div className="flex items-center space-x-3 min-w-0">
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
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

      {/* PWA Install Button (if browser supports install prompt) */}
      {isInstallable && (
        <div className="px-4 py-1.5 z-10">
          <button
            type="button"
            onClick={installApp}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all border border-emerald-300/30 cursor-pointer shadow-sm animate-pulse"
          >
            <div className="flex items-center gap-2">
              <Download size={14} className="text-white" />
              <span>Install App</span>
            </div>
            <span className="font-mono text-[10px] bg-white/20 px-1.5 py-0.5 rounded">PWA</span>
          </button>
        </div>
      )}

      {/* Keyboard Shortcuts Trigger Button */}
      {onOpenShortcuts && (
        <div className="px-4 py-1.5 z-10">
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

      <div className="p-4 z-10 flex items-center gap-3 opacity-90 border-t border-white/10">
        <Leaf size={18} className="text-emerald-300 shrink-0" />
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold text-emerald-50 truncate">Al-Barakah Digital Studio</span>
          <span className="text-[10px] text-emerald-200 truncate">Offline-Ready & Secured</span>
        </div>
      </div>
    </div>
  );
}

export function BottomNav() {
  const location = useLocation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { isInstallable, installApp } = usePwaInstall();

  // Close more sheet when navigating
  useEffect(() => {
    setIsMoreOpen(false);
  }, [location.pathname]);

  const primaryItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Sales', path: '/sales', icon: ShoppingCart },
    { name: 'MFS', path: '/mfs', icon: Smartphone },
    { name: 'Dues', path: '/customers', icon: Users },
    { name: 'Reports', path: '/reports', icon: FileBarChart },
  ];

  const secondaryItems = [
    { name: 'Expenses', path: '/expenses', icon: Wallet },
    { name: 'Inventory', path: '/inventory', icon: Package },
    { name: 'Borrowings', path: '/borrowings', icon: HandCoins },
    { name: 'History', path: '/history', icon: History },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  const isMoreActive = secondaryItems.some(item => item.path === location.pathname);

  return (
    <>
      {/* Slide-up Drawer for Secondary Items */}
      {isMoreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div 
            className="flex-1" 
            onClick={() => setIsMoreOpen(false)} 
          />
          <div className="bg-white rounded-t-3xl p-5 shadow-2xl border-t border-gray-200 z-50 max-h-[75vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-gray-900">More Features</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                  Al-Barakah
                </span>
              </div>
              <button 
                type="button" 
                onClick={() => setIsMoreOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {secondaryItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMoreOpen(false)}
                    className={clsx(
                      'flex items-center gap-3 p-3 rounded-2xl transition-all border font-semibold text-xs',
                      isActive 
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-xs' 
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    <div className={clsx(
                      'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
                      isActive ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
                    )}>
                      <Icon size={16} />
                    </div>
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* PWA Install Button inside More Drawer */}
            {isInstallable && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreOpen(false);
                    installApp();
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs"
                >
                  <Download size={15} />
                  <span>Install App on Home Screen (PWA)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main 5+1 Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around items-center h-16 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.06)] z-40 px-1 print:hidden pb-safe">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-colors py-1',
                isActive ? 'text-[#084b3e]' : 'text-gray-400 hover:text-gray-700'
              )}
            >
              <div className={clsx(
                'w-10 h-7 flex items-center justify-center rounded-full transition-all',
                isActive && 'bg-emerald-50 text-[#084b3e]'
              )}>
                <Icon size={19} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={clsx(
                'text-[10px] tracking-tight leading-none',
                isActive ? 'font-black text-[#084b3e]' : 'font-semibold text-gray-500'
              )}>
                {item.name}
              </span>
            </Link>
          );
        })}

        {/* More Menu Toggle Button */}
        <button
          type="button"
          onClick={() => setIsMoreOpen(!isMoreOpen)}
          className={clsx(
            'flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-colors py-1 cursor-pointer',
            isMoreActive || isMoreOpen ? 'text-[#084b3e]' : 'text-gray-400 hover:text-gray-700'
          )}
        >
          <div className={clsx(
            'w-10 h-7 flex items-center justify-center rounded-full transition-all',
            (isMoreActive || isMoreOpen) && 'bg-emerald-50 text-[#084b3e]'
          )}>
            <Menu size={19} strokeWidth={isMoreActive || isMoreOpen ? 2.5 : 2} />
          </div>
          <span className={clsx(
            'text-[10px] tracking-tight leading-none',
            isMoreActive || isMoreOpen ? 'font-black text-[#084b3e]' : 'font-semibold text-gray-500'
          )}>
            More
          </span>
        </button>
      </div>
    </>
  );
}
