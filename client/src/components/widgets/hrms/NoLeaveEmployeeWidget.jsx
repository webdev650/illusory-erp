import React from 'react';
import DashboardWidgetCard from '../../dashboard/DashboardWidgetCard';
import { Award, ShieldCheck, MapPin } from 'lucide-react';

export const NoLeaveEmployeeWidget = ({
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
  const employees = data?.employees || [];
  const monthName = data?.month || 'Current Month';
  const count = data?.count || 0;

  const mask = (val) => (isMasked ? '••••' : val);

  return (
    <DashboardWidgetCard
      widgetKey="no_leave"
      title="No Leave Employees"
      subtitle={`Perfect attendance / zero leaves taken in ${monthName}`}
      icon={Award}
      loading={loading}
      error={error}
      isEmpty={count === 0}
      emptyMessage={`All staff availed leave in ${monthName}`}
      isMasked={isMasked}
      filters={filters}
      departments={departments}
      onToggleMask={onToggleMask}
      onUpdateFilters={onUpdateFilters}
      onApplyFiltersToAll={onApplyFiltersToAll}
      onRefresh={onRefresh}
      onRemove={onRemove}
    >
      <div className="space-y-3">
        {/* Header Count */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
          <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>100% Attendance Rate</span>
          </span>
          <span className="text-slate-400 font-medium">
            {mask(count)} Staff Members
          </span>
        </div>

        {/* Scrollable list */}
        <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar pr-1">
          {employees.map((emp, idx) => (
            <div
              key={emp.id || idx}
              className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between gap-2.5 text-xs"
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center flex-shrink-0 text-xs">
                  {emp.name.charAt(0)}
                </div>
                <div className="truncate">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {emp.name}
                  </h4>
                  <p className="text-[10px] text-slate-400 truncate">
                    {emp.designation} • {emp.department}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1 text-[10px] text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-700 flex-shrink-0">
                <MapPin className="w-2.5 h-2.5 text-slate-400" />
                <span>{emp.location}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardWidgetCard>
  );
};

export default NoLeaveEmployeeWidget;
