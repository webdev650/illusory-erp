import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { PageHeader, Card, Button, Badge } from '../../components/ui';
import {
  Clock,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  FileSpreadsheet,
  Download,
  List,
  Grid,
  CheckCircle2,
  AlertCircle,
  X,
  User,
  Users,
  Search,
} from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const ManageLogs = () => {
  const { user, role } = useAuth();
  const isHRAdmin = role === 'super_admin' || role === 'hr';

  const [currentDate, setCurrentDate] = useState(new Date('2026-11-01'));
  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  const [loading, setLoading] = useState(true);
  const [logsData, setLogsData] = useState(null);
  const [activeDayEdit, setActiveDayEdit] = useState(null);

  // Form states inside Manage Punch Drawer
  const [punchType, setPunchType] = useState('in');
  const [punchTime, setPunchTime] = useState('10:00');
  const [punchReason, setPunchReason] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [editingPunchId, setEditingPunchId] = useState(null);
  const [msg, setMsg] = useState(null);

  // Fetch employees
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await api.get('/employees');
        if (res.success && res.data) {
          setAllEmployees(res.data);
          if (!selectedEmpId && res.data.length > 0) {
            setSelectedEmpId(res.data[0]._id);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch employees', err);
      }
    };
    fetchEmployees();
  }, []);

  // Fetch Manage Logs Data
  const fetchLogs = async () => {
    if (!selectedEmpId) return;
    try {
      setLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;

      const res = await api.get('/attendance/manage-logs', {
        params: {
          employeeId: selectedEmpId,
          year,
          month,
        },
      });

      if (res.success) {
        setLogsData(res.data);
      }
    } catch (err) {
      console.error('Error fetching logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedEmpId, currentDate]);

  const handleAddOrUpdatePunch = async (e) => {
    e.preventDefault();
    if (!punchReason.trim()) {
      alert('A valid reason is required for manual attendance modifications.');
      return;
    }

    try {
      setFormSubmitting(true);
      if (editingPunchId) {
        // Update punch
        const res = await api.put(`/attendance/logs/${editingPunchId}`, {
          time: new Date(`${activeDayEdit.date}T${punchTime}:00+05:30`),
          note: punchReason,
        });
        if (res.success) {
          setMsg('Punch updated successfully. Day flagged as Changed Log.');
          setEditingPunchId(null);
          setPunchReason('');
          fetchLogs();
          // update local activeDayEdit
          setActiveDayEdit(res.data.dayStatus);
        }
      } else {
        // Add punch
        const res = await api.post('/attendance/logs', {
          employeeId: selectedEmpId,
          date: activeDayEdit.date,
          type: punchType,
          time: punchTime,
          note: punchReason,
        });
        if (res.success) {
          setMsg('Punch added successfully. Day flagged as Changed Log.');
          setPunchReason('');
          fetchLogs();
          setActiveDayEdit(res.data.dayStatus);
        }
      }
      setTimeout(() => setMsg(null), 3500);
    } catch (err) {
      alert(err.message || 'Action failed');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeletePunch = async (logId) => {
    const reason = window.prompt('Please enter the justification for deleting this punch:');
    if (!reason || !reason.trim()) return;

    try {
      const res = await api.delete(`/attendance/logs/${logId}`, {
        data: { reason },
      });
      if (res.success) {
        setMsg('Punch removed. Day status recalculated.');
        fetchLogs();
        setActiveDayEdit(res.data.dayStatus);
        setTimeout(() => setMsg(null), 3000);
      }
    } catch (err) {
      alert(err.message || 'Delete failed');
    }
  };

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const days = logsData?.days || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Attendance Logs"
        subtitle="Review, audit, add missing biometric entries, and correct punch anomalies for staff"
        breadcrumbs={[{ label: 'HRMS', path: '/hrms/dashboard' }, { label: 'Attendance', path: '/hrms/attendance' }, { label: 'Manage Logs' }]}
      />

      {msg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {/* Control Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Left: Employee Selector & Month */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Employee Picker */}
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" />
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {allEmployees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  [{emp.employeeId}] {emp.personal?.firstName} {emp.personal?.lastName} ({emp.employment?.department?.name || 'Staff'})
                </option>
              ))}
            </select>
          </div>

          {/* Month Picker */}
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-900 dark:text-white min-w-[120px] text-center">
              {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: View Toggles & Summary Metrics */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs bg-slate-50 dark:bg-slate-900 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-slate-400">Total Days:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{logsData?.summary?.totalDays || 30}</span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-slate-400">Working:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{logsData?.summary?.totalWorkingDays || 0}</span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-slate-400">Worked:</span>
            <span className="font-bold text-emerald-600">{logsData?.summary?.workedDays || 0}</span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-slate-400">Rate:</span>
            <span className="font-bold text-brand-600">{logsData?.summary?.presentPercentage || 0}%</span>
          </div>

          {/* Grid / Table Toggle */}
          <div className="p-1 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-sm'
                  : 'text-slate-500'
              }`}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs transition-all ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-sm'
                  : 'text-slate-500'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Logs Display */}
      {loading ? (
        <div className="p-16 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400">
          <Clock className="w-8 h-8 animate-spin text-brand-600 mb-2" />
          <p className="text-xs">Loading employee attendance logs...</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {days.map((day) => {
            const dayNum = parseInt(day.date.split('-')[2], 10);
            const inPunch = day.logs.find((l) => l.type === 'in');
            const outPunches = day.logs.filter((l) => l.type === 'out');
            const outPunch = outPunches.length > 0 ? outPunches[outPunches.length - 1] : null;

            return (
              <div
                key={day.date}
                onClick={() => {
                  setActiveDayEdit(day);
                  setEditingPunchId(null);
                  setPunchReason('');
                }}
                className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-brand-500 cursor-pointer transition-all flex flex-col justify-between min-h-[110px]"
                style={{ backgroundColor: day.bg }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{dayNum}</span>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{ color: day.text, border: `1px solid ${day.border}` }}
                  >
                    {day.label}
                  </span>
                </div>

                <div className="text-[10px] space-y-0.5 font-mono text-slate-600 dark:text-slate-400 my-1">
                  <div>IN: {inPunch ? new Date(inPunch.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</div>
                  <div>OUT: {outPunch ? new Date(outPunch.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</div>
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700/50">
                  <span>{(day.workedMinutes / 60).toFixed(1)} hrs</span>
                  <span className="text-brand-600 font-semibold">Manage &rarr;</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase font-bold text-[10px]">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Calculated Status</th>
                <th className="py-3 px-4">Clock In</th>
                <th className="py-3 px-4">Clock Out</th>
                <th className="py-3 px-4">Breaks</th>
                <th className="py-3 px-4">Worked Time</th>
                <th className="py-3 px-4">Punches Count</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {days.map((day) => {
                const inPunch = day.logs.find((l) => l.type === 'in');
                const outPunches = day.logs.filter((l) => l.type === 'out');
                const outPunch = outPunches.length > 0 ? outPunches[outPunches.length - 1] : null;

                return (
                  <tr key={day.date} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-100">
                      {day.date}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ color: day.text, backgroundColor: day.bg, border: `1px solid ${day.border}` }}
                      >
                        {day.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-600">
                      {inPunch ? new Date(inPunch.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                      {outPunch ? new Date(outPunch.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {day.breakMinutes > 0 ? `${day.breakMinutes}m` : '-'}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-100">
                      {(day.workedMinutes / 60).toFixed(2)}h
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-semibold">
                      {day.logs.length} punch{day.logs.length === 1 ? '' : 'es'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setActiveDayEdit(day);
                          setEditingPunchId(null);
                          setPunchReason('');
                        }}
                        className="px-3 py-1 bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-lg font-semibold text-xs transition-colors"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-out Drawer: Manage Day Punches */}
      {activeDayEdit && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 h-full shadow-2xl border-l border-slate-200 dark:border-slate-700 p-6 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-[10px] font-bold text-brand-600 uppercase tracking-wider">Punch Management</span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Logs for {activeDayEdit.date}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveDayEdit(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Day Status Pill */}
              <div className="p-3.5 rounded-2xl flex items-center justify-between" style={{ backgroundColor: activeDayEdit.bg }}>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Day Engine Status</span>
                  <p className="text-sm font-bold" style={{ color: activeDayEdit.text }}>{activeDayEdit.label}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Total Worked</span>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{(activeDayEdit.workedMinutes / 60).toFixed(2)} hrs</p>
                </div>
              </div>

              {/* Existing Punches List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Recorded Punches</h4>
                {activeDayEdit.logs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">No punches recorded for this day yet.</p>
                ) : (
                  <div className="space-y-2">
                    {activeDayEdit.logs.map((log) => (
                      <div
                        key={log._id}
                        className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                log.type === 'in' ? 'bg-emerald-500' : log.type === 'out' ? 'bg-rose-500' : 'bg-cyan-500'
                              }`}
                            />
                            <span className="font-bold uppercase text-slate-900 dark:text-white">
                              {log.type.replace('_', ' ')}
                            </span>
                            <span className="font-mono text-slate-600 dark:text-slate-300 font-semibold">
                              {new Date(log.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                              {log.source}
                            </span>
                          </div>
                          {log.note && <p className="text-[11px] text-slate-400 mt-1 italic">{log.note}</p>}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingPunchId(log._id);
                              const dt = new Date(log.time);
                              const h = String(dt.getHours()).padStart(2, '0');
                              const m = String(dt.getMinutes()).padStart(2, '0');
                              setPunchTime(`${h}:${m}`);
                              setPunchReason(log.note || '');
                            }}
                            className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                            title="Edit punch time"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePunch(log._id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                            title="Soft delete punch"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add / Edit Punch Form */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>{editingPunchId ? 'Edit Punch Timestamp' : 'Add Missing Punch Entry'}</span>
                  {editingPunchId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPunchId(null);
                        setPunchReason('');
                      }}
                      className="text-[11px] text-slate-400 hover:underline"
                    >
                      Cancel Edit
                    </button>
                  )}
                </h4>

                <form onSubmit={handleAddOrUpdatePunch} className="space-y-3 text-xs">
                  {!editingPunchId && (
                    <div>
                      <label className="block text-slate-500 mb-1 font-semibold">Punch Event Type</label>
                      <select
                        value={punchType}
                        onChange={(e) => setPunchType(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                      >
                        <option value="in">Clock In</option>
                        <option value="out">Clock Out</option>
                        <option value="break_in">Break In (Start Break)</option>
                        <option value="break_out">Break Out (Resume Work)</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-500 mb-1 font-semibold">Punch Time (HH:mm)</label>
                    <input
                      type="time"
                      value={punchTime}
                      onChange={(e) => setPunchTime(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 mb-1 font-semibold">
                      Reason / Justification <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={punchReason}
                      onChange={(e) => setPunchReason(e.target.value)}
                      placeholder="e.g. Biometric reader missed punch / On client visit"
                      required
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="w-full py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl text-xs disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {formSubmitting ? 'Saving...' : editingPunchId ? 'Update Punch' : 'Record Manual Punch'}
                  </button>
                </form>
              </div>
            </div>

            {/* Bottom Close */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setActiveDayEdit(null)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold text-center transition-colors"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageLogs;
