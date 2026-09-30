import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface UseKeyboardShortcutsProps {
  onOpenShortcuts: () => void;
  onCloseModals?: () => void;
}

export function useKeyboardShortcuts({ onOpenShortcuts, onCloseModals }: UseKeyboardShortcutsProps) {
  const navigate = useNavigate();
  const { toggleBalanceVisibility, logout } = useAuth();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused = target && (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.tagName === 'SELECT' || 
        target.isContentEditable
      );

      // Escape closes modals
      if (e.key === 'Escape') {
        if (onCloseModals) {
          onCloseModals();
        }
        return;
      }

      // Help shortcuts: '?' (when not typing in an input) or 'Ctrl + /'
      if ((e.key === '?' && !isInputFocused) || (e.ctrlKey && e.key === '/')) {
        e.preventDefault();
        onOpenShortcuts();
        return;
      }

      // Function keys: F1 to F12
      if (e.key === 'F1') {
        e.preventDefault();
        navigate('/sales');
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        navigate('/expenses');
        return;
      }
      if (e.key === 'F3') {
        e.preventDefault();
        navigate('/mfs');
        return;
      }
      if (e.key === 'F4') {
        e.preventDefault();
        navigate('/reports');
        return;
      }
      if (e.key === 'F5') {
        e.preventDefault();
        navigate('/settings');
        return;
      }
      if (e.key === 'F6') {
        e.preventDefault();
        navigate('/customers');
        return;
      }
      if (e.key === 'F7') {
        e.preventDefault();
        navigate('/inventory');
        return;
      }
      if (e.key === 'F8') {
        e.preventDefault();
        navigate('/');
        return;
      }
      if (e.key === 'F9') {
        e.preventDefault();
        navigate('/borrowings');
        return;
      }
      if (e.key === 'F10') {
        e.preventDefault();
        navigate('/history');
        return;
      }
      if (e.key === 'F12') {
        e.preventDefault();
        onOpenShortcuts();
        return;
      }

      // Alt + Number (Alt + 1 to 9)
      if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            navigate('/');
            break;
          case '2':
            e.preventDefault();
            navigate('/sales');
            break;
          case '3':
            e.preventDefault();
            navigate('/customers');
            break;
          case '4':
            e.preventDefault();
            navigate('/mfs');
            break;
          case '5':
            e.preventDefault();
            navigate('/borrowings');
            break;
          case '6':
            e.preventDefault();
            navigate('/expenses');
            break;
          case '7':
            e.preventDefault();
            navigate('/reports');
            break;
          case '8':
            e.preventDefault();
            navigate('/history');
            break;
          case '9':
            e.preventDefault();
            navigate('/settings');
            break;
          case 's':
          case 'S':
            e.preventDefault();
            navigate('/sales');
            break;
          case 'm':
          case 'M':
            e.preventDefault();
            navigate('/mfs');
            break;
          case 'i':
          case 'I':
            e.preventDefault();
            navigate('/inventory');
            break;
          case 'c':
          case 'C':
            e.preventDefault();
            navigate('/customers');
            break;
          case 'h':
          case 'H':
            e.preventDefault();
            toggleBalanceVisibility();
            break;
          case 'l':
          case 'L':
            e.preventDefault();
            logout();
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigate, toggleBalanceVisibility, logout, onOpenShortcuts, onCloseModals]);
}
