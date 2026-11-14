import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ERP_MODULES } from '../config/modules';
import {
  Home,
  Users,
  UserCheck,
  CheckSquare,
  CreditCard,
  Briefcase,
  UserPlus,
  TrendingUp,
  Box,
  Plane,
  Clock,
  BarChart3,
  HelpCircle,
  Wrench,
  Settings,
  DollarSign,
  Building2,
  Video,
  Sparkles,
} from 'lucide-react';

const ICON_MAP = {
  Home,
  Users,
  UserCheck,
  CheckSquare,
  CreditCard,
  Briefcase,
  UserPlus,
  TrendingUp,
  Box,
  Plane,
  Clock,
  BarChart3,
  HelpCircle,
  Wrench,
  Settings,
  DollarSign,
  Building2,
  Video,
};

const MODULE_COLORS = {
  home: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40 dark:text-violet-300',
  hrms: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300',
  hr: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40 dark:text-teal-300',
  projects: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300',
  tasks: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-300',
  clients: 'text-sky-600 bg-sky-50 dark:bg-sky-950/40 dark:text-sky-300',
  payroll: 'text-green-600 bg-green-50 dark:bg-green-950/40 dark:text-green-300',
  recruitment: 'text-orange-600 bg-orange-50 dark:bg-orange-950/40 dark:text-orange-300',
  crm: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300',
  assets: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40 dark:text-cyan-300',
  travel_expense: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300',
  activity_tracker: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-300',
  reports: 'text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-950/40 dark:text-fuchsia-300',
  support: 'text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-300',
  utilities: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300',
  configurations: 'text-zinc-600 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300',
  finance: 'text-lime-700 bg-lime-50 dark:bg-lime-950/40 dark:text-lime-300',
  meetings: 'text-pink-600 bg-pink-50 dark:bg-pink-950/40 dark:text-pink-300',
};

export const AppsGridPopover = ({ isOpen, onClose }) => {
  const { hasPermission } = useAuth();

  if (!isOpen) return null;

  const visibleModules = ERP_MODULES.filter((mod) => {
    if (!mod.requiredPermission) return true;
    if (Array.isArray(mod.requiredPermission)) {
      return mod.requiredPermission.some((perm) => hasPermission(perm));
    }
    return hasPermission(mod.requiredPermission);
  });

  return (
    <div className="relative">
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white dark:bg-[#151A26] shadow-soft-lg border border-slate-100 dark:border-slate-800 p-4 z-40">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Studio Modules
          </h4>
          <span className="text-[10px] text-slate-400">{visibleModules.length} available</span>
        </div>

        <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto no-scrollbar">
          {visibleModules.map((item) => {
            const Icon = ICON_MAP[item.icon] || Sparkles;
            const colorClass = MODULE_COLORS[item.key] || 'text-brand-600 bg-brand-50';

            return (
              <NavLink
                key={item.key}
                to={item.path}
                onClick={onClose}
                className="flex flex-col items-center justify-center p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-center group"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center mb-1.5 transition-transform group-hover:scale-105 ${colorClass}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 line-clamp-1 leading-tight">
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AppsGridPopover;
