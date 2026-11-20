import React from 'react';
import { NavLink } from 'react-router-dom';
import DashboardWidgetCard from '../../dashboard/DashboardWidgetCard';
import { AlertCircle, Clock, ChevronRight } from 'lucide-react';

export const LateAttendanceChartWidget = ({
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
  const kpis = data?.kpis || {
    lateToday: 0,
    totalLateEmployees: 0,
    averageLateMinutes: 0,
    totalLateTime: '0h 0m',
  };
  const ranked = data?.ranked || [];

  const mask = (val) => (isMasked ? '••••' : val);

  return (
    <DashboardWidgetCard
      widgetKey="late_attendance"
      title="Late Attendance Analytics"
      subtitle="Punctuality KPIs and top late arrival occurrences"
      icon={AlertCircle}
      loading={loading}
      error={error}
      isEmpty={ranked.length === 0 && kpis.totalLateEmployees === 0}
      emptyMessage="All employees arrived on time"
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
        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-2.5 bg-rose-50/50 dark:bg-rose-950/30 rounded-xl border border-rose-100/60 dark:border-rose-900/40 text-center">
            <span className="text-[10px] uppercase font-semibold text-rose-500">Late Today</span>
            <p className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5">
              {mask(kpis.lateToday)}
            </p>
          </div>
          <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
            <span className="text-[10px] uppercase font-semibold text-slate-400">Total Late Staff</span>
            <p className="text-lg font-bold text-slate-800 dark:text-white mt-0.5">
              {mask(kpis.totalLateEmployees)}
            </p>
          </div>
          <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
            <span className="text-[10px] uppercase font-semibold text-slate-400">Avg Delay</span>
            <p className="text-lg font-bold text-slate-800 dark:text-white mt-0.5">
              {mask(`${kpis.averageLateMinutes}m`)}
            </p>
          </div>
          <div className="p-2.5 bg-amber-50/50 dark:bg-amber-950/30 rounded-xl border border-amber-100/60 dark:border-amber-900/40 text-center">
            <span className="text-[10px] uppercase font-semibold text-amber-500">Total Time Lost</span>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {mask(kpis.totalLateTime)}
            </p>
          </div>
        </div>

        {/* Ranked Late Arrivals */}
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            <span>Ranked by Late Occurrences</span>
            <NavLink
              to="/hrms/attendance"
              className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline flex items-center"
            >
              <span>View full report</span>
              <ChevronRight className="w-3 h-3 ml-0.5" />
            </NavLink>
          </div>

          <div className="space-y-2">
            {ranked.map((item, idx) => {
              const maxLate = ranked[0]?.lateCount || 1;
              const pct = Math.min(100, Math.round((item.lateCount / maxLate) * 100));

              return (
                <div
                  key={item.id || idx}
                  className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between gap-3 text-xs"
                >
                  {/* Avatar + Name */}
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                      {item.name.charAt(0)}
                    </div>
                    <div className="truncate">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {item.name}
                      </p>
                      <span className="text-[10px] text-slate-400">
                        {item.employeeId} • {item.department}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar + Occurrence count */}
                  <div className="flex items-center space-x-2 w-32 flex-shrink-0">
                    <div className="flex-1 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className="bg-rose-500 h-full rounded-full transition-all duration-300"
                      />
                    </div>
                    <span className="font-bold text-rose-600 dark:text-rose-400 text-xs w-8 text-right">
                      {mask(`${item.lateCount}x`)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardWidgetCard>
  );
};

export default LateAttendanceChartWidget;
