import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  Briefcase,
  Search,
  Plus,
  LayoutGrid,
  List,
  Calendar,
  Users,
  Building2,
  Clock,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Filter,
  X,
  Loader2,
  DollarSign,
  ChevronRight,
} from 'lucide-react';

const STATUS_CONFIG = {
  planning: { label: 'Planning', bg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200' },
  active: { label: 'Active', bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200' },
  on_hold: { label: 'On Hold', bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200' },
  completed: { label: 'Completed', bg: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200' },
  cancelled: { label: 'Cancelled', bg: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-300' },
};

const PRIORITY_BADGES = {
  urgent: 'text-red-700 bg-red-50 border-red-200 dark:bg-red-950/40 dark:text-red-400',
  high: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400',
  medium: 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400',
  low: 'text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:text-slate-400',
};

export const Projects = () => {
  const { user, hasPermission } = useAuth();
  const [projects, setProjects] = useState([]);
  const [summary, setSummary] = useState(null);
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');

  // Multi-step Create Project Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    client: '',
    type: 'website',
    projectManager: '',
    priority: 'medium',
    startDate: '',
    dueDate: '',
    description: '',
    tags: '',
    members: [],
    budgetAmountINR: '',
    estimatedHours: '',
    milestones: [],
  });

  const canCreate = hasPermission('project.create');
  const canViewBudget = hasPermission('project.viewBudget');

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (clientFilter) params.client = clientFilter;

      const [projRes, sumRes] = await Promise.all([
        api.get('/projects', { params }),
        api.get('/projects/summary'),
      ]);

      if (projRes.success) setProjects(projRes.data.projects || []);
      if (sumRes.success) setSummary(sumRes.data);
    } catch (err) {
      console.error('Failed to load projects', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuxiliaryData = async () => {
    try {
      const [cliRes, empRes] = await Promise.all([
        api.get('/clients', { params: { limit: 100 } }),
        api.get('/employees', { params: { limit: 100 } }),
      ]);
      if (cliRes.success) setClients(cliRes.data.clients || []);
      if (empRes.success) setEmployees(empRes.data.employees || []);
    } catch (err) {
      console.error('Error fetching auxiliary data', err);
    }
  };

  useEffect(() => {
    fetchAuxiliaryData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProjects();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, statusFilter, clientFilter]);

  const handleAddMemberRow = () => {
    setNewProject((prev) => ({
      ...prev,
      members: [
        ...prev.members,
        { employee: '', roleInProject: 'Team Member', allocationPercent: 100, billingRatePerHourINR: 500 },
      ],
    }));
  };

  const handleRemoveMemberRow = (index) => {
    setNewProject((prev) => ({
      ...prev,
      members: prev.members.filter((_, i) => i !== index),
    }));
  };

  const handleAddMilestoneRow = () => {
    setNewProject((prev) => ({
      ...prev,
      milestones: [
        ...prev.milestones,
        { name: '', dueDate: '', amountINR: 0, status: 'pending' },
      ],
    }));
  };

  const handleRemoveMilestoneRow = (index) => {
    setNewProject((prev) => ({
      ...prev,
      milestones: prev.milestones.filter((_, i) => i !== index),
    }));
  };

  const handleCreateProjectSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      const payload = {
        name: newProject.name,
        client: newProject.client,
        type: newProject.type,
        projectManager: newProject.projectManager,
        priority: newProject.priority,
        description: newProject.description,
        startDate: newProject.startDate || undefined,
        dueDate: newProject.dueDate || undefined,
        tags: newProject.tags
          ? newProject.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
        members: newProject.members
          .filter((m) => m.employee)
          .map((m) => ({
            employee: m.employee,
            roleInProject: m.roleInProject,
            allocationPercent: Number(m.allocationPercent) || 100,
            billingRatePerHour: Math.round((Number(m.billingRatePerHourINR) || 0) * 100), // convert to paise
          })),
        milestones: newProject.milestones
          .filter((ms) => ms.name)
          .map((ms) => ({
            name: ms.name,
            dueDate: ms.dueDate || undefined,
            amount: Math.round((Number(ms.amountINR) || 0) * 100), // convert to paise
            status: ms.status || 'pending',
          })),
      };

      if (newProject.budgetAmountINR) {
        payload.budget = {
          amount: Math.round(Number(newProject.budgetAmountINR) * 100), // convert to paise
          currency: 'INR',
          estimatedHours: Number(newProject.estimatedHours) || 0,
        };
      }

      const res = await api.post('/projects', payload);
      if (res.success) {
        setIsCreateOpen(false);
        setCurrentStep(1);
        fetchProjects();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create project');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Briefcase className="w-6 h-6 text-brand-600" />
            Projects & Engagements
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Design & tech client contracts, project lifecycles, deliverables, and team allocation
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => {
              setCurrentStep(1);
              setIsCreateOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        )}
      </div>

      {/* KPI Stats Strip */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase">Active Projects</span>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {summary.statusCounts?.active || 0}
              </div>
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 flex items-center justify-center font-bold">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase">Total Contracts</span>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {summary.statusCounts?.total || 0}
              </div>
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase">Active Tasks</span>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {summary.activeTasksCount || 0}
              </div>
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 dark:bg-red-950/50 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase">Overdue Tasks</span>
              <div className="text-xl font-bold text-red-600 dark:text-red-400">
                {summary.overdueTasksCount || 0}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter and View Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search projects by code, title, tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { key: '', label: 'All' },
            { key: 'planning', label: 'Planning' },
            { key: 'active', label: 'Active' },
            { key: 'on_hold', label: 'On Hold' },
            { key: 'completed', label: 'Completed' },
          ].map((st) => (
            <button
              key={st.key}
              onClick={() => setStatusFilter(st.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === st.key
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-800 text-brand-600 shadow-xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-800 text-brand-600 shadow-xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center text-slate-400 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600 mb-2" />
          <p className="text-sm">Loading studio projects...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="p-16 text-center text-slate-400 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <Briefcase className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-base font-semibold text-slate-700 dark:text-slate-300">No projects found</p>
          <p className="text-sm mt-1">Create your first client project contract to begin managing deliverables.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p) => {
            const stConfig = STATUS_CONFIG[p.status] || STATUS_CONFIG.planning;
            const isOverdue =
              p.dueDate && p.status !== 'completed' && new Date(p.dueDate) < new Date();

            return (
              <Link
                key={p._id}
                to={`/projects/${p._id}`}
                className="block bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs hover:shadow-lg hover:border-brand-500/60 dark:hover:border-brand-500/60 transition-all group flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Code, Priority, Status */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {p.projectCode}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                          PRIORITY_BADGES[p.priority] || PRIORITY_BADGES.medium
                        }`}
                      >
                        {p.priority}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase border ${stConfig.bg}`}
                      >
                        {stConfig.label}
                      </span>
                    </div>
                  </div>

                  {/* Project Title & Client */}
                  <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors line-clamp-2 leading-snug">
                    {p.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 truncate">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{p.client?.name || 'Internal Project'}</span>
                  </p>

                  {/* Description snippet */}
                  {p.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2.5 line-clamp-2 leading-relaxed">
                      {p.description}
                    </p>
                  )}
                </div>

                {/* Bottom Section */}
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700/60 space-y-3">
                  {/* Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500 font-medium">Progress</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {p.progressPercent || 0}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-brand-600 h-full rounded-full transition-all"
                        style={{ width: `${p.progressPercent || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Dates & Team Avatars */}
                  <div className="flex items-center justify-between text-xs">
                    <div
                      className={`flex items-center gap-1 font-medium ${
                        isOverdue ? 'text-red-600 font-bold' : 'text-slate-500'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {p.dueDate
                          ? new Date(p.dueDate).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'No Date'}
                      </span>
                      {isOverdue && <span className="text-[10px] text-red-600">(Overdue)</span>}
                    </div>

                    {/* Team Members */}
                    <div className="flex items-center -space-x-1.5">
                      {p.members && p.members.length > 0 ? (
                        p.members.slice(0, 4).map((m) => (
                          <div
                            key={m._id}
                            className="w-6 h-6 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 text-white font-bold text-[10px] flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-xs"
                            title={`${m.employee?.personal?.firstName || 'Member'} (${m.roleInProject})`}
                          >
                            {m.employee?.personal?.firstName?.charAt(0) || 'M'}
                          </div>
                        ))
                      ) : (
                        <span className="text-[11px] text-slate-400">No team</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/75 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Code</th>
                  <th className="py-3.5 px-4">Project Name</th>
                  <th className="py-3.5 px-4">Client</th>
                  <th className="py-3.5 px-4">Manager</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Progress</th>
                  <th className="py-3.5 px-4">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {projects.map((p) => {
                  const stConfig = STATUS_CONFIG[p.status] || STATUS_CONFIG.planning;
                  const isOverdue =
                    p.dueDate && p.status !== 'completed' && new Date(p.dueDate) < new Date();

                  return (
                    <tr
                      key={p._id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors cursor-pointer group"
                      onClick={() => (window.location.href = `/projects/${p._id}`)}
                    >
                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-brand-600">
                        {p.projectCode}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors">
                        {p.name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {p.client?.name || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {p.projectManager?.personal?.firstName
                          ? `${p.projectManager.personal.firstName} ${p.projectManager.personal.lastName}`
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                            PRIORITY_BADGES[p.priority] || PRIORITY_BADGES.medium
                          }`}
                        >
                          {p.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase border ${stConfig.bg}`}
                        >
                          {stConfig.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-brand-600 h-full rounded-full"
                              style={{ width: `${p.progressPercent || 0}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {p.progressPercent || 0}%
                          </span>
                        </div>
                      </td>
                      <td
                        className={`py-3.5 px-4 text-xs font-medium ${
                          isOverdue ? 'text-red-600 font-bold' : 'text-slate-500'
                        }`}
                      >
                        {p.dueDate ? new Date(p.dueDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Multi-Step Create Project Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Create New Client Project
                </h3>
                <span className="text-xs text-slate-400">Step {currentStep} of {canViewBudget ? 3 : 2}</span>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Wizard Indicator */}
            <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs font-semibold">
              <span
                className={`flex items-center gap-1.5 ${
                  currentStep === 1 ? 'text-brand-600 font-bold' : 'text-slate-400'
                }`}
              >
                1. Project Basics
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
              <span
                className={`flex items-center gap-1.5 ${
                  currentStep === 2 ? 'text-brand-600 font-bold' : 'text-slate-400'
                }`}
              >
                2. Team Allocation
              </span>
              {canViewBudget && (
                <>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                  <span
                    className={`flex items-center gap-1.5 ${
                      currentStep === 3 ? 'text-brand-600 font-bold' : 'text-slate-400'
                    }`}
                  >
                    3. Budget & Milestones
                  </span>
                </>
              )}
            </div>

            <form onSubmit={handleCreateProjectSubmit} className="p-6 space-y-4">
              {/* Step 1: Basics */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Project Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Odisha Tourism Experience Portal"
                      value={newProject.name}
                      onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Client *
                      </label>
                      <select
                        required
                        value={newProject.client}
                        onChange={(e) => setNewProject({ ...newProject, client: e.target.value })}
                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                      >
                        <option value="">Select Client Organization</option>
                        {clients.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Project Type
                      </label>
                      <select
                        value={newProject.type}
                        onChange={(e) => setNewProject({ ...newProject, type: e.target.value })}
                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm capitalize focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                      >
                        {['website', 'branding', 'app', 'social_media', 'marketing', 'video', 'other'].map(
                          (t) => (
                            <option key={t} value={t}>
                              {t.replace('_', ' ')}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Project Manager *
                      </label>
                      <select
                        required
                        value={newProject.projectManager}
                        onChange={(e) => setNewProject({ ...newProject, projectManager: e.target.value })}
                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                      >
                        <option value="">Select Project Lead</option>
                        {employees.map((emp) => (
                          <option key={emp._id} value={emp._id}>
                            {emp.personal?.firstName} {emp.personal?.lastName} ({emp.employment?.designation})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Priority Level
                      </label>
                      <select
                        value={newProject.priority}
                        onChange={(e) => setNewProject({ ...newProject, priority: e.target.value })}
                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm capitalize focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                      >
                        {['low', 'medium', 'high', 'urgent'].map((pr) => (
                          <option key={pr} value={pr}>
                            {pr}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Kickoff Start Date
                      </label>
                      <input
                        type="date"
                        value={newProject.startDate}
                        onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Target Due Date
                      </label>
                      <input
                        type="date"
                        value={newProject.dueDate}
                        onChange={(e) => setNewProject({ ...newProject, dueDate: e.target.value })}
                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Description & Scope
                    </label>
                    <textarea
                      rows="3"
                      placeholder="Outline client deliverables, tech stack, and goals..."
                      value={newProject.description}
                      onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Team Members */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Assigned Team Members ({newProject.members.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddMemberRow}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Member
                    </button>
                  </div>

                  {newProject.members.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                      No team members added yet. Click &quot;Add Member&quot; to assign specialists.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {newProject.members.map((m, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-2.5"
                        >
                          <select
                            required
                            value={m.employee}
                            onChange={(e) => {
                              const updated = [...newProject.members];
                              updated[idx].employee = e.target.value;
                              setNewProject({ ...newProject, members: updated });
                            }}
                            className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:text-white"
                          >
                            <option value="">Select Employee</option>
                            {employees.map((emp) => (
                              <option key={emp._id} value={emp._id}>
                                {emp.personal?.firstName} {emp.personal?.lastName}
                              </option>
                            ))}
                          </select>

                          <input
                            type="text"
                            placeholder="Role in Project (e.g. UI Designer)"
                            value={m.roleInProject}
                            onChange={(e) => {
                              const updated = [...newProject.members];
                              updated[idx].roleInProject = e.target.value;
                              setNewProject({ ...newProject, members: updated });
                            }}
                            className="w-36 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:text-white"
                          />

                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="10"
                              max="100"
                              value={m.allocationPercent}
                              onChange={(e) => {
                                const updated = [...newProject.members];
                                updated[idx].allocationPercent = e.target.value;
                                setNewProject({ ...newProject, members: updated });
                              }}
                              className="w-16 px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-center dark:text-white"
                            />
                            <span className="text-xs text-slate-400">%</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveMemberRow(idx)}
                            className="p-1 text-slate-400 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Budget and Milestones (visible only if permitted) */}
              {currentStep === 3 && canViewBudget && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Contract Budget Amount (₹ INR)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 750000"
                        value={newProject.budgetAmountINR}
                        onChange={(e) => setNewProject({ ...newProject, budgetAmountINR: e.target.value })}
                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Estimated Hours
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 420"
                        value={newProject.estimatedHours}
                        onChange={(e) => setNewProject({ ...newProject, estimatedHours: e.target.value })}
                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Contract Milestones ({newProject.milestones.length})
                      </span>
                      <button
                        type="button"
                        onClick={handleAddMilestoneRow}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Milestone
                      </button>
                    </div>

                    <div className="space-y-2">
                      {newProject.milestones.map((ms, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-2"
                        >
                          <input
                            type="text"
                            required
                            placeholder="Milestone Deliverable Name"
                            value={ms.name}
                            onChange={(e) => {
                              const updated = [...newProject.milestones];
                              updated[idx].name = e.target.value;
                              setNewProject({ ...newProject, milestones: updated });
                            }}
                            className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:text-white"
                          />
                          <input
                            type="date"
                            value={ms.dueDate}
                            onChange={(e) => {
                              const updated = [...newProject.milestones];
                              updated[idx].dueDate = e.target.value;
                              setNewProject({ ...newProject, milestones: updated });
                            }}
                            className="w-32 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:text-white"
                          />
                          <input
                            type="number"
                            placeholder="Amount (₹)"
                            value={ms.amountINR}
                            onChange={(e) => {
                              const updated = [...newProject.milestones];
                              updated[idx].amountINR = e.target.value;
                              setNewProject({ ...newProject, milestones: updated });
                            }}
                            className="w-24 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveMilestoneRow(idx)}
                            className="p-1 text-slate-400 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Wizard Footer Controls */}
              <div className="pt-4 flex items-center justify-between border-t border-slate-200 dark:border-slate-700">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((prev) => prev - 1)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                  >
                    Back
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  {(currentStep < (canViewBudget ? 3 : 2)) ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!newProject.name || !newProject.client || !newProject.projectManager) {
                          alert('Please fill all required project fields');
                          return;
                        }
                        setCurrentStep((prev) => prev + 1);
                      }}
                      className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold transition-colors"
                    >
                      Next Step
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={formSubmitting}
                      className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                      {formSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Create Project
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
