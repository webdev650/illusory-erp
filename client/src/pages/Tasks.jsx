import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { TaskModal } from '../components/TaskModal';
import {
  CheckSquare,
  Search,
  Plus,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Loader2,
  ArrowRight,
  Briefcase,
  Play,
  RotateCcw,
} from 'lucide-react';

const PRIORITY_BADGES = {
  urgent: 'text-red-700 bg-red-50 border-red-200 dark:bg-red-950/40 dark:text-red-400',
  high: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400',
  medium: 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400',
  low: 'text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:text-slate-400',
};

export const Tasks = () => {
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('all'); // 'today' | 'thisWeek' | 'overdue' | 'all'
  const [data, setData] = useState({
    today: [],
    thisWeek: [],
    overdue: [],
    all: [],
    stats: { total: 0, completed: 0, pending: 0, overdue: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [activeTaskId, setActiveTaskId] = useState(null);

  const fetchMyTasks = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tasks/my');
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load my tasks', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyTasks();
  }, []);

  const handleQuickStatusChange = async (e, task, newStatus) => {
    e.stopPropagation();
    try {
      const res = await api.patch(`/tasks/${task._id}/status`, { status: newStatus });
      if (res.success) {
        fetchMyTasks();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    }
  };

  const getFilteredTasks = () => {
    let list = data[activeTab] || [];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.taskCode?.toLowerCase().includes(q) ||
          t.project?.name?.toLowerCase().includes(q)
      );
    }

    if (priorityFilter) {
      list = list.filter((t) => t.priority === priorityFilter);
    }

    return list;
  };

  const filteredTasks = getFilteredTasks();

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <CheckSquare className="w-6 h-6 text-brand-600" />
            My Tasks & Deliverables
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Personal deliverables, sprint priorities, checklists, and deadline tracking
          </p>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 flex items-center justify-center font-bold">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase">Total Assigned</span>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {data.stats?.total || 0}
            </div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase">Pending Tasks</span>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {data.stats?.pending || 0}
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
              {data.stats?.overdue || 0}
            </div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase">Completed</span>
            <div className="text-xl font-bold text-emerald-600">
              {data.stats?.completed || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Tab Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          {[
            { key: 'all', label: `All (${data.all?.length || 0})` },
            { key: 'today', label: `Today (${data.today?.length || 0})` },
            { key: 'thisWeek', label: `This Week (${data.thisWeek?.length || 0})` },
            { key: 'overdue', label: `Overdue (${data.overdue?.length || 0})`, isOverdue: true },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? tab.isOverdue
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-brand-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Priority Selector */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs capitalize dark:text-white focus:outline-none"
          >
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Task List Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600 mb-2" />
            <p className="text-sm">Loading your tasks...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <CheckSquare className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-base font-semibold text-slate-700 dark:text-slate-300">No tasks in this view</p>
            <p className="text-sm mt-1">You are completely caught up on your deliverables!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredTasks.map((t) => {
              const checklistDone = (t.checklist || []).filter((c) => c.done).length;
              const checklistTotal = (t.checklist || []).length;
              const isOverdue =
                t.dueDate && t.status !== 'done' && new Date(t.dueDate) < new Date();

              return (
                <div
                  key={t._id}
                  onClick={() => setActiveTaskId(t._id)}
                  className="p-4 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-brand-600">
                        {t.taskCode}
                      </span>
                      {t.project && (
                        <span className="text-xs text-slate-400 font-medium">
                          • {t.project.name}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.2 rounded-full uppercase border ${
                          PRIORITY_BADGES[t.priority] || PRIORITY_BADGES.medium
                        }`}
                      >
                        {t.priority}
                      </span>
                    </div>

                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors">
                      {t.title}
                    </h4>

                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      {t.dueDate && (
                        <span
                          className={`flex items-center gap-1 font-medium ${
                            isOverdue ? 'text-red-600 font-bold' : ''
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          Due: {new Date(t.dueDate).toLocaleDateString('en-IN')}
                          {isOverdue && <span>(Overdue)</span>}
                        </span>
                      )}
                      <span className="flex items-center gap-1 font-medium text-slate-500">
                        <Clock className="w-3.5 h-3.5 text-brand-500" />
                        {t.loggedHours || 0}h / {t.estimatedHours || 0}h
                      </span>
                      {checklistTotal > 0 && (
                        <span>
                          Checklist: {checklistDone}/{checklistTotal}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Action: Status Pill & Quick Transition */}
                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full uppercase bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {t.status.replace('_', ' ')}
                    </span>

                    {/* Quick Move Button */}
                    {t.status !== 'done' && (
                      <button
                        onClick={(e) => handleQuickStatusChange(e, t, 'done')}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Mark as Done"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Done
                      </button>
                    )}

                    {t.status === 'todo' && (
                      <button
                        onClick={(e) => handleQuickStatusChange(e, t, 'in_progress')}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Start Task"
                      >
                        <Play className="w-3 h-3" /> Start
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Task Detail Modal Drawer */}
      {activeTaskId && (
        <TaskModal
          taskId={activeTaskId}
          onClose={() => setActiveTaskId(null)}
          onTaskUpdated={fetchMyTasks}
        />
      )}
    </div>
  );
};

export default Tasks;

