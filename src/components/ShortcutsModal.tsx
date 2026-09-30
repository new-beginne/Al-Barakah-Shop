import React from 'react';
import { X, Keyboard, Zap, Shield, ArrowRight } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null;

  const navigationShortcuts = [
    { key: 'F1', desc: 'Go to Sales Entry' },
    { key: 'F2', desc: 'Go to Expenses Entry' },
    { key: 'F3', desc: 'Go to MFS Transactions' },
    { key: 'F4', desc: 'Go to Reports & Analytics' },
    { key: 'F5', desc: 'Go to Settings' },
    { key: 'F6', desc: 'Go to Customers & Dues' },
    { key: 'F7', desc: 'Go to Inventory & Stock' },
    { key: 'F8', desc: 'Go to Dashboard' },
    { key: 'F9', desc: 'Go to Borrowings / Loans' },
    { key: 'F10', desc: 'Go to Transaction History' },
    { key: 'F12 / ?', desc: 'Open Shortcuts Cheatsheet' },
    { key: 'Esc', desc: 'Close dialogs or modals' },
  ];

  const actionShortcuts = [
    { key: 'Alt + S', desc: 'Quick Open Sales Entry' },
    { key: 'Alt + M', desc: 'Quick Open MFS Ledger' },
    { key: 'Alt + C', desc: 'Quick Open Customers' },
    { key: 'Alt + H', desc: 'Toggle Balance / Profit Privacy (Hide / Show)' },
    { key: 'Alt + L', desc: 'Instant Lock / Logout (Protect shop data)' },
    { key: 'Ctrl + / or ?', desc: 'Open this Keyboard Shortcuts Guide' },
    { key: 'Esc', desc: 'Close dialogs or modals' },
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#084b3e] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-200 border border-white/20">
              <Keyboard size={22} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold tracking-wide">Keyboard Shortcuts</h3>
              <p className="text-xs text-emerald-100/80">Speed up your daily shop workflow</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Quick Tip */}
          <div className="flex items-center gap-3 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold">
            <Zap size={18} className="text-emerald-700 shrink-0" />
            <span>
              Press any function key (<kbd className="px-1.5 py-0.5 bg-white rounded border border-emerald-300 font-mono text-[11px] shadow-xs">F1</kbd> to <kbd className="px-1.5 py-0.5 bg-white rounded border border-emerald-300 font-mono text-[11px] shadow-xs">F10</kbd>) or <kbd className="px-1.5 py-0.5 bg-white rounded border border-emerald-300 font-mono text-[11px] shadow-xs">Alt + 1-9</kbd> from anywhere in the app to switch tabs instantly!
            </span>
          </div>

          {/* Navigation Shortcuts */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
              <span>Page Navigation</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {navigationShortcuts.map((item, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-2.5 bg-gray-50 hover:bg-gray-100/80 rounded-xl border border-gray-100 transition-colors"
                >
                  <span className="text-xs font-medium text-gray-700">{item.desc}</span>
                  <kbd className="px-2 py-1 bg-white border border-gray-300 rounded-md font-mono text-[11px] font-bold text-gray-900 shadow-xs">
                    {item.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Action & Security Shortcuts */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
              <Shield size={14} className="text-[#084b3e]" />
              <span>Actions & Security</span>
            </h4>
            <div className="grid grid-cols-1 gap-2.5">
              {actionShortcuts.map((item, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-2.5 bg-gray-50 hover:bg-gray-100/80 rounded-xl border border-gray-100 transition-colors"
                >
                  <span className="text-xs font-medium text-gray-700">{item.desc}</span>
                  <kbd className="px-2.5 py-1 bg-white border border-gray-300 rounded-md font-mono text-[11px] font-bold text-[#084b3e] shadow-xs">
                    {item.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>Press <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded font-mono shadow-xs">Esc</kbd> to close</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#084b3e] text-white rounded-lg font-bold hover:bg-[#0c5e4e] transition-colors cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
