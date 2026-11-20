import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import DashboardWidgetCard from '../../dashboard/DashboardWidgetCard';
import { UserCheck } from 'lucide-react';

export const EmployeeGrowthWidget = ({
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
  const mask = (val) => (isMasked ? '••••' : val);

  return (
    <DashboardWidgetCard
      widgetKey="growth"
      title="Employee Growth Comparison"
      subtitle="Monthly Joiners vs Left Employees"
      icon={UserCheck}
      loading={loading}
      error={error}
      isEmpty={series.length === 0}
      emptyMessage="No historical joiner/leaver records"
      isMasked={isMasked}
      filters={filters}
      departments={departments}
      onToggleMask={onToggleMask}
      onUpdateFilters={onUpdateFilters}
      onApplyFiltersToAll={onApplyFiltersToAll}
      onRefresh={onRefresh}
      onRemove={onRemove}
    >
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const row = payload[0].payload;
                  return (
                    <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs text-white">
                      <p className="font-bold text-slate-300">{row.month}</p>
                      <p className="text-emerald-400 font-semibold mt-1">
                        New Joiners: +{mask(row.joiners)}
                      </p>
                      <p className="text-rose-400 font-semibold">
                        Left Employees: -{mask(row.leavers)}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
            />
            <Bar dataKey="joiners" name="New Joiners" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={16} />
            <Bar dataKey="leavers" name="Left Employees" fill="#F43F5E" radius={[4, 4, 0, 0]} maxBarSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DashboardWidgetCard>
  );
};

export default EmployeeGrowthWidget;
