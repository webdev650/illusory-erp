import React from 'react';

const COLOR_PALETTES = [
  'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300',
  'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
];

const SIZE_MAP = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-xs font-semibold',
  lg: 'w-11 h-11 text-sm font-bold',
  xl: 'w-14 h-14 text-base font-bold',
};

export const Avatar = ({
  src,
  name = 'User',
  size = 'md',
  status, // 'online' | 'offline' | 'busy'
  className = '',
}) => {
  // Deterministic color from name
  const charCodeSum = name
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorClass = COLOR_PALETTES[charCodeSum % COLOR_PALETTES.length];
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;

  const initials = name
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  return (
    <div className={`relative inline-flex flex-shrink-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sizeClass} rounded-full object-cover border border-slate-200 dark:border-slate-700`}
        />
      ) : (
        <div
          className={`${sizeClass} rounded-full flex items-center justify-center font-medium ${colorClass}`}
        >
          {initials}
        </div>
      )}
      {status && (
        <span
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
            status === 'online'
              ? 'bg-emerald-500'
              : status === 'busy'
              ? 'bg-rose-500'
              : 'bg-slate-400'
          }`}
        />
      )}
    </div>
  );
};

export default Avatar;

