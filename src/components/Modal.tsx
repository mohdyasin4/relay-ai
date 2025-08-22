import React, { useEffect } from 'react';
import CloseIcon from './icons/CloseIcon';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string | React.ReactNode;
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
      className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-50 transition-opacity animate-[fade-in_0.2s_ease-out]"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-background text-foreground rounded-xl shadow-2xl w-full max-w-md m-4 flex flex-col animate-[slide-up_0.3s_ease-out] border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="p-4 border-b border-border flex justify-between items-center flex-shrink-0">
          {typeof title === 'string' ? <h2 className="text-xl font-bold">{title}</h2> : title}
          <button
            onClick={onClose}
            className="p-1 rounded-full text-muted-foreground hover:bg-accent transition-colors"
            aria-label="Close modal"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>
        <main className="p-6 overflow-y-auto">
          {children}
        </main>
        {footer && (
          <footer className="p-4 border-t border-border flex-shrink-0">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
};

export default Modal;