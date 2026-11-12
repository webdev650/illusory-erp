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
  User,
  Sparkles,
  Building2,
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
  User,
  Building2,
};

export const Sidebar = ({ isMobileOpen, setIsMobileOpen }) => {
  const { hasPermission } = useAuth();

  // Filter modules from the unified registry based on required permissions
  const visibleModules = ERP_MODULES.filter((mod) => {
    if (!mod.requiredPermission) return true;
    return hasPermission(mod.requiredPermission);
  });

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-slate-900 dark:text-white leading-none">
                Illusory ERP
              </h1>
              <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Illusory Design Studios
              </span>
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Agency Modules
          </div>

          {visibleModules.map((item) => {
            const Icon = ICON_MAP[item.icon] || Sparkles;
            const isSoon = item.status === 'soon';

            return (
              <NavLink
                key={item.key}
                to={item.path}
                onClick={() => setIsMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white'
                  }`
                }
              >
                <div className="flex items-center space-x-3 truncate">
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
                {isSoon && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500">
                    Soon
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Studio location badge */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Bhubaneswar, IN
            </span>
            <span className="font-mono text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
              v1.2.0
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
