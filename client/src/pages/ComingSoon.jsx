import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Sparkles, ArrowLeft, Clock, ShieldCheck } from 'lucide-react';

export const ComingSoon = () => {
  const location = useLocation();
  const path = location.pathname.split('/').pop() || 'Module';
  const title = path.charAt(0).toUpperCase() + path.slice(1);

  return (
    <div className="py-16 px-4 text-center max-w-xl mx-auto">
      <div className="w-16 h-16 rounded-3xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400 flex items-center justify-center mx-auto mb-6 shadow-sm">
        <Sparkles className="w-8 h-8" />
      </div>

      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300 mb-3">
        <Clock className="w-3.5 h-3.5" />
        Roadmap Feature (Phase 2)
      </span>

      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
        {title} Module
      </h1>

      <p className="mt-3 text-xs sm:text-sm text-slate-500 leading-relaxed">
        This ERP module is part of the planned roadmap for Illusory Design Studios. Day 1 focuses on HRMS Employee Master and Configurations. This section will connect seamlessly with active employee records once released.
      </p>

      <div className="mt-8 flex justify-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
};
