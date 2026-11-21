import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { ERP_MODULES } from '../config/modules';
import api from '../api/axios';
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
  Star,
  Search,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  FileText,
  AlertTriangle,
  Heart,
  GraduationCap,
  Target,
  Sun,
  Moon,
  X,
  Calendar,
  CalendarDays,
  Edit2,
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
  Sparkles,
  LayoutDashboard,
  FileText,
  AlertTriangle,
  Heart,
  GraduationCap,
  Target,
  Calendar,
  CalendarDays,
  Edit2,
};

const MODULE_TILE_COLORS = {
  home: 'bg-violet-100 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300',
  hrms: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300',
  hr: 'bg-teal-100 text-teal-700 dark:bg-teal-950/70 dark:text-teal-300',
  projects: 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300',
  tasks: 'bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300',
  clients: 'bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300',
  payroll: 'bg-green-100 text-green-700 dark:bg-green-950/70 dark:text-green-300',
  recruitment: 'bg-orange-100 text-orange-700 dark:bg-orange-950/70 dark:text-orange-300',
  crm: 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300',
  assets: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-300',
  travel_expense: 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300',
  activity_tracker: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300',
  reports: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/70 dark:text-fuchsia-300',
  support: 'bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300',
  utilities: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  configurations: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  finance: 'bg-lime-100 text-lime-800 dark:bg-lime-950/70 dark:text-lime-300',
  meetings: 'bg-pink-100 text-pink-700 dark:bg-pink-950/70 dark:text-pink-300',
};

