import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { WidgetCard, Avatar } from '../ui';
import { Cake, Award, Heart } from 'lucide-react';

export const CelebrationsWidget = ({ dragHandleProps }) => {
  const [data, setData] = useState({ birthdays: [], anniversaries: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCelebrations = async () => {
      try {
        const res = await api.get('/hr/celebrations');
        if (res.success && res.data) {
          setData(res.data);
        }
      } catch {
        //
      } finally {
        setLoading(false);
      }
    };
    fetchCelebrations();
  }, []);

  const total = (data.birthdays?.length || 0) + (data.anniversaries?.length || 0);

  return (
    <WidgetCard
      title="Celebrations This Week"
      subtitle="Birthdays & Studio Work Anniversaries"
      icon={Cake}
      iconColor="text-pink-600 bg-pink-50 dark:bg-pink-950/40 dark:text-pink-300"
      dragHandleProps={dragHandleProps}
      loading={loading}
      empty={total === 0}
      emptyMessage="No birthdays or work anniversaries this week."
    >
      <div className="space-y-2">
        {data.birthdays?.map((b) => (
          <div
            key={`bday-${b.id || b.name}`}
            className="flex items-center justify-between p-2.5 rounded-xl bg-pink-50/50 dark:bg-pink-950/20 border border-pink-100 dark:border-pink-900/40"
          >
            <div className="flex items-center space-x-2.5 truncate">
              <div className="p-1.5 rounded-lg bg-pink-100 dark:bg-pink-900/50 text-pink-600 dark:text-pink-300">
                <Cake className="w-4 h-4" />
              </div>
              <div className="truncate">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block truncate">
                  {b.name}
                </span>
                <span className="text-[10px] text-pink-600 dark:text-pink-400">Birthday • {b.date}</span>
              </div>
            </div>
            <span className="text-sm">🎂</span>
          </div>
        ))}

        {data.anniversaries?.map((a) => (
          <div
            key={`anni-${a.id || a.name}`}
            className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40"
          >
            <div className="flex items-center space-x-2.5 truncate">
              <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300">
                <Award className="w-4 h-4" />
              </div>
              <div className="truncate">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block truncate">
                  {a.name}
                </span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400">
                  {a.years} Year Anniversary • {a.date}
                </span>
              </div>
            </div>
            <span className="text-sm">🎉</span>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
};

export default CelebrationsWidget;
