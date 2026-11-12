import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

export const AttendanceTrendChart = ({ data = [] }) => {
  if (!data || data.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 text-xs">
        No 30-day attendance trend data recorded yet.
      </div>
    );
  }

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="colorLeave" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
          <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              borderColor: '#334155',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '11px',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
          <Area
            type="monotone"
            dataKey="present"
            name="Present"
            stroke="#10b981"
            fillOpacity={1}
            fill="url(#colorPresent)"
          />
          <Area
            type="monotone"
            dataKey="late"
            name="Late Arrival"
            stroke="#f59e0b"
            fillOpacity={1}
            fill="url(#colorLate)"
          />
          <Area
            type="monotone"
            dataKey="leave"
            name="Approved Leave"
            stroke="#8b5cf6"
            fillOpacity={1}
            fill="url(#colorLeave)"
          />
          <Area
            type="monotone"
            dataKey="absent"
            name="Absent"
            stroke="#f43f5e"
            fillOpacity={1}
            fill="url(#colorAbsent)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