export const Sidebar = ({ isMobileOpen, setIsMobileOpen }) => {
  const location = useLocation();
  const { hasPermission } = useAuth();
  const { preferences, togglePinModule, toggleSidebarCollapse, toggleTheme } = usePreferences();
  const [subPageSearch, setSubPageSearch] = useState('');

  const isLevel2Collapsed = preferences?.sidebarCollapsed ?? false;
  const pinnedList = preferences?.pinnedModules || [];
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchPending = async () => {
      try {
        const res = await api.get('/approvals/pending-for-me');
        if (isMounted && res.success && Array.isArray(res.data)) {
          setPendingApprovalsCount(res.data.length);
        }
      } catch (err) {
        // Silently skip if unauthenticated
      }
    };
    fetchPending();
    const interval = setInterval(fetchPending, 45000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Allowed modules based on RBAC
  const visibleModules = useMemo(() => {
    return ERP_MODULES.filter((mod) => {
      if (!mod.requiredPermission) return true;
      if (Array.isArray(mod.requiredPermission)) {
        return mod.requiredPermission.some((perm) => hasPermission(perm));
      }
      return hasPermission(mod.requiredPermission);
    });
  }, [hasPermission]);

  // Determine current active module from URL
  const activeModule = useMemo(() => {
    const currentPath = location.pathname;
    // Match exact home
    if (currentPath === '/') {
      return visibleModules.find((m) => m.key === 'home') || visibleModules[0];
    }
    // Match root path segment e.g. /hrms, /projects, /tasks
    const firstSegment = `/${currentPath.split('/')[1]}`;
    const found = visibleModules.find((m) => m.path === firstSegment || currentPath.startsWith(m.path));
    return found || visibleModules.find((m) => m.key === 'hrms') || visibleModules[0];
  }, [location.pathname, visibleModules]);

  // Children pages of active module
  const moduleChildren = useMemo(() => {
    if (!activeModule) return [];
    if (activeModule.children && activeModule.children.length > 0) {
      return activeModule.children.filter((child) => {
        if (!child.requiredPermission) return true;
        return hasPermission(child.requiredPermission);
      });
    }
    // Fallback single item for modules without children
    return [
      {
        key: activeModule.key,
        label: activeModule.label,
        icon: activeModule.icon,
        path: activeModule.path,
        status: activeModule.status,
      },
    ];
  }, [activeModule, hasPermission]);

  // Filtered sub-pages
  const filteredChildren = useMemo(() => {
    if (!subPageSearch.trim()) return moduleChildren;
    const q = subPageSearch.toLowerCase();
    return moduleChildren.filter((c) => c.label.toLowerCase().includes(q));
  }, [moduleChildren, subPageSearch]);

  // Pinned favorites
  const favouriteModules = useMemo(() => {
    return visibleModules.filter((m) => pinnedList.includes(m.key));
  }, [visibleModules, pinnedList]);

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* TWO-LEVEL SIDEBAR CONTAINER */}
      <div
        className={`fixed top-0 bottom-0 left-0 z-50 flex transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* ========================================================= */}
        {/* LEVEL 1: SLIM ICON RAIL (64px / w-16)                     */}
        {/* ========================================================= */}
        <aside className="w-16 bg-slate-900 dark:bg-[#0B0F19] border-r border-slate-800 flex flex-col items-center py-4 flex-shrink-0 select-none">
          {/* Studio Brand Emblem */}
          <NavLink
            to="/"
            onClick={() => setIsMobileOpen(false)}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/30 mb-5 group relative"
            title="Illusory ERP"
          >
            <Sparkles className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="sr-only">Illusory ERP</span>
          </NavLink>

          {/* Rail Scrollable List */}
          <div className="flex-1 w-full overflow-y-auto overflow-x-hidden space-y-4 no-scrollbar px-2 flex flex-col items-center">
            {/* FAVOURITES SECTION */}
            {favouriteModules.length > 0 && (
              <div className="w-full flex flex-col items-center space-y-2 pb-3 border-b border-slate-800/80">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 opacity-80 mb-0.5" />
                {favouriteModules.map((item) => {
                  const Icon = ICON_MAP[item.icon] || Sparkles;
                  const isActive = activeModule?.key === item.key;
                  return (
                    <NavLink
                      key={`rail-fav-${item.key}`}
                      to={item.children?.[0]?.path || item.path}
                      onClick={() => setIsMobileOpen(false)}
                      className={`group relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 ring-2 ring-brand-400/50'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {/* Tooltip */}
                      <span className="absolute left-14 ml-2 px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 rounded-md whitespace-nowrap shadow-xl border border-slate-700 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                        {item.label} (Fav)
                      </span>
                    </NavLink>
                  );
                })}
              </div>
            )}

            {/* MODULES LIST */}
            <div className="w-full flex flex-col items-center space-y-2">
              {visibleModules.map((item) => {
                const Icon = ICON_MAP[item.icon] || Sparkles;
                const isActive = activeModule?.key === item.key;
                const tileColor = MODULE_TILE_COLORS[item.key] || 'bg-slate-800 text-slate-300';

                return (
                  <NavLink
                    key={`rail-${item.key}`}
                    to={item.children?.[0]?.path || item.path}
                    onClick={() => setIsMobileOpen(false)}
                    className={`group relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      isActive
                        ? 'bg-brand-600 text-white shadow-md shadow-brand-600/35 ring-2 ring-brand-400/50 scale-105'
                        : `${tileColor} opacity-90 hover:opacity-100 hover:scale-105`
                    }`}
                  >
                    <Icon className="w-5 h-5" />

                    {/* Pending Count Badge */}
                    {item.key === 'hrms' && pendingApprovalsCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-slate-950 font-bold text-[9px] rounded-full flex items-center justify-center ring-2 ring-slate-950 shadow-md">
                        {pendingApprovalsCount > 9 ? '9+' : pendingApprovalsCount}
                      </span>
                    )}

                    {/* Active Pip */}
                    {isActive && (
                      <span className="absolute -left-2 top-2.5 bottom-2.5 w-1 bg-white rounded-r-full shadow-sm" />
                    )}

                    {/* Tooltip */}
                    <span className="absolute left-14 ml-2 px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 rounded-md whitespace-nowrap shadow-xl border border-slate-700 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                      {item.label}
                      {item.status === 'soon' && (
                        <span className="ml-1.5 px-1.5 py-0.5 text-[9px] bg-slate-700 text-slate-300 rounded font-normal">
                          Soon
                        </span>
                      )}
                    </span>
                  </NavLink>
                );
              })}
            </div>
          </div>

          {/* Bottom Rail Controls */}
          <div className="pt-3 border-t border-slate-800/80 w-full flex flex-col items-center space-y-2">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={preferences.theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            >
              {preferences.theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {/* Desktop Collapse Toggle */}
            <button
              onClick={toggleSidebarCollapse}
              className="hidden lg:flex w-10 h-10 rounded-xl items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={isLevel2Collapsed ? 'Expand Menu' : 'Collapse Menu'}
            >
              {isLevel2Collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>
        </aside>

        {/* ========================================================= */}
        {/* LEVEL 2: SECONDARY MODULE SUB-MENU (224px / w-56)         */}
        {/* ========================================================= */}
        {(!isLevel2Collapsed || isMobileOpen) && (
          <aside className="w-56 bg-slate-900/95 dark:bg-[#111520] border-r border-slate-800 flex flex-col transition-all duration-300 select-none">
            {/* Header: Module Title + Star Pin */}
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800">
              <div className="truncate">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                  Module
                </span>
                <h2 className="text-sm font-bold text-white truncate">
                  {activeModule?.label || 'Overview'}
                </h2>
              </div>
              <div className="flex items-center space-x-1">
                {activeModule && (
                  <button
                    onClick={() => togglePinModule(activeModule.key)}
                    className="p-1 rounded-lg text-slate-400 hover:text-amber-400 transition-colors"
                    title={
                      pinnedList.includes(activeModule.key) ? 'Unpin from Favourites' : 'Pin to Favourites'
                    }
                  >
                    <Star
                      className={`w-4 h-4 ${
                        pinnedList.includes(activeModule.key)
                          ? 'text-amber-400 fill-amber-400'
                          : ''
                      }`}
                    />
                  </button>
                )}
                {/* Mobile Close Button */}
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="lg:hidden p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sub-page Search */}
            <div className="px-3 pt-3 pb-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter pages..."
                  value={subPageSearch}
                  onChange={(e) => setSubPageSearch(e.target.value)}
                  className="w-full bg-slate-800/80 dark:bg-slate-900/80 text-xs text-slate-200 placeholder-slate-500 rounded-lg pl-8 pr-2.5 py-1.5 border border-slate-750 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            {/* Sub-pages List */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 no-scrollbar">
              {filteredChildren.map((child) => {
                const Icon = ICON_MAP[child.icon] || LayoutDashboard;
                return (
                  <NavLink
                    key={child.key || child.path}
                    to={child.path}
                    onClick={() => setIsMobileOpen(false)}
                    className={({ isActive }) =>
                      `group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-brand-600 text-white font-semibold shadow-sm shadow-brand-500/25'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex items-center space-x-2.5 truncate">
                          <Icon
                            className={`w-4 h-4 flex-shrink-0 transition-colors ${
                              isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                            }`}
                          />
                          <span className="truncate">{child.label}</span>
                        </div>
                        {child.status === 'soon' && (
                          <span
                            className={`ml-1 px-1.5 py-0.5 text-[9px] font-semibold rounded ${
                              isActive
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-800 text-slate-400 group-hover:text-slate-300'
                            }`}
                          >
                            Soon
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}

              {filteredChildren.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-500">
                  No matching pages
                </div>
              )}
            </div>

            {/* Bottom info */}
            <div className="p-3 border-t border-slate-800/80 text-[10px] text-slate-500 text-center">
              Illusory Design Studios
            </div>
          </aside>
        )}
      </div>
    </>
  );
};

export default Sidebar;
