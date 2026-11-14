import React, { useState, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { ERP_MODULES } from '../config/modules';
import IllusoryLogo from './brand/IllusoryLogo';
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

// Unique background/text colors for each module's rounded-square icon tile
const MODULE_TILE_COLORS = {
  home: 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
  hrms: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  hr: 'bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300',
  projects: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
  tasks: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300',
  clients: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
  payroll: 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300',
  recruitment: 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300',
  crm: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  assets: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300',
  travel_expense: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  activity_tracker: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
  reports: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/60 dark:text-fuchsia-300',
  support: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
  utilities: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  configurations: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  finance: 'bg-lime-100 text-lime-800 dark:bg-lime-950/60 dark:text-lime-300',
  meetings: 'bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300',
};

export const Sidebar = ({ isMobileOpen, setIsMobileOpen }) => {
  const { hasPermission } = useAuth();
  const { preferences, togglePinModule, toggleSidebarCollapse } = usePreferences();
  const [searchQuery, setSearchQuery] = useState('');

  const isCollapsed = preferences?.sidebarCollapsed ?? false;
  const pinnedList = preferences?.pinnedModules || [];

  // Filter modules user has permission to view
  const visibleModules = useMemo(() => {
    return ERP_MODULES.filter((mod) => {
      if (!mod.requiredPermission) return true;
      if (Array.isArray(mod.requiredPermission)) {
        return mod.requiredPermission.some((perm) => hasPermission(perm));
      }
      return hasPermission(mod.requiredPermission);
    });
  }, [hasPermission]);

  // Modules matching search
  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return visibleModules;
    const q = searchQuery.toLowerCase();
    return visibleModules.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.key.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q))
    );
  }, [visibleModules, searchQuery]);

  // Favourites list
  const favouriteModules = useMemo(() => {
    return visibleModules.filter((m) => pinnedList.includes(m.key));
  }, [visibleModules, pinnedList]);

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Main Sidebar Shell */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-white dark:bg-[#111520] border-r border-slate-200/80 dark:border-slate-800 flex flex-col transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-72'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80">
          <NavLink to="/" onClick={() => setIsMobileOpen(false)} className="truncate">
            <IllusoryLogo collapsed={isCollapsed} />
          </NavLink>
        </div>

        {/* Scrollable Navigation */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6 no-scrollbar">
          {/* SECTION 1: HOME & FAVOURITES */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 pb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <span>Favourites</span>
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              </div>
            )}

            {favouriteModules.map((item) => {
              const Icon = ICON_MAP[item.icon] || Sparkles;
              const tileColor = MODULE_TILE_COLORS[item.key] || 'bg-slate-100 text-slate-600';

              return (
                <NavLink
                  key={`fav-${item.key}`}
                  to={item.path}
                  onClick={() => setIsMobileOpen(false)}
                  title={isCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/25 font-bold'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center space-x-3 truncate">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : tileColor
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                      </div>

                      {/* Unpin star button */}
                      {!isCollapsed && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            togglePinModule(item.key);
                          }}
                          title="Remove from favourites"
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-amber-500 transition-opacity"
                        >
                          <Star className={`w-3.5 h-3.5 ${isActive ? 'text-white/80' : 'text-amber-400 fill-amber-400'}`} />
                        </button>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>

          {/* SECTION 2: ALL MODULES REGISTRY */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Agency Modules ({filteredModules.length})
              </div>
            )}

            {filteredModules.map((item) => {
              const Icon = ICON_MAP[item.icon] || Sparkles;
              const tileColor = MODULE_TILE_COLORS[item.key] || 'bg-slate-100 text-slate-600';
              const isPinned = pinnedList.includes(item.key);
              const isSoon = item.status === 'soon';

              return (
                <NavLink
                  key={item.key}
                  to={item.path}
                  onClick={() => setIsMobileOpen(false)}
                  title={isCollapsed ? `${item.label}${isSoon ? ' (Soon)' : ''}` : undefined}
                  className={({ isActive }) =>
                    `group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/25 font-bold'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center space-x-3 truncate">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : tileColor
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        {!isCollapsed && (
                          <span className="truncate">{item.label}</span>
                        )}
                      </div>

                      {!isCollapsed && (
                        <div className="flex items-center space-x-1.5 flex-shrink-0">
                          {isSoon && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                                isActive
                                  ? 'bg-white/20 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                              }`}
                            >
                              Soon
                            </span>
                          )}

                          {/* Pin toggle star */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              togglePinModule(item.key);
                            }}
                            title={isPinned ? 'Remove from favourites' : 'Add to favourites'}
                            className={`p-1 transition-opacity ${
                              isPinned
                                ? 'opacity-100 text-amber-400 fill-amber-400'
                                : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-amber-400'
                            }`}
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${
                                isPinned ? 'fill-amber-400 text-amber-400' : ''
                              }`}
                            />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* BOTTOM: FILTER SEARCH & COLLAPSE TOGGLE */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 space-y-2">
          {!isCollapsed && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter menu..."
                className="w-full pl-8 pr-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Collapse/Expand Toggle Button */}
          <button
            onClick={toggleSidebarCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex w-full items-center justify-center p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500">
                <ChevronLeft className="w-4 h-4" />
                <span>Collapse Menu</span>
              </div>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
