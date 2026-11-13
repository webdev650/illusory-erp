import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTimer } from '../context/TimerContext';
import { useAuth } from '../context/AuthContext';
import { Clock, Square, AlertTriangle, Play } from 'lucide-react';

export const NavbarTimer = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { isRunning, formattedElapsed, activeTimer, stopTimer, isForgotten, loading } = useTimer();
  const [stopping, setStopping] = useState(false);

  if (!hasPermission('activity.logOwn')) {
    return null;
  }

  const handleStop = async (e) => {
    e.stopPropagation();
    if (stopping) return;
    try {
      setStopping(true);
      await stopTimer();
    } catch (err) {
      alert(err.message || 'Failed to stop timer');
    } finally {
      setStopping(false);
    }
  };

  if (isRunning) {
    return (
      <div
        onClick={() => navigate('/tracker')}
        className={`cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-xs transition-all ${
          isForgotten
            ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 animate-pulse'
            : 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100/70'
        }`}
        title={`Running Timer: ${activeTimer?.description || 'Task'}${
          activeTimer?.project?.name ? ` (${activeTimer.project.name})` : ''
        }. Click to open Activity Tracker.`}
      >
        <span className="relative flex h-2 w-2">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isForgotten ? 'bg-rose-500' : 'bg-emerald-500'
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              isForgotten ? 'bg-rose-600' : 'bg-emerald-600'
            }`}
          />
        </span>

        <span className="font-mono text-xs font-bold tracking-tight">
          {formattedElapsed}
        </span>

        {activeTimer?.project?.projectCode && (
          <span className="hidden sm:inline text-[11px] font-semibold opacity-90 max-w-[100px] truncate">
            {activeTimer.project.projectCode}
          </span>
        )}

        {isForgotten && (
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" title="Running > 12 hours" />
        )}

        <button
          onClick={handleStop}
          disabled={stopping || loading}
          title="Stop & Log Time"
          className="p-1 rounded-full hover:bg-emerald-200/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 transition-colors ml-0.5"
        >
          <Square className="w-3 h-3 fill-current" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => navigate('/tracker')}
      title="Open Activity Tracker & Timer"
      className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/60 transition-colors text-xs font-medium"
    >
      <Clock className="w-3.5 h-3.5 text-slate-400" />
      <span className="hidden lg:inline">Timer</span>
    </button>
  );
};

export default NavbarTimer;

