import React from 'react';

export const IllusoryLogo = ({
  collapsed = false,
  className = '',
  size = 'md',
}) => {
  return (
    <div className={`flex items-center space-x-3 select-none ${className}`}>
      {/* Brand Icon Mark */}
      <div className="relative w-10 h-10 rounded-tile bg-gradient-to-tr from-brand-700 via-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/25 flex-shrink-0">
        <svg
          className="w-5 h-5 text-white transform transition-transform duration-300 hover:rotate-12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Custom geometric Studio Spark */}
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
        </svg>
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-white dark:border-[#151A26]" />
      </div>

      {/* Brand Typography (hidden when collapsed) */}
      {!collapsed && (
        <div className="flex flex-col truncate">
          <div className="flex items-center space-x-1.5">
            <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white leading-none">
              Illusory
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 leading-none">
              ERP
            </span>
          </div>
          <span className="text-[10px] font-medium tracking-wide text-slate-400 dark:text-slate-500 mt-1 uppercase">
            Illusory Design Studios
          </span>
        </div>
      )}
    </div>
  );
};

export default IllusoryLogo;

