import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import {
  Users,
  UserCheck,
  Clock,
  Sparkles,
  Building2,
  Calendar,
  ArrowUpRight,
  BellRing,
  User,
  Shield,
  Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const Home = () => {
  const { user, role, hasPermission } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAdminOrHr = ['super_admin', 'admin', 'hr'].includes(role) || hasPermission('dashboard.read');

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!isAdminOrHr) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get('/dashboard/summary');
        if (res.success) {
          setSummary(res.data);
        }
      } catch (err) {
        console.warn('Dashboard fetch error', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [isAdminOrHr]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  // --- EMPLOYEE VIEW ---
  if (!isAdminOrHr) {
    const emp = user?.employee;
    return (
      <div className="space-y-6">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-900 via-indigo-900 to-slate-900 p-8 text-white shadow-xl">
          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30 mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              Welcome to Illusory Studio
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Hello, {emp?.personal?.firstName || user?.email?.split('@')[0]}!
            </h1>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Design & Technology Agency • Bhubaneswar, Odisha. Access your employee records, update emergency contacts, and stay connected with the studio.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/my-profile"
                className="inline-flex items-center px-4 py-2 bg-white text-slate-900 hover:bg-slate-100 text-xs font-semibold rounded-xl transition-all shadow-sm"
              >
                <User className="w-4 h-4 mr-2" />
                View & Edit My Profile
              </Link>
            </div>
          </div>
        </div>

        {/* Profile Card & Studio Announcements */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-brand-600" />
              My Employment Snapshot
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-slate-400">Employee ID</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {emp?.employeeId || 'IDS-NEW'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-slate-400">Designation</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {emp?.employment?.designation || 'Specialist'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-slate-400">Department</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {emp?.employment?.department?.name || 'General'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-slate-400">Work Mode</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {emp?.employment?.workMode || 'Hybrid'}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-400">Status</span>
                <span className="font-semibold px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  {emp?.status?.toUpperCase() || 'ACTIVE'}
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <BellRing className="w-4 h-4 text-amber-500" />
              Studio Announcements & Updates
            </h3>
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                  Agency Update
                </span>
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white mt-1">
                  Welcome to the new Illusory ERP (Day 1 Launch)
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  The studio's modular ERP is now live for Day 1 HRMS and Employee master operations. Please verify your contact information and emergency details under My Profile.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Workplace Policy
                </span>
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white mt-1">
                  Hybrid Work Schedule Guidelines
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Employees operating on Hybrid mode should coordinate team in-studio days with their designated project and team leads.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- ADMIN / HR VIEW ---
  const metrics = summary?.metrics || {};

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Company Dashboard
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Overview of agency workforce, departments, and onboarding metrics.
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Employees
            </span>
            <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-4">
            {metrics.totalEmployees || 0}
          </p>
          <div className="flex items-center text-xs text-emerald-600 mt-2 font-medium">
            <span>{metrics.activeEmployees || 0} active in studio</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Departments
            </span>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-4">
            {metrics.totalDepartments || 7}
          </p>
          <div className="flex items-center text-xs text-slate-400 mt-2 font-medium">
            <span>Core Agency Divisions</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              On Probation
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-4">
            {metrics.probationEmployees || 0}
          </p>
          <div className="flex items-center text-xs text-amber-600 mt-2 font-medium">
            <span>Review dates scheduled</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              New Joiners (Month)
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-4">
            {metrics.newJoinersThisMonth || 0}
          </p>
          <div className="flex items-center text-xs text-emerald-600 mt-2 font-medium">
            <span>Onboarding pipeline</span>
          </div>
        </div>
      </div>

      {/* Distribution & Recent Joiners */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department breakdown */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Department Breakdown
            </h3>
            <Link
              to="/hrms"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center"
            >
              View all <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>

          <div className="space-y-4">
            {(summary?.departmentDistribution || []).map((dept) => {
              const total = metrics.totalEmployees || 1;
              const pct = Math.round((dept.count / total) * 100);
              return (
                <div key={dept.departmentId || dept.name} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-700 dark:text-slate-300">
                      {dept.name} ({dept.code})
                    </span>
                    <span className="text-slate-500 font-semibold">{dept.count}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full bg-brand-600 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Joiners Table */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Recent Studio Joiners
            </h3>
            <Link
              to="/hrms"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center"
            >
              Open HRMS <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-400 uppercase font-semibold">
                  <th className="pb-3">Employee</th>
                  <th className="pb-3">ID</th>
                  <th className="pb-3">Department</th>
                  <th className="pb-3">Joining Date</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {(summary?.recentJoiners || []).map((emp) => (
                  <tr key={emp._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="py-3 font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-[10px]">
                        {emp.personal?.firstName?.charAt(0)}
                      </div>
                      <span>
                        {emp.personal?.firstName} {emp.personal?.lastName}
                      </span>
                    </td>
                    <td className="py-3 text-slate-500 font-mono">{emp.employeeId}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">
                      {emp.employment?.department?.name || 'General'}
                    </td>
                    <td className="py-3 text-slate-500">
                      {emp.employment?.dateOfJoining
                        ? new Date(emp.employment.dateOfJoining).toLocaleDateString()
                        : 'N/A'}
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        {emp.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
