import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useTimer } from '../context/TimerContext';
import { PageHeader, Button } from '../components/ui';
import {
  Clock,
  Play,
  Square,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Download,
  Users,
  Briefcase,
  PieChart as PieChartIcon,
  BarChart3,
  CheckSquare,
  Tag,
  DollarSign,
  Copy,
  Info,
  Loader2,
  X,
  FileText,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#64748b'];

// Helper to get Kolkata Monday of a date
const getKolkataMonday = (d = new Date()) => {
  const date = new Date(d);
  // Get day in IST (0 = Sun, 1 = Mon ... 6 = Sat)
  const istStr = date.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' });
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[istStr] !== undefined ? dayMap[istStr] : date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Adjust to Monday
  date.setDate(date.getDate() + diff);
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

// Format minutes to "Xh Ym"
const formatMinutes = (totalMinutes = 0) => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0 && m === 0) return '0m';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

// Format paise to INR
const formatINR = (paise = 0) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
};

export const ActivityTracker = () => {
  const { user, hasPermission } = useAuth();
  const {
    activeTimer,
    isRunning,
    formattedElapsed,
    startTimer,
    stopTimer,
    discardTimer,
    isForgotten,
  } = useTimer();

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'my_time';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Synchronize tab with search params
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // ==========================================
  // SHARED DATA: Active Projects & Tasks
  // ==========================================
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [projRes, taskRes] = await Promise.all([
          api.get('/projects?limit=100&status=active'),
          api.get('/tasks?limit=200'),
        ]);
        if (projRes.success) setProjects(projRes.data.projects || []);
        if (taskRes.success) setTasks(taskRes.data.tasks || []);
      } catch (err) {
        console.warn('Failed to load projects/tasks', err);
      }
    };
    fetchMetadata();
  }, []);

  // Filter tasks based on selected project
  const getTasksForProject = (projectId) => {
    if (!projectId) return tasks;
    return tasks.filter((t) => (t.project?._id || t.project) === projectId);
  };

  // ==========================================
  // TAB 1: MY TIME (Weekly grid & timer)
  // ==========================================
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getKolkataMonday(new Date()));
  const [weekData, setWeekData] = useState(null);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [submitWarning, setSubmitWarning] = useState(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submittingTimesheet, setSubmittingTimesheet] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [showReopenModal, setShowReopenModal] = useState(false);

  // Time Entry Modal State
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [entryForm, setEntryForm] = useState({
    date: '',
    project: '',
    task: '',
    category: 'project_work',
    description: '',
    hours: 1,
    minutes: 0,
    isBillable: true,
  });

  // Fetch week timesheet & entries
  const fetchWeekData = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingWeek(true);
      const res = await api.get(`/activity/timesheets/${currentWeekStart}`);
      if (res.success) {
        setWeekData(res.data);
      }
    } catch (err) {
      console.error('Failed to load week data', err);
    } finally {
      setLoadingWeek(false);
    }
  }, [currentWeekStart, user]);

  useEffect(() => {
    fetchWeekData();
  }, [fetchWeekData]);

  // Navigate Weeks
  const handlePrevWeek = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() - 7);
    setCurrentWeekStart(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  };

  const handleNextWeek = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + 7);
    setCurrentWeekStart(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  };

  const handleCurrentWeek = () => {
    setCurrentWeekStart(getKolkataMonday(new Date()));
  };

  // Open Entry Modal
  const handleOpenAddEntry = (dateString = '') => {
    setEditingEntry(null);
    setEntryForm({
      date: dateString || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
      project: '',
      task: '',
      category: 'project_work',
      description: '',
      hours: 1,
      minutes: 0,
      isBillable: true,
    });
    setEntryModalOpen(true);
  };

  const handleOpenEditEntry = (entry) => {
    setEditingEntry(entry);
    const dateFormatted = new Date(entry.date).toLocaleDateString('en-CA', {
      timeZone: 'Asia/Kolkata',
    });
    setEntryForm({
      date: dateFormatted,
      project: entry.project?._id || entry.project || '',
      task: entry.task?._id || entry.task || '',
      category: entry.category || 'project_work',
      description: entry.description || '',
      hours: Math.floor((entry.durationMinutes || 0) / 60),
      minutes: (entry.durationMinutes || 0) % 60,
      isBillable: entry.isBillable !== false,
    });
    setEntryModalOpen(true);
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    const durationMinutes = Number(entryForm.hours) * 60 + Number(entryForm.minutes);
    if (durationMinutes < 5) {
      alert('Duration must be at least 5 minutes');
      return;
    }
    if (durationMinutes > 960) {
      alert('Duration cannot exceed 16 hours in a single entry');
      return;
    }

    try {
      const payload = {
        date: entryForm.date,
        project: entryForm.project || null,
        task: entryForm.task || null,
        category: entryForm.category,
        description: entryForm.description,
        durationMinutes,
        isBillable: entryForm.isBillable,
      };

      if (editingEntry) {
        await api.put(`/activity/entries/${editingEntry._id}`, payload);
      } else {
        await api.post('/activity/entries', payload);
      }

      setEntryModalOpen(false);
      fetchWeekData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to save entry');
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this time entry?')) return;
    try {
      await api.delete(`/activity/entries/${entryId}`);
      fetchWeekData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete entry');
    }
  };

  // Quick Action: Copy entries from yesterday
  const handleCopyYesterday = async (targetDateString) => {
    const targetDate = new Date(targetDateString);
    const prevDate = new Date(targetDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = prevDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // Find entries for prevDate in the current week (or fetch them if outside)
    let sourceEntries = (weekData?.entries || []).filter(
      (e) => new Date(e.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === prevDateStr
    );

    if (sourceEntries.length === 0) {
      try {
        const res = await api.get(`/activity/entries?startDate=${prevDateStr}&endDate=${prevDateStr}`);
        if (res.success && res.data?.entries) {
          sourceEntries = res.data.entries;
        }
      } catch (err) {
        console.warn('Failed to fetch yesterday entries', err);
      }
    }

    if (sourceEntries.length === 0) {
      alert(`No entries found for yesterday (${prevDateStr}) to copy.`);
      return;
    }

    if (!window.confirm(`Copy ${sourceEntries.length} entries from ${prevDateStr} to ${targetDateString}?`)) {
      return;
    }

    try {
      const copies = sourceEntries.map((e) => ({
        date: targetDateString,
        project: e.project?._id || e.project || null,
        task: e.task?._id || e.task || null,
        category: e.category,
        description: e.description,
        durationMinutes: e.durationMinutes,
        isBillable: e.isBillable,
      }));

      await api.post('/activity/entries/bulk', { entries: copies });
      fetchWeekData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to copy entries');
    }
  };

  // Submit Weekly Timesheet
  const handleSubmitTimesheet = async () => {
    try {
      setSubmittingTimesheet(true);
      const res = await api.post(`/activity/timesheets/${currentWeekStart}/submit`);
      if (res.success) {
        setShowSubmitModal(false);
        fetchWeekData();
        if (res.data?.warning) {
          alert(`Timesheet submitted!\n\nNotice: ${res.data.warning}`);
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit timesheet');
    } finally {
      setSubmittingTimesheet(false);
    }
  };

  // Reopen Timesheet (Admin / HR)
  const handleReopenTimesheet = async () => {
    if (!reopenReason.trim()) {
      alert('Please provide a reason for reopening the timesheet');
      return;
    }
    try {
      const timesheetId = weekData?.timesheet?._id;
      if (!timesheetId) return;
      await api.post(`/activity/timesheets/${timesheetId}/reopen`, { reason: reopenReason });
      setShowReopenModal(false);
      setReopenReason('');
      fetchWeekData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reopen timesheet');
    }
  };

  // Timer controls in My Time
  const [timerForm, setTimerForm] = useState({
    project: '',
    task: '',
    category: 'project_work',
    description: '',
    isBillable: true,
  });

  const handleStartTimerInline = async (e) => {
    e.preventDefault();
    try {
      await startTimer(timerForm);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStopTimerInline = async () => {
    try {
      await stopTimer();
      fetchWeekData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDiscardTimerInline = async () => {
    if (!window.confirm('Discard the running timer without saving?')) return;
    try {
      await discardTimer();
    } catch (err) {
      alert(err.message);
    }
  };

  const isTimesheetLocked =
    weekData?.timesheet?.status === 'submitted' || weekData?.timesheet?.status === 'approved';

  // Can submit timesheet check
  const canSubmitNow = useMemo(() => {
    if (isTimesheetLocked) return false;
    const now = new Date();
    const todayKolkata = new Date(now.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' }));
    const mondayKolkata = new Date(currentWeekStart);
    // If viewing a previous week, submission is always allowed
    const diffDays = Math.floor((todayKolkata - mondayKolkata) / (1000 * 60 * 60 * 24));
    if (diffDays >= 7) return true;
    // Current week: allowed Friday (day 5), Saturday (6), Sunday (0)
    const day = todayKolkata.getDay();
    return day === 5 || day === 6 || day === 0;
  }, [currentWeekStart, isTimesheetLocked]);

  // ==========================================
  // TAB 2: APPROVALS
  // ==========================================
  const [pendingTimesheets, setPendingTimesheets] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectingTimesheet, setInspectingTimesheet] = useState(null);
  const [inspectEntries, setInspectEntries] = useState([]);
  const [loadingInspect, setLoadingInspect] = useState(false);
  const [actionComment, setActionComment] = useState('');
  const [actingOnId, setActingOnId] = useState(null);

  const fetchPendingTimesheets = useCallback(async () => {
    try {
      setLoadingPending(true);
      const res = await api.get('/activity/timesheets/pending');
      if (res.success) {
        setPendingTimesheets(res.data || []);
      }
    } catch (err) {
      console.warn('Failed to load pending timesheets', err);
    } finally {
      setLoadingPending(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'approvals') {
      fetchPendingTimesheets();
    }
  }, [activeTab, fetchPendingTimesheets]);

  const handleInspectTimesheet = async (ts) => {
    setInspectingTimesheet(ts);
    setInspectModalOpen(true);
    setActionComment('');
    try {
      setLoadingInspect(true);
      const weekStartStr = new Date(ts.weekStart).toLocaleDateString('en-CA', {
        timeZone: 'Asia/Kolkata',
      });
      const res = await api.get(
        `/activity/timesheets/${weekStartStr}?employeeId=${ts.employee?._id || ts.employee}`
      );
      if (res.success) {
        setInspectEntries(res.data.entries || []);
      }
    } catch (err) {
      alert('Failed to inspect entries');
    } finally {
      setLoadingInspect(false);
    }
  };

  const handleApproveTimesheet = async (ts) => {
    const approvalReqId = ts.approvalRequest?._id || ts.approvalRequest;
    if (!approvalReqId) {
      alert('No approval request attached to this timesheet');
      return;
    }
    try {
      setActingOnId(ts._id);
      await api.post(`/approvals/${approvalReqId}/approve`, { comment: actionComment || 'Approved' });
      setInspectModalOpen(false);
      fetchPendingTimesheets();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve timesheet');
    } finally {
      setActingOnId(null);
    }
  };

  const handleRejectTimesheet = async (ts) => {
    if (!actionComment.trim()) {
      alert('Please enter a rejection reason in the comment box.');
      return;
    }
    const approvalReqId = ts.approvalRequest?._id || ts.approvalRequest;
    if (!approvalReqId) {
      alert('No approval request attached');
      return;
    }
    try {
      setActingOnId(ts._id);
      await api.post(`/approvals/${approvalReqId}/reject`, { comment: actionComment.trim() });
      setInspectModalOpen(false);
      fetchPendingTimesheets();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject timesheet');
    } finally {
      setActingOnId(null);
    }
  };

  // ==========================================
  // TAB 3: TEAM CAPACITY
  // ==========================================
  const [teamWeekStart, setTeamWeekStart] = useState(() => getKolkataMonday(new Date()));
  const [teamReport, setTeamReport] = useState([]);
  const [missingReport, setMissingReport] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [selectedDept, setSelectedDept] = useState('all');

  const fetchTeamData = useCallback(async () => {
    try {
      setLoadingTeam(true);
      const weekEndDate = new Date(teamWeekStart);
      weekEndDate.setDate(weekEndDate.getDate() + 6);
      const weekEndStr = weekEndDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

      const [empRes, missRes] = await Promise.all([
        api.get(`/activity/reports/by-employee?startDate=${teamWeekStart}&endDate=${weekEndStr}`),
        api.get(`/activity/reports/missing-timesheets`),
      ]);

      if (empRes.success) setTeamReport(empRes.data.employees || []);
      if (missRes.success) setMissingReport(missRes.data || []);
    } catch (err) {
      console.warn('Failed to load team capacity', err);
    } finally {
      setLoadingTeam(false);
    }
  }, [teamWeekStart]);

  useEffect(() => {
    if (activeTab === 'team') {
      fetchTeamData();
    }
  }, [activeTab, fetchTeamData]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set();
    teamReport.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set);
  }, [teamReport]);

  const filteredTeamReport = useMemo(() => {
    if (selectedDept === 'all') return teamReport;
    return teamReport.filter((e) => e.department === selectedDept);
  }, [teamReport, selectedDept]);

  // ==========================================
  // TAB 4: REPORTS & ANALYTICS
  // ==========================================
  const [reportRange, setReportRange] = useState('month'); // week | last_week | month | last_month | custom
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [projectReport, setProjectReport] = useState([]);
  const [categoryReport, setCategoryReport] = useState([]);
  const [employeeReport, setEmployeeReport] = useState([]);
  const [reportSummary, setReportSummary] = useState(null);
  const [loadingReports, setLoadingReports] = useState(false);

  // Compute date range
  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    const todayIST = new Date(today.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' }));

    if (reportRange === 'week') {
      const monStr = getKolkataMonday(todayIST);
      const sun = new Date(monStr);
      sun.setDate(sun.getDate() + 6);
      return { startDate: monStr, endDate: sun.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) };
    }
    if (reportRange === 'last_week') {
      const curMon = new Date(getKolkataMonday(todayIST));
      curMon.setDate(curMon.getDate() - 7);
      const sun = new Date(curMon);
      sun.setDate(sun.getDate() + 6);
      return {
        startDate: curMon.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
        endDate: sun.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
      };
    }
    if (reportRange === 'month') {
      const y = todayIST.getFullYear();
      const m = todayIST.getMonth();
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      return {
        startDate: start.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
        endDate: end.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
      };
    }
    if (reportRange === 'last_month') {
      const y = todayIST.getFullYear();
      const m = todayIST.getMonth() - 1;
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      return {
        startDate: start.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
        endDate: end.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
      };
    }
    return { startDate: customStart || '2026-01-01', endDate: customEnd || '2026-12-31' };
  }, [reportRange, customStart, customEnd]);

  const fetchReports = useCallback(async () => {
    try {
      setLoadingReports(true);
      const [projRes, catRes, empRes] = await Promise.all([
        api.get(`/activity/reports/by-project?startDate=${startDate}&endDate=${endDate}`),
        api.get(`/activity/reports/by-category?startDate=${startDate}&endDate=${endDate}`),
        api.get(`/activity/reports/by-employee?startDate=${startDate}&endDate=${endDate}`),
      ]);

      if (projRes.success) {
        setProjectReport(projRes.data.projects || []);
        setReportSummary(projRes.data.summary || null);
      }
      if (catRes.success) setCategoryReport(catRes.data.categories || []);
      if (empRes.success) setEmployeeReport(empRes.data.employees || []);
    } catch (err) {
      console.warn('Failed to load reports', err);
    } finally {
      setLoadingReports(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReports();
    }
  }, [activeTab, fetchReports]);

  // Export CSV Handler
  const handleExportCSV = async () => {
    try {
      const response = await api.get(
        `/activity/export?startDate=${startDate}&endDate=${endDate}`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `activity_report_${startDate}_to_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to export activity CSV');
    }
  };

  // Status badge styling
  const getStatusBadge = (status = 'draft') => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Approved
          </span>
        );
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Clock className="w-3.5 h-3.5 text-blue-500 animate-spin" />
            Submitted
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            Rejected
          </span>
        );
      case 'reopened':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <RotateCcw className="w-3.5 h-3.5 text-purple-500" />
            Reopened
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            Draft
          </span>
        );
    }
  };

  const canApproveOrManage =
    hasPermission(['activity.approve', 'activity.readTeam', 'activity.readAll']);

  return (
    <div className="space-y-6">
      {/* Page Title & Navigation Tabs */}
      <PageHeader
        title="Activity Tracker"
        subtitle="Log billable hours, manage timesheets, track live timer, and review studio capacity"
        breadcrumbs={[{ label: 'Activity Tracker' }]}
        actions={
          activeTab === 'my_time' ? (
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => handleOpenAddEntry()}
              disabled={isTimesheetLocked}
            >
              Log Time
            </Button>
          ) : null
        }
      />

      {/* Tabs Header */}
      <div className="flex items-center space-x-1 border-b border-slate-200 dark:border-slate-700 overflow-x-auto scrollbar-none">
        <button
          onClick={() => handleTabChange('my_time')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'my_time'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          My Time
        </button>

        {canApproveOrManage && (
          <button
            onClick={() => handleTabChange('approvals')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap relative ${
              activeTab === 'approvals'
                ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            Timesheet Approvals
            {pendingTimesheets.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white ml-1">
                {pendingTimesheets.length}
              </span>
            )}
          </button>
        )}

        {canApproveOrManage && (
          <button
            onClick={() => handleTabChange('team')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'team'
                ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Team Capacity
          </button>
        )}

        {canApproveOrManage && (
          <button
            onClick={() => handleTabChange('reports')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'reports'
                ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Reports & Analytics
          </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* TAB 1: MY TIME                                            */}
      {/* ========================================================= */}
      {activeTab === 'my_time' && (
        <div className="space-y-6">
          {/* Live Running Timer Box */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-900/40 relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />

            {isRunning ? (
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                    </span>
                    <span className="text-xs font-bold tracking-wider uppercase text-rose-300">
                      Timer Running
                    </span>
                    {isForgotten && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-900 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Running &gt; 12 hours
                      </span>
                    )}
                  </div>

                  <p className="text-lg font-semibold text-white">
                    {activeTimer?.description || 'Active task in progress'}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-indigo-200/80">
                    {activeTimer?.project && (
                      <span className="px-2 py-0.5 rounded bg-white/10 font-mono">
                        {activeTimer.project.projectCode || 'PRJ'} • {activeTimer.project.name}
                      </span>
                    )}
                    {activeTimer?.task && (
                      <span className="px-2 py-0.5 rounded bg-white/10 font-mono">
                        {activeTimer.task.taskCode || 'TSK'} • {activeTimer.task.title}
                      </span>
                    )}
                    <span className="capitalize px-2 py-0.5 rounded bg-white/10">
                      {(activeTimer?.category || 'project_work').replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="font-mono text-3xl md:text-4xl font-extrabold tracking-wider text-emerald-400">
                    {formattedElapsed}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleStopTimerInline}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg transition-transform active:scale-95"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      Stop & Log
                    </button>
                    <button
                      onClick={handleDiscardTimerInline}
                      className="p-2.5 rounded-xl bg-white/10 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 transition-colors"
                      title="Discard timer without saving"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleStartTimerInline} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold tracking-wider uppercase text-indigo-300">
                      Live Timer
                    </span>
                  </div>
                  <span className="text-xs text-indigo-300/70">
                    Automatically computes duration and writes entry on stop
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {/* Project */}
                  <select
                    value={timerForm.project}
                    onChange={(e) =>
                      setTimerForm({ ...timerForm, project: e.target.value, task: '' })
                    }
                    className="text-xs rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-brand-400"
                  >
                    <option value="" className="bg-slate-900 text-white">
                      Select Project (Optional)
                    </option>
                    {projects.map((p) => (
                      <option key={p._id} value={p._id} className="bg-slate-900 text-white">
                        {p.projectCode} - {p.name}
                      </option>
                    ))}
                  </select>

                  {/* Task */}
                  <select
                    value={timerForm.task}
                    onChange={(e) => setTimerForm({ ...timerForm, task: e.target.value })}
                    className="text-xs rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-brand-400"
                  >
                    <option value="" className="bg-slate-900 text-white">
                      Select Task (Optional)
                    </option>
                    {getTasksForProject(timerForm.project).map((t) => (
                      <option key={t._id} value={t._id} className="bg-slate-900 text-white">
                        {t.taskCode} - {t.title}
                      </option>
                    ))}
                  </select>

                  {/* Category */}
                  <select
                    value={timerForm.category}
                    onChange={(e) => setTimerForm({ ...timerForm, category: e.target.value })}
                    className="text-xs rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-brand-400 capitalize"
                  >
                    {['project_work', 'meeting', 'review', 'learning', 'admin', 'internal', 'support', 'other'].map(
                      (cat) => (
                        <option key={cat} value={cat} className="bg-slate-900 text-white">
                          {cat.replace('_', ' ')}
                        </option>
                      )
                    )}
                  </select>

                  {/* Description */}
                  <input
                    type="text"
                    required
                    placeholder="What are you working on?"
                    value={timerForm.description}
                    onChange={(e) => setTimerForm({ ...timerForm, description: e.target.value })}
                    className="text-xs rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                  />

                  {/* Start Button */}
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Start Timer
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Week Overview & Controls Bar */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            {/* Week Selector */}
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-slate-100 dark:bg-slate-700/60 rounded-xl p-1">
                <button
                  onClick={handlePrevWeek}
                  title="Previous Week"
                  className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-white dark:hover:bg-slate-600 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCurrentWeek}
                  className="px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-200"
                >
                  Current Week
                </button>
                <button
                  onClick={handleNextWeek}
                  title="Next Week"
                  className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-white dark:hover:bg-slate-600 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-brand-600" />
                  {weekData?.timesheet?.weekStart
                    ? `${new Date(weekData.timesheet.weekStart).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })} – ${new Date(weekData.timesheet.weekEnd).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}`
                    : 'Loading week...'}
                </p>
                <div className="mt-0.5">
                  {getStatusBadge(weekData?.timesheet?.status)}
                </div>
              </div>
            </div>

            {/* Week Summary KPI Metrics */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Logged Hours</span>
                <span className="text-base font-extrabold text-slate-800 dark:text-white">
                  {weekData?.summary?.totalHours || 0}h
                  <span className="text-xs font-normal text-slate-400 ml-1">
                    / {weekData?.summary?.expectedHours || 40}h
                  </span>
                </span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Billable Hours</span>
                <span className="text-base font-extrabold text-brand-600 dark:text-brand-400">
                  {weekData?.summary?.billableHours || 0}h
                  <span className="text-xs font-normal text-slate-400 ml-1">
                    ({weekData?.summary?.totalMinutes > 0
                      ? Math.round(
                          (weekData.summary.billableMinutes / weekData.summary.totalMinutes) * 100
                        )
                      : 0}
                    %)
                  </span>
                </span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 min-w-[140px]">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Capacity</span>
                  <span
                    className={`font-bold ${
                      (weekData?.summary?.utilizationPercent || 0) >= 80
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {weekData?.summary?.utilizationPercent || 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (weekData?.summary?.utilizationPercent || 0) >= 80
                        ? 'bg-emerald-500'
                        : 'bg-amber-500'
                    }`}
                    style={{
                      width: `${Math.min(100, weekData?.summary?.utilizationPercent || 0)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Submit / Reopen Actions */}
              <div>
                {!isTimesheetLocked ? (
                  <button
                    onClick={() => {
                      const totalH = weekData?.summary?.totalHours || 0;
                      const expH = weekData?.summary?.expectedHours || 40;
                      if (expH > 0 && totalH < expH * 0.8) {
                        setSubmitWarning(
                          `You have logged ${totalH} hours, which is under 80% of your expected capacity (${expH} hours).`
                        );
                      } else {
                        setSubmitWarning(null);
                      }
                      setShowSubmitModal(true);
                    }}
                    disabled={
                      !canSubmitNow ||
                      (weekData?.entries || []).length === 0 ||
                      submittingTimesheet
                    }
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition-all ${
                      canSubmitNow && (weekData?.entries || []).length > 0
                        ? 'bg-brand-600 hover:bg-brand-700 text-white cursor-pointer'
                        : 'bg-slate-100 text-slate-400 dark:bg-slate-800 cursor-not-allowed'
                    }`}
                    title={
                      !canSubmitNow
                        ? 'Timesheet can be submitted Friday onwards or after week closes'
                        : ''
                    }
                  >
                    <Send className="w-3.5 h-3.5" />
                    Submit Week
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 italic">
                      Locked ({weekData?.timesheet?.status})
                    </span>

                    {/* Admin / HR Reopen Action */}
                    {hasPermission('activity.editAll') && (
                      <button
                        onClick={() => setShowReopenModal(true)}
                        className="px-2.5 py-1.5 rounded-lg border border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950/40 text-xs font-semibold flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reopen
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Rejection / Reopen Feedback Banner */}
          {weekData?.timesheet?.reviewComment && (
            <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 dark:bg-purple-950/30 dark:border-purple-800 flex items-start gap-3">
              <Info className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-purple-900 dark:text-purple-200">
                  Manager Review Note:
                </p>
                <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                  "{weekData.timesheet.reviewComment}"
                </p>
              </div>
            </div>
          )}

          {/* 7-Day Week Breakdown Cards */}
          {loadingWeek ? (
            <div className="py-20 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-600" />
              <p className="text-sm">Loading weekly timesheet...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(weekData?.days || []).map((day) => {
                const dayDateObj = new Date(day.date);
                const dayName = dayDateObj.toLocaleDateString('en-US', {
                  timeZone: 'Asia/Kolkata',
                  weekday: 'short',
                });
                const isWeekend = dayName === 'Sat' || dayName === 'Sun';
                const dayHours = day.totalMinutes / 60;
                const isComplete = dayHours >= 7.5;
                const isPartial = dayHours > 0 && dayHours < 7.5;
                const isMissing = dayHours === 0 && !isWeekend;

                return (
                  <div
                    key={day.dateString}
                    className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs"
                  >
                    {/* Day Header Row */}
                    <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="w-12 text-center text-xs font-bold px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                          {dayName}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            {dayDateObj.toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                          <span className="text-[11px] text-slate-400">
                            {day.entries.length} {day.entries.length === 1 ? 'entry' : 'entries'} logged
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Status Tag */}
                        {isComplete && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            Complete ({formatMinutes(day.totalMinutes)})
                          </span>
                        )}
                        {isPartial && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            Partial ({formatMinutes(day.totalMinutes)})
                          </span>
                        )}
                        {isMissing && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                            Missing Time
                          </span>
                        )}
                        {isWeekend && day.totalMinutes === 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            Weekend
                          </span>
                        )}

                        {/* Quick Actions */}
                        {!isTimesheetLocked && (
                          <div className="flex items-center gap-1.5">
                            {day.entries.length === 0 && (
                              <button
                                onClick={() => handleCopyYesterday(day.dateString)}
                                title="Copy entries from previous day"
                                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3 text-slate-400" />
                                Copy Yesterday
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenAddEntry(day.dateString)}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200 dark:border-brand-800 flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Add Entry
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Day Entries List */}
                    {day.entries.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400 italic">
                        No time logged for this day.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                        {day.entries.map((entry) => (
                          <div
                            key={entry._id}
                            className="p-4 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-slate-800 dark:text-slate-100">
                                  {entry.project?.name ? (
                                    <>
                                      <span className="font-mono text-brand-600 dark:text-brand-400 font-bold mr-1">
                                        {entry.project.projectCode}
                                      </span>
                                      {entry.project.name}
                                    </>
                                  ) : (
                                    <span className="text-slate-500">Internal Agency</span>
                                  )}
                                </span>

                                {entry.task && (
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-mono">
                                    {entry.task.taskCode} • {entry.task.title}
                                  </span>
                                )}

                                <span className="capitalize px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                  {entry.category.replace('_', ' ')}
                                </span>

                                {entry.isBillable ? (
                                  <span
                                    title="Billable to client"
                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-0.5"
                                  >
                                    <DollarSign className="w-2.5 h-2.5" />
                                    Billable
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                                    Non-billable
                                  </span>
                                )}

                                {entry.source === 'timer' && (
                                  <span className="text-[10px] text-slate-400 font-mono flex items-center gap-0.5">
                                    <Clock className="w-2.5 h-2.5" />
                                    Timer
                                  </span>
                                )}
                              </div>

                              <p className="text-slate-600 dark:text-slate-300 text-xs">
                                {entry.description}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                                {formatMinutes(entry.durationMinutes)}
                              </span>

                              {!isTimesheetLocked && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleOpenEditEntry(entry)}
                                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                                    title="Edit entry"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteEntry(entry._id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                    title="Delete entry"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: TIMESHEET APPROVALS (Managers & HR)                */}
      {/* ========================================================= */}
      {activeTab === 'approvals' && canApproveOrManage && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Pending Timesheet Submissions ({pendingTimesheets.length})
            </h2>
            <button
              onClick={fetchPendingTimesheets}
              className="text-xs text-brand-600 dark:text-brand-400 font-semibold hover:underline"
            >
              Refresh List
            </button>
          </div>

          {loadingPending ? (
            <div className="py-16 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
              <p className="text-xs">Loading pending submissions...</p>
            </div>
          ) : pendingTimesheets.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-400 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                All caught up!
              </p>
              <p className="text-xs">No timesheets are currently awaiting your approval.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-700">
              {pendingTimesheets.map((ts) => {
                const totalHours = Math.round(((ts.totalMinutes || 0) / 60) * 10) / 10;
                const billableHours = Math.round(((ts.billableMinutes || 0) / 60) * 10) / 10;
                const isUnderCapacity = totalHours < 32;

                return (
                  <div
                    key={ts._id}
                    className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-bold flex items-center justify-center text-sm flex-shrink-0">
                        {ts.employee?.personal?.firstName?.charAt(0) || 'E'}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {ts.employee?.personal?.firstName} {ts.employee?.personal?.lastName}
                        </p>
                        <p className="text-xs text-slate-400">
                          {ts.employee?.employment?.designation || 'Team Member'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Week</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {new Date(ts.weekStart).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}{' '}
                          –{' '}
                          {new Date(ts.weekEnd).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Logged</span>
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          {totalHours}h
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Billable</span>
                        <span className="font-extrabold text-brand-600 dark:text-brand-400">
                          {billableHours}h
                        </span>
                      </div>

                      {isUnderCapacity && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          &lt; 80% Expected
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleInspectTimesheet(ts)}
                        className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        Inspect Entries
                      </button>
                      <button
                        onClick={() => handleApproveTimesheet(ts)}
                        disabled={actingOnId === ts._id}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: TEAM CAPACITY                                      */}
      {/* ========================================================= */}
      {activeTab === 'team' && canApproveOrManage && (
        <div className="space-y-6">
          {/* Missing Timesheets Alert Banner */}
          {missingReport.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  Missing Timesheet Alert: {missingReport.length} team members have not submitted their
                  timesheets for last week.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {missingReport.map((m) => (
                    <span
                      key={m.employee?._id || m.employee}
                      className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200"
                    >
                      {m.employee?.personal?.firstName} {m.employee?.personal?.lastName}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Controls Bar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Week Starting:
              </span>
              <input
                type="date"
                value={teamWeekStart}
                onChange={(e) => setTeamWeekStart(getKolkataMonday(new Date(e.target.value)))}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold">Department:</span>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Team Capacity Table */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Employee</th>
                    <th className="px-5 py-3">Department</th>
                    <th className="px-5 py-3">Logged / Expected</th>
                    <th className="px-5 py-3">Capacity %</th>
                    <th className="px-5 py-3">Billable %</th>
                    <th className="px-5 py-3 text-right">Timesheet Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {loadingTeam ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                        Loading capacity data...
                      </td>
                    </tr>
                  ) : filteredTeamReport.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-400">
                        No team time logs found for this week.
                      </td>
                    </tr>
                  ) : (
                    filteredTeamReport.map((emp) => {
                      const util = emp.utilizationPercent || 0;
                      return (
                        <tr
                          key={emp.employeeId}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors"
                        >
                          <td className="px-5 py-3.5">
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {emp.employeeName}
                            </span>
                            <span className="text-[10px] text-slate-400">{emp.designation}</span>
                          </td>
                          <td className="px-5 py-3.5 font-medium text-slate-600 dark:text-slate-300">
                            {emp.department || 'Studio'}
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-slate-800 dark:text-slate-200">
                            {emp.totalHours}h{' '}
                            <span className="text-slate-400 font-normal">/ {emp.expectedHours || 40}h</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    util >= 80 ? 'bg-emerald-500' : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${Math.min(100, util)}%` }}
                                />
                              </div>
                              <span
                                className={`font-bold ${
                                  util >= 80 ? 'text-emerald-600' : 'text-amber-600'
                                }`}
                              >
                                {util}%
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 font-bold text-brand-600 dark:text-brand-400">
                            {emp.billableRatioPercent || 0}%
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {getStatusBadge(emp.timesheetStatus || 'draft')}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: REPORTS & ANALYTICS                                */}
      {/* ========================================================= */}
      {activeTab === 'reports' && canApproveOrManage && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Time Range:</span>
              <div className="flex items-center bg-slate-100 dark:bg-slate-700/60 rounded-xl p-1 text-xs font-semibold">
                {[
                  { key: 'week', label: 'This Week' },
                  { key: 'last_week', label: 'Last Week' },
                  { key: 'month', label: 'This Month' },
                  { key: 'last_month', label: 'Last Month' },
                ].map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setReportRange(r.key)}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      reportRange === r.key
                        ? 'bg-white dark:bg-slate-600 text-brand-600 dark:text-brand-300 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Export CSV Button */}
            {hasPermission('activity.export') && (
              <button
                onClick={handleExportCSV}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2 shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                Export CSV
              </button>
            )}
          </div>

          {/* KPI Statistics Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-slate-400 text-xs uppercase font-bold block mb-1">
                Total Hours Logged
              </span>
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {reportSummary?.totalHours || 0}h
              </span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-slate-400 text-xs uppercase font-bold block mb-1">
                Billable Hours
              </span>
              <span className="text-2xl font-extrabold text-brand-600 dark:text-brand-400">
                {reportSummary?.billableHours || 0}h
              </span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-slate-400 text-xs uppercase font-bold block mb-1">
                Billability Rate
              </span>
              <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {reportSummary?.billablePercent || 0}%
              </span>
            </div>

            {hasPermission('activity.viewCost') && (
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <span className="text-slate-400 text-xs uppercase font-bold block mb-1">
                  Total Studio Cost
                </span>
                <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
                  {formatINR(reportSummary?.totalCostPaise || 0)}
                </span>
              </div>
            )}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hours by Project Bar Chart */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-brand-600" />
                Hours by Project
              </h3>
              {projectReport.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                  No project hours recorded in this range.
                </div>
              ) : (
                <div className="h-64 w-full text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={projectReport.slice(0, 8)}
                      margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                    >
                      <XAxis
                        dataKey="projectCode"
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        interval={0}
                      />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          color: '#fff',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="totalHours" name="Total Hours" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar
                        dataKey="billableHours"
                        name="Billable Hours"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Hours by Category Donut Chart */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-indigo-600" />
                Hours by Category
              </h3>
              {categoryReport.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                  No category hours recorded.
                </div>
              ) : (
                <div className="h-64 w-full flex items-center justify-center text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryReport}
                        dataKey="totalHours"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                      >
                        {categoryReport.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          color: '#fff',
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Project Breakdown Table */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Project Detail Summary
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-400 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="px-5 py-3">Project</th>
                    <th className="px-5 py-3">Client</th>
                    <th className="px-5 py-3">Total Hours</th>
                    <th className="px-5 py-3">Billable Hours</th>
                    {hasPermission('activity.viewCost') && <th className="px-5 py-3">Cost to Studio</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {projectReport.map((proj) => (
                    <tr
                      key={proj.projectId}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors"
                    >
                      <td className="px-5 py-3 font-semibold text-slate-900 dark:text-white">
                        <span className="font-mono text-brand-600 dark:text-brand-400 mr-1.5">
                          {proj.projectCode}
                        </span>
                        {proj.projectName}
                      </td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                        {proj.clientName || 'Direct'}
                      </td>
                      <td className="px-5 py-3 font-bold text-slate-800 dark:text-slate-100">
                        {proj.totalHours}h
                      </td>
                      <td className="px-5 py-3 font-bold text-emerald-600 dark:text-emerald-400">
                        {proj.billableHours}h
                      </td>
                      {hasPermission('activity.viewCost') && (
                        <td className="px-5 py-3 font-bold text-slate-700 dark:text-slate-300">
                          {formatINR(proj.costToDate || 0)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Add / Edit Time Entry                              */}
      {/* ========================================================= */}
      {entryModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setEntryModalOpen(false)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-brand-600" />
                {editingEntry ? 'Edit Time Entry' : 'Log Daily Time'}
              </h3>
              <button
                onClick={() => setEntryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="space-y-4 text-xs">
              {/* Date */}
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  Date (IST) *
                </label>
                <input
                  type="date"
                  required
                  value={entryForm.date}
                  onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              {/* Project & Task */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                    Project
                  </label>
                  <select
                    value={entryForm.project}
                    onChange={(e) =>
                      setEntryForm({ ...entryForm, project: e.target.value, task: '' })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    <option value="">Internal / Agency</option>
                    {projects.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.projectCode} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                    Task
                  </label>
                  <select
                    value={entryForm.task}
                    onChange={(e) => setEntryForm({ ...entryForm, task: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    <option value="">None / General</option>
                    {getTasksForProject(entryForm.project).map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.taskCode} - {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  Category *
                </label>
                <select
                  value={entryForm.category}
                  onChange={(e) => setEntryForm({ ...entryForm, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white capitalize"
                >
                  {['project_work', 'meeting', 'review', 'learning', 'admin', 'internal', 'support', 'other'].map(
                    (c) => (
                      <option key={c} value={c}>
                        {c.replace('_', ' ')}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  Work Summary / Description *
                </label>
                <textarea
                  required
                  rows="3"
                  placeholder="Detail your work accomplishments or meeting agenda..."
                  value={entryForm.description}
                  onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white resize-none"
                />
              </div>

              {/* Duration (Hours & Minutes) & Billable Toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                    Duration
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <input
                        type="number"
                        min="0"
                        max="16"
                        value={entryForm.hours}
                        onChange={(e) => setEntryForm({ ...entryForm, hours: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-bold"
                      />
                      <span className="text-[10px] text-slate-400 block text-center mt-0.5">Hours</span>
                    </div>
                    <div className="flex-1">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        step="5"
                        value={entryForm.minutes}
                        onChange={(e) => setEntryForm({ ...entryForm, minutes: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-bold"
                      />
                      <span className="text-[10px] text-slate-400 block text-center mt-0.5">Mins</span>
                    </div>
                  </div>
                </div>

                <div className="pb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={entryForm.isBillable}
                      onChange={(e) =>
                        setEntryForm({ ...entryForm, isBillable: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      Billable to Client
                    </span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setEntryModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-xs"
                >
                  {editingEntry ? 'Update Entry' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Submit Timesheet Confirmation                      */}
      {/* ========================================================= */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setShowSubmitModal(false)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-brand-600" />
              Submit Weekly Timesheet
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Once submitted, your weekly entries will be locked and forwarded to your reporting
              manager for approval.
            </p>

            {submitWarning && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed font-medium">
                  {submitWarning}
                </p>
              </div>
            )}

            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Logged Hours:</span>
                <span className="font-bold text-slate-800 dark:text-white">
                  {weekData?.summary?.totalHours || 0} hrs
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Billable Hours:</span>
                <span className="font-bold text-brand-600 dark:text-brand-400">
                  {weekData?.summary?.billableHours || 0} hrs
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitTimesheet}
                disabled={submittingTimesheet}
                className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
              >
                {submittingTimesheet && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Submission
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Inspect Timesheet Entries (Approver View)          */}
      {/* ========================================================= */}
      {inspectModalOpen && inspectingTimesheet && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setInspectModalOpen(false)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 space-y-5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Timesheet: {inspectingTimesheet.employee?.personal?.firstName}{' '}
                  {inspectingTimesheet.employee?.personal?.lastName}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Week of {new Date(inspectingTimesheet.weekStart).toLocaleDateString('en-IN')} (
                  {Math.round(((inspectingTimesheet.totalMinutes || 0) / 60) * 10) / 10} hrs logged)
                </p>
              </div>
              <button
                onClick={() => setInspectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Entries List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {loadingInspect ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-brand-600" />
                  Loading entries...
                </div>
              ) : inspectEntries.length === 0 ? (
                <div className="py-8 text-center text-slate-400">No entries recorded.</div>
              ) : (
                inspectEntries.map((e) => (
                  <div
                    key={e._id}
                    className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 dark:text-white">
                          {new Date(e.date).toLocaleDateString('en-IN', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                        {e.project && (
                          <span className="px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 font-mono text-[10px]">
                            {e.project.projectCode}
                          </span>
                        )}
                        <span className="capitalize px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px]">
                          {e.category.replace('_', ' ')}
                        </span>
                        {e.isBillable && (
                          <span className="text-emerald-600 font-bold text-[10px]">Billable</span>
                        )}
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 text-xs">{e.description}</p>
                    </div>
                    <span className="font-mono font-bold text-slate-900 dark:text-white flex-shrink-0">
                      {formatMinutes(e.durationMinutes)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Approver Action Box */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-3">
              <input
                type="text"
                placeholder="Approval or Rejection comment (Required for rejection)..."
                value={actionComment}
                onChange={(e) => setActionComment(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => handleRejectTimesheet(inspectingTimesheet)}
                  className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs font-bold"
                >
                  Reject with Comment
                </button>
                <button
                  onClick={() => handleApproveTimesheet(inspectingTimesheet)}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
                >
                  Approve Timesheet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Reopen Timesheet (Admin / HR)                      */}
      {/* ========================================================= */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setShowReopenModal(false)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-purple-600" />
              Reopen Timesheet for Revision
            </h3>
            <p className="text-xs text-slate-500">
              Reopening will unlock all entries for this week so the employee can correct or log
              additional time.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reason for Reopening *
              </label>
              <textarea
                rows="3"
                required
                placeholder="e.g. Please log client demo hours on Thursday..."
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowReopenModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleReopenTimesheet}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
              >
                Confirm Reopen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityTracker;

