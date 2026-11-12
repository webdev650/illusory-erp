import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Menu, LogOut, KeyRound, User, ChevronDown, Moon, Sun, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Navbar = ({ setIsMobileOpen }) => {
  const { user, role, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const getRoleBadgeColor = () => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200';
      case 'admin':
        return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200';
      case 'hr':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200';
      default:
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200';
    }
  };

  const displayName = user?.employee?.personal
    ? `${user.employee.personal.firstName} ${user.employee.personal.lastName}`
    : user?.email?.split('@')[0] || 'User';

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 px-4 lg:px-8 flex items-center justify-between">
      {/* Left section: mobile hamburger & breadcrumb */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-200">Illusory ERP</span>
          <span>/</span>
          <span>Studio Workspace</span>
        </div>
      </div>

      {/* Right section: theme toggle & user profile */}
      <div className="flex items-center space-x-3">
        <button
          onClick={toggleDarkMode}
          title="Toggle Dark Mode"
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Role Pill */}
        <span
          className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${getRoleBadgeColor()}`}
        >
          <Shield className="w-3 h-3" />
          {role.replace('_', ' ')}
        </span>

        {/* User profile dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center space-x-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-tight">
                {displayName}
              </p>
              <p className="text-[10px] text-slate-400 leading-tight">
                {user?.employee?.employeeId || user?.email}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-40 text-xs">
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                  <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                </div>

                <Link
                  to="/my-profile"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center space-x-2.5 px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <span>My Profile</span>
                </Link>

                <Link
                  to="/change-password"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center space-x-2.5 px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <KeyRound className="w-4 h-4 text-slate-400" />
                  <span>Change Password</span>
                </Link>

                <div className="border-t border-slate-100 dark:border-slate-700 my-1" />

                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center space-x-2.5 px-4 py-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
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
  );
};
