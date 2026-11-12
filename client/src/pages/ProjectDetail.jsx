import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { KanbanBoard } from '../components/KanbanBoard';
import { TaskModal } from '../components/TaskModal';
import {
  Briefcase,
  Calendar,
  Building2,
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  Kanban,
  List,
  Paperclip,
  Activity,
  Plus,
  ArrowLeft,
  ChevronRight,
  Loader2,
  Upload,
  X,
  DollarSign,
  Flag,
} from 'lucide-react';

export const ProjectDetail = () => {
  const { id } = useParams();
  const { user, hasPermission } = useAuth();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('board'); // 'overview' | 'board' | 'list' | 'team' | 'milestones' | 'files'
  const [allEmployees, setAllEmployees] = useState([]);

  // Task Modal state
  const [activeTaskId, setActiveTaskId] = useState(null);

  // Quick Add Task Modal state
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [addTaskStatus, setAddTaskStatus] = useState('todo');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskAssignees, setNewTaskAssignees] = useState([]);
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);

  // Add Member Modal state
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [newMemberEmpId, setNewMemberEmpId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('Team Member');
  const [newMemberAlloc, setNewMemberAlloc] = useState(100);

  // Add Milestone Modal state
  const [isAddMilestoneOpen, setIsAddMilestoneOpen] = useState(false);
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');
  const [newMilestoneAmountINR, setNewMilestoneAmountINR] = useState('');

  const canManageMembers = hasPermission('project.manageMembers');
  const canUpdateProject = hasPermission('project.update');
  const canCreateTask = hasPermission('task.create');
  const canViewBudget = hasPermission('project.viewBudget');

  const fetchProjectData = async () => {
    try {
      setLoading(true);
      const [projRes, tasksRes, empRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get('/tasks', { params: { project: id, limit: 100 } }),
        api.get('/employees', { params: { limit: 100 } }),
      ]);

      if (projRes.success) setProject(projRes.data);
      if (tasksRes.success) setTasks(tasksRes.data.tasks || []);
      if (empRes.success) setAllEmployees(empRes.data.employees || []);
    } catch (err) {
      console.error('Failed to load project details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchProjectData();
    }
  }, [id]);

  const handleStatusChange = async (newStatus) => {
    try {
      const res = await api.patch(`/projects/${project._id}/status`, { status: newStatus });
      if (res.success) {
        setProject((prev) => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleTaskMove = async (taskId, newStatus) => {
    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      const res = await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
      if (res.success) {
        // Refresh project data to sync recalculated progressPercent
        const projRes = await api.get(`/projects/${id}`);
        if (projRes.success) setProject(projRes.data);
      }
    } catch (err) {
      console.error('Failed to update task status', err);
      fetchProjectData();
    }
  };

  const handleOpenAddTask = (status = 'todo') => {
    setAddTaskStatus(status);
    setNewTaskTitle('');
    setNewTaskPriority('medium');
    setNewTaskAssignees([]);
    setNewTaskDueDate('');
    setIsAddTaskOpen(true);
  };

  const handleCreateTaskSubmit = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    setIsAddingTask(true);
    try {
      const res = await api.post('/tasks', {
        title: newTaskTitle.trim(),
        project: project._id,
        status: addTaskStatus,
        priority: newTaskPriority,
        assignees: newTaskAssignees,
        dueDate: newTaskDueDate || undefined,
      });

      if (res.success) {
        setIsAddTaskOpen(false);
        fetchProjectData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create task');
    } finally {
      setIsAddingTask(false);
    }
  };

  const handleAddMemberSubmit = async (e) => {
    e.preventDefault();
    if (!newMemberEmpId) return;

    try {
      const res = await api.post(`/projects/${project._id}/members`, {
        employeeId: newMemberEmpId,
        roleInProject: newMemberRole,
        allocationPercent: Number(newMemberAlloc) || 100,
      });

      if (res.success) {
        setIsAddMemberOpen(false);
        fetchProjectData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (empId) => {
    if (!window.confirm('Remove this member from the project?')) return;
    try {
      const res = await api.delete(`/projects/${project._id}/members/${empId}`);
      if (res.success) {
        fetchProjectData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleAddMilestoneSubmit = async (e) => {
    e.preventDefault();
    if (!newMilestoneName) return;

    try {
      const res = await api.post(`/projects/${project._id}/milestones`, {
        name: newMilestoneName,
        dueDate: newMilestoneDate || undefined,
        amount: Math.round((Number(newMilestoneAmountINR) || 0) * 100), // paise
      });

      if (res.success) {
        setIsAddMilestoneOpen(false);
        fetchProjectData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add milestone');
    }
  };

  const handleToggleMilestone = async (milestone) => {
    const nextStatus = milestone.status === 'done' ? 'pending' : 'done';
    try {
      const res = await api.put(
        `/projects/${project._id}/milestones/${milestone._id}`,
        { status: nextStatus }
      );
      if (res.success) {
        fetchProjectData();
      }
    } catch (err) {
      console.error('Failed to toggle milestone', err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post(`/projects/${project._id}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.success) {
        fetchProjectData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Upload failed');
    }
  };

  if (loading || !project) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600 mb-2" />
        <p className="text-sm">Loading project workspace...</p>
      </div>
    );
  }

  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const overdueTasks = tasks.filter(
    (t) => t.dueDate && t.status !== 'done' && new Date(t.dueDate) < new Date()
  ).length;

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link to="/projects" className="hover:text-brand-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Projects
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
          {project.projectCode}
        </span>
      </div>

      {/* Main Project Header Banner */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
              {project.projectCode}
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {project.type}
            </span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full uppercase bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              {project.priority} Priority
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {project.name}
          </h1>

          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
            {project.client && (
              <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                <Building2 className="w-4 h-4 text-slate-400" />
                {project.client.name}
              </span>
            )}
            {project.projectManager && (
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-400" />
                Lead:{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {project.projectManager.personal?.firstName} {project.projectManager.personal?.lastName}
                </span>
              </span>
            )}
            {project.dueDate && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                Due: {new Date(project.dueDate).toLocaleDateString('en-IN')}
              </span>
            )}
          </div>
        </div>

        {/* Right Side Status & Progress */}
        <div className="flex items-center gap-5 self-start lg:self-auto">
          <div className="text-right">
            <span className="text-xs text-slate-400 font-semibold block mb-1">Status</span>
            <select
              value={project.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 capitalize focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white shadow-xs"
            >
              {['planning', 'active', 'on_hold', 'completed', 'cancelled'].map((st) => (
                <option key={st} value={st}>
                  {st.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="w-24 text-center">
            <div className="text-2xl font-black text-brand-600 dark:text-brand-400">
              {project.progressPercent || 0}%
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className="bg-brand-600 h-full rounded-full transition-all"
                style={{ width: `${project.progressPercent || 0}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold mt-0.5 block">
              {doneTasks}/{tasks.length} Done
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4 overflow-x-auto">
        <div className="flex items-center gap-2">
          {[
            { key: 'board', label: 'Kanban Board', icon: Kanban },
            { key: 'list', label: 'Task List', icon: List },
            { key: 'overview', label: 'Overview & Scope', icon: Briefcase },
            { key: 'team', label: `Team (${project.members?.length || 0})`, icon: Users },
            { key: 'milestones', label: `Milestones (${project.milestones?.length || 0})`, icon: Flag },
            { key: 'files', label: `Files (${project.attachments?.length || 0})`, icon: Paperclip },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 transition-colors relative whitespace-nowrap ${
                  isActive
                    ? 'text-brand-600 dark:text-brand-400 font-bold'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {canCreateTask && (
          <button
            onClick={() => handleOpenAddTask('todo')}
            className="mb-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" /> New Task
          </button>
        )}
      </div>

      {/* TAB 1: KANBAN BOARD */}
      {activeTab === 'board' && (
        <KanbanBoard
          tasks={tasks}
          onTaskClick={(t) => setActiveTaskId(t._id)}
          onTaskMove={handleTaskMove}
          onAddTask={handleOpenAddTask}
        />
      )}

      {/* TAB 2: TASK LIST */}
      {activeTab === 'list' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/75 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Code</th>
                  <th className="py-3.5 px-4">Title</th>
                  <th className="py-3.5 px-4">Assignees</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Checklist</th>
                  <th className="py-3.5 px-4">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {tasks.map((t) => {
                  const checklistDone = (t.checklist || []).filter((c) => c.done).length;
                  const checklistTotal = (t.checklist || []).length;
                  const isOverdue =
                    t.dueDate && t.status !== 'done' && new Date(t.dueDate) < new Date();

                  return (
                    <tr
                      key={t._id}
                      onClick={() => setActiveTaskId(t._id)}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-mono text-xs font-bold text-brand-600">
                        {t.taskCode}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors">
                        {t.title}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center -space-x-1.5">
                          {(t.assignees || []).map((emp) => (
                            <div
                              key={emp._id}
                              className="w-6 h-6 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 text-white font-bold text-[10px] flex items-center justify-center border-2 border-white dark:border-slate-800"
                              title={`${emp.personal?.firstName}`}
                            >
                              {emp.personal?.firstName?.charAt(0)}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {t.priority}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                          {t.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {checklistTotal > 0 ? `${checklistDone}/${checklistTotal}` : '—'}
                      </td>
                      <td
                        className={`py-3 px-4 text-xs font-medium ${
                          isOverdue ? 'text-red-600 font-bold' : 'text-slate-500'
                        }`}
                      >
                        {t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: OVERVIEW & SCOPE */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider text-slate-400">
                Scope of Work & Objectives
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {project.description || 'No detailed scope description provided.'}
              </p>

              {project.tags && project.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-700">
                  {project.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                <span className="text-xs text-slate-400 font-semibold uppercase">Total Tasks</span>
                <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {tasks.length}
                </div>
              </div>
              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                <span className="text-xs text-slate-400 font-semibold uppercase">Done Tasks</span>
                <div className="text-xl font-bold text-emerald-600 mt-1">{doneTasks}</div>
              </div>
              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                <span className="text-xs text-slate-400 font-semibold uppercase">Overdue Tasks</span>
                <div className="text-xl font-bold text-red-600 mt-1">{overdueTasks}</div>
              </div>
              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                <span className="text-xs text-slate-400 font-semibold uppercase">Team Size</span>
                <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {project.members?.length || 0}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Financials & Budget (Masked if not authorized) */}
          <div className="space-y-6">
            {canViewBudget && project.budget ? (
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-brand-600" />
                  Budget & Financials
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-slate-500">Contract Value</span>
                    <span className="font-bold text-base text-slate-900 dark:text-white">
                      ₹{((project.budget.amount || 0) / 100).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-slate-500">Estimated Hours</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {project.budget.estimatedHours || 0} hrs
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs py-1">
                    <span className="text-slate-500">Currency</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {project.budget.currency || 'INR'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400">
                <Clock className="w-6 h-6 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                Financial data restricted to Project Managers & Admin roles.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: TEAM */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Project Members & Allocations</h3>
            {canManageMembers && (
              <button
                onClick={() => setIsAddMemberOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Add Team Member
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(project.members || []).map((m) => (
              <div
                key={m._id}
                className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white font-bold text-sm flex items-center justify-center">
                    {m.employee?.personal?.firstName?.charAt(0) || 'M'}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      {m.employee?.personal?.firstName} {m.employee?.personal?.lastName}
                    </h4>
                    <span className="text-xs text-brand-600 dark:text-brand-400 font-semibold block">
                      {m.roleInProject}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {m.allocationPercent || 100}% allocation
                    </span>
                  </div>
                </div>

                {canManageMembers && (
                  <button
                    onClick={() => handleRemoveMember(m.employee?._id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg"
                    title="Remove member"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: MILESTONES */}
      {activeTab === 'milestones' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Contract Milestones & Deliverables</h3>
            {canUpdateProject && (
              <button
                onClick={() => setIsAddMilestoneOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Add Milestone
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {(project.milestones || []).map((ms) => (
              <div
                key={ms._id}
                className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={ms.status === 'done'}
                    onChange={() => handleToggleMilestone(ms)}
                    className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                  />
                  <div>
                    <h4
                      className={`text-sm font-semibold ${
                        ms.status === 'done'
                          ? 'line-through text-slate-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {ms.name}
                    </h4>
                    {ms.dueDate && (
                      <span className="text-xs text-slate-400">
                        Target: {new Date(ms.dueDate).toLocaleDateString('en-IN')}
                      </span>
                    )}
                  </div>
                </div>

                {canViewBudget && ms.amount !== undefined && (
                  <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                    ₹{((ms.amount || 0) / 100).toLocaleString('en-IN')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: FILES */}
      {activeTab === 'files' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Project Files & Attachments</h3>
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> Upload File
              <input type="file" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          {(project.attachments || []).length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
              No files uploaded for this project yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(project.attachments || []).map((att) => (
                <a
                  key={att._id}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand-500 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Paperclip className="w-4 h-4 text-slate-400 group-hover:text-brand-600" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {att.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-brand-600 font-bold uppercase">View</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Task Modal Drawer */}
      {activeTaskId && (
        <TaskModal
          taskId={activeTaskId}
          onClose={() => setActiveTaskId(null)}
          onTaskUpdated={fetchProjectData}
          allEmployees={allEmployees}
        />
      )}

      {/* Quick Add Task Modal */}
      {isAddTaskOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Add Task to {project.name}
              </h3>
              <button onClick={() => setIsAddTaskOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTaskSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Design responsive hero component"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:text-white capitalize"
                  >
                    {['low', 'medium', 'high', 'urgent'].map((pr) => (
                      <option key={pr} value={pr}>
                        {pr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsAddTaskOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingTask}
                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold"
                >
                  {isAddingTask ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Add Project Team Member</h3>
            <form onSubmit={handleAddMemberSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Employee
                </label>
                <select
                  required
                  value={newMemberEmpId}
                  onChange={(e) => setNewMemberEmpId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                >
                  <option value="">Select Employee</option>
                  {allEmployees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.personal?.firstName} {emp.personal?.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Role in Project
                </label>
                <input
                  type="text"
                  placeholder="e.g. Frontend Specialist"
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-brand-600 text-white rounded-xl text-xs font-semibold"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Milestone Modal */}
      {isAddMilestoneOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Add Project Milestone</h3>
            <form onSubmit={handleAddMilestoneSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Milestone Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Beta Release & Client UAT"
                  value={newMilestoneName}
                  onChange={(e) => setNewMilestoneName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Due Date
                </label>
                <input
                  type="date"
                  value={newMilestoneDate}
                  onChange={(e) => setNewMilestoneDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                />
              </div>

              {canViewBudget && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Milestone Amount (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 150000"
                    value={newMilestoneAmountINR}
                    onChange={(e) => setNewMilestoneAmountINR(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddMilestoneOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-brand-600 text-white rounded-xl text-xs font-semibold"
                >
                  Add Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;

