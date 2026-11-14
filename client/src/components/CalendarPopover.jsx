import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Badge } from './ui';

export const CalendarPopover = ({ isOpen, onClose }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [holidays, setHolidays] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedDateEvents, setSelectedDateEvents] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchCalendarData = async () => {
      try {
        const [holRes, taskRes] = await Promise.all([
          api.get('/hr/holidays/upcoming').catch(() => ({ success: false })),
          api.get('/tasks/my/summary').catch(() => ({ success: false })),
        ]);
        if (holRes.success && holRes.data) setHolidays(holRes.data);
        if (taskRes.success && taskRes.data) {
          const dueList = [
            ...(taskRes.data.today || []),
            ...(taskRes.data.thisWeek || []),
            ...(taskRes.data.overdue || []),
          ];
          setTasks(dueList);
        }
      } catch {
        //
      }
    };
    fetchCalendarData();
  }, [isOpen]);

  if (!isOpen) return null;

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  return (
    <div className="relative">
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-[#151A26] shadow-soft-lg border border-slate-100 dark:border-slate-800 p-4 z-40">
        {/* Month Header */}
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <CalendarIcon className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
              {monthNames[month]} {year}
            </h4>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={prevMonth}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextMonth}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Calendar Days Grid */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400 mb-1">
          <span>Su</span>
          <span>Mo</span>
          <span>Tu</span>
          <span>We</span>
          <span>Th</span>
          <span>Fr</span>
          <span>Sa</span>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {/* Leading empty spaces */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="h-7" />
          ))}

          {/* Days */}
          {Array.from({ length: totalDays }).map((_, i) => {
            const dayNum = i + 1;
            const isToday = isCurrentMonth && today.getDate() === dayNum;

            // Check if holiday matches this day
            const hasHoliday = holidays.some((h) => {
              const d = new Date(h.date);
              return d.getFullYear() === year && d.getMonth() === month && d.getDate() === dayNum;
            });

            return (
              <div
                key={`day-${dayNum}`}
                className={`h-7 rounded-lg flex items-center justify-center font-medium relative text-xs ${
                  isToday
                    ? 'bg-brand-600 text-white font-bold shadow-sm shadow-brand-500/30'
                    : hasHoliday
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{dayNum}</span>
                {hasHoliday && !isToday && (
                  <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-emerald-500" />
                )}
              </div>
            );
          })}
        </div>

        {/* Upcoming Studio Events / Holidays */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Upcoming Holidays & Due Tasks
          </p>

          <div className="space-y-1.5 max-h-36 overflow-y-auto no-scrollbar">
            {holidays.slice(0, 3).map((h) => (
              <div
                key={h._id || h.name}
                className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50"
              >
                <div className="flex items-center space-x-2 truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                  <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                    {h.name}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 flex-shrink-0">
                  {new Date(h.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}

            {tasks.slice(0, 2).map((t) => (
              <div
                key={t._id}
                className="flex items-center justify-between text-xs p-2 rounded-xl bg-amber-50/60 dark:bg-amber-950/20"
              >
                <div className="flex items-center space-x-2 truncate">
                  <Clock className="w-3 h-3 text-amber-500 flex-shrink-0" />
                  <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                    {t.title}
                  </span>
                </div>
                <Badge variant="warning" size="sm">
                  {t.priority}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarPopover;
