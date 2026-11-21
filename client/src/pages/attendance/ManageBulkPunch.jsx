import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { PageHeader, Card, Button, Badge } from '../../components/ui';
import {
  Users,
  Clock,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Download,
  Search,
  Filter,
  Check,
  X,
  PlayCircle,
  StopCircle,
  Coffee,
  ShieldAlert,
  ArrowRight,
  FileSpreadsheet,
  Lock,
} from 'lucide-react';

export const ManageBulkPunch = () => {
  const { user, role } = useAuth();
  const isHRAdmin = role === 'super_admin' || role === 'hr';

  // State
  const [timerStatuses, setTimerStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // all, Running, Not Running
  const [selectedEmpIds, setSelectedEmpIds] = useState([]);

  // Bulk Action Form
  const [actionType, setActionType] = useState('in'); // 'in', 'out', 'break_in', 'break_out'
  const [actionDate, setActionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [actionTime, setActionTime] = useState('10:00');
  const [actionReason, setActionReason] = useState('');

  // Conflict Preview State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [overrides, setOverrides] = useState({}); // { [empId]: boolean }
  const [overrideReason, setOverrideReason] = useState('');

  // Execution & Result State
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [resultModalOpen, setResultModalOpen] = useState(false);

  // Undo Drawer State
  const [undoDrawerOpen, setUndoDrawerOpen] = useState(false);
  const [recentBulkActions, setRecentBulkActions] = useState([]);
  const [undoLoading, setUndoLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  // Policy lock status
  const [policyLockedUpTo, setPolicyLockedUpTo] = useState(null);

  // Load timer statuses & policy
  const loadData = async () => {
    setLoading(true);
    try {
      const [timerRes, policyRes] = await Promise.all([
        api.get('/attendance/bulk/timer-statuses'),
        api.get('/attendance/policy').catch(() => null),
      ]);

      if (timerRes.success && timerRes.data) {
        setTimerStatuses(timerRes.data);
      }

      if (policyRes?.success && policyRes?.data?.attendanceLockedUpToDate) {
        setPolicyLockedUpTo(new Date(policyRes.data.attendanceLockedUpToDate).toISOString().split('T')[0]);
      }
    } catch (err) {
      console.error('Failed to load bulk data:', err);
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to load timer statuses' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter employees
  const departments = useMemo(() => {
    const set = new Set();
    timerStatuses.forEach((t) => {
      if (t.department) set.add(t.department);
    });
    return Array.from(set);
  }, [timerStatuses]);

  const filteredEmployees = useMemo(() => {
    return timerStatuses.filter((emp) => {
      const matchesSearch =
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.employeeCode.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = deptFilter === 'all' || emp.department === deptFilter;
      const matchesStatus = statusFilter === 'all' || emp.timerStatus === statusFilter;
      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [timerStatuses, searchQuery, deptFilter, statusFilter]);

  // Checkbox selection
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const ids = filteredEmployees.slice(0, 100).map((emp) => emp.employeeId);
      setSelectedEmpIds(ids);
    } else {
      setSelectedEmpIds([]);
    }
  };

  const toggleSelectEmp = (id) => {
    setSelectedEmpIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id);
      } else {
        if (prev.length >= 100) {
          alert('Maximum 100 employees permitted per bulk action.');
          return prev;
        }
        return [...prev, id];
      }
    });
  };

  // Preview Bulk Action
  const handlePreview = async (e) => {
    e.preventDefault();
    if (selectedEmpIds.length === 0) {
      setMsg({ type: 'error', text: 'Select at least one employee for the bulk action' });
      return;
    }
    if (!actionReason.trim()) {
      setMsg({ type: 'error', text: 'A reason for this bulk punch action is required' });
      return;
    }

    setPreviewLoading(true);
    setMsg(null);
    try {
      const res = await api.post('/attendance/bulk/preview', {
        employeeIds: selectedEmpIds,
        date: actionDate,
        actionType,
        time: actionTime,
      });

      if (res.success && res.data) {
        setPreviewData(res.data);
        setOverrides({});
        setPreviewOpen(true);
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to preview bulk punch' });
    } finally {
      setPreviewLoading(false);
    }
  };

  // Execute Bulk Action
  const handleExecute = async () => {
    setExecuting(true);
    setMsg(null);
    try {
      const res = await api.post('/attendance/bulk/execute', {
        employeeIds: selectedEmpIds,
        date: actionDate,
        actionType,
        time: actionTime,
        reason: actionReason,
        overrides,
        overrideReason,
      });

      if (res.success && res.data) {
        setExecutionResult(res.data);
        setPreviewOpen(false);
        setResultModalOpen(true);
        setSelectedEmpIds([]);
        setActionReason('');
        loadData(); // Refresh timer statuses
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to execute bulk punch' });
    } finally {
      setExecuting(false);
    }
  };

  // Load Recent Bulk Actions for Undo Drawer
  const openUndoDrawer = async () => {
    setUndoLoading(true);
    setUndoDrawerOpen(true);
    try {
      const res = await api.get('/attendance/bulk/recent');
      if (res.success && res.data) {
        setRecentBulkActions(res.data);
      }
    } catch (err) {
      console.error('Failed to load recent bulk actions:', err);
    } finally {
      setUndoLoading(false);
    }
  };

  // Undo a Bulk Action
  const handleUndo = async (bulkActionId) => {
    if (!window.confirm('Are you sure you want to undo this bulk action? All punch logs created by it will be permanently deleted and daily statuses will be recomputed.')) {
      return;
    }

    setUndoLoading(true);
    try {
      const res = await api.post(`/attendance/bulk/undo/${bulkActionId}`);
      if (res.success) {
        setMsg({ type: 'success', text: res.message || 'Bulk action undone successfully' });
        // Refresh recent actions
        const updated = await api.get('/attendance/bulk/recent');
        if (updated.success) setRecentBulkActions(updated.data);
        loadData();
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to undo bulk action' });
    } finally {
      setUndoLoading(false);
    }
  };

  // Download Execution Results as CSV
  const downloadResultsCSV = () => {
    if (!executionResult || !executionResult.details) return;

    const headers = ['Employee ID', 'Employee Name', 'Status', 'Reason', 'Action Type', 'Date', 'Time'];
    const rows = executionResult.details.map((d) => [
      d.employeeCode || '',
      `"${d.employeeName || ''}"`,
      d.status || '',
      `"${d.reason || ''}"`,
      executionResult.actionType || '',
      executionResult.date || '',
      actionTime,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `bulk-punch-results-${executionResult.bulkActionId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isLockedDate = policyLockedUpTo && actionDate <= policyLockedUpTo;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Manage Bulk In/Out"
        subtitle="Batch clock-in, clock-out, and break logging for teams with real-time timer tracking and 24-hour undo protection"
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={openUndoDrawer}
              className="border-slate-700 hover:bg-slate-800 text-slate-200"
            >
              <RotateCcw className="w-4 h-4 mr-1.5 text-amber-400" />
              Recent Actions (Undo)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="border-slate-700 hover:bg-slate-800 text-slate-200"
            >
              Refresh Statuses
            </Button>
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

      {/* Policy Lock Banner */}
      {isLockedDate && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center gap-3 text-sm">
          <Lock className="w-5 h-5 shrink-0" />
          <div>
            <span className="font-semibold">Attendance Period Locked:</span> Dates on or before{' '}
            <span className="font-mono underline">{policyLockedUpTo}</span> are locked by company policy. Bulk modifications are blocked.
          </div>
        </div>
      )}

      {/* Action Form Card */}
      <Card className="p-5 bg-slate-900/60 border-slate-800/80">
        <form onSubmit={handlePreview} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-300">Action:</span>
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActionType('in')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                    actionType === 'in' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <PlayCircle className="w-3.5 h-3.5" /> Clock In
                </button>
                <button
                  type="button"
                  onClick={() => setActionType('out')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                    actionType === 'out' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <StopCircle className="w-3.5 h-3.5" /> Clock Out
                </button>
                <button
                  type="button"
                  onClick={() => setActionType('break_in')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                    actionType === 'break_in' ? 'bg-cyan-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Coffee className="w-3.5 h-3.5" /> Break In
                </button>
                <button
                  type="button"
                  onClick={() => setActionType('break_out')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                    actionType === 'break_out' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" /> Break Out
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={actionDate}
                  onChange={(e) => setActionDate(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <input
                  type="time"
                  value={actionTime}
                  onChange={(e) => setActionTime(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Bulk Reason <span className="text-rose-400">*</span> (Mandatory for audit and compliance)
              </label>
              <input
                type="text"
                placeholder="e.g. Biometric reader sync failure, Studio outdoor event, Team client meeting"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div className="flex items-center gap-3 justify-end">
              <Badge variant="outline" className="border-slate-700 text-slate-300">
                Selected: {selectedEmpIds.length} / 100 max
              </Badge>
              <Button
                type="submit"
                disabled={previewLoading || selectedEmpIds.length === 0 || isLockedDate}
                className="bg-violet-600 hover:bg-violet-500 text-white"
              >
                {previewLoading ? 'Evaluating Conflicts...' : 'Preview Bulk Punch'}
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {/* Filter and Selection Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

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

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="all">All Timer Statuses</option>
            <option value="Running">Running (Clocked In)</option>
            <option value="Not Running">Not Running (Clocked Out / Not in)</option>
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>
            Showing <strong className="text-white">{filteredEmployees.length}</strong> employees
          </span>
          {selectedEmpIds.length > 0 && (
            <button
              onClick={() => setSelectedEmpIds([])}
              className="text-violet-400 hover:text-violet-300 underline ml-2"
            >
              Clear selection
            </button>
          )}
        </div>
      </div>

      {/* Real-time Timer Status Table */}
      <Card className="overflow-hidden border-slate-800/80 bg-slate-900/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px]">
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredEmployees.length > 0 &&
                      filteredEmployees.slice(0, 100).every((e) => selectedEmpIds.includes(e.employeeId))
                    }
                    onChange={handleSelectAll}
                    className="rounded border-slate-700 bg-slate-900 text-violet-600 focus:ring-violet-500 focus:ring-offset-slate-950"
                  />
                </th>
                <th className="p-3">Employee</th>
                <th className="p-3">Department</th>
                <th className="p-3 text-center">Live Timer</th>
                <th className="p-3">First In</th>
                <th className="p-3">Last Out</th>
                <th className="p-3 text-right">Worked Time</th>
                <th className="p-3 text-center">Punches Today</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Loading live employee timers...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No employees match your filters.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const isSelected = selectedEmpIds.includes(emp.employeeId);
                  const isRunning = emp.timerStatus === 'Running';

                  return (
                    <tr
                      key={emp.employeeId}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isSelected ? 'bg-violet-950/20' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectEmp(emp.employeeId)}
                          className="rounded border-slate-700 bg-slate-900 text-violet-600 focus:ring-violet-500 focus:ring-offset-slate-950"
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-slate-200">{emp.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{emp.employeeCode}</div>
                      </td>
                      <td className="p-3 text-slate-300">{emp.department}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            isRunning
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                            }`}
                          />
                          {emp.timerStatus}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-300">
                        {emp.firstIn ? new Date(emp.firstIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="p-3 font-mono text-slate-300">
                        {emp.lastOut ? new Date(emp.lastOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-200">
                        {emp.workedHours > 0 ? `${emp.workedHours}h (${emp.workedMinutes}m)` : '-'}
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                          {emp.logsCount}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Conflict Preview Drawer */}
      {previewOpen && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  Bulk Punch Pre-Execution Preview
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Target Date: <strong className="text-white">{previewData.dateStr}</strong> | Action:{' '}
                  <strong className="text-white uppercase">{previewData.actionType}</strong> | Time:{' '}
                  <strong className="text-white">{actionTime}</strong>
                </p>
              </div>
              <button
                onClick={() => setPreviewOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary badges */}
            <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="text-slate-400">
                  Total Evaluated: <strong className="text-white">{previewData.summary.total}</strong>
                </span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ready: <strong>{previewData.summary.ready}</strong>
                </span>
                <span className="text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Conflicts:{' '}
                  <strong>{previewData.summary.conflicts}</strong>
                </span>
              </div>
              {previewData.summary.conflicts > 0 && (
                <span className="text-amber-400 text-[11px]">
                  Conflicted rows will be skipped unless "Override" is checked
                </span>
              )}
            </div>

            {/* Preview Rows Table */}
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                    <th className="p-2">Employee</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Conflict Diagnosis</th>
                    <th className="p-2 text-center">Admin Override</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {previewData.previewRows.map((row) => {
                    const hasConflict = row.hasConflict;
                    const isOverridden = !!overrides[row.employeeId];

                    return (
                      <tr key={row.employeeId} className={hasConflict ? 'bg-rose-950/10' : ''}>
                        <td className="p-2">
                          <div className="font-medium text-slate-200">{row.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{row.employeeCode}</div>
                        </td>
                        <td className="p-2">
                          {hasConflict ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <AlertCircle className="w-3 h-3" /> Conflict
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" /> Ready
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-slate-300">
                          {hasConflict ? (
                            <ul className="list-disc list-inside text-rose-300 space-y-0.5">
                              {row.conflicts.map((c, i) => (
                                <li key={i}>{c}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-slate-400">No conflicts. Will record clean punch.</span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {hasConflict ? (
                            <label className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isOverridden}
                                onChange={(e) =>
                                  setOverrides((prev) => ({
                                    ...prev,
                                    [row.employeeId]: e.target.checked,
                                  }))
                                }
                                className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-950"
                              />
                              <span className="text-[11px] text-amber-400 font-medium">Override</span>
                            </label>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {Object.values(overrides).some(Boolean) && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-2 mt-4">
                  <label className="block text-xs font-medium text-amber-300">
                    Override Justification Note (Required for auditing)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Authorized by Operations Head for studio shoot delay"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewOpen(false)}
                className="border-slate-700 text-slate-300"
              >
                Back to Edit
              </Button>
              <Button
                size="sm"
                onClick={handleExecute}
                disabled={executing}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {executing ? 'Executing Batch Punch...' : 'Confirm & Execute Bulk Punch'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Execution Results & CSV Download */}
      {resultModalOpen && executionResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Bulk Punch Results
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-mono">ID: {executionResult.bulkActionId}</p>
              </div>
              <button
                onClick={() => setResultModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <div className="text-xl font-bold text-emerald-400">
                    {executionResult.summary?.succeededCount || 0}
                  </div>
                  <div className="text-[11px] text-emerald-300">Punches Logged</div>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <div className="text-xl font-bold text-amber-400">
                    {executionResult.summary?.skippedCount || 0}
                  </div>
                  <div className="text-[11px] text-amber-300">Skipped (Conflicts)</div>
                </div>
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
                  <div className="text-xl font-bold text-rose-400">
                    {executionResult.summary?.failedCount || 0}
                  </div>
                  <div className="text-[11px] text-rose-300">Failed Errors</div>
                </div>
              </div>

              {/* Detail List */}
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-800 text-xs">
                  {executionResult.details?.map((item, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-medium text-slate-200">{item.employeeName}</span>
                        <span className="text-[11px] text-slate-500 font-mono ml-2">({item.employeeCode})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-[11px]">{item.reason}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            item.status === 'succeeded'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : item.status === 'skipped'
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadResultsCSV}
                className="border-slate-700 text-slate-300 hover:text-white"
              >
                <Download className="w-4 h-4 mr-1.5" /> Download Results CSV
              </Button>
              <Button
                size="sm"
                onClick={() => setResultModalOpen(false)}
                className="bg-violet-600 hover:bg-violet-500 text-white"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer: 24-Hour Undo Actions */}
      {undoDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border-l border-slate-800 w-full max-w-xl h-full flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-400" />
                  Recent Bulk Actions (Undo Available)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Actions can be undone within 24 hours of execution before payroll locking.
                </p>
              </div>
              <button
                onClick={() => setUndoDrawerOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              {undoLoading ? (
                <div className="p-8 text-center text-slate-400">Loading recent actions...</div>
              ) : recentBulkActions.length === 0 ? (
                <div className="p-8 text-center text-slate-400">No bulk actions recorded.</div>
              ) : (
                recentBulkActions.map((action) => {
                  const isExpired = new Date() > new Date(action.expiresAt);
                  const isUndone = action.isUndone;
                  const canUndo = !isExpired && !isUndone;

                  return (
                    <div
                      key={action.bulkActionId}
                      className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono text-slate-300 font-semibold">{action.bulkActionId}</span>
                          <span className="text-[11px] text-slate-500 ml-2">
                            {new Date(action.createdAt).toLocaleString('en-IN')}
                          </span>
                        </div>
                        {isUndone ? (
                          <Badge variant="outline" className="border-slate-700 text-slate-500">
                            Undone
                          </Badge>
                        ) : isExpired ? (
                          <Badge variant="outline" className="border-slate-800 text-slate-600">
                            24h Expired
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
                            Active (Undo Available)
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-slate-300 text-[11px]">
                        <div>
                          Target Date: <strong className="text-white">{action.date}</strong>
                        </div>
                        <div>
                          Action: <strong className="text-white uppercase">{action.actionType}</strong>
                        </div>
                        <div>
                          Punches Created: <strong className="text-emerald-400">{action.logsCreated?.length || 0}</strong>
                        </div>
                        <div>
                          Employees: <strong className="text-white">{action.affectedEmployees?.length || 0}</strong>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-400">
                        Reason: <span className="text-slate-300 italic">{action.reason}</span>
                      </div>

                      {canUndo && (
                        <div className="pt-2 border-t border-slate-800/80 flex justify-end">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleUndo(action.bulkActionId)}
                            className="bg-rose-600 hover:bg-rose-500 text-white text-xs h-7"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Undo This Bulk Action
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUndoDrawerOpen(false)}
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

export default ManageBulkPunch;
