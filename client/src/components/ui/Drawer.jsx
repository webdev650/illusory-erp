import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export const Drawer = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  width = 'max-w-md',
  footer,
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
        <div
          className={`w-screen ${width} bg-white dark:bg-[#151A26] shadow-2xl border-l border-slate-100 dark:border-slate-800 flex flex-col`}
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white leading-tight">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">{children}</div>

          {/* Optional Footer */}
          {footer && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Drawer;

