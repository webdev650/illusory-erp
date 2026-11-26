import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Card, Button } from '../components/ui';
import {
  TrendingUp,
  Target,
  Award,
  Users,
  Calendar,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Edit2,
  ChevronRight,
  Shield,
  MessageSquare,
  FileText,
  Star,
  Layers,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Lock,
  ThumbsUp,
  Check,
  X,
} from 'lucide-react';

export const Performance = () => {
  const { user, role, hasPermission } = useAuth();
  const isSuperAdmin = role === 'super_admin';
  const isHR = role === 'hr' || isSuperAdmin;
  const isManager = ['project_manager', 'manager'].includes(role) || isHR;

  // Tabs: Overview, My Performance, My Team, Cycles, Goals, 1:1s, Feedback, Calibration, Reports, Settings
  const [activeTab, setActiveTab] = useState('overview');

  // Overview / Data states
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [myPerformance, setMyPerformance] = useState(null);
  const [goals, setGoals] = useState([]);
  const [oneOnOnes, setOneOnOnes] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [settings, setSettings] = useState(null);

  // Modals & Drawer
  const [selectedReview, setSelectedReview] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cycleModalOpen, setCycleModalOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [oneOnOneModalOpen, setOneOnOneModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [calibrationModalOpen, setCalibrationModalOpen] = useState(false);
  const [pipModalOpen, setPipModalOpen] = useState(false);

  // Forms
  const [newCycle, setNewCycle] = useState({
    name: '',
    type: 'quarterly',
    periodStart: '',
    periodEnd: '',
    participantsScope: 'all',
    template: '',
  });
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    type: 'individual',
    dueDate: '',
    keyResults: [{ title: '', startValue: 0, targetValue: 100, unit: '%' }],
  });
  const [newMeeting, setNewMeeting] = useState({
    employee: '',
    meetingDate: '',
    agenda: '',
  });
  const [newFeedback, setNewFeedback] = useState({
    toEmployee: '',
    type: 'praise',
    visibility: 'public',
    message: '',
    valueTags: ['Craftsmanship'],
  });
  const [calibrationForm, setCalibrationForm] = useState({
    calibratedRating: 3,
    reason: '',
  });
  const [employeesList, setEmployeesList] = useState([]);
  const [templatesList, setTemplatesList] = useState([]);

  // Load summary and initial data
  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [sumRes, settRes, empRes, tmplRes] = await Promise.all([
        api.get('/performance/summary'),
        api.get('/performance/settings'),
        api.get('/employees').catch(() => ({ data: { data: [] } })),
        api.get('/performance/templates').catch(() => ({ data: { data: [] } })),
      ]);

      setSummary(sumRes.data.data);
      setSettings(settRes.data.data);
      setEmployeesList(empRes.data.data || []);
      setTemplatesList(tmplRes.data.data || []);
    } catch (err) {
      console.error('Failed to load performance overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Tab change lazy loader
  useEffect(() => {
    const loadTabData = async () => {
      try {
        if (activeTab === 'cycles') {
          const res = await api.get('/performance/cycles');
          setCycles(res.data.data || []);
        } else if (activeTab === 'my_performance') {
          const res = await api.get('/me/performance');
          setMyPerformance(res.data.data);
        } else if (activeTab === 'team' || activeTab === 'calibration') {
          const res = await api.get('/performance/reviews');
          setReviews(res.data.data || []);
        } else if (activeTab === 'goals') {
          const res = await api.get('/performance/goals');
          setGoals(res.data.data || []);
        } else if (activeTab === 'one_on_ones') {
          const res = await api.get('/performance/one-on-ones');
          setOneOnOnes(res.data.data || []);
        } else if (activeTab === 'feedback') {
          const res = await api.get('/performance/feedback');
          setFeedbacks(res.data.data || []);
        }
      } catch (err) {
        console.error(`Failed to load tab ${activeTab}:`, err);
      }
    };
    loadTabData();
  }, [activeTab]);

  // Create Cycle
  const handleCreateCycle = async (e) => {
    e.preventDefault();
    try {
      await api.post('/performance/cycles', newCycle);
      setCycleModalOpen(false);
      setNewCycle({ name: '', type: 'quarterly', periodStart: '', periodEnd: '', participantsScope: 'all', template: '' });
      const res = await api.get('/performance/cycles');
      setCycles(res.data.data || []);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create review cycle');
    }
  };

  // Start Cycle
  const handleStartCycle = async (cycleId) => {
    if (!window.confirm('Start this review cycle? This will initialize evaluation records for eligible participants.')) return;
    try {
      await api.post(`/performance/cycles/${cycleId}/start`);
      const res = await api.get('/performance/cycles');
      setCycles(res.data.data || []);
      alert('Review cycle started successfully');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to start cycle');
    }
  };

  // Create Goal
  const handleCreateGoal = async (e) => {
    e.preventDefault();
    try {
      await api.post('/performance/goals', newGoal);
      setGoalModalOpen(false);
      setNewGoal({ title: '', description: '', type: 'individual', dueDate: '', keyResults: [{ title: '', startValue: 0, targetValue: 100, unit: '%' }] });
      const res = await api.get('/performance/goals');
      setGoals(res.data.data || []);
      alert('Goal submitted successfully');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create goal');
    }
  };

  // Recommend PIP
  const handleRecommendPIP = async (reviewId) => {
    if (!window.confirm('Create a DRAFT Performance Improvement Plan (PIP) in Warnings & PIP? Nothing starts automatically.')) return;
    try {
      const res = await api.post(`/performance/reviews/${reviewId}/recommend-pip`);
      alert(`Draft PIP created successfully for employee (ID: ${res.data.data._id}). HR can review in Warnings & PIP.`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to recommend draft PIP');
    }
  };

  // Calibrate Review Action
  const handleCalibrate = async (e) => {
    e.preventDefault();
    if (!selectedReview) return;
    try {
      await api.post(`/performance/reviews/${selectedReview._id}/calibrate`, calibrationForm);
      setCalibrationModalOpen(false);
      setCalibrationForm({ calibratedRating: 3, reason: '' });
      const res = await api.get('/performance/reviews');
      setReviews(res.data.data || []);
      alert('Evaluation rating calibrated and logged successfully');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to calibrate rating');
    }
  };

  // Export Data
  const handleExport = async () => {
    try {
      const res = await api.get('/performance/export');
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.data.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `performance_export_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      alert(`Export successful with watermark: "${res.data.data.watermark}"`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to export performance data');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <PageHeader
        title="Performance & Appraisal Master"
        subtitle="Confidential evaluations, quarterly OKR goals, 360° feedback, 1:1 syncs, and calibration"
        actions={
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleExport} className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
            {isHR && (
              <Button onClick={() => setCycleModalOpen(true)} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white">
                <Plus className="w-4 h-4" />
                New Cycle
              </Button>
            )}
            <Button onClick={() => setGoalModalOpen(true)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Target className="w-4 h-4" />
              New Goal
            </Button>
          </div>
        }
      />

      {/* 2. Mandatory Studio Policy Warning Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-900 shadow-sm">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 text-sm leading-relaxed">
          <div className="flex items-center gap-2 font-semibold text-amber-950 mb-0.5">
            <span>Official HR Performance Policy Safeguard</span>
            <span className="px-2 py-0.5 text-xs font-medium bg-amber-200 text-amber-900 rounded-full border border-amber-300">
              unverified, confirm with HR
            </span>
          </div>
          <p>
            {summary?.noticeText ||
              "Review rating scales, weightings and consequences must follow the company's HR policy; confirm with HR."}
          </p>
          <p className="text-xs text-amber-800 mt-1">
            <strong>Core Principle:</strong> Performance data supports people decisions; it never makes them. No automated ranking, increments, warnings, or terminations occur without explicit human approval.
          </p>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-2 overflow-x-auto pb-2">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'my_performance', label: 'My Performance', icon: Award },
            ...(isManager ? [{ id: 'team', label: 'My Team', icon: Users }] : []),
            ...(isHR ? [{ id: 'cycles', label: 'Cycles', icon: Calendar }] : []),
            { id: 'goals', label: 'Goals (OKR)', icon: Target },
            { id: 'one_on_ones', label: '1:1 Syncs', icon: MessageSquare },
            { id: 'feedback', label: 'Kudos & Feedback', icon: ThumbsUp },
            ...(isHR ? [{ id: 'calibration', label: 'Calibration', icon: Shield }] : []),
            { id: 'reports', label: 'Reports', icon: FileText },
            ...(isSuperAdmin ? [{ id: 'settings', label: 'Settings', icon: Lock }] : []),
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-brand-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* TAB CONTENT */}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Cycle</p>
                <h4 className="text-lg font-bold text-slate-900 mt-1">
                  {summary?.activeCycle ? summary.activeCycle.name : 'No Active Cycle'}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {summary?.activeCycle ? `Ends ${new Date(summary.activeCycle.periodEnd).toLocaleDateString()}` : 'Awaiting HR launch'}
                </p>
              </div>
              <div className="p-3 bg-brand-50 rounded-xl text-brand-600">
                <Calendar className="w-6 h-6" />
              </div>
            </Card>

            <Card className="p-4 border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Self Reviews Done</p>
                <h4 className="text-xl font-bold text-slate-900 mt-1">
                  {summary?.reviewStats?.selfDone || 0} / {summary?.reviewStats?.total || 0}
                </h4>
                <p className="text-xs text-emerald-600 mt-0.5 font-medium">
                  {summary?.reviewStats?.total ? Math.round(((summary.reviewStats.selfDone) / summary.reviewStats.total) * 100) : 0}% completion
                </p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </Card>

            <Card className="p-4 border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Manager Evals</p>
                <h4 className="text-xl font-bold text-slate-900 mt-1">
                  {summary?.reviewStats?.managerDone || 0} / {summary?.reviewStats?.total || 0}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">Scored by team leads</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                <Users className="w-6 h-6" />
              </div>
            </Card>

            <Card className="p-4 border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Published Outcomes</p>
                <h4 className="text-xl font-bold text-slate-900 mt-1">
                  {summary?.reviewStats?.published || 0}
                </h4>
                <p className="text-xs text-indigo-600 mt-0.5 font-medium">Visible to employees</p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                <Award className="w-6 h-6" />
              </div>
            </Card>
          </div>

          {/* Department Rating Distribution Chart (Privacy Protected: Groups < 3 hidden) */}
          {isHR && (
            <Card className="p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Studio Discipline Rating Averages</h3>
                  <p className="text-xs text-slate-500">
                    Aggregated department averages for the current cycle. Departments with fewer than 3 evaluations are suppressed to preserve confidentiality.
                  </p>
                </div>
                <span className="text-xs font-medium px-2.5 py-1 bg-slate-100 rounded-md text-slate-600">
                  Privacy Threshold: &ge; 3 participants
                </span>
              </div>

              {summary?.departmentAverages?.length > 0 ? (
                <div className="space-y-4">
                  {summary.departmentAverages.map((dept) => (
                    <div key={dept.department} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-800">{dept.department} ({dept.employeeCount} evaluated)</span>
                        <span className="font-bold text-slate-900">{dept.averageRating} / 5.0</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-brand-600 h-2.5 rounded-full"
                          style={{ width: `${(dept.averageRating / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-sm">
                  No department rating groups currently meet the minimum privacy threshold (&ge;3 respondents) for visualization.
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: MY PERFORMANCE */}
      {activeTab === 'my_performance' && (
        <div className="space-y-6">
          {myPerformance?.review ? (
            <Card className="p-6 border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-start justify-between border-b pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{myPerformance.activeCycle?.name}</h3>
                  <p className="text-xs text-slate-500">
                    Evaluator / Manager: {myPerformance.review.manager?.personal?.firstName} {myPerformance.review.manager?.personal?.lastName}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  myPerformance.review.isPublished ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {myPerformance.review.isPublished ? 'Outcome Published' : 'In Review (Confidential)'}
                </span>
              </div>

              {/* Publication Status Notice */}
              {!myPerformance.review.isPublished && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-blue-900 text-sm flex items-center gap-3">
                  <Lock className="w-5 h-5 text-blue-600 shrink-0" />
                  <div>
                    <p className="font-medium">Manager Evaluation in Progress</p>
                    <p className="text-xs text-blue-800">
                      Evaluator scoring and calibration are confidential and will be visible only once HR formally publishes the cycle outcomes.
                    </p>
                  </div>
                </div>
              )}

              {/* Published Results & Acknowledgement */}
              {myPerformance.review.isPublished && (
                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Final Overall Rating</p>
                      <h2 className="text-3xl font-extrabold text-slate-900 mt-1">
                        {myPerformance.review.managerReview?.finalOverallRating || 'N/A'} <span className="text-sm font-normal text-slate-500">/ 5.0</span>
                      </h2>
                    </div>
                    {myPerformance.review.employeeAcknowledgement?.acknowledgedAt ? (
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">
                          <Check className="w-3.5 h-3.5" /> Acknowledged on {new Date(myPerformance.review.employeeAcknowledgement.acknowledgedAt).toLocaleDateString()}
                        </span>
                        <p className="text-xs text-slate-400 mt-1">Status: Received</p>
                      </div>
                    ) : (
                      <Button
                        onClick={async () => {
                          const comments = prompt('Enter your acknowledgement response (optional):', '');
                          const isDisputed = window.confirm('Do you agree with the outcome? Click OK to acknowledge normally, or Cancel to flag a dispute ("I Disagree") for HR review.');
                          try {
                            await api.post(`/performance/reviews/${myPerformance.review._id}/acknowledge`, {
                              comments,
                              isDisputed: !isDisputed,
                            });
                            alert('Acknowledgement recorded successfully');
                            const res = await api.get('/me/performance');
                            setMyPerformance(res.data.data);
                          } catch (e) {
                            alert(e.response?.data?.message || 'Failed to acknowledge');
                          }
                        }}
                        className="bg-brand-600 hover:bg-brand-700 text-white"
                      >
                        Acknowledge Review
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase">Noted Strengths</p>
                      <p className="text-sm text-slate-800 mt-1">{myPerformance.review.managerReview?.strengths || 'Consistent deliverables'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase">Development Plan</p>
                      <p className="text-sm text-slate-800 mt-1">{myPerformance.review.managerReview?.developmentPlan || 'Expand technical leadership'}</p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-8 text-center text-slate-500 border border-dashed">
              No active performance review assigned to your account for this cycle.
            </Card>
          )}
        </div>
      )}

      {/* TAB 3: MY TEAM (MANAGERS & HR) */}
      {activeTab === 'team' && (
        <Card className="p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Direct Reports Evaluations</h3>
              <p className="text-xs text-slate-500">
                Score your team members against template sections. Suggested ratings are calculated from weights; manual overall ratings require detailed reasons if different.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold border-b">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Cycle</th>
                  <th className="py-3 px-4">Self Review</th>
                  <th className="py-3 px-4">Suggested Rating</th>
                  <th className="py-3 px-4">Final Rating</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reviews.map((rev) => (
                  <tr key={rev._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">
                        {rev.employee?.personal?.firstName} {rev.employee?.personal?.lastName}
                      </div>
                      <div className="text-xs text-slate-500">{rev.employee?.employment?.designation} ({rev.employee?.employeeId})</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{rev.cycle?.name}</td>
                    <td className="py-3 px-4">
                      {rev.selfReview?.submittedAt ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
                          <Check className="w-3 h-3" /> Submitted
                        </span>
                      ) : (
                        <span className="text-amber-600 text-xs">Pending</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {rev.managerReview?.recommendedRating ? `${rev.managerReview.recommendedRating} / 5.0` : '—'}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {rev.managerReview?.finalOverallRating ? `${rev.managerReview.finalOverallRating} / 5.0` : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {rev.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedReview(rev);
                          setDrawerOpen(true);
                        }}
                      >
                        Evaluate / Drilldown
                      </Button>
                      {isHR && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRecommendPIP(rev._id)}
                          className="text-amber-600 border-amber-300 hover:bg-amber-50"
                        >
                          Recommend PIP
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 4: CYCLES (HR) */}
      {activeTab === 'cycles' && (
        <Card className="p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Studio Review Cycles</h3>
            <Button onClick={() => setCycleModalOpen(true)} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white">
              <Plus className="w-4 h-4" /> New Cycle
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cycles.map((c) => (
              <Card key={c._id} className="p-5 border border-slate-200 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">{c.name}</h4>
                    <p className="text-xs text-slate-500 uppercase font-medium mt-0.5">{c.type} evaluation</p>
                  </div>
                  <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full uppercase ${
                    c.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                    c.status === 'published' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'
                  }`}>
                    {c.status}
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <p><strong>Period:</strong> {new Date(c.periodStart).toLocaleDateString()} &mdash; {new Date(c.periodEnd).toLocaleDateString()}</p>
                  <p><strong>Scope:</strong> {c.participantsScope.replace(/_/g, ' ')}</p>
                  <p><strong>Template:</strong> {c.template?.name || 'Default Studio Review'}</p>
                </div>
                <div className="pt-2 border-t flex items-center justify-end gap-2">
                  {c.status === 'draft' && (
                    <Button size="sm" onClick={() => handleStartCycle(c._id)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      Start Cycle
                    </Button>
                  )}
                  {c.status === 'active' && (
                    <Button size="sm" onClick={async () => {
                      if (window.confirm('Publish outcomes of this cycle to employees?')) {
                        await api.post(`/performance/cycles/${c._id}/publish`);
                        const res = await api.get('/performance/cycles');
                        setCycles(res.data.data || []);
                      }
                    }} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                      Publish Outcomes
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </Card>
      )}

      {/* TAB 5: GOALS (OKR) */}
      {activeTab === 'goals' && (
        <Card className="p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Objectives & Key Results (OKRs)</h3>
              <p className="text-xs text-slate-500">Track and update individual, team, and agency objectives.</p>
            </div>
            <Button onClick={() => setGoalModalOpen(true)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="w-4 h-4" /> New Goal
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.map((g) => (
              <Card key={g._id} className="p-5 border border-slate-200 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {g.type}
                    </span>
                    <h4 className="font-bold text-slate-900 mt-1">{g.title}</h4>
                    <p className="text-xs text-slate-500">Owner: {g.employee?.personal?.firstName} {g.employee?.personal?.lastName}</p>
                  </div>
                  <span className="text-sm font-extrabold text-slate-900">{g.progressPercentage}%</span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{ width: `${g.progressPercentage}%` }}
                  />
                </div>

                {/* Key Results */}
                <div className="text-xs text-slate-600 space-y-1.5 pt-2 border-t">
                  <p className="font-semibold text-slate-700">Key Results:</p>
                  {g.keyResults?.map((kr, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100">
                      <span>{kr.title}</span>
                      <span className="font-bold text-slate-800">{kr.currentValue} / {kr.targetValue} {kr.unit}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
                  <span>Due: {new Date(g.dueDate).toLocaleDateString()}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">Status: {g.status}</span>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      )}

      {/* TAB 6: 1:1 SYNCS */}
      {activeTab === 'one_on_ones' && (
        <Card className="p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Continuous 1:1 Check-ins</h3>
              <p className="text-xs text-slate-500">Structured manager-employee syncs with private and shared notes.</p>
            </div>
            <Button onClick={() => setOneOnOneModalOpen(true)} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white">
              <Plus className="w-4 h-4" /> Schedule 1:1
            </Button>
          </div>

          <div className="space-y-3">
            {oneOnOnes.map((m) => (
              <div key={m._id} className="p-4 rounded-xl border border-slate-200 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div>
                  <h4 className="font-semibold text-slate-900">
                    Sync with {m.employee?.personal?.firstName} {m.employee?.personal?.lastName}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Date: {new Date(m.meetingDate).toLocaleString()} • Agenda: {m.agenda || 'Regular sync'}
                  </p>
                </div>
                <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* TAB 7: KUDOS & FEEDBACK */}
      {activeTab === 'feedback' && (
        <Card className="p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Studio Kudos & Continuous Praise</h3>
              <p className="text-xs text-slate-500">Recognize peers and align work with studio values.</p>
            </div>
            <Button onClick={() => setFeedbackModalOpen(true)} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white">
              <ThumbsUp className="w-4 h-4" /> Give Praise
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {feedbacks.map((f) => (
              <div key={f._id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
                    {f.valueTags?.join(', ') || 'Studio Kudos'}
                  </span>
                  <span className="text-[10px] text-slate-400">{new Date(f.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-slate-800 leading-relaxed font-medium">"{f.message}"</p>
                <div className="text-xs text-slate-500 pt-2 border-t flex items-center justify-between">
                  <span>To: <strong>{f.toEmployee?.personal?.firstName} {f.toEmployee?.personal?.lastName}</strong></span>
                  <span>From: {f.fromEmployee?.personal?.firstName}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* TAB 8: CALIBRATION (HR / SUPER ADMIN) */}
      {activeTab === 'calibration' && isHR && (
        <Card className="p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Appraisal Calibration Hub</h3>
              <p className="text-xs text-slate-500">
                Calibrate ratings across departments to ensure fairness. Every calibration change requires a recorded reason and is audit logged.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-semibold border-b">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Manager Rating</th>
                  <th className="py-3 px-4">Calibrated Rating</th>
                  <th className="py-3 px-4">Calibration Reason</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reviews.map((rev) => (
                  <tr key={rev._id}>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {rev.employee?.personal?.firstName} {rev.employee?.personal?.lastName}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {rev.managerReview?.finalOverallRating || '—'} / 5.0
                    </td>
                    <td className="py-3 px-4 font-extrabold text-brand-600">
                      {rev.calibration?.calibratedRating ? `${rev.calibration.calibratedRating} / 5.0` : '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 max-w-xs truncate">
                      {rev.calibration?.calibrationReason || 'No adjustments'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedReview(rev);
                          setCalibrationForm({
                            calibratedRating: rev.managerReview?.finalOverallRating || 3,
                            reason: '',
                          });
                          setCalibrationModalOpen(true);
                        }}
                      >
                        Calibrate
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 9: SETTINGS */}
      {activeTab === 'settings' && isSuperAdmin && (
        <Card className="p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="border-b pb-4">
            <h3 className="text-base font-bold text-slate-900">Performance Engine Settings</h3>
            <p className="text-xs text-slate-500">Configure global rating scales, calibration rules, and privacy controls.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Chart Privacy Threshold (Min Group Size)
              </label>
              <input
                type="number"
                value={settings?.minGroupSizeForCharts || 3}
                disabled
                className="w-full border rounded-lg p-2.5 bg-slate-100 text-slate-700 text-sm font-medium"
              />
              <p className="text-xs text-slate-500 mt-1">
                Mandatory rule: Departments or groups with fewer than 3 people are suppressed in analytics to avoid exposing individuals.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Retention Period (Years after exit)
              </label>
              <input
                type="number"
                value={settings?.retentionYears || 3}
                disabled
                className="w-full border rounded-lg p-2.5 bg-slate-100 text-slate-700 text-sm font-medium"
              />
              <p className="text-xs text-slate-500 mt-1">Default 3 years; anonymisation managed by Super Admin.</p>
            </div>
          </div>
        </Card>
      )}

      {/* MODALS */}

      {/* Calibration Modal */}
      {calibrationModalOpen && selectedReview && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 bg-white space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900">Calibrate Performance Rating</h3>
              <button onClick={() => setCalibrationModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCalibrate} className="space-y-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">Employee: <strong>{selectedReview.employee?.personal?.firstName} {selectedReview.employee?.personal?.lastName}</strong></p>
                <p className="text-xs text-slate-500">Current Rating: <strong>{selectedReview.managerReview?.finalOverallRating} / 5.0</strong></p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Calibrated Rating (1 - 5)</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  value={calibrationForm.calibratedRating}
                  onChange={(e) => setCalibrationForm({ ...calibrationForm, calibratedRating: e.target.value })}
                  required
                  className="w-full border rounded-lg p-2.5"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mandatory Calibration Reason *</label>
                <textarea
                  value={calibrationForm.reason}
                  onChange={(e) => setCalibrationForm({ ...calibrationForm, reason: e.target.value })}
                  required
                  placeholder="Explain why this evaluation is being calibrated across departments..."
                  rows={3}
                  className="w-full border rounded-lg p-2.5"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setCalibrationModalOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white">Save Calibration</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Goal Modal */}
      {goalModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 bg-white space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900">Create OKR Goal</h3>
              <button onClick={() => setGoalModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateGoal} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Goal Title *</label>
                <input
                  type="text"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                  required
                  placeholder="e.g. Lead Brand Redesign & Design System rollout"
                  className="w-full border rounded-lg p-2.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
                  <select
                    value={newGoal.type}
                    onChange={(e) => setNewGoal({ ...newGoal, type: e.target.value })}
                    className="w-full border rounded-lg p-2.5"
                  >
                    <option value="individual">Individual</option>
                    <option value="team">Team</option>
                    <option value="company">Company</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Due Date *</label>
                  <input
                    type="date"
                    value={newGoal.dueDate}
                    onChange={(e) => setNewGoal({ ...newGoal, dueDate: e.target.value })}
                    required
                    className="w-full border rounded-lg p-2.5"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Key Result 1</label>
                <input
                  type="text"
                  value={newGoal.keyResults[0]?.title || ''}
                  onChange={(e) => {
                    const krs = [...newGoal.keyResults];
                    krs[0].title = e.target.value;
                    setNewGoal({ ...newGoal, keyResults: krs });
                  }}
                  required
                  placeholder="e.g. Complete 100% component library in Figma"
                  className="w-full border rounded-lg p-2.5"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setGoalModalOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">Submit Goal</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Performance;
