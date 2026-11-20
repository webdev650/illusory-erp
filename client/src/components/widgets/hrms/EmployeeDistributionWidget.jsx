import React, { useState } from 'react';
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
import { PieChart } from 'lucide-react';

const PALETTE = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6'];

export const EmployeeDistributionWidget = ({
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
  onParamChange,
}) => {
  const [groupBy, setGroupBy] = useState(data?.groupBy || 'department');
  const [crossBy, setCrossBy] = useState(data?.crossBy || 'gender');

  const chartData = data?.data || [];
  const categories = data?.categories || [];

  const mask = (val) => (isMasked ? '••••' : val);

  const handleGroupChange = (e) => {
    const val = e.target.value;
    setGroupBy(val);
    onParamChange?.({ groupBy: val, crossBy });
  };

  const handleCrossChange = (e) => {
    const val = e.target.value;
    setCrossBy(val);
    onParamChange?.({ groupBy, crossBy: val });
  };

  return (
    <DashboardWidgetCard
      widgetKey="distribution"
      title="Employee Distribution"
      subtitle="Cross-sectional workforce distribution"
      icon={PieChart}
      loading={loading}
      error={error}
      isEmpty={chartData.length === 0}
      emptyMessage="No employee records found"
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
        {/* Interactive Selectors */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-[10px] font-semibold text-slate-400 uppercase">Group by:</span>
            <select
              value={groupBy}
              onChange={handleGroupChange}
              className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-brand-500 font-medium"
            >
              <option value="department">Department</option>
              <option value="designation">Designation</option>
              <option value="employeeType">Employment Type</option>
              <option value="location">Work Mode</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-[10px] font-semibold text-slate-400 uppercase">Cross by:</span>
            <select
              value={crossBy}
              onChange={handleCrossChange}
              className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-brand-500 font-medium"
            >
              <option value="gender">Gender</option>
              <option value="employeeType">Employment Type</option>
              <option value="ageBand">Age Band</option>
            </select>
          </div>
        </div>

        {/* Grouped Bar Chart */}
        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 25 }}>
              <XAxis
                dataKey="group"
                stroke="#94A3B8"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                angle={-20}
                textAnchor="end"
                interval={0}
              />
              <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const row = payload[0].payload;
                    return (
                      <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs text-white">
                        <p className="font-bold text-slate-300 pb-1 mb-1 border-b border-slate-800">
                          {row.group}
                        </p>
                        {categories.map((cat, i) => (
                          <div key={i} className="flex items-center justify-between space-x-4 py-0.5">
                            <span className="text-slate-400">{cat}:</span>
                            <span className="font-semibold">{mask(row[cat] || 0)}</span>
                          </div>
                        ))}
                        <div className="pt-1 mt-1 border-t border-slate-800 flex justify-between font-bold text-brand-300">
                          <span>Total:</span>
                          <span>{mask(row.total)}</span>
                        </div>
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
              {categories.map((cat, idx) => (
                <Bar
                  key={cat}
                  dataKey={cat}
                  name={cat}
                  fill={PALETTE[idx % PALETTE.length]}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={18}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </DashboardWidgetCard>
  );
};

export default EmployeeDistributionWidget;
