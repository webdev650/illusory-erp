import React from 'react';
import Card from './Card';

export const StatCard = ({
  icon: Icon,
  iconColor = 'text-brand-600 bg-brand-50 dark:bg-brand-900/30 dark:text-brand-300',
  label,
  value,
  subtext,
  badge,
  badgeColor = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  className = '',
  onClick,
}) => {
  return (
    <Card
      hover={!!onClick}
      padding="p-5"
      className={`relative overflow-hidden ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <div className="flex items-baseline space-x-2">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {value}
            </h3>
            {badge && (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${badgeColor}`}>
                {badge}
              </span>
            )}
          </div>
          {subtext && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500">{subtext}</p>
          )}
        </div>
        {Icon && (
          <div className={`p-3 rounded-2xl flex-shrink-0 ${iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </Card>
  );
};

export default StatCard;

