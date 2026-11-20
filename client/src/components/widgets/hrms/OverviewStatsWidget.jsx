import React from 'react';
import DashboardWidgetCard from '../../dashboard/DashboardWidgetCard';
import { BarChart3, TrendingUp, TrendingDown, Users, UserPlus, UserMinus, AlertTriangle } from 'lucide-react';

export const OverviewStatsWidget = ({
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
  const mask = (val) => (isMasked ? '••••' : val);

  const tiles = [
    {
      label: 'Total Employees',
      value: data?.totalEmployees?.value ?? 0,
      delta: data?.totalEmployees?.delta ?? 0,
      progress: data?.totalEmployees?.progress ?? 75,
      icon: Users,
      color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40',
      meterColor: 'stroke-indigo-500',
    },
    {
      label: 'New Joiners (30d)',
      value: data?.newJoiners?.value ?? 0,
      delta: data?.newJoiners?.delta ?? 0,
      progress: data?.newJoiners?.progress ?? 40,
      icon: UserPlus,
      color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
      meterColor: 'stroke-emerald-500',
    },
    {
      label: 'Exited Employees',
      value: data?.exitedEmployees?.value ?? 0,
      delta: data?.exitedEmployees?.delta ?? 0,
      progress: data?.exitedEmployees?.progress ?? 20,
      icon: UserMinus,
      color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/40',
      meterColor: 'stroke-rose-500',
    },
    {
      label: 'Employees on PIP',
      value: data?.employeesOnPip?.value ?? 0,
      delta: data?.employeesOnPip?.delta ?? 0,
      progress: data?.employeesOnPip?.progress ?? 10,
      icon: AlertTriangle,
      color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40',
      meterColor: 'stroke-amber-500',
    },
  ];

  return (
    <DashboardWidgetCard
      widgetKey="overview_stats"
      title="Employee Overview Statistics"
      subtitle="Key movement KPIs vs previous 30 days"
      icon={BarChart3}
      loading={loading}
      error={error}
      isMasked={isMasked}
      filters={filters}
      departments={departments}
      onToggleMask={onToggleMask}
      onUpdateFilters={onUpdateFilters}
      onApplyFiltersToAll={onApplyFiltersToAll}
      onRefresh={onRefresh}
      onRemove={onRemove}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {tiles.map((tile, i) => {
          const Icon = tile.icon;
          const isPositive = tile.delta >= 0;

          return (
            <div
              key={i}
              className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col justify-between space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                  {tile.label}
                </span>
                <div className={`p-1.5 rounded-lg ${tile.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  {mask(tile.value)}
                </span>
                <div
                  className={`flex items-center space-x-0.5 text-[10px] font-bold ${
                    isPositive ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  {isPositive ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span>{tile.delta > 0 ? `+${tile.delta}%` : `${tile.delta}%`}</span>
                </div>
              </div>

              {/* Dashed progress meter */}
              <div className="w-full">
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden flex space-x-1">
                  <div
                    style={{ width: `${Math.min(100, Math.max(8, tile.progress))}%` }}
                    className={`h-full rounded-full transition-all duration-500 ${
                      tile.color.includes('emerald')
                        ? 'bg-emerald-500'
                        : tile.color.includes('rose')
                        ? 'bg-rose-500'
                        : tile.color.includes('amber')
                        ? 'bg-amber-500'
                        : 'bg-indigo-500'
                    }`}
                  />
                </div>
                <div className="flex justify-between items-center text-[9px] text-slate-400 mt-1">
                  <span>30d Target</span>
                  <span>{tile.progress}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </DashboardWidgetCard>
  );
};

export default OverviewStatsWidget;
