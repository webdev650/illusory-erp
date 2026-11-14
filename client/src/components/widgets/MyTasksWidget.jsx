import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import api from '../../api/axios';
import { WidgetCard, Badge } from '../ui';
import { CheckSquare, ArrowRight, Clock } from 'lucide-react';

const PRIORITY_BADGE = {
  urgent: 'danger',
  high: 'warning',
  medium: 'brand',
  low: 'neutral',
};

export const MyTasksWidget = ({ dragHandleProps }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await api.get('/tasks?status=in_progress,todo&limit=5');
        if (res.success && res.data?.tasks) {
          setTasks(res.data.tasks);
        }
      } catch {
        //
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  return (
    <WidgetCard
      title="My Open Tasks"
      subtitle={`${tasks.length} active assignments`}
      icon={CheckSquare}
      iconColor="text-purple-600 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-300"
      dragHandleProps={dragHandleProps}
      loading={loading}
      empty={tasks.length === 0}
      emptyMessage="No open tasks assigned to you right now."
      actions={
        <NavLink
          to="/tasks"
          className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center space-x-1"
        >
          <span>View Kanban</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </NavLink>
      }
    >
      <div className="space-y-2">
        {tasks.map((task) => (
          <NavLink
            key={task._id}
            to={`/tasks?taskId=${task._id}`}
            className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="space-y-0.5 truncate pr-3">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  {task.taskCode}
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {task.title}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                {task.project?.name || 'Internal Task'}
              </p>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
              <Badge variant={PRIORITY_BADGE[task.priority] || 'neutral'} size="sm">
                {task.priority}
              </Badge>
              {task.dueDate && (
                <span className="text-[10px] text-slate-400 flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                </span>
              )}
            </div>
          </NavLink>
        ))}
      </div>
    </WidgetCard>
  );
};

export default MyTasksWidget;

