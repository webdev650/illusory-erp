import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { ERP_MODULES } from '../config/modules';
import { NavbarTimer } from './NavbarTimer';
import CommandPalette from './CommandPalette';
import CalendarPopover from './CalendarPopover';
import AppsGridPopover from './AppsGridPopover';
import { Avatar } from './ui';
import api from '../api/axios';
import {
  Menu,
  Search,
  Calendar,
  Bell,
  Grid,
  Settings,
  Moon,
  Sun,
  User,
  KeyRound,
  LogOut,
  ChevronDown,
  MoreHorizontal,
  Clock,
  Sparkles,
} from 'lucide-react';

export const Navbar = ({ setIsMobileOpen, onOpenCustomizeDrawer }) => {
  const { user, role, logout, hasPermission } = useAuth();
  const { preferences, toggleTheme } = usePreferences();
  const location = useLocation();
  const navigate = useNavigate();

  // Dialog & Popover states
  const [cmdOpen, setCmdOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Listen for Ctrl+K / Cmd+K global hotkey
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Notifications polling
  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications?limit=10');
      if (res.success && res.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch {
      //
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 45000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const markNotificationRead = async (id, link) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifOpen(false);
      if (link) navigate(link);
    } catch {
      if (link) navigate(link);
    }
  };

  // Quick-access tabs list (Home, HR, Tasks, Reports, Approvals, Meetings, etc.)
  const quickTabKeys = ['home', 'hr', 'tasks', 'reports', 'approvals', 'meetings'];

  const primaryTabs = [
    { label: 'Home', path: '/', key: 'home' },
    { label: 'HR', path: '/hr', key: 'hr', perm: 'hr.access' },
    { label: 'Tasks', path: '/tasks', key: 'tasks', perm: ['task.read', 'task.readOwn'] },
    { label: 'Reports', path: '/modules/reports', key: 'reports', perm: 'report.view' },
    { label: 'Approvals', path: '/approvals', key: 'approvals' },
    { label: 'Meetings', path: '/modules/meetings', key: 'meetings' },
  ].filter((tab) => {
    if (!tab.perm) return true;
    if (Array.isArray(tab.perm)) return tab.perm.some((p) => hasPermission(p));
    return hasPermission(tab.perm);
  });

  // Overflow modules that aren't in the primary tabs
  const overflowModules = ERP_MODULES.filter(
    (m) => !quickTabKeys.includes(m.key) && (!m.requiredPermission || hasPermission(m.requiredPermission))
  );

  const displayName = user?.employee?.personal
    ? `${user.employee.personal.firstName} ${user.employee.personal.lastName}`
    : user?.email?.split('@')[0] || 'User';

  return (
    <>
      <header className="sticky top-0 z-30 h-16 bg-white/85 dark:bg-[#111520]/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between">
        {/* LEFT: Mobile hamburger & Quick-access tabs */}
        <div className="flex items-center space-x-3 overflow-x-auto no-scrollbar">
          {/* Hamburger button for mobile */}
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Quick-Access Navigation Tabs with Underline */}
          <nav className="hidden md:flex items-center space-x-1">
            {primaryTabs.map((tab) => {
              const isActive =
                tab.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(tab.path);

              return (
                <NavLink
                  key={tab.key}
                  to={tab.path}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg transition-all relative ${
                    isActive
                      ? 'text-brand-600 dark:text-brand-400 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <span>{tab.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-brand-600 dark:bg-brand-400 rounded-full" />
                  )}
                </NavLink>
              );
            })}

            {/* "..." Overflow Menu for the remaining modules */}
            {overflowModules.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setOverflowOpen(!overflowOpen)}
                  className={`p-2 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                    overflowOpen ? 'bg-slate-100 dark:bg-slate-800' : ''
                  }`}
                  title="More modules"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {overflowOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setOverflowOpen(false)} />
                    <div className="absolute left-0 mt-2 w-52 rounded-2xl bg-white dark:bg-[#151A26] shadow-soft-lg border border-slate-100 dark:border-slate-800 py-1.5 z-40">
                      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                        Other Modules
                      </div>
                      <div className="max-h-60 overflow-y-auto no-scrollbar py-1">
                        {overflowModules.map((m) => (
                          <NavLink
                            key={m.key}
                            to={m.path}
                            onClick={() => setOverflowOpen(false)}
                            className="flex items-center justify-between px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            <span>{m.label}</span>
                            {m.status === 'soon' && (
                              <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
                                Soon
                              </span>
                            )}
                          </NavLink>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </nav>
        </div>

        {/* RIGHT: Actions, Command Palette Trigger, Calendar, Notifications, Apps, Profile */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Live Punch / Activity Timer Pill */}
          <NavbarTimer />

          {/* Global Search / Command Palette (Ctrl+K) */}
          <button
            onClick={() => setCmdOpen(true)}
            className="flex items-center space-x-2 px-2.5 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors text-xs"
            title="Search (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs text-slate-400">Search...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-white dark:bg-slate-700 rounded-md border border-slate-200 dark:border-slate-600">
              ⌘K
            </kbd>
          </button>

          {/* Mini Calendar Popover Button */}
          <div className="relative">
            <button
              onClick={() => {
                setCalendarOpen(!calendarOpen);
                setAppsOpen(false);
                setNotifOpen(false);
              }}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Studio Calendar"
            >
              <Calendar className="w-4 h-4" />
            </button>
            <CalendarPopover isOpen={calendarOpen} onClose={() => setCalendarOpen(false)} />
          </div>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => {
                setNotifOpen(!notifOpen);
                setCalendarOpen(false);
                setAppsOpen(false);
              }}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#111520] animate-pulse" />
              )}
            </button>

            {/* Notification Dropdown */}
            {notifOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-[#151A26] shadow-soft-lg border border-slate-100 dark:border-slate-800 p-4 z-40 text-xs">
                  <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 dark:border-slate-800">
                    <h4 className="font-bold text-slate-800 dark:text-slate-100">Notifications</h4>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
                        {unreadCount} new
                      </span>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto no-scrollbar divide-y divide-slate-100/60 dark:divide-slate-800/40">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-slate-400">
                        No notifications to display
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n._id}
                          onClick={() => markNotificationRead(n._id, n.link)}
                          className={`p-3 rounded-xl cursor-pointer transition-colors ${
                            n.isRead
                              ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                              : 'bg-brand-50/40 dark:bg-brand-950/20 hover:bg-brand-50/60'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {n.title}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(n.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                            {n.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Apps-Grid Shortcut Icon */}
          <div className="relative">
            <button
              onClick={() => {
                setAppsOpen(!appsOpen);
                setCalendarOpen(false);
                setNotifOpen(false);
              }}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="All Modules Grid"
            >
              <Grid className="w-4 h-4" />
            </button>
            <AppsGridPopover isOpen={appsOpen} onClose={() => setAppsOpen(false)} />
          </div>

          {/* Settings / Customize Home Layout Button */}
          <button
            onClick={() => onOpenCustomizeDrawer && onOpenCustomizeDrawer()}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Customize Dashboard Layout"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* User profile dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center space-x-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
            >
              <Avatar
                src={user?.employee?.personal?.photo?.url}
                name={displayName}
                size="sm"
              />
              <div className="hidden lg:block text-left">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-tight">
                  {displayName}
                </p>
                <p className="text-[10px] text-slate-400 leading-tight capitalize">
                  {role?.replace('_', ' ')}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-[#151A26] shadow-soft-lg border border-slate-100 dark:border-slate-800 py-1.5 z-40 text-xs">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {displayName}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                  </div>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate('/my-profile');
                    }}
                    className="w-full flex items-center space-x-2.5 px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    <span>My Profile</span>
                  </button>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate('/change-password');
                    }}
                    className="w-full flex items-center space-x-2.5 px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <KeyRound className="w-4 h-4 text-slate-400" />
                    <span>Change Password</span>
                  </button>

                  {/* Dark Mode Toggle */}
                  <button
                    onClick={() => {
                      toggleTheme();
                    }}
                    className="w-full flex items-center justify-between px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <div className="flex items-center space-x-2.5">
                      {preferences.theme === 'dark' ? (
                        <Sun className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Moon className="w-4 h-4 text-slate-400" />
                      )}
                      <span>Appearance</span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 capitalize">
                      {preferences.theme}
                    </span>
                  </button>

                  <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center space-x-2.5 px-4 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Global Command Palette Dialog */}
      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />
    </>
  );
};

export default Navbar;
