import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import DashboardWidgetCard from '../../dashboard/DashboardWidgetCard';
import { ArrowUpRight } from 'lucide-react';

export const NetGrowthWidget = ({
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
      widgetKey="net_growth"
      title="Net Growth"
      subtitle="Monthly net workforce movement (Joiners - Leavers)"
      icon={ArrowUpRight}
      loading={loading}
      error={error}
      isEmpty={series.length === 0}
      emptyMessage="No movement data recorded"
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
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="netGrowthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
              <ReferenceLine y={0} stroke="#64748B" strokeDasharray="3 3" />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const row = payload[0].payload;
                    return (
                      <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs text-white">
                        <p className="font-bold text-slate-300">{row.month}</p>
                        <p className="text-emerald-400 font-semibold mt-1">
                          Joiners: +{mask(row.joiners)}
                        </p>
                        <p className="text-rose-400 font-semibold">
                          Leavers: -{mask(row.leavers)}
                        </p>
                        <p className="text-brand-300 font-bold pt-1 border-t border-slate-700 mt-1">
                          Net Movement: {mask(row.badge)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="net"
                stroke="#10B981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#netGrowthGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Quick Month Badges */}
        <div className="flex items-center justify-between overflow-x-auto no-scrollbar gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          {series.slice(-6).map((item, idx) => (
            <div
              key={idx}
              className="flex-1 min-w-[48px] py-1 px-1.5 rounded-md bg-slate-50 dark:bg-slate-900/60 text-center border border-slate-100 dark:border-slate-800"
            >
              <span className="text-[10px] text-slate-400 block">{item.month}</span>
              <span
                className={`text-[11px] font-bold block ${
                  item.net > 0 ? 'text-emerald-500' : item.net < 0 ? 'text-rose-500' : 'text-slate-500'
                }`}
              >
                {mask(item.badge)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </DashboardWidgetCard>
  );
};

export default NetGrowthWidget;
