import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Loader2 } from 'lucide-react';

export const ProtectedRoute = ({ children, requiredPermission, requiredRoles }) => {
  const { user, role, hasPermission, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="w-10 h-10 animate-spin text-brand-600 mb-4" />
        <p className="text-sm font-medium text-slate-500">Loading Illusory ERP...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Force password change on first login
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  // Check required permission if set
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="p-8 max-w-xl mx-auto my-16 text-center bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Access Denied</h2>
        <p className="text-sm text-slate-500 mb-6">
          Your role (<span className="font-semibold text-slate-700 dark:text-slate-300 uppercase">{role}</span>) does not have permission to view this module.
        </p>
        <a
          href="/"
          className="inline-flex items-center px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          Return to Dashboard
        </a>
      </div>
    );
  }

  // Check role array if set
  if (requiredRoles && !requiredRoles.includes(role)) {
    return (
      <div className="p-8 max-w-xl mx-auto my-16 text-center bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Restricted Section</h2>
        <p className="text-sm text-slate-500 mb-6">
          This area is strictly restricted to administrative roles.
        </p>
        <a
          href="/"
          className="inline-flex items-center px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          Return to Dashboard
        </a>
      </div>
    );
  }

  return children;
};
