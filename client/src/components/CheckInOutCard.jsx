import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Clock, LogIn, LogOut, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export const CheckInOutCard = ({ onStatusChange }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [message, setMessage] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live seconds clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchTodayAttendance = async () => {
    try {
      setLoading(true);
      const res = await api.get('/hr/attendance/today');
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      console.warn('Failed to fetch attendance status', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayAttendance();
  }, []);

  const handlePunch = async (action) => {
    try {
      setPunching(true);
      setMessage(null);
      const endpoint = action === 'in' ? '/hr/attendance/check-in' : '/hr/attendance/check-out';
      const res = await api.post(endpoint, {});
      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        await fetchTodayAttendance();
        if (onStatusChange) onStatusChange();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Action failed' });
    } finally {
      setPunching(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
      </div>
    );
  }

  const record = data?.record;
  const isCheckedIn = Boolean(record?.checkIn);
  const isCheckedOut = Boolean(record?.checkOut);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-brand-600" />
            Live Studio Punch Clock
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="text-xs text-slate-400 font-medium">IST</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Shift: {data?.shift?.startTime || '09:30'} - {data?.shift?.endTime || '18:30'} (15m grace)
          </p>
        </div>

        {/* Punch actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {!isCheckedIn ? (
            <button
              onClick={() => handlePunch('in')}
              disabled={punching}
              className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              {punching ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <LogIn className="w-4 h-4 mr-2" />
              )}
              <span>Web Check-In</span>
            </button>
          ) : !isCheckedOut ? (
            <div className="flex items-center gap-3">
              <div className="text-left hidden sm:block">
                <span className="text-[10px] text-emerald-600 font-bold block">In Progress</span>
                <span className="text-xs text-slate-500 font-mono">
                  Since {new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <button
                onClick={() => handlePunch('out')}
                disabled={punching}
                className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/20 transition-all disabled:opacity-50"
              >
                {punching ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <LogOut className="w-4 h-4 mr-2" />
                )}
                <span>Check-Out</span>
              </button>
            </div>
          ) : (
            <div className="px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center sm:text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Today's Shift</span>
              <p className="text-xs font-bold text-emerald-600 mt-0.5">
                Completed ({record.workHours} hrs logged)
              </p>
            </div>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}
    </div>
  );
};
