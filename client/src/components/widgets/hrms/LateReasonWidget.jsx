import React from 'react';
import DashboardWidgetCard from '../../dashboard/DashboardWidgetCard';
import { Clock } from 'lucide-react';

export const LateReasonWidget = ({
  data,
  loading,
  error,
  filters,
  isMasked,
  departments,
  onToggleMask,
  onUpdateFilters,
  onApplyFiltersToAll,
  onRefresh,
  onRemove,
}) => {
  const reasons = data?.data || [];
  const totalLateCount = data?.totalLateCount || 0;

  const mask = (val) => (isMasked ? '••••' : val);

  return (
    <DashboardWidgetCard
      widgetKey="late_reasons"
      title="Late Arrival Reasons"
      subtitle="Explanations cited during late studio check-ins"
      icon={Clock}
      loading={loading}
      error={error}
      isEmpty={totalLateCount === 0 || reasons.every((r) => r.count === 0)}
      emptyMessage="No late check-ins recorded"
      isMasked={isMasked}
      filters={filters}
      departments={departments}
      onToggleMask={onToggleMask}
      onUpdateFilters={onUpdateFilters}
      onApplyFiltersToAll={onApplyFiltersToAll}
      onRefresh={onRefresh}
      onRemove={onRemove}
    >
      <div className="space-y-3.5">
        <div className="flex justify-between items-center text-xs text-slate-500">
          <span>Reported Reasons Breakdown</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Total: {mask(totalLateCount)}
          </span>
        </div>

        {reasons.map((item, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {item.reason}
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {mask(item.count)}{' '}
                <span className="text-[10px] text-slate-400 font-normal">
                  ({item.percentage}%)
                </span>
              </span>
            </div>

            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                style={{ width: `${item.percentage || 0}%` }}
                className={`h-full rounded-full transition-all duration-500 ${
                  idx === 0
                    ? 'bg-brand-500'
                    : idx === 1
                    ? 'bg-amber-500'
                    : idx === 2
                    ? 'bg-rose-500'
                    : idx === 3
                    ? 'bg-sky-500'
                    : 'bg-slate-400'
                }`}
              />
            </div>
          </div>
        ))}
      </div>
    </DashboardWidgetCard>
  );
};

export default LateReasonWidget;
