import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { WidgetCard, Badge } from '../ui';
import { Megaphone, Calendar } from 'lucide-react';

export const AnnouncementsWidget = ({ dragHandleProps }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await api.get('/hr/announcements');
        if (res.success && res.data) {
          setAnnouncements(res.data);
        }
      } catch {
        //
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  return (
    <WidgetCard
      title="Studio Announcements"
      subtitle="Latest updates from studio leadership"
      icon={Megaphone}
      iconColor="text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300"
      dragHandleProps={dragHandleProps}
      loading={loading}
      empty={announcements.length === 0}
      emptyMessage="No announcements published currently."
    >
      <div className="space-y-2.5">
        {announcements.slice(0, 3).map((item) => (
          <div
            key={item._id}
            className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                {item.title}
              </span>
              <span className="text-[10px] text-slate-400">
                {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
              {item.content}
            </p>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
};

export default AnnouncementsWidget;

