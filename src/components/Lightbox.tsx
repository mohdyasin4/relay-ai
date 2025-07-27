import React, { useEffect } from 'react';
import CloseIcon from './icons/CloseIcon';

interface LightboxProps {
  src: string;
  onClose: () => void;
}

const Lightbox: React.FC<LightboxProps> = ({ src, onClose }) => {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 animate-[fade-in_0.2s_ease-out]"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full text-white bg-black/50 hover:bg-black/75 transition-colors"
        aria-label="Close lightbox"
      >
        <CloseIcon className="w-8 h-8" />
      </button>
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt="Lightbox view" className="w-auto h-auto max-w-[90vw] max-h-[90vh] object-contain rounded-lg animate-[slide-up_0.3s_ease-out]" />
      </div>
    </div>
  );
};

export default Lightbox;