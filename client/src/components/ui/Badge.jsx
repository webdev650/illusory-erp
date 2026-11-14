import React from 'react';

const VARIANT_MAP = {
  brand: 'bg-brand-50 text-brand-700 border-brand-200/60 dark:bg-brand-950/40 dark:text-brand-300 dark:border-brand-800/40',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40',
  warning: 'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40',
  danger: 'bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40',
  info: 'bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40',
  purple: 'bg-purple-50 text-purple-700 border-purple-200/60 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

export const Badge = ({
  children,
  variant = 'neutral',
  size = 'sm',
  dot = false,
  className = '',
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  const variantClass = VARIANT_MAP[variant] || VARIANT_MAP.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${sizeClasses} ${variantClass} ${className}`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
};

export default Badge;

