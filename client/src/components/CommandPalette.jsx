import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { ERP_MODULES } from '../config/modules';
import api from '../api/axios';
import {
  Search,
  ArrowRight,
  Briefcase,
  CheckSquare,
  Users,
  Moon,
  Sun,
  Clock,
  Calendar,
  Sparkles,
  Command,
} from 'lucide-react';

export const CommandPalette = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { toggleTheme } = usePreferences();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Dynamic search data (cached or lazy fetched)
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
      return;
    }

    // Fetch searchable items when palette opens
    const fetchSearchData = async () => {
      try {
        const [projRes, taskRes] = await Promise.all([
          api.get('/projects?limit=20').catch(() => ({ success: false })),
          api.get('/tasks?limit=25').catch(() => ({ success: false })),
        ]);
        if (projRes.success && projRes.data?.projects) {
          setProjects(projRes.data.projects);
        }
        if (taskRes.success && taskRes.data?.tasks) {
          setTasks(taskRes.data.tasks);
        }
      } catch {
        //
      }
    };
    fetchSearchData();
  }, [isOpen]);

  // Build searchable items list
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [];

    // 1. Pages & Modules
    ERP_MODULES.forEach((mod) => {
      if (mod.requiredPermission) {
        if (Array.isArray(mod.requiredPermission)) {
          if (!mod.requiredPermission.some((p) => hasPermission(p))) return;
        } else if (!hasPermission(mod.requiredPermission)) {
          return;
        }
      }

      if (
        !q ||
        mod.label.toLowerCase().includes(q) ||
        mod.key.toLowerCase().includes(q) ||
        (mod.description && mod.description.toLowerCase().includes(q))
      ) {
        list.push({
          type: 'Page',
          id: `page-${mod.key}`,
          title: mod.label,
          subtitle: mod.description || 'Module page',
          icon: Sparkles,
          action: () => {
            navigate(mod.path);
            onClose();
          },
        });
      }
    });

    // 2. Quick Actions
    const quickActions = [
      {
        type: 'Action',
        id: 'action-profile',
        title: 'View My Profile',
        subtitle: 'Personal details, employment, statutory and bank info',
        icon: Users,
        action: () => {
          navigate('/my-profile');
          onClose();
        },
      },
      {
        type: 'Action',
        id: 'action-approvals',
        title: 'Review Pending Approvals',
        subtitle: 'Leaves, timesheets, and asset requests',
        icon: Clock,
        action: () => {
          navigate('/approvals');
          onClose();
        },
      },
      {
        type: 'Action',
        id: 'action-theme',
        title: 'Toggle Dark / Light Mode',
        subtitle: 'Switch between dark and light appearance',
        icon: Moon,
        action: () => {
          toggleTheme();
          onClose();
        },
      },
    ];

    quickActions.forEach((act) => {
      if (!q || act.title.toLowerCase().includes(q) || act.subtitle.toLowerCase().includes(q)) {
        list.push(act);
      }
    });

    // 3. Projects
    projects.forEach((prj) => {
      if (!q || prj.name.toLowerCase().includes(q) || prj.projectCode?.toLowerCase().includes(q)) {
        list.push({
          type: 'Project',
          id: `prj-${prj._id}`,
          title: prj.name,
          subtitle: `${prj.projectCode} • Status: ${prj.status}`,
          icon: Briefcase,
          action: () => {
            navigate(`/projects/${prj._id}`);
            onClose();
          },
        });
      }
    });

    // 4. Tasks
    tasks.forEach((tsk) => {
      if (!q || tsk.title.toLowerCase().includes(q) || tsk.taskCode?.toLowerCase().includes(q)) {
        list.push({
          type: 'Task',
          id: `tsk-${tsk._id}`,
          title: tsk.title,
          subtitle: `${tsk.taskCode} • ${tsk.priority} priority`,
          icon: CheckSquare,
          action: () => {
            navigate(`/tasks?taskId=${tsk._id}`);
            onClose();
          },
        });
      }
    });

    return list.slice(0, 15);
  }, [query, projects, tasks, hasPermission, navigate, onClose, toggleTheme]);

  // Keyboard navigation inside list
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          results[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-20">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative mx-auto max-w-xl transform rounded-2xl bg-white dark:bg-[#151A26] shadow-2xl border border-slate-100 dark:border-slate-800 transition-all overflow-hidden">
        {/* Search Input Bar */}
        <div className="relative flex items-center px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-400 mr-3 flex-shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search (projects, tasks, pages)..."
            className="w-full bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-md">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-100/50 dark:divide-slate-800/40">
          {results.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No matching pages, projects, or tasks found.
            </div>
          ) : (
            results.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <div
                      className={`p-1.5 rounded-lg flex-shrink-0 ${
                        isSelected
                          ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-semibold leading-tight truncate">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0 ml-3">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400">
                      {item.type}
                    </span>
                    {isSelected && <ArrowRight className="w-3.5 h-3.5 text-brand-500" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="px-4 py-2 bg-slate-50/70 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center space-x-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
          <span>Illusory Studio Workspace</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;

