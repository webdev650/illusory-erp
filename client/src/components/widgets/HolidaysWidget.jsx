import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { WidgetCard } from '../ui';
import { Calendar, Sparkles } from 'lucide-react';

export const HolidaysWidget = ({ dragHandleProps }) => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const res = await api.get('/hr/holidays/upcoming');
        if (res.success && res.data) {
          setHolidays(res.data);
        }
      } catch {
        //
      } finally {
        setLoading(false);
      }
    };
    fetchHolidays();
  }, []);

  return (
    <WidgetCard
      title="Upcoming Holidays"
      subtitle="Odisha Public & Studio Holidays"
      icon={Calendar}
      iconColor="text-teal-600 bg-teal-50 dark:bg-teal-950/40 dark:text-teal-300"
      dragHandleProps={dragHandleProps}
      loading={loading}
      empty={holidays.length === 0}
      emptyMessage="No upcoming public holidays in the near future."
    >
      <div className="space-y-2">
        {holidays.slice(0, 4).map((h) => {
          const d = new Date(h.date);
          return (
            <div
              key={h._id || h.name}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80"
            >
              <div className="flex items-center space-x-2.5 truncate">
                <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {h.name}
                </span>
              </div>
              <div className="text-right text-[11px] text-slate-400 font-medium flex-shrink-0">
                <span>{d.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' })}</span>
              </div>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
};

export default HolidaysWidget;

