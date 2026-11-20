import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import DashboardWidgetCard from '../../dashboard/DashboardWidgetCard';
import { TrendingUp } from 'lucide-react';

export const EmployeeStrengthWidget = ({
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
  const series = data?.series || [];
  const summary = data?.summary || { highest: 0, lowest: 0, current: 0 };

  const mask = (val) => (isMasked ? '••••' : val);

  return (
    <DashboardWidgetCard
      widgetKey="strength"
      title="Employee Strength"
      subtitle="Monthly workforce headcount progression (12 Months)"
      icon={TrendingUp}
      loading={loading}
      error={error}
      isEmpty={series.length === 0}
      emptyMessage="No historical headcount data"
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
        {/* Recharts Headcount progression */}
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="strengthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const row = payload[0].payload;
                    return (
                      <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs text-white">
                        <p className="font-bold text-slate-300">{row.month} {row.year}</p>
                        <p className="text-brand-400 font-semibold mt-0.5">
                          Headcount: {mask(row.headcount)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="headcount"
                stroke="#6366F1"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#strengthGradient)"
              />
              <Bar dataKey="headcount" fill="#818CF8" opacity={0.3} radius={[4, 4, 0, 0]} maxBarSize={20} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Footer: highest / lowest / current */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/40">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Highest</span>
            <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
              {mask(summary.highest)}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/40">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Lowest</span>
            <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
              {mask(summary.lowest)}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-brand-50/50 dark:bg-brand-950/30 border border-brand-100/50 dark:border-brand-900/30">
            <span className="text-[10px] text-brand-600 dark:text-brand-400 uppercase font-bold">Current</span>
            <p className="text-sm font-bold text-brand-700 dark:text-brand-300 mt-0.5">
              {mask(summary.current)}
            </p>
          </div>
        </div>
      </div>
    </DashboardWidgetCard>
  );
};

export default EmployeeStrengthWidget;
