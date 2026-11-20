import React from 'react';
import DashboardWidgetCard from '../../dashboard/DashboardWidgetCard';
import { Clock, AlertTriangle } from 'lucide-react';

export const LateArrivalTodayWidget = ({
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
  const lateList = Array.isArray(data) ? data : [];
  const mask = (val) => (isMasked ? '••••' : val);

  return (
    <DashboardWidgetCard
      widgetKey="late_today"
      title="Late Arrival Today"
      subtitle="Real-time arrivals delayed past standard studio clock-in"
      icon={Clock}
      loading={loading}
      error={error}
      isEmpty={lateList.length === 0}
      emptyMessage="No late arrivals today — everyone arrived on time!"
      isMasked={isMasked}
      filters={filters}
      departments={departments}
      onToggleMask={onToggleMask}
      onUpdateFilters={onUpdateFilters}
      onApplyFiltersToAll={onApplyFiltersToAll}
      onRefresh={onRefresh}
      onRemove={onRemove}
    >
      <div className="space-y-2.5 max-h-72 overflow-y-auto no-scrollbar pr-1">
        {lateList.map((emp, idx) => {
          const timeStr = emp.checkInTime
            ? new Date(emp.checkInTime).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'N/A';

          return (
            <div
              key={emp.id || idx}
              className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-bold flex items-center justify-center flex-shrink-0 text-xs">
                  {emp.name.charAt(0)}
                </div>
                <div className="truncate">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {emp.name}
                  </h4>
                  <p className="text-[10px] text-slate-400 truncate">
                    {emp.employeeId} • {emp.department}
                  </p>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <span className="font-bold text-rose-600 dark:text-rose-400 block text-xs">
                  {mask(`+${emp.lateMinutes} mins late`)}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Check-in: {timeStr}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </DashboardWidgetCard>
  );
};

export default LateArrivalTodayWidget;
