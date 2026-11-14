import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import api from '../../api/axios';
import { WidgetCard, Badge } from '../ui';
import { Clock, ArrowRight, CheckCircle2 } from 'lucide-react';

export const WeeklyHoursWidget = ({ dragHandleProps }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHours = async () => {
      try {
        const res = await api.get('/activity/timesheets/current');
        if (res.success && res.data) {
          setData(res.data);
        }
      } catch {
        //
      } finally {
        setLoading(false);
      }
    };
    fetchHours();
  }, []);

  const totalMinutes = data?.timesheet?.totalMinutes || 0;
  const billableMinutes = data?.timesheet?.billableMinutes || 0;
  const status = data?.timesheet?.status || 'draft';

  const totalHours = (totalMinutes / 60).toFixed(1);
  const billableHours = (billableMinutes / 60).toFixed(1);
  const nonBillableHours = Math.max(0, (totalMinutes - billableMinutes) / 60).toFixed(1);

  // Progress towards 40h standard week
  const weekProgressPercent = Math.min(100, Math.round((totalHours / 40) * 100));

  return (
    <WidgetCard
      title="My Weekly Hours"
      subtitle="Activity Tracker & Timesheet"
      icon={Clock}
      iconColor="text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-300"
      dragHandleProps={dragHandleProps}
      loading={loading}
      actions={
        <NavLink
          to="/tracker"
          className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center space-x-1"
        >
          <span>Timesheet</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </NavLink>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {totalHours}h
            </span>
            <span className="text-xs text-slate-400 ml-1.5">/ 40h weekly target</span>
          </div>
          <Badge
            variant={
              status === 'approved'
                ? 'success'
                : status === 'submitted'
                ? 'brand'
                : 'neutral'
            }
          >
            {status}
          </Badge>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-[11px] text-slate-500 mb-1">
            <span>Weekly Progress</span>
            <span className="font-semibold">{weekProgressPercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
            <div
              className="bg-brand-600 dark:bg-brand-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${weekProgressPercent}%` }}
            />
          </div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <p className="text-[10px] text-slate-400 uppercase font-bold">Billable</p>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {billableHours}h
            </p>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <p className="text-[10px] text-slate-400 uppercase font-bold">Internal / Non-Billable</p>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300 font-mono">
              {nonBillableHours}h
            </p>
          </div>
        </div>
      </div>
    </WidgetCard>
  );
};

export default WeeklyHoursWidget;

