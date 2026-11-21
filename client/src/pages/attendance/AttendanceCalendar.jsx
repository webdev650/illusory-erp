import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { PageHeader, Card, Button, Badge } from '../../components/ui';
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download,
  List,
  Grid,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sun,
  Moon,
  Coffee,
  X,
  FileSpreadsheet,
  FileText,
  User,
  Users,
  Eye,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const AttendanceCalendar = () => {
  const { user, role } = useAuth();
  const isHRAdmin = role === 'super_admin' || role === 'hr';

  const [currentDate, setCurrentDate] = useState(new Date('2026-11-01'));
  const [scope, setScope] = useState('self'); // 'self' | 'all'
  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'list'
  const [colorMode, setColorMode] = useState('log'); // 'log' | 'leave'
  const [statusFilter, setStatusFilter] = useState(null); // Clickable legend filter

  const [loading, setLoading] = useState(true);
  const [calendarData, setCalendarData] = useState(null);
  const [activeDayDetail, setActiveDayDetail] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);

  // Load team/employees list for dropdown
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await api.get('/employees');
        if (res.success && res.data) {
          setAllEmployees(res.data);
          if (!selectedEmpId && res.data.length > 0) {
            setSelectedEmpId(user?.employee?._id || user?.employee || res.data[0]._id);
          }
        }
      } catch (err) {
        console.warn('Failed to load employee directory for calendar', err);
      }
    };
    fetchEmployees();
  }, [user]);

  // Fetch Calendar Data
  const fetchCalendar = async () => {
    try {
      setLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const empId = scope === 'self' ? (user?.employee?._id || user?.employee) : selectedEmpId;

      if (!empId) return;

      const res = await api.get('/attendance/calendar', {
        params: {
          year,
          month,
          employeeId: empId,
          scope,
        },
      });

      if (res.success) {
        setCalendarData(res.data);
      }
    } catch (err) {
      console.error('Error loading attendance calendar', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [currentDate, scope, selectedEmpId]);

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const jumpToToday = () => {
    setCurrentDate(new Date());
  };

  // Export to Excel / CSV
  const handleExport = async (format = 'xlsx') => {
    try {
      setExportLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const empId = scope === 'self' ? (user?.employee?._id || user?.employee) : selectedEmpId;

      const response = await api.get('/attendance/export', {
        params: { employeeId: empId, year, month, format },
        responseType: 'blob',
      });

      const blob = new Blob([response], {
        type: format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Attendance_${MONTH_NAMES[month - 1]}_${year}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  // Filtered days list
  const days = calendarData?.days || [];
  const filteredDays = useMemo(() => {
    if (!statusFilter) return days;
    return days.filter((d) => d.status === statusFilter);
  }, [days, statusFilter]);

  // Calculate calendar grid padding (starts on Sunday)
  const firstDayOfWeek = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return new Date(year, month, 1).getDay(); // 0 = Sun
  }, [currentDate]);

  // Legend status list for chips
  const LEGEND_ITEMS = [
    { key: 'LOG_OK', label: 'Log Ok', bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    { key: 'BREAK_LOG', label: 'Break Log', bg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20' },
    { key: 'LEAVE', label: 'Leave', bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
    { key: 'LOG_ERROR', label: 'Log Error', bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
    { key: 'HOLIDAY', label: 'Holiday', bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
    { key: 'WEEK_OFF', label: 'Week Off', bg: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20' },
    { key: 'NOT_PA', label: 'NOT P/A', bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
    { key: 'CHANGED_LOG', label: 'Changed Log', bg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20' },
    { key: 'REMOTE_WORK', label: 'Remote Work', bg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <PageHeader
            title="Attendance Calendar"
            subtitle="Studio biometric logs, daily work hours breakdown, shift rosters and regularization"
            breadcrumbs={[{ label: 'HRMS', path: '/hrms/dashboard' }, { label: 'Attendance', path: '/hrms/attendance' }, { label: 'Calendar' }]}
          />
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Self / All Toggle */}
          <div className="p-1 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setScope('self')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                scope === 'self'
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Self</span>
            </button>
            <button
              onClick={() => setScope('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                scope === 'all'
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{isHRAdmin ? 'All Staff' : 'My Team'}</span>
            </button>
          </div>

          {/* Employee Picker when scope === 'all' */}
          {scope === 'all' && (
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {allEmployees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  [{emp.employeeId}] {emp.personal?.firstName} {emp.personal?.lastName}
                </option>
              ))}
            </select>
          )}

          {/* View Mode Toggle: Calendar vs List */}
          <div className="p-1 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded-lg text-xs transition-all ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Calendar Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Tabular List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Export Action */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleExport('xlsx')}
              disabled={exportLoading}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel</span>
            </button>
            <button
              onClick={() => handleExport('csv')}
              disabled={exportLoading}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Month Navigator Bar & Clickable Legend Chips */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Month Arrows */}
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span>{MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
          </h2>

          <button
            onClick={nextMonth}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={jumpToToday}
            className="ml-2 px-3 py-1 rounded-lg text-xs font-medium bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-700/50"
          >
            Today
          </button>
        </div>

        {/* Legend Chips with Click-to-Filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          {statusFilter && (
            <button
              onClick={() => setStatusFilter(null)}
              className="px-2 py-1 bg-slate-800 text-white text-[11px] font-semibold rounded-lg flex items-center gap-1"
            >
              <span>Clear Filter</span>
              <X className="w-3 h-3" />
            </button>
          )}

          {LEGEND_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setStatusFilter(statusFilter === item.key ? null : item.key)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${item.bg} ${
                statusFilter === item.key ? 'ring-2 ring-brand-500 scale-105 shadow-sm' : 'opacity-80 hover:opacity-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Split View: Calendar/List Grid (Left 70%) + Analytics Panel (Right 30%) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column (8 of 12 cols): Calendar Grid or List */}
        <div className="xl:col-span-8 space-y-4">
          {loading ? (
            <div className="p-16 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400">
              <Clock className="w-8 h-8 animate-spin text-brand-600 mb-2" />
              <p className="text-xs">Computing day-status calculations from engine...</p>
            </div>
          ) : viewMode === 'calendar' ? (
            /* CALENDAR 7-COLUMN GRID */
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-center py-2.5">
                {WEEKDAYS.map((w, idx) => (
                  <span
                    key={w}
                    className={`text-xs font-bold uppercase tracking-wider ${
                      idx === 0 ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {w}
                  </span>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-700/60">
                {/* Empty padding cells for first week */}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[105px] bg-slate-50/40 dark:bg-slate-900/20" />
                ))}

                {/* Actual day cells */}
                {days.map((day) => {
                  const dayNum = parseInt(day.date.split('-')[2], 10);
                  const isFilteredOut = statusFilter && day.status !== statusFilter;
                  const inPunch = day.logs.find((l) => l.type === 'in');
                  const outPunches = day.logs.filter((l) => l.type === 'out');
                  const outPunch = outPunches.length > 0 ? outPunches[outPunches.length - 1] : null;

                  return (
                    <div
                      key={day.date}
                      onClick={() => setActiveDayDetail(day)}
                      className={`min-h-[105px] p-2 relative flex flex-col justify-between cursor-pointer transition-all hover:bg-brand-50/50 dark:hover:bg-slate-700/40 ${
                        isFilteredOut ? 'opacity-25' : ''
                      }`}
                      style={{ backgroundColor: colorMode === 'log' ? day.bg : undefined }}
                    >
                      {/* Day Number + Shift Start */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          {dayNum}
                        </span>

                        {day.lateMinutes > 0 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white">
                            Late: {day.lateMinutes}m
                          </span>
                        )}
                      </div>

                      {/* Main Status Pill */}
                      <div className="my-1">
                        <span
                          className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md truncate max-w-full"
                          style={{
                            color: day.text,
                            backgroundColor: day.bg,
                            border: `1px solid ${day.border}`,
                          }}
                        >
                          {day.label}
                        </span>
                      </div>

                      {/* In/Out Punch Timestamps */}
                      <div className="text-[10px] text-slate-500 space-y-0.5 font-mono">
                        {inPunch && (
                          <div className="flex justify-between items-center text-emerald-700 dark:text-emerald-400">
                            <span>IN:</span>
                            <span>{new Date(inPunch.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                          </div>
                        )}
                        {outPunch && (
                          <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                            <span>OUT:</span>
                            <span>{new Date(outPunch.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                          </div>
                        )}
                        {!inPunch && !outPunch && day.workedMinutes > 0 && (
                          <div className="text-[10px] text-sky-600 font-semibold">
                            {(day.workedMinutes / 60).toFixed(1)} hrs worked
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* TABULAR LIST VIEW */
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase font-bold text-[10px]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Shift</th>
                    <th className="py-3 px-4">In / Out</th>
                    <th className="py-3 px-4">Break</th>
                    <th className="py-3 px-4">Worked</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredDays.map((d) => {
                    const inPunch = d.logs.find((l) => l.type === 'in');
                    const outPunches = d.logs.filter((l) => l.type === 'out');
                    const outPunch = outPunches.length > 0 ? outPunches[outPunches.length - 1] : null;

                    return (
                      <tr key={d.date} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-100">
                          {d.date}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {d.shift?.name || 'General Shift'}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {inPunch ? new Date(inPunch.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                          {' → '}
                          {outPunch ? new Date(outPunch.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {d.breakMinutes > 0 ? `${d.breakMinutes}m` : '-'}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                          {(d.workedMinutes / 60).toFixed(2)}h
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              color: d.text,
                              backgroundColor: d.bg,
                              border: `1px solid ${d.border}`,
                            }}
                          >
                            {d.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setActiveDayDetail(d)}
                            className="p-1.5 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg"
                            title="Inspect day details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column (4 of 12 cols): Attendance Summary, Hours Breakdown, Leave & Remote */}
        <div className="xl:col-span-4 space-y-4">
          {/* Card 1: Attendance Summary */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Attendance Summary</span>
              <span className="text-brand-600 font-bold">{calendarData?.summary?.presentPercentage || 0}% Present</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Days</span>
                <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {calendarData?.summary?.totalDays || 30}
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Company Working</span>
                <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {calendarData?.summary?.totalWorkingDays || 0}
                </p>
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-100 dark:border-emerald-800/40">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Worked Days</span>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {calendarData?.summary?.workedDays || 0}
                </p>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-100 dark:border-amber-800/40">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Late Count</span>
                <p className="text-lg font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                  {calendarData?.summary?.lateCount || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Hours Breakdown */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Hours Breakdown
            </h3>

            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-700/50">
              <span className="text-slate-500">Company Working Hours:</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">
                {calendarData?.hoursBreakdown?.companyWorkingHours || 0} hrs
              </span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-700/50">
              <span className="text-slate-500">Total Worked Hours:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {calendarData?.hoursBreakdown?.totalWorkedHours || 0} hrs
              </span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-700/50">
              <span className="text-slate-500">Overtime (OT) Hours:</span>
              <span className="font-bold text-brand-600">
                {calendarData?.hoursBreakdown?.otHours || 0} hrs
              </span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-700/50">
              <span className="text-slate-500">As-Per-Policy Hours:</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">
                {calendarData?.hoursBreakdown?.asPerPolicyHours || 0} hrs
              </span>
            </div>

            <div className="flex justify-between items-center py-1.5">
              <span className="text-slate-500">Week-off Present Hours:</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {calendarData?.hoursBreakdown?.weekOffPresentHours || 0} hrs
              </span>
            </div>
          </div>

          {/* Card 3: Leave & Remote */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Leave & Remote Work
            </h3>

            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-700/50">
              <span className="text-slate-500">Paid Leave Hours:</span>
              <span className="font-bold text-indigo-600">
                {calendarData?.leaveAndRemote?.paidLeaveHours || 0} hrs
              </span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-700/50">
              <span className="text-slate-500">Unpaid Leave Hours:</span>
              <span className="font-bold text-rose-600">
                {calendarData?.leaveAndRemote?.unpaidLeaveHours || 0} hrs
              </span>
            </div>

            <div className="flex justify-between items-center py-1.5">
              <span className="text-slate-500">Remote Work Hours:</span>
              <span className="font-bold text-sky-600">
                {calendarData?.leaveAndRemote?.remoteWorkHours || 0} hrs
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Side Drawer: Day Punch Details & Regularize Action */}
      {activeDayDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 h-full shadow-2xl border-l border-slate-200 dark:border-slate-700 p-6 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-[10px] font-bold text-brand-600 uppercase tracking-wider">Day Breakdown</span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {new Date(activeDayDetail.date).toLocaleDateString('en-IN', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveDayDetail(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Badge */}
              <div className="p-4 rounded-2xl flex items-center justify-between" style={{ backgroundColor: activeDayDetail.bg }}>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Calculated Status</span>
                  <p className="text-base font-bold" style={{ color: activeDayDetail.text }}>
                    {activeDayDetail.label}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Net Worked</span>
                  <p className="text-base font-bold text-slate-800 dark:text-slate-100">
                    {(activeDayDetail.workedMinutes / 60).toFixed(2)} hrs
                  </p>
                </div>
              </div>

              {/* Shift Information */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1 text-xs">
                <span className="text-[10px] font-bold uppercase text-slate-400">Assigned Shift</span>
                <p className="font-bold text-slate-900 dark:text-white">{activeDayDetail.shift?.name || 'General Shift'}</p>
                <p className="text-slate-500 text-[11px]">
                  Timing: {activeDayDetail.shift?.startTime} to {activeDayDetail.shift?.endTime} (Grace: 15 mins)
                </p>
              </div>

              {/* Punch Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Punch Events</h4>
                {activeDayDetail.logs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">No biometric punches recorded for this day.</p>
                ) : (
                  <div className="space-y-2">
                    {activeDayDetail.logs.map((log) => (
                      <div
                        key={log._id}
                        className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              log.type === 'in' ? 'bg-emerald-500' : log.type === 'out' ? 'bg-rose-500' : 'bg-cyan-500'
                            }`}
                          />
                          <span className="font-bold uppercase text-slate-800 dark:text-slate-200">
                            {log.type.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {log.source}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          {new Date(log.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Linked Leave / Remote */}
              {activeDayDetail.linked?.leave && (
                <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 rounded-xl text-xs">
                  <span className="font-bold text-indigo-700 dark:text-indigo-300">Approved Leave:</span>
                  <p className="text-indigo-600 dark:text-indigo-400 mt-0.5">{activeDayDetail.linked.leave.type} ({activeDayDetail.linked.leave.code})</p>
                </div>
              )}

              {activeDayDetail.linked?.holiday && (
                <div className="p-3.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 rounded-xl text-xs">
                  <span className="font-bold text-purple-700 dark:text-purple-300">Holiday:</span>
                  <p className="text-purple-600 dark:text-purple-400 mt-0.5">{activeDayDetail.linked.holiday.name}</p>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center gap-3">
              <Link
                to={`/hrms/attendance/regularization?date=${activeDayDetail.date}`}
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold text-center shadow-sm"
              >
                Log Regularize
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceCalendar;
