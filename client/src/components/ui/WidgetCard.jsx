import React from 'react';
import Card from './Card';
import { Loader2 } from 'lucide-react';

export const WidgetCard = ({
  title,
  subtitle,
  icon: Icon,
  iconColor = 'text-brand-600 dark:text-brand-400',
  actions,
  loading = false,
  empty = false,
  emptyMessage = 'No data available',
  children,
  className = '',
  bodyClassName = '',
  dragHandleProps,
}) => {
  return (
    <Card className={`flex flex-col h-full ${className}`} padding="p-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center space-x-2.5 truncate" {...dragHandleProps}>
          {Icon && (
            <div className={`p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 ${iconColor}`}>
              <Icon className="w-4 h-4" />
            </div>
          )}
          <div className="truncate">
            <h3 className="text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100 truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center space-x-1.5 ml-2">{actions}</div>}
      </div>

      {/* Body */}
      <div className={`flex-1 flex flex-col ${bodyClassName}`}>
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
            <span className="text-xs">Loading widget data...</span>
          </div>
        ) : empty ? (
          <div className="py-10 flex flex-col items-center justify-center text-center px-4">
            <p className="text-xs text-slate-400 dark:text-slate-500">{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </Card>
  );
};

export default WidgetCard;

