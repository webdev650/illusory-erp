import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { CheckInOutCard } from '../components/CheckInOutCard';
import {
  Users,
  UserCheck,
  Clock,
  Sparkles,
  Building2,
  Calendar,
  ArrowUpRight,
  BellRing,
  User,
  Shield,
  Loader2,
  Cake,
  Award,
  Plus,
  Send,
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  Briefcase,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const Home = () => {
  const { user, role, hasPermission } = useAuth();
  const [summary, setSummary] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [celebrations, setCelebrations] = useState({ birthdays: [], anniversaries: [] });
  const [upcomingHolidays, setUpcomingHolidays] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [myTasksData, setMyTasksData] = useState({ today: [], thisWeek: [], overdue: [], all: [] });
  const [myProjects, setMyProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Apply Leave Modal
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveForm, setLeaveForm] = useState({
    leaveTypeId: '',
    fromDate: '',
    toDate: '',
    isHalfDay: false,
    reason: '',
  });
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveMsg, setLeaveMsg] = useState(null);

  const isAdminOrHr = ['super_admin', 'admin', 'hr'].includes(role) || hasPermission('dashboard.read');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [annRes, celRes, holRes] = await Promise.all([
        api.get('/hr/announcements'),
        api.get('/hr/celebrations'),
        api.get('/hr/holidays/upcoming'),
      ]);

      if (annRes.success) setAnnouncements(annRes.data);
      if (celRes.success) setCelebrations(celRes.data);
      if (holRes.success) setUpcomingHolidays(holRes.data);

      if (isAdminOrHr) {
        const sumRes = await api.get('/dashboard/summary');
        if (sumRes.success) setSummary(sumRes.data);
      }

      // Fetch employee specific data
      if (user?.employee) {
        const [balRes, typesRes, tasksRes, projsRes] = await Promise.all([
          api.get('/hr/leave/balances'),
          api.get('/hr/leave/types'),
          api.get('/tasks/my'),
          api.get('/projects/my'),
        ]);
        if (balRes.success) setLeaveBalances(balRes.data);
        if (typesRes.success) {
          setLeaveTypes(typesRes.data);
          if (typesRes.data[0]) setLeaveForm((f) => ({ ...f, leaveTypeId: typesRes.data[0]._id }));
        }
        if (tasksRes.success) setMyTasksData(tasksRes.data);
        if (projsRes.success) setMyProjects(projsRes.data.projects || []);
      }
    } catch (err) {
      console.warn('Dashboard fetch error', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isAdminOrHr, user]);

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    setLeaveLoading(true);
    setLeaveMsg(null);
    try {
      const res = await api.post('/hr/leave/apply', leaveForm);
      if (res.success) {
        setLeaveMsg({ type: 'success', text: 'Leave application submitted for approval!' });
        setTimeout(() => {
          setLeaveModalOpen(false);
          setLeaveMsg(null);
        }, 2000);
        fetchData();
      }
    } catch (err) {
      setLeaveMsg({ type: 'error', text: err.message || 'Failed to submit leave' });
    } finally {
      setLeaveLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const emp = user?.employee;
  const metrics = summary?.metrics || {};

  return (
    <div className="space-y-6">
      {/* 1. Live Punch Clock Widget */}
      <CheckInOutCard onStatusChange={fetchData} />

      {/* 2. Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-900 via-indigo-900 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Illusory Design Studios • Studio Workspace
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Welcome back, {emp?.personal?.firstName || user?.email?.split('@')[0]}!
          </h1>
          <p className="mt-1 text-xs text-slate-300">
            {emp?.employment?.designation || 'Specialist'} • {emp?.employment?.department?.name || 'Agency Division'} • {emp?.employment?.workMode || 'Hybrid'} Mode
          </p>
        </div>
      </div>

      {/* 3. Leave Balances Cards & Quick Actions (For Employees) */}
      {leaveBalances.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              My Leave Quota & Balances ({new Date().getFullYear()})
            </h3>
            <button
              onClick={() => setLeaveModalOpen(true)}
              className="inline-flex items-center px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Apply for Leave
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {leaveBalances.map((b) => {
              const available = b.allocated + b.carried - b.used - b.pending;
              return (
                <div
                  key={b._id}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 text-xs"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate block">
                    {b.leaveType?.name}
                  </span>
                  <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                    {available} <span className="text-xs font-normal text-slate-400">days left</span>
                  </p>
                  <div className="mt-2 text-[10px] text-slate-400 flex justify-between">
                    <span>Used: {b.used}</span>
                    {b.pending > 0 && <span className="text-amber-600 font-semibold">Pending: {b.pending}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3.5. My Projects & My Tasks Widgets (Day 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Open Tasks Widget */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-brand-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                My Open Tasks & Deadlines
              </h3>
            </div>
            <Link to="/tasks" className="text-xs font-semibold text-brand-600 hover:underline">
              View All Tasks &rarr;
            </Link>
          </div>

          {/* Quick Sub-Stats */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Today</span>
              <span className="font-bold text-slate-900 dark:text-white text-base">
                {myTasksData.today?.length || 0}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 text-amber-800 dark:text-amber-300">
              <span className="block text-[10px] uppercase font-semibold">This Week</span>
              <span className="font-bold text-base">{myTasksData.thisWeek?.length || 0}</span>
            </div>
            <div className="p-2 rounded-xl bg-red-50/60 dark:bg-red-950/20 border border-red-200/50 text-red-700 dark:text-red-400">
              <span className="block text-[10px] uppercase font-semibold">Overdue</span>
              <span className="font-bold text-base">{myTasksData.overdue?.length || 0}</span>
            </div>
          </div>

          <div className="space-y-2">
            {(myTasksData.all || []).filter((t) => t.status !== 'done').length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No pending tasks assigned to you.</p>
            ) : (
              (myTasksData.all || [])
                .filter((t) => t.status !== 'done')
                .slice(0, 4)
                .map((t) => (
                  <Link
                    key={t._id}
                    to={t.project?._id ? `/projects/${t.project._id}` : '/tasks'}
                    className="block p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-700/40 border border-slate-100 dark:border-slate-700/60 transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[11px] font-bold text-brand-600">
                        {t.taskCode}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-brand-600 truncate">
                      {t.title}
                    </h4>
                    {t.dueDate && (
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        Due: {new Date(t.dueDate).toLocaleDateString('en-IN')}
                      </span>
                    )}
                  </Link>
                ))
            )}
          </div>
        </div>

        {/* My Active Projects Widget */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-brand-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                My Active Projects
              </h3>
            </div>
            <Link to="/projects" className="text-xs font-semibold text-brand-600 hover:underline">
              View All Projects &rarr;
            </Link>
          </div>

          <div className="space-y-3">
            {myProjects.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No projects assigned to your portfolio.</p>
            ) : (
              myProjects.slice(0, 3).map((p) => (
                <Link
                  key={p._id}
                  to={`/projects/${p._id}`}
                  className="block p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-700/40 border border-slate-100 dark:border-slate-700/60 transition-colors group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[11px] font-bold text-brand-600">
                      {p.projectCode}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {p.status}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-brand-600 truncate">
                    {p.name}
                  </h4>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Client: {p.client?.name || 'Internal'}</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{p.progressPercent || 0}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1.5">
                    <div
                      className="bg-brand-600 h-full rounded-full transition-all"
                      style={{ width: `${p.progressPercent || 0}%` }}
                    />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 4. Admin Metrics Grid (if Admin/HR) */}
      {isAdminOrHr && summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Headcount</span>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">{metrics.totalEmployees}</p>
            <span className="text-xs text-emerald-600 font-medium">{metrics.activeEmployees} active</span>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Departments</span>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">{metrics.totalDepartments}</p>
            <span className="text-xs text-indigo-600 font-medium">Core disciplines</span>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">On Probation</span>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">{metrics.probationEmployees}</p>
            <span className="text-xs text-amber-600 font-medium">Pending confirmation</span>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">New Joiners (Month)</span>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">{metrics.newJoinersThisMonth}</p>
            <span className="text-xs text-emerald-600 font-medium">Recent onboardings</span>
          </div>
        </div>
      )}

      {/* 5. Announcements, Holidays & Celebrations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Studio Announcements Feed */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BellRing className="w-4 h-4 text-amber-500" />
              Studio Announcements
            </h3>
            {hasPermission('announcement.create') && (
              <Link to="/hr?tab=announcements" className="text-xs font-semibold text-brand-600 hover:underline">
                Manage
              </Link>
            )}
          </div>

          <div className="space-y-3">
            {announcements.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No active studio announcements.</p>
            ) : (
              announcements.slice(0, 3).map((a) => (
                <div key={a._id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      {a.pinned && <span className="w-2 h-2 rounded-full bg-amber-500"></span>}
                      {a.title}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed pt-0.5">{a.body}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Celebrations & Holidays Sidebar */}
        <div className="space-y-6">
          {/* Celebrations this week */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 text-xs space-y-3">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Cake className="w-4 h-4 text-rose-500" />
              Studio Celebrations This Week
            </h3>

            {celebrations.birthdays.length === 0 && celebrations.anniversaries.length === 0 ? (
              <p className="text-slate-400 py-2">No team birthdays or work milestones this week.</p>
            ) : (
              <div className="space-y-2">
                {celebrations.birthdays.map((b, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-900/10 text-rose-800 dark:text-rose-300">
                    <div>
                      <span className="font-semibold block">{b.name}</span>
                      <span className="text-[10px] text-slate-400">Birthday on {b.date}</span>
                    </div>
                    {b.isToday && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-200 text-rose-800">Today!</span>}
                  </div>
                ))}

                {celebrations.anniversaries.map((an, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-purple-50/50 dark:bg-purple-900/10 text-purple-800 dark:text-purple-300">
                    <div>
                      <span className="font-semibold block">{an.name}</span>
                      <span className="text-[10px] text-slate-400">{an.yearsCompleted} Year Work Anniversary ({an.date})</span>
                    </div>
                    {an.isToday && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-200 text-purple-800">Today!</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Holidays */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 text-xs space-y-3">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-600" />
              Upcoming Studio Holidays
            </h3>

            <div className="space-y-2">
              {upcomingHolidays.map((h) => (
                <div key={h._id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block">{h.name}</span>
                    <span className="text-[10px] text-slate-400">{new Date(h.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                  </div>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {h.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- Apply Leave Modal --- */}
      {leaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 text-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Apply for Leave</h3>
            <p className="text-slate-400 mb-4">
              Weekends and official Odisha studio holidays are excluded from day deductions.
            </p>

            {leaveMsg && (
              <div className={`mb-3 p-3 rounded-xl flex items-center gap-2 ${leaveMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {leaveMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{leaveMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleApplyLeave} className="space-y-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Leave Category *</label>
                <select
                  value={leaveForm.leaveTypeId}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leaveTypeId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  {leaveTypes.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name} ({t.code}) — {t.paid ? 'Paid' : 'Unpaid'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">From Date *</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.fromDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, fromDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">To Date *</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.toDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, toDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="halfDayCheck"
                  checked={leaveForm.isHalfDay}
                  onChange={(e) => setLeaveForm({ ...leaveForm, isHalfDay: e.target.checked })}
                  className="rounded text-brand-600"
                />
                <label htmlFor="halfDayCheck" className="text-slate-600 font-medium cursor-pointer">
                  Half Day (0.5 working day)
                </label>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Reason for Absence *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide context for manager & HR review..."
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLeaveModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={leaveLoading}
                  className="px-4 py-1.5 rounded-xl bg-brand-600 text-white font-semibold disabled:opacity-50"
                >
                  {leaveLoading ? 'Submitting...' : 'Submit Leave Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
