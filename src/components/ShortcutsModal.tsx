import React from 'react';
import { Zap, Shield } from 'lucide-react';
import { Modal } from './common/Modal';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  const navigationShortcuts = [
    { key: 'F1', desc: 'Go to Sales Entry' },
    { key: 'F2', desc: 'Go to Expenses Entry' },
    { key: 'F3', desc: 'Go to MFS Transactions' },
    { key: 'F4', desc: 'Go to Reports & Analytics' },
    { key: 'F5', desc: 'Go to Settings' },
    { key: 'F6', desc: 'Go to Customers & Dues' },
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Keyboard Shortcuts"
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Quick Tip */}
        <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-[12px] text-xs font-semibold">
          <Zap size={18} className="text-[#075e4f] shrink-0" />
          <span>
            Press any function key (<kbd className="px-1.5 py-0.5 bg-white rounded border border-emerald-300 font-mono text-[11px] shadow-xs">F1</kbd> to <kbd className="px-1.5 py-0.5 bg-white rounded border border-emerald-300 font-mono text-[11px] shadow-xs">F10</kbd>) or <kbd className="px-1.5 py-0.5 bg-white rounded border border-emerald-300 font-mono text-[11px] shadow-xs">Alt + 1-9</kbd> from anywhere in the app to switch tabs instantly!
          </span>
        </div>

        {/* Navigation Shortcuts */}
        <div>
          <h4 className="text-[12px] font-[750] uppercase tracking-[0.04em] text-[#4b5870] mb-2.5 flex items-center gap-1.5">
            <span>Page Navigation</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {navigationShortcuts.map((item, idx) => (
              <div 
                key={idx} 
                className="flex items-center justify-between p-2.5 bg-[#f7f8fa] hover:bg-[#eef2f5] rounded-[10px] border border-[#d8e0e8] transition-colors"
              >
                <span className="text-[13px] font-semibold text-[#202b3d]">{item.desc}</span>
                <kbd className="px-2 py-0.5 bg-white border border-[#d8e0e8] rounded-[6px] font-mono text-[11px] font-bold text-[#202b3d] shadow-xs">
                  {item.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Action & Security Shortcuts */}
        <div>
          <h4 className="text-[12px] font-[750] uppercase tracking-[0.04em] text-[#4b5870] mb-2.5 flex items-center gap-1.5">
            <Shield size={14} className="text-[#075e4f]" />
            <span>Actions & Security</span>
          </h4>
          <div className="grid grid-cols-1 gap-2">
            {actionShortcuts.map((item, idx) => (
              <div 
                key={idx} 
                className="flex items-center justify-between p-2.5 bg-[#f7f8fa] hover:bg-[#eef2f5] rounded-[10px] border border-[#d8e0e8] transition-colors"
              >
                <span className="text-[13px] font-semibold text-[#202b3d]">{item.desc}</span>
                <kbd className="px-2.5 py-0.5 bg-white border border-[#d8e0e8] rounded-[6px] font-mono text-[11px] font-bold text-[#075e4f] shadow-xs">
                  {item.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 flex items-center justify-between border-t border-[#d8e0e8]/60 text-xs text-[#8b95a3]">
          <span>Press <kbd className="px-1.5 py-0.5 bg-white border border-[#d8e0e8] rounded font-mono shadow-xs">Esc</kbd> to close</span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[43px] px-5 bg-[#075e4f] hover:bg-[#064c40] text-white font-[750] text-[13px] rounded-[12px] shadow-[0_2px_3px_rgba(0,0,0,0.12)] transition-all cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </Modal>
  );
}
