import React from 'react';
import DashboardWidgetCard from '../../dashboard/DashboardWidgetCard';
import { Users } from 'lucide-react';

export const EmployeeStatusTypeWidget = ({
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
  const counts = data?.counts || { total: 0, fullTime: 0, probation: 0, intern: 0, notice: 0 };
  const composition = data?.composition || [];

  const mask = (val) => (isMasked ? '••••' : val);

  return (
    <DashboardWidgetCard
      widgetKey="status_type"
      title="Employee Status & Type"
      subtitle="Workforce composition and contract breakdown"
      icon={Users}
      loading={loading}
      error={error}
      isEmpty={data?.total === 0}
      emptyMessage="No employees in selected scope"
      isMasked={isMasked}
      filters={filters}
      departments={departments}
      onToggleMask={onToggleMask}
      onUpdateFilters={onUpdateFilters}
      onApplyFiltersToAll={onApplyFiltersToAll}
      onRefresh={onRefresh}
      onRemove={onRemove}
    >
      <div className="space-y-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-semibold text-slate-400 uppercase">Total Staff</span>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              {mask(counts.total)}
            </p>
          </div>
          <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100/50 dark:border-indigo-900/40">
            <span className="text-[10px] font-semibold text-indigo-500 uppercase">Full Time</span>
            <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
              {mask(counts.fullTime)}
            </p>
            <span className="text-[10px] text-slate-400">{data?.percentages?.fullTime || 0}%</span>
          </div>
          <div className="p-3 bg-amber-50/50 dark:bg-amber-950/30 rounded-xl border border-amber-100/50 dark:border-amber-900/40">
            <span className="text-[10px] font-semibold text-amber-500 uppercase">Probation</span>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {mask(counts.probation)}
            </p>
            <span className="text-[10px] text-slate-400">{data?.percentages?.probation || 0}%</span>
          </div>
          <div className="p-3 bg-rose-50/50 dark:bg-rose-950/30 rounded-xl border border-rose-100/50 dark:border-rose-900/40">
            <span className="text-[10px] font-semibold text-rose-500 uppercase">Notice</span>
            <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">
              {mask(counts.notice)}
            </p>
            <span className="text-[10px] text-slate-400">{data?.percentages?.notice || 0}%</span>
          </div>
        </div>

        {/* Composition Rail */}
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
            <span>Workforce Rail</span>
            <span className="text-[10px] text-slate-400">Total: {mask(counts.total)}</span>
          </div>

          {/* Thin horizontal bar broken into colored segments */}
          <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
            {composition.map((item, idx) => (
              <div
                key={idx}
                style={{
                  width: `${item.pct || 0}%`,
                  backgroundColor: item.color,
                }}
                className="h-full transition-all duration-300 relative group cursor-pointer"
                title={`${item.label}: ${mask(item.count)} (${item.pct}%)`}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            {composition.map((item, idx) => (
              <div key={idx} className="flex items-center space-x-1.5 text-[11px] truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-slate-600 dark:text-slate-300 truncate">{item.label}</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 ml-auto">
                  {mask(item.count)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardWidgetCard>
  );
};

export default EmployeeStatusTypeWidget;
