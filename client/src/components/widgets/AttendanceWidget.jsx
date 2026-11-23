import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import { Card, Button, Badge } from '../ui';
import RemoteWorkModal from '../modals/RemoteWorkModal';
import AttendanceRegularizeModal from '../modals/AttendanceRegularizeModal';
import ApplyLeaveModal from '../modals/ApplyLeaveModal';
import {
  Clock,
  LogIn,
  LogOut,
  Coffee,
  Calendar,
  Home as HomeIcon,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Plus,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileText,
} from 'lucide-react';

export const AttendanceWidget = ({ onStatusChange }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  // Modals
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [wfhModalOpen, setWfhModalOpen] = useState(false);
  const [regularizeModalOpen, setRegularizeModalOpen] = useState(false);

  // Live timer seconds
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const isToday =
    new Date(selectedDate).toDateString() === new Date().toDateString();

  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true);
      const dateParam = new Date(selectedDate).toISOString().split('T')[0];
      const res = await api.get(`/hr/attendance/today?date=${dateParam}`);
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err) {
      //
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // Recalculate on window focus
  useEffect(() => {
    const handleFocus = () => fetchAttendance();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchAttendance]);

  // Live work hours timer calculation
  useEffect(() => {
    const record = data?.record;
    if (!record || !record.checkIn || !isToday) {
      setElapsedSeconds(0);
      return;
    }

    const checkInTime = new Date(record.checkIn).getTime();

    const updateTimer = () => {
      const now = record.checkOut ? new Date(record.checkOut).getTime() : Date.now();

      // Total breaks in ms
      let breakMs = 0;
      if (record.breaks && record.breaks.length > 0) {
        record.breaks.forEach((b) => {
          const bStart = new Date(b.start).getTime();
          const bEnd = b.end ? new Date(b.end).getTime() : (record.checkOut ? now : Date.now());
          breakMs += Math.max(0, bEnd - bStart);
        });
      }

      const netMs = Math.max(0, now - checkInTime - breakMs);
      setElapsedSeconds(Math.floor(netMs / 1000));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [data, isToday]);

  // Actions
  const handlePunch = async (type) => {
    try {
      setActionLoading(true);
      setMsg(null);
      let endpoint = '';
      if (type === 'in') endpoint = '/hr/attendance/check-in';
      else if (type === 'out') endpoint = '/hr/attendance/check-out';
      else if (type === 'break-in') endpoint = '/hr/attendance/break-in';
      else if (type === 'break-out') endpoint = '/hr/attendance/break-out';

      const res = await api.post(endpoint, {});
      if (res.success) {
        setMsg({ type: 'success', text: res.message });
        await fetchAttendance();
        if (onStatusChange) onStatusChange();
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Operation failed' });
    } finally {
      setActionLoading(false);
    }
  };

  // Date Navigation
  const handlePrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
  };
  const handleNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
  };

  const record = data?.record;
  const shift = data?.shift || { startTime: '10:00', endTime: '18:45' };
  const isClockedIn = Boolean(record?.checkIn);
  const isClockedOut = Boolean(record?.checkOut);

  // Check ongoing break
  const activeBreak = record?.breaks?.find((b) => !b.end);
  const isOnBreak = Boolean(activeBreak);

  // Format elapsed seconds to HH:MM:SS
  const formatTime = (totalSec) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Build sequential timeline logs for today
  const logs = [];
  if (record?.checkIn) {
    logs.push({
      type: 'Clock In',
      time: new Date(record.checkIn),
      icon: LogIn,
      color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
    });
  }
  if (record?.breaks && record.breaks.length > 0) {
    record.breaks.forEach((b, idx) => {
      logs.push({
        type: `Break ${idx + 1} Start`,
        time: new Date(b.start),
        icon: Coffee,
        color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40',
      });
      if (b.end) {
        logs.push({
          type: `Break ${idx + 1} End`,
          time: new Date(b.end),
          icon: Coffee,
          color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40',
        });
      }
    });
  }
  if (record?.checkOut) {
    logs.push({
      type: 'Clock Out',
      time: new Date(record.checkOut),
      icon: LogOut,
      color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/40',
    });
  }
  logs.sort((a, b) => a.time - b.time);

  return (
    <>
      <Card className="flex flex-col h-full bg-white dark:bg-[#151A26] relative overflow-hidden" padding="p-5 sm:p-6">
        {/* Header with status dot and date nav */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isClockedIn && !isClockedOut
                  ? isOnBreak
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-emerald-500 animate-pulse'
                  : 'bg-slate-300 dark:bg-slate-700'
              }`}
            />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
              Attendance
            </h3>
            {isClockedIn && !isClockedOut && (
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                isOnBreak
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
              }`}>
                {isOnBreak ? 'On Break' : 'Clocked In'}
              </span>
            )}
          </div>

          {/* Date Navigation arrows */}
          <div className="flex items-center space-x-1 text-xs">
            <button
              onClick={handlePrevDay}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-slate-600 dark:text-slate-300 min-w-[70px] text-center text-[11px]">
              {isToday ? 'Today' : selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
            <button
              onClick={handleNextDay}
              disabled={isToday}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Work Timer */}
        <div className="py-4 text-center">
          <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-1">
            {isToday ? "Today's Work Hours" : 'Logged Work Hours'}
          </p>
          <div className="text-3xl sm:text-4xl font-extrabold tracking-tight font-mono text-slate-900 dark:text-white">
            {isToday ? formatTime(elapsedSeconds) : `${record?.workHours || 0} hrs`}
          </div>
          <div className="flex items-center justify-center space-x-2 mt-1.5 text-[11px] text-slate-400">
            <span>Policy: 9 hrs</span>
            <span>•</span>
            <span>Shift: {shift.startTime} - {shift.endTime}</span>
          </div>
        </div>

        {/* Feedback message banner */}
        {msg && (
          <div
            className={`mb-3 p-2.5 rounded-xl text-xs flex items-center space-x-2 ${
              msg.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
            }`}
          >
            {msg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="truncate">{msg.text}</span>
          </div>
        )}

        {/* Action Punch Buttons (Active only for Today) */}
        {isToday && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {/* Clock In / Clock Out Primary Toggle */}
            {!isClockedIn ? (
              <Button
                variant="primary"
                size="md"
                icon={LogIn}
                loading={actionLoading}
                onClick={() => handlePunch('in')}
                className="col-span-2 py-3 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20 text-white font-bold"
              >
                Clock In
              </Button>
            ) : !isClockedOut ? (
              <>
                <Button
                  variant="danger"
                  size="md"
                  icon={LogOut}
                  loading={actionLoading}
                  onClick={() => handlePunch('out')}
                  className="font-bold py-2.5"
                >
                  Clock Out
                </Button>

                {/* Break In / Break Out Secondary Toggle */}
                {!isOnBreak ? (
                  <Button
                    variant="secondary"
                    size="md"
                    icon={Coffee}
                    loading={actionLoading}
                    onClick={() => handlePunch('break-in')}
                    className="font-semibold py-2.5"
                  >
                    Break In
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="md"
                    icon={Coffee}
                    loading={actionLoading}
                    onClick={() => handlePunch('break-out')}
                    className="font-semibold py-2.5 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Break Out
                  </Button>
                )}
              </>
            ) : (
              <div className="col-span-2 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-center text-xs font-semibold text-slate-500">
                Completed shift for today ({record?.workHours || 0} hrs logged)
              </div>
            )}
          </div>
        )}

        {/* "Today's Log" list with "..." menu & "Add Log" button */}
        <div className="flex-1 space-y-2 mt-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
            <span>{isToday ? "Today's Log" : 'Punch Activity'}</span>
            <button
              onClick={() => setRegularizeModalOpen(true)}
              className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Log</span>
            </button>
          </div>

          <div className="space-y-1.5 max-h-36 overflow-y-auto no-scrollbar">
            {logs.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">No punches logged for this date.</p>
            ) : (
              logs.map((log, idx) => {
                const Icon = log.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className={`p-1.5 rounded-lg ${log.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{log.type}</span>
                    </div>

                    <div className="flex items-center space-x-1 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      <span>{log.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <button
                        onClick={() => setRegularizeModalOpen(true)}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        title="Adjust log"
                      >
                        <MoreVertical className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Bottom Action Buttons: "Apply Leave" and "Apply Remote Work" */}
        <div className="pt-4 mt-auto border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={Calendar}
            onClick={() => setLeaveModalOpen(true)}
            className="w-full text-xs font-semibold"
          >
            Apply Leave
          </Button>

          <Button
            variant="outline"
            size="sm"
            icon={HomeIcon}
            onClick={() => setWfhModalOpen(true)}
            className="w-full text-xs font-semibold"
          >
            Apply WFH
          </Button>
        </div>
      </Card>

      {/* Modals */}
      <ApplyLeaveModal
        isOpen={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
        onSuccess={fetchAttendance}
      />
      <RemoteWorkModal
        isOpen={wfhModalOpen}
        onClose={() => setWfhModalOpen(false)}
        onSuccess={fetchAttendance}
      />
      <AttendanceRegularizeModal
        isOpen={regularizeModalOpen}
        onClose={() => setRegularizeModalOpen(false)}
        targetDate={selectedDate}
        onSuccess={fetchAttendance}
      />
    </>
  );
};

export default AttendanceWidget;

