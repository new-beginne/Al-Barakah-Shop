import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showCloseButton?: boolean;
  children: React.ReactNode;
  ariaLabelledBy?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  maxWidth = 'md',
  showCloseButton = true,
  children,
  ariaLabelledBy = 'universal-modal-title',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClass = {
    sm: 'max-w-[380px]',
    md: 'max-w-[445px]', // Exact demo reference width
    lg: 'max-w-[560px]',
    xl: 'max-w-[680px]',
    '2xl': 'max-w-[840px]',
  }[maxWidth];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
    >
      <div
        className={`w-full ${maxWidthClass} p-6 sm:p-7 bg-white border border-[#cdd6e0]/75 rounded-[15px] shadow-[0_12px_32px_rgba(25,40,60,0.07)] max-h-[90vh] overflow-y-auto relative animate-fadeIn`}
        onClick={(e) => e.stopPropagation()}
      >
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 text-gray-400 hover:text-[#202b3d] rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        )}

        <h2
          id={ariaLabelledBy}
          className="text-center font-[750] text-[20px] sm:text-[21px] text-[#202b3d] tracking-[-0.025em] leading-snug mb-6"
        >
          {title}
        </h2>

        {children}
      </div>
    </div>
  );
};
