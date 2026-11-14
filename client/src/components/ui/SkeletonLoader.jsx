import React from 'react';

export const SkeletonLoader = ({
  variant = 'line', // 'line' | 'card' | 'circle' | 'stat'
  lines = 3,
  className = '',
}) => {
  if (variant === 'circle') {
    return (
      <div className={`w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse ${className}`} />
    );
  }

  if (variant === 'stat') {
    return (
      <div className={`p-5 rounded-2xl bg-white dark:bg-[#151A26] border border-slate-100 dark:border-slate-800 animate-pulse space-y-3 ${className}`}>
        <div className="flex justify-between items-center">
          <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="h-7 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-2.5 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`p-5 rounded-2xl bg-white dark:bg-[#151A26] border border-slate-100 dark:border-slate-800 animate-pulse space-y-3 ${className}`}>
        <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-3 w-4/5 bg-slate-200 dark:bg-slate-800 rounded" />
      </div>
    );
  }

  return (
    <div className={`space-y-2.5 ${className}`}>
      {Array.from({ length: lines }).map((_, idx) => (
        <div
          key={idx}
          className="h-3 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"
          style={{ width: `${100 - idx * 15}%` }}
        />
      ))}
    </div>
  );
};

export default SkeletonLoader;

