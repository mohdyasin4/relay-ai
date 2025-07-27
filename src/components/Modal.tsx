import React, { useEffect } from 'react';
import CloseIcon from './icons/CloseIcon';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/60 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity animate-[fade-in_0.2s_ease-out]"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-xl shadow-2xl w-full max-w-md m-4 flex flex-col animate-[slide-up_0.3s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label="Close modal"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>
        <main className="p-6 overflow-y-auto">
          {children}
        </main>
        {footer && (
          <footer className="p-4 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
};

export default Modal;