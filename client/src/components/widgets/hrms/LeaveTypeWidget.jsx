import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import DashboardWidgetCard from '../../dashboard/DashboardWidgetCard';
import { Calendar } from 'lucide-react';

export const LeaveTypeWidget = ({
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
  const chartData = data?.data || [];
  const totalDays = data?.totalDays || 0;

  const mask = (val) => (isMasked ? '••••' : val);

  return (
    <DashboardWidgetCard
      widgetKey="leave_types"
      title="Leave Type Breakdown"
      subtitle="Days taken categorized by leave policy"
      icon={Calendar}
      loading={loading}
      error={error}
      isEmpty={totalDays === 0 || chartData.length === 0}
      emptyMessage="No leaves recorded in this period"
      isMasked={isMasked}
      filters={filters}
      departments={departments}
      onToggleMask={onToggleMask}
      onUpdateFilters={onUpdateFilters}
      onApplyFiltersToAll={onApplyFiltersToAll}
      onRefresh={onRefresh}
      onRemove={onRemove}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Donut Chart */}
        <div className="relative w-44 h-44 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const row = payload[0].payload;
                    return (
                      <div className="bg-slate-900 border border-slate-700 p-2 rounded-lg text-xs text-white">
                        <p className="font-bold">{row.name}</p>
                        <p className="text-brand-300">
                          {mask(row.value)} Days ({row.percentage}%)
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={3}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Centered Total */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-bold text-slate-800 dark:text-white">
              {mask(totalDays)}
            </span>
            <span className="text-[10px] text-slate-400">Days</span>
          </div>
        </div>

        {/* Legend List */}
        <div className="flex-1 w-full space-y-2">
          {chartData.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/40 text-xs"
            >
              <div className="flex items-center space-x-2 truncate">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                  {item.name}
                </span>
              </div>
              <div className="flex items-center space-x-2 font-semibold">
                <span className="text-slate-900 dark:text-white">{mask(item.value)}d</span>
                <span className="text-[10px] text-slate-400">({item.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardWidgetCard>
  );
};

export default LeaveTypeWidget;
