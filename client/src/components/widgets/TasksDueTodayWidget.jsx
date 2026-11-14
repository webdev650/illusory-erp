import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import api from '../../api/axios';
import { WidgetCard, Badge } from '../ui';
import { AlertCircle, Clock, CheckCircle2, ArrowRight } from 'lucide-react';

export const TasksDueTodayWidget = ({ dragHandleProps }) => {
  const [data, setData] = useState({ today: [], overdue: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDue = async () => {
      try {
        const res = await api.get('/tasks/my/summary');
        if (res.success && res.data) {
          setData({
            today: res.data.today || [],
            overdue: res.data.overdue || [],
          });
        }
      } catch {
        //
      } finally {
        setLoading(false);
      }
    };
    fetchDue();
  }, []);

  const totalAlerts = data.overdue.length + data.today.length;

  return (
    <WidgetCard
      title="Tasks Due & Deadlines"
      subtitle={`${data.overdue.length} overdue, ${data.today.length} due today`}
      icon={AlertCircle}
      iconColor="text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300"
      dragHandleProps={dragHandleProps}
      loading={loading}
      empty={totalAlerts === 0}
      emptyMessage="All caught up! No tasks due today or overdue."
      actions={
        <NavLink
          to="/tasks"
          className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center space-x-1"
        >
          <span>Tasks</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </NavLink>
      }
    >
      <div className="space-y-2">
        {data.overdue.map((t) => (
          <NavLink
            key={t._id}
            to={`/tasks?taskId=${t._id}`}
            className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          >
            <div className="truncate pr-2">
              <span className="text-xs font-semibold text-rose-900 dark:text-rose-200 truncate block">
                {t.title}
              </span>
              <span className="text-[10px] text-rose-600 dark:text-rose-400">
                Overdue by {Math.ceil((Date.now() - new Date(t.dueDate).getTime()) / (1000 * 60 * 60 * 24))} days
              </span>
            </div>
            <Badge variant="danger" size="sm">
              Overdue
            </Badge>
          </NavLink>
        ))}

        {data.today.map((t) => (
          <NavLink
            key={t._id}
            to={`/tasks?taskId=${t._id}`}
            className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
          >
            <div className="truncate pr-2">
              <span className="text-xs font-semibold text-amber-900 dark:text-amber-200 truncate block">
                {t.title}
              </span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400">
                Due Today (by end of day)
              </span>
            </div>
            <Badge variant="warning" size="sm">
              Today
            </Badge>
          </NavLink>
        ))}
      </div>
    </WidgetCard>
  );
};

export default TasksDueTodayWidget;
