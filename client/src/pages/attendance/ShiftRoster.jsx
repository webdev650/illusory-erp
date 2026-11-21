import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { PageHeader, Card, Button, Badge } from '../../components/ui';
import {
  CalendarDays,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  History,
  X,
  Edit2,
  Trash2,
  Sparkles,
  Users,
  Sun,
  Moon,
  Coffee,
  Lock,
} from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const ShiftRoster = () => {
  const { user, role, permissions = [] } = useAuth();
  const isHRAdmin =
    role === 'super_admin' ||
    role === 'hr' ||
    permissions.includes('*') ||
    permissions.includes('attendance.manage') ||
    permissions.includes('shift.manage');
  const isManager = role === 'manager';

  // Active Tab
  const [activeTab, setActiveTab] = useState('roster'); // 'roster' | 'templates'

  // Date Navigation
  const [currentDate, setCurrentDate] = useState(new Date('2026-11-01'));
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');

  // Matrix State
  const [matrixData, setMatrixData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Shift Templates State
  const [shifts, setShifts] = useState([]);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [shiftForm, setShiftForm] = useState({
    name: '',
    startTime: '10:00',
    endTime: '18:45',
    graceMinutes: 15,
    unpaidBreakMinutes: 60,
    workingMinutes: 465,
    isDefault: false,
  });
  const [shiftFormError, setShiftFormError] = useState('');

  // Selection & Assignment State
  const [selectedSlots, setSelectedSlots] = useState([]); // [{ employeeId, date }]
  const [assignShiftId, setAssignShiftId] = useState('');
  const [assignType, setAssignType] = useState('special'); // 'special' | 'deleted'
  const [assignReason, setAssignReason] = useState('');
  const [assigning, setAssigning] = useState(false);

  // History Drawer State
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [msg, setMsg] = useState(null);

  // Load Shifts
  const loadShifts = async () => {
    try {
      const res = await api.get('/attendance/roster/shifts');
      if (res.success && res.data) {
        setShifts(res.data);
        const def = res.data.find((s) => s.isDefault);
        if (def && !assignShiftId) setAssignShiftId(def._id);
      }
    } catch (err) {
      console.error('Failed to load shifts:', err);
    }
  };

  // Load Matrix
  const loadMatrix = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const res = await api.get(`/attendance/roster/matrix?startDate=${startStr}&endDate=${endStr}`);
      if (res.success && res.data) {
        setMatrixData(res.data);
      }
    } catch (err) {
      console.error('Failed to load matrix:', err);
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to load roster matrix' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShifts();
  }, []);

  useEffect(() => {
    loadMatrix();
    setSelectedSlots([]);
  }, [currentDate]);

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Filter matrix
  const departments = useMemo(() => {
    if (!matrixData?.matrix) return [];
    const set = new Set();
    matrixData.matrix.forEach((m) => {
      if (m.employee?.department) set.add(m.employee.department);
    });
    return Array.from(set);
  }, [matrixData]);

  const filteredMatrix = useMemo(() => {
    if (!matrixData?.matrix) return [];
    return matrixData.matrix.filter((row) => {
      const matchesSearch =
        row.employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.employee.employeeCode.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = deptFilter === 'all' || row.employee.department === deptFilter;
      return matchesSearch && matchesDept;
    });
  }, [matrixData, searchQuery, deptFilter]);

  // Slot Selection
  const toggleSelectSlot = (employeeId, date) => {
    if (!isHRAdmin && !isManager) return; // View only for employee

    const key = `${employeeId}_${date}`;
    setSelectedSlots((prev) => {
      const exists = prev.some((s) => `${s.employeeId}_${s.date}` === key);
      if (exists) {
        return prev.filter((s) => `${s.employeeId}_${s.date}` !== key);
      } else {
        if (prev.length >= 200) {
          alert('Maximum 200 slots can be selected at once.');
          return prev;
        }
        return [...prev, { employeeId, date }];
      }
    });
  };

  const selectRow = (employeeId) => {
    if (!isHRAdmin && !isManager) return;
    if (!matrixData?.dates) return;

    const rowSlots = matrixData.dates.map((d) => ({ employeeId, date: d }));
    setSelectedSlots((prev) => {
      const otherSlots = prev.filter((s) => s.employeeId !== employeeId);
      const isAllSelected = rowSlots.every((rs) => prev.some((p) => p.employeeId === rs.employeeId && p.date === rs.date));
      return isAllSelected ? otherSlots : [...otherSlots, ...rowSlots];
    });
  };

  // Check if past dates or logged dates are selected
  const hasPastOrLoggedSelected = useMemo(() => {
    const todayIST = new Date().toISOString().split('T')[0];
    return selectedSlots.some((s) => s.date < todayIST);
  }, [selectedSlots]);

  // Assign Roster Action
  const handleAssignRoster = async () => {
    if (selectedSlots.length === 0) return;

    if (hasPastOrLoggedSelected && !assignReason.trim()) {
      setMsg({
        type: 'error',
        text: 'A reason is mandatory when modifying shift roster for past dates or days with logs.',
      });
      return;
    }

    setAssigning(true);
    setMsg(null);
    try {
      const assignments = selectedSlots.map((s) => ({
        employeeId: s.employeeId,
        date: s.date,
        shiftId: assignType === 'deleted' ? null : assignShiftId,
        type: assignType,
      }));

      const res = await api.post('/attendance/roster/assign', {
        assignments,
        reason: assignReason,
      });

      if (res.success) {
        setMsg({ type: 'success', text: res.message || 'Roster updated successfully' });
        setSelectedSlots([]);
        setAssignReason('');
        loadMatrix();
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to assign roster' });
    } finally {
      setAssigning(false);
    }
  };

  // Shift Template Form Submit
  const handleShiftSubmit = async (e) => {
    e.preventDefault();
    setShiftFormError('');

    const [startH, startM] = shiftForm.startTime.split(':').map(Number);
    const [endH, endM] = shiftForm.endTime.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    if (endMins <= startMins) {
      setShiftFormError(
        'Overnight shifts crossing midnight are not currently supported. Shift start time must be earlier than end time on the same day (planned future feature).'
      );
      return;
    }

    try {
      if (editingShift) {
        await api.put(`/attendance/roster/shifts/${editingShift._id}`, shiftForm);
        setMsg({ type: 'success', text: 'Shift template updated' });
      } else {
        await api.post('/attendance/roster/shifts', shiftForm);
        setMsg({ type: 'success', text: 'Shift template created' });
      }
      setShiftModalOpen(false);
      setEditingShift(null);
      loadShifts();
    } catch (err) {
      setShiftFormError(err.response?.data?.message || 'Failed to save shift');
    }
  };

  // Open History Drawer
  const openHistory = async () => {
    setHistoryLoading(true);
    setHistoryDrawerOpen(true);
    try {
      const res = await api.get('/attendance/roster/history');
      if (res.success && res.data) {
        setHistoryData(res.data);
      }
    } catch (err) {
      console.error('Failed to load roster history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Page Header */}
      <PageHeader
        title="Shift Roster"
        subtitle="Manage employee schedules, assign custom shift windows, and plan team rosters with precedence rules"
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={openHistory}
              className="border-slate-700 hover:bg-slate-800 text-slate-200"
            >
              <History className="w-4 h-4 mr-1.5 text-amber-400" />
              Roster History
            </Button>
            {isHRAdmin && (
              <Button
                variant={activeTab === 'templates' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab(activeTab === 'templates' ? 'roster' : 'templates')}
                className={activeTab === 'templates' ? 'bg-violet-600 text-white' : 'border-slate-700 text-slate-200'}
              >
                {activeTab === 'templates' ? 'View Roster Matrix' : 'Manage Shift Templates'}
              </Button>
            )}
          </div>
        }
      />

      {/* Messages */}
      {msg && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm ${
            msg.type === 'error'
              ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
              : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {msg.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeTab === 'roster' ? (
        <>
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Month Navigator */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 shadow-sm">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-4 text-xs font-semibold text-slate-200 font-mono">
                {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
              </span>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="relative w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search staff..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              {isHRAdmin && (
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  <option value="all">All Departments</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Roster Grid Matrix */}
          <Card className="overflow-hidden border-slate-800/80 bg-slate-900/50 shadow-xl">
            <div className="overflow-x-auto max-h-[650px] relative">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800">
                  <tr>
                    <th className="p-3 w-56 sticky left-0 z-30 bg-slate-950 border-r border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                      Employee
                    </th>
                    {matrixData?.dates?.map((dStr) => {
                      const dayNum = parseInt(dStr.split('-')[2], 10);
                      const dateObj = new Date(`${dStr}T00:00:00.000Z`);
                      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'narrow' });
                      const isSunday = dateObj.getUTCDay() === 0;

                      return (
                        <th
                          key={dStr}
                          className={`p-1.5 text-center min-w-[70px] border-r border-slate-800/60 ${
                            isSunday ? 'bg-slate-900/80 text-rose-400 font-semibold' : 'text-slate-400'
                          }`}
                        >
                          <div className="text-[11px] font-mono">{dayNum}</div>
                          <div className="text-[9px] uppercase tracking-tight">{dayName}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={35} className="p-12 text-center text-slate-400">
                        Loading roster matrix...
                      </td>
                    </tr>
                  ) : filteredMatrix.length === 0 ? (
                    <tr>
                      <td colSpan={35} className="p-12 text-center text-slate-400">
                        No employees found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredMatrix.map((row) => {
                      const emp = row.employee;

                      return (
                        <tr key={emp._id} className="hover:bg-slate-800/20 transition-colors">
                          {/* Sticky Employee Column */}
                          <td className="p-3 sticky left-0 z-10 bg-slate-900 border-r border-slate-800">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-slate-200">{emp.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {emp.employeeCode} &bull; {emp.department}
                                </div>
                              </div>
                              {isHRAdmin && (
                                <button
                                  type="button"
                                  onClick={() => selectRow(emp._id)}
                                  className="text-[10px] text-violet-400 hover:text-violet-300 underline"
                                >
                                  Row
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Date Cells */}
                          {matrixData.dates.map((dStr) => {
                            const dayInfo = row.days[dStr];
                            const isSelected = selectedSlots.some(
                              (s) => s.employeeId === emp._id && s.date === dStr
                            );

                            const shiftType = dayInfo?.type || 'default';
                            const isDayOff = dayInfo?.isDayOff;
                            const conflicts = dayInfo?.conflicts || {};

                            return (
                              <td
                                key={dStr}
                                onClick={() => toggleSelectSlot(emp._id, dStr)}
                                className={`p-1 text-center border-r border-slate-800/40 cursor-pointer select-none transition-all ${
                                  isSelected
                                    ? 'bg-violet-600/30 ring-1 ring-inset ring-violet-500'
                                    : 'hover:bg-slate-800/60'
                                }`}
                              >
                                <div className="flex flex-col items-center justify-center min-h-[46px] gap-0.5">
                                  {/* Shift Badge */}
                                  {isDayOff ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700/60">
                                      Off
                                    </span>
                                  ) : shiftType === 'special' ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                                      {dayInfo.shiftName?.substring(0, 7)}
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                      Gen
                                    </span>
                                  )}

                                  {/* Conflict Pill */}
                                  {conflicts.isHoliday && (
                                    <span className="text-[8px] font-bold text-purple-400 bg-purple-500/10 px-1 rounded">
                                      Holiday
                                    </span>
                                  )}
                                  {conflicts.isLeave && (
                                    <span className="text-[8px] font-bold text-indigo-400 bg-indigo-500/10 px-1 rounded">
                                      Leave
                                    </span>
                                  )}
                                  {conflicts.isRemote && (
                                    <span className="text-[8px] font-bold text-sky-400 bg-sky-500/10 px-1 rounded">
                                      WFH
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Floating Action Toolbar (When slots are selected) */}
          {selectedSlots.length > 0 && isHRAdmin && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl flex flex-wrap items-center gap-4 max-w-4xl w-[92vw]">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-violet-500 text-violet-300 bg-violet-950/40">
                  {selectedSlots.length} slot(s) selected
                </Badge>
                <button
                  onClick={() => setSelectedSlots([])}
                  className="text-xs text-slate-400 hover:text-white underline"
                >
                  Clear
                </button>
              </div>

              <div className="flex items-center gap-2 flex-1">
                <select
                  value={assignType}
                  onChange={(e) => setAssignType(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  <option value="special">Assign Shift</option>
                  <option value="deleted">Mark Scheduled Day Off</option>
                </select>

                {assignType === 'special' && (
                  <select
                    value={assignShiftId}
                    onChange={(e) => setAssignShiftId(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                  >
                    {shifts.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.startTime} - {s.endTime})
                      </option>
                    ))}
                  </select>
                )}

                <input
                  type="text"
                  placeholder={
                    hasPastOrLoggedSelected
                      ? 'Reason is mandatory for past/logged days *'
                      : 'Optional change reason...'
                  }
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  className={`flex-1 bg-slate-950 border rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 ${
                    hasPastOrLoggedSelected && !assignReason.trim()
                      ? 'border-amber-500 ring-1 ring-amber-500'
                      : 'border-slate-700 focus:ring-violet-500'
                  }`}
                />
              </div>

              <Button
                size="sm"
                onClick={handleAssignRoster}
                disabled={assigning || (hasPastOrLoggedSelected && !assignReason.trim())}
                className="bg-violet-600 hover:bg-violet-500 text-white shrink-0"
              >
                {assigning ? 'Applying...' : 'Apply to Selected'}
              </Button>
            </div>
          )}
        </>
      ) : (
        /* Shift Templates Tab */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Define operational work schedules for Illusory Design Studios. Overnight shifts crossing midnight are rejected.
            </p>
            <Button
              size="sm"
              onClick={() => {
                setEditingShift(null);
                setShiftForm({
                  name: '',
                  startTime: '10:00',
                  endTime: '18:45',
                  graceMinutes: 15,
                  unpaidBreakMinutes: 60,
                  workingMinutes: 465,
                  isDefault: false,
                });
                setShiftFormError('');
                setShiftModalOpen(true);
              }}
              className="bg-violet-600 hover:bg-violet-500 text-white"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Add Shift Template
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shifts.map((s) => (
              <Card key={s._id} className="p-5 border-slate-800 bg-slate-900/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-violet-400" />
                    <span className="font-semibold text-white text-sm">{s.name}</span>
                  </div>
                  {s.isDefault ? (
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-950/20">
                      Default Company Shift
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-slate-700 text-slate-400">
                      Custom
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px] uppercase">Hours</span>
                    <span className="font-mono text-slate-200 font-semibold">
                      {s.startTime} &rarr; {s.endTime}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px] uppercase">Grace Period</span>
                    <span className="font-mono text-slate-200 font-semibold">{s.graceMinutes} mins</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px] uppercase">Working Target</span>
                    <span className="font-mono text-slate-200 font-semibold">
                      {(s.workingMinutes / 60).toFixed(2)} hrs ({s.workingMinutes}m)
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px] uppercase">Unpaid Break</span>
                    <span className="font-mono text-slate-200 font-semibold">{s.unpaidBreakMinutes} mins</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingShift(s);
                      setShiftForm({
                        name: s.name,
                        startTime: s.startTime,
                        endTime: s.endTime,
                        graceMinutes: s.graceMinutes,
                        unpaidBreakMinutes: s.unpaidBreakMinutes,
                        workingMinutes: s.workingMinutes,
                        isDefault: s.isDefault,
                      });
                      setShiftFormError('');
                      setShiftModalOpen(true);
                    }}
                    className="border-slate-700 text-slate-300 hover:text-white h-7 text-xs"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Shift Template */}
      {shiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-white">
                {editingShift ? 'Edit Shift Template' : 'Create New Shift Template'}
              </h3>
              <button
                onClick={() => setShiftModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {shiftFormError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{shiftFormError}</span>
              </div>
            )}

            <form onSubmit={handleShiftSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Shift Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Afternoon Creative Shift"
                  value={shiftForm.name}
                  onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Start Time (24h) *</label>
                  <input
                    type="time"
                    required
                    value={shiftForm.startTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">End Time (24h) *</label>
                  <input
                    type="time"
                    required
                    value={shiftForm.endTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Grace (mins)</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={shiftForm.graceMinutes}
                    onChange={(e) => setShiftForm({ ...shiftForm, graceMinutes: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Target (mins)</label>
                  <input
                    type="number"
                    min="60"
                    max="720"
                    value={shiftForm.workingMinutes}
                    onChange={(e) => setShiftForm({ ...shiftForm, workingMinutes: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Break (mins)</label>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    value={shiftForm.unpaidBreakMinutes}
                    onChange={(e) => setShiftForm({ ...shiftForm, unpaidBreakMinutes: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shiftForm.isDefault}
                    onChange={(e) => setShiftForm({ ...shiftForm, isDefault: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-950 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-slate-300 font-medium">Set as Default Company Shift</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShiftModalOpen(false)}
                  className="border-slate-700 text-slate-300"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-violet-600 hover:bg-violet-500 text-white">
                  Save Shift
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drawer: Roster Change History */}
      {historyDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border-l border-slate-800 w-full max-w-xl h-full flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-400" />
                  Roster Change History
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Full audit timeline of shift overrides, assignments, and scheduled day-offs.
                </p>
              </div>
              <button
                onClick={() => setHistoryDrawerOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-3 text-xs">
              {historyLoading ? (
                <div className="p-8 text-center text-slate-400">Loading history...</div>
              ) : historyData.length === 0 ? (
                <div className="p-8 text-center text-slate-400">No roster changes recorded yet.</div>
              ) : (
                historyData.map((h) => (
                  <div key={h._id} className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">
                        {h.employee?.personal?.firstName} {h.employee?.personal?.lastName}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {new Date(h.appliedAt).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-300">
                      <span className="font-mono text-amber-400 font-semibold">{h.date}</span>
                      <span>&bull;</span>
                      <span>
                        {h.oldShift?.name || 'Default'} &rarr;{' '}
                        <strong className="text-emerald-400 font-semibold">
                          {h.changeType === 'remove' ? 'Scheduled Day Off' : h.newShift?.name || 'Assigned'}
                        </strong>
                      </span>
                    </div>

                    {h.reason && (
                      <div className="text-[11px] text-slate-400">
                        Reason: <span className="text-slate-300 italic">{h.reason}</span>
                      </div>
                    )}

                    <div className="text-[10px] text-slate-500">
                      Changed by: {h.changedBy?.email || 'Admin'}
                      {h.affectedPastDate && (
                        <span className="ml-2 text-amber-400 font-medium">(Past date recalculation)</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistoryDrawerOpen(false)}
                className="border-slate-700 text-slate-300"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftRoster;
