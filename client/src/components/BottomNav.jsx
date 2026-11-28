import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, CheckSquare, Calendar, Bell, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const BottomNav = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Show bottom nav only on mobile devices (hidden md and above)
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 safe-bottom"
      aria-label="Mobile Navigation"
    >
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto">
        {/* 1. Home */}
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[44px] text-[10px] font-medium transition-colors ${
              isActive
                ? 'text-brand-600 dark:text-brand-400 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`p-1 rounded-xl transition-colors ${isActive ? 'bg-brand-50 dark:bg-brand-900/40' : ''}`}>
                <Home className="w-5 h-5" />
              </span>
              <span className="mt-0.5">Home</span>
            </>
          )}
        </NavLink>

        {/* 2. Tasks */}
        <NavLink
          to="/tasks"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[44px] text-[10px] font-medium transition-colors ${
              isActive
                ? 'text-brand-600 dark:text-brand-400 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`p-1 rounded-xl transition-colors ${isActive ? 'bg-brand-50 dark:bg-brand-900/40' : ''}`}>
                <CheckSquare className="w-5 h-5" />
              </span>
              <span className="mt-0.5">Tasks</span>
            </>
          )}
        </NavLink>

        {/* 3. Leave / Attendance */}
        <NavLink
          to="/hrms/attendance"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[44px] text-[10px] font-medium transition-colors ${
              isActive
                ? 'text-brand-600 dark:text-brand-400 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`p-1 rounded-xl transition-colors ${isActive ? 'bg-brand-50 dark:bg-brand-900/40' : ''}`}>
                <Calendar className="w-5 h-5" />
              </span>
              <span className="mt-0.5">Leave</span>
            </>
          )}
        </NavLink>

        {/* 4. Notifications */}
        <NavLink
          to="/notifications"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[44px] text-[10px] font-medium transition-colors ${
              isActive
                ? 'text-brand-600 dark:text-brand-400 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`p-1 rounded-xl transition-colors ${isActive ? 'bg-brand-50 dark:bg-brand-900/40' : ''}`}>
                <Bell className="w-5 h-5" />
              </span>
              <span className="mt-0.5">Notifications</span>
            </>
          )}
        </NavLink>

        {/* 5. Profile */}
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[44px] text-[10px] font-medium transition-colors ${
              isActive
                ? 'text-brand-600 dark:text-brand-400 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`p-1 rounded-xl transition-colors ${isActive ? 'bg-brand-50 dark:bg-brand-900/40' : ''}`}>
                <User className="w-5 h-5" />
              </span>
              <span className="mt-0.5">Profile</span>
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
};

export default BottomNav;
