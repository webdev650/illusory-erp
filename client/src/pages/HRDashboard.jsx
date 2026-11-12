import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { AttendanceTrendChart } from '../components/AttendanceTrendChart';
import {
  UserCheck,
  Users,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Download,
  Filter,
  Plus,
  Search,
  Check,
  X,
  Loader2,
  CalendarDays,
  BellRing,
  Edit,
  Sparkles,
} from 'lucide-react';

export const HRDashboard = () => {
  const { hasPermission, role } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  // Metrics
  const [metricsData, setMetricsData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Attendance sub-tab states
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attLoading, setAttLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attStatusFilter, setAttStatusFilter] = useState('');
  const [departments, setDepartments] = useState([]);

  // Pending Approvals sub-tab states
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [actingApprovalId, setActingApprovalId] = useState(null);
  const [approvalComment, setApprovalComment] = useState('');

  // Leave sub-tab states
  const [leaveRequests, setLeaveRequests] = useState([]);

  // Holidays sub-tab states
  const [holidays, setHolidays] = useState([]);
  const [addHolidayModal, setAddHolidayModal] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '', type: 'festival', description: '' });

  // Announcements sub-tab states
  const [announcements, setAnnouncements] = useState([]);
  const [newAnnouncementModal, setNewAnnouncementModal] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', body: '', audience: 'all', pinned: false });

  // Manual Edit Attendance Modal
  const [editAttendanceModal, setEditAttendanceModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  const [msg, setMsg] = useState(null);

  const fetchDashboardMetrics = async () => {
    try {
      setLoading(true);
      const res = await api.get('/hr/dashboard-metrics');
      if (res.success) {
        setMetricsData(res.data);
      }
    } catch (err) {
      console.warn('Metrics load error', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async () => {
    try {
      setAttLoading(true);
      const params = {};
      if (selectedDate) {
        params.startDate = selectedDate;
        params.endDate = selectedDate;
      }
      if (attStatusFilter) params.status = attStatusFilter;

      const res = await api.get('/hr/attendance/all', { params });
      if (res.success) {
        setAttendanceRecords(res.data.records);
      }
    } catch (err) {
      console.warn('Attendance load error', err);
    } finally {
      setAttLoading(false);
    }
  };

  const fetchPendingApprovals = async () => {
    try {
      const res = await api.get('/approvals/pending-for-me');
      if (res.success) {
        setPendingApprovals(res.data);
      }
    } catch (err) {
      console.warn('Approvals load error', err);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      const res = await api.get('/hr/leave/all');
      if (res.success) {
        setLeaveRequests(res.data.requests);
      }
    } catch (err) {
      console.warn('Leave requests load error', err);
    }
  };

  const fetchHolidays = async () => {
    try {
      const res = await api.get('/hr/holidays');
      if (res.success) {
        setHolidays(res.data);
      }
    } catch (err) {
      console.warn('Holidays load error', err);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const res = await api.get('/hr/announcements');
      if (res.success) {
        setAnnouncements(res.data);
      }
    } catch (err) {
      console.warn('Announcements load error', err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      if (res.success) setDepartments(res.data);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchDashboardMetrics();
    fetchAttendance();
    fetchPendingApprovals();
    fetchLeaveRequests();
    fetchHolidays();
    fetchAnnouncements();
    fetchDepartments();
  }, []);

  const handleApprovalAction = async (id, action) => {
    try {
      setActingApprovalId(id);
      const endpoint = action === 'approve' ? `/approvals/${id}/approve` : `/approvals/${id}/reject`;
      const res = await api.post(endpoint, { comment: approvalComment });
      if (res.success) {
        setMsg(`Request successfully ${action}d`);
        setTimeout(() => setMsg(null), 3000);
        setApprovalComment('');
        fetchPendingApprovals();
        fetchDashboardMetrics();
      }
    } catch (err) {
      alert(err.message || 'Action failed');
    } finally {
      setActingApprovalId(null);
    }
  };

  const handleCreateHoliday = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/hr/holidays', newHoliday);
      if (res.success) {
        setAddHolidayModal(false);
        setNewHoliday({ name: '', date: '', type: 'festival', description: '' });
        setMsg('Holiday added successfully');
        setTimeout(() => setMsg(null), 3000);
        fetchHolidays();
      }
    } catch (err) {
      alert(err.message || 'Failed to add holiday');
    }
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/hr/announcements', newAnnouncement);
      if (res.success) {
        setNewAnnouncementModal(false);
        setNewAnnouncement({ title: '', body: '', audience: 'all', pinned: false });
        setMsg('Announcement published successfully');
        setTimeout(() => setMsg(null), 3000);
        fetchAnnouncements();
      }
    } catch (err) {
      alert(err.message || 'Failed to publish announcement');
    }
  };

  const handleSaveAttendanceEdit = async (e) => {
    e.preventDefault();
    if (!editingRecord?._id) return;
    try {
      const res = await api.patch(`/hr/attendance/${editingRecord._id}/manual-edit`, {
        status: editingRecord.status,
        checkIn: editingRecord.checkIn,
        checkOut: editingRecord.checkOut,
        note: editingRecord.note,
      });
      if (res.success) {
        setEditAttendanceModal(false);
        setMsg('Attendance updated by HR override');
        setTimeout(() => setMsg(null), 3000);
        fetchAttendance();
        fetchDashboardMetrics();
      }
    } catch (err) {
      alert(err.message || 'Failed to update attendance');
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const m = metricsData?.metrics || {};

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <UserCheck className="w-6 h-6 text-brand-600" />
            HR Operations Hub
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Workforce attendance tracking, multi-tier leave approvals, studio holiday calendar, and announcements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`http://localhost:5000/api/v1/hr/attendance/all?format=csv`}
            download
            className="inline-flex items-center px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-sm"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </a>
        </div>
      </div>

      {msg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 space-x-6 text-xs font-semibold overflow-x-auto">
        {[
          { key: 'overview', label: 'Overview & 30-Day Trend' },
          { key: 'attendance', label: `Attendance Log (${attendanceRecords.length})` },
          { key: 'approvals', label: `Pending Approvals (${pendingApprovals.length})` },
          { key: 'leaves', label: `Leave Applications (${leaveRequests.length})` },
          { key: 'holidays', label: 'Holiday Calendar' },
          { key: 'announcements', label: 'Announcements' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-3 capitalize transition-all border-b-2 whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-brand-600 text-brand-600 dark:text-brand-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview & Metrics */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top 6 KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Present Today</span>
              <p className="text-2xl font-extrabold text-emerald-600 mt-1">{m.present || 0}</p>
              <span className="text-[10px] text-slate-400">On time</span>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Late Arrival</span>
              <p className="text-2xl font-extrabold text-amber-500 mt-1">{m.late || 0}</p>
              <span className="text-[10px] text-slate-400">&gt; 15m grace</span>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Half Day</span>
              <p className="text-2xl font-extrabold text-indigo-600 mt-1">{m.halfDay || 0}</p>
              <span className="text-[10px] text-slate-400">&lt; 4 hrs shift</span>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">On Leave</span>
              <p className="text-2xl font-extrabold text-purple-600 mt-1">{m.leave || 0}</p>
              <span className="text-[10px] text-slate-400">Approved leave</span>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Absent / Unlogged</span>
              <p className="text-2xl font-extrabold text-rose-500 mt-1">{m.absent || 0}</p>
              <span className="text-[10px] text-slate-400">No punch yet</span>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Approvals</span>
              <p className="text-2xl font-extrabold text-brand-600 mt-1">{m.pendingApprovals || 0}</p>
              <span className="text-[10px] text-slate-400">Action required</span>
            </div>
          </div>

          {/* 30-Day Attendance Trend Chart */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  30-Day Attendance Trend
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Visualized daily distribution across Present, Late, Leave, and Absent records.
                </p>
              </div>
            </div>

            <AttendanceTrendChart data={metricsData?.attendanceTrend || []} />
          </div>
        </div>
      )}

      {/* Tab 2: Attendance Management */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <label className="text-slate-500 font-semibold">Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-slate-500 font-semibold">Status:</label>
              <select
                value={attStatusFilter}
                onChange={(e) => setAttStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
              >
                <option value="">All Statuses</option>
                <option value="present">Present</option>
                <option value="late">Late Arrival</option>
                <option value="half_day">Half Day</option>
                <option value="leave">On Leave</option>
                <option value="absent">Absent</option>
              </select>
            </div>

            <button
              onClick={fetchAttendance}
              className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl"
            >
              Apply Filter
            </button>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            {attLoading ? (
              <div className="py-16 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
              </div>
            ) : attendanceRecords.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                No attendance logs found for this date.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase font-bold text-[10px]">
                    <th className="py-3 px-6">Employee</th>
                    <th className="py-3 px-4">Check In</th>
                    <th className="py-3 px-4">Check Out</th>
                    <th className="py-3 px-4">Hours</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Note / Location</th>
                    <th className="py-3 px-6 text-right">HR Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {attendanceRecords.map((r) => (
                    <tr key={r._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="py-3 px-6">
                        <span className="font-semibold text-slate-800 dark:text-slate-100 block">
                          {r.employee?.personal?.firstName} {r.employee?.personal?.lastName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {r.employee?.employeeId} • {r.employee?.employment?.designation}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono font-medium text-slate-600 dark:text-slate-300">
                        {r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>

                      <td className="py-3 px-4 font-mono font-medium text-slate-600 dark:text-slate-300">
                        {r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                        {r.workHours ? `${r.workHours} hrs` : '0 hrs'}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            r.status === 'present'
                              ? 'bg-emerald-100 text-emerald-700'
                              : r.status === 'late'
                              ? 'bg-amber-100 text-amber-700'
                              : r.status === 'leave'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {r.note || r.location || 'Studio (Bhubaneswar)'}
                      </td>

                      <td className="py-3 px-6 text-right">
                        <button
                          onClick={() => {
                            setEditingRecord(r);
                            setEditAttendanceModal(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                          title="Manual Edit (HR Override)"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Pending Approvals */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Pending leave applications and attendance corrections awaiting your verification:
          </p>

          {pendingApprovals.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center text-slate-400 text-xs border border-slate-200 dark:border-slate-700">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">Inbox Zero</p>
              <p>You have no pending requests waiting for approval at this time.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingApprovals.map((reqItem) => (
                <div
                  key={reqItem._id}
                  className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-brand-50 text-brand-700">
                        {reqItem.type}
                      </span>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-1">
                        {reqItem.title}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Requested by: {reqItem.requestedBy?.personal?.firstName} {reqItem.requestedBy?.personal?.lastName} ({reqItem.requestedBy?.employeeId})
                      </p>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-700">
                      Step {reqItem.currentStep} of {reqItem.steps?.length}
                    </span>
                  </div>

                  {reqItem.metadata?.reason && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl text-xs text-slate-600 dark:text-slate-300 italic">
                      "{reqItem.metadata.reason}"
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleApprovalAction(reqItem._id, 'reject')}
                      disabled={actingApprovalId === reqItem._id}
                      className="px-3.5 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprovalAction(reqItem._id, 'approve')}
                      disabled={actingApprovalId === reqItem._id}
                      className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                    >
                      Approve & Advance
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Leave Applications */}
      {activeTab === 'leaves' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase font-bold text-[10px]">
                  <th className="py-3 px-6">Employee</th>
                  <th className="py-3 px-4">Leave Type</th>
                  <th className="py-3 px-4">Dates</th>
                  <th className="py-3 px-4">Working Days</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {leaveRequests.map((l) => (
                  <tr key={l._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="py-3 px-6 font-semibold text-slate-800 dark:text-slate-100">
                      {l.employee?.personal?.firstName} {l.employee?.personal?.lastName}
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {l.employee?.employeeId}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-brand-600">
                      {l.leaveType?.name} ({l.leaveType?.code})
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {new Date(l.fromDate).toLocaleDateString()} &rarr; {new Date(l.toDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                      {l.days} {l.days === 1 ? 'day' : 'days'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 italic max-w-xs truncate">
                      {l.reason}
                    </td>
                    <td className="py-3 px-6 text-right">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          l.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : l.status === 'rejected'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {l.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Holidays */}
      {activeTab === 'holidays' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500">
              Official Odisha Studio Holidays (2026). Days are excluded from leave balance deduction.
            </p>
            <button
              onClick={() => setAddHolidayModal(true)}
              className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Holiday</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {holidays.map((h) => (
              <div
                key={h._id}
                className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white truncate">{h.name}</span>
                  <span className="font-mono text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {h.type}
                  </span>
                </div>
                <div className="flex items-center text-brand-600 font-semibold gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{new Date(h.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                </div>
                <p className="text-slate-400 text-[11px]">{h.description || 'Declared agency holiday'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 6: Announcements */}
      {activeTab === 'announcements' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500">
              Studio broadcast announcements visible to all employees on their home feed.
            </p>
            <button
              onClick={() => setNewAnnouncementModal(true)}
              className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>New Announcement</span>
            </button>
          </div>

          <div className="space-y-3">
            {announcements.map((a) => (
              <div
                key={a._id}
                className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {a.pinned && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-100 text-amber-700">
                        Pinned
                      </span>
                    )}
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{a.title}</h4>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Holiday Modal */}
      {addHolidayModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700 text-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">Add Studio Holiday</h3>
            <form onSubmit={handleCreateHoliday} className="space-y-3">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Holiday Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Utkala Dibasa"
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Date *</label>
                <input
                  type="date"
                  required
                  value={newHoliday.date}
                  onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Type</label>
                <select
                  value={newHoliday.type}
                  onChange={(e) => setNewHoliday({ ...newHoliday, type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value="festival">Festival Holiday</option>
                  <option value="national">National Holiday</option>
                  <option value="optional">Optional Holiday</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddHolidayModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-brand-600 text-white font-semibold"
                >
                  Add Holiday
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Edit Attendance Modal */}
      {editAttendanceModal && editingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700 text-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              HR Manual Attendance Override
            </h3>
            <p className="text-slate-400 mb-3">
              Modifying punch record for {editingRecord.employee?.personal?.firstName} {editingRecord.employee?.personal?.lastName}.
            </p>

            <form onSubmit={handleSaveAttendanceEdit} className="space-y-3">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Status *</label>
                <select
                  value={editingRecord.status}
                  onChange={(e) => setEditingRecord({ ...editingRecord, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value="present">Present</option>
                  <option value="late">Late Arrival</option>
                  <option value="half_day">Half Day</option>
                  <option value="leave">On Leave</option>
                  <option value="absent">Absent</option>
                  <option value="wfh">Work From Home (WFH)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">HR Note / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Corrected as per biometric log"
                  value={editingRecord.note || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, note: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditAttendanceModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-brand-600 text-white font-semibold"
                >
                  Save Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Announcement Modal */}
      {newAnnouncementModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 text-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">Publish Studio Announcement</h3>
            <form onSubmit={handleCreateAnnouncement} className="space-y-3">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Announcement Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Studio Townhall Meeting"
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Message Body *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Details for all team members..."
                  value={newAnnouncement.body}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, body: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pinCheck"
                  checked={newAnnouncement.pinned}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, pinned: e.target.checked })}
                  className="rounded text-brand-600"
                />
                <label htmlFor="pinCheck" className="text-slate-600 font-medium cursor-pointer">
                  Pin to top of studio home feed
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewAnnouncementModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-brand-600 text-white font-semibold"
                >
                  Broadcast Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
