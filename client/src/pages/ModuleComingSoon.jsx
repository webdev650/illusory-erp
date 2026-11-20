import React from 'react';
import { Sparkles, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ModuleComingSoon = ({
  title = 'Feature In Development',
  description = 'This module is scheduled for development in our upcoming sprint.',
  features = [],
}) => {
  const navigate = useNavigate();

  return (
    <div className="py-12 px-4 max-w-2xl mx-auto text-center space-y-6">
      <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center mx-auto shadow-xl shadow-brand-500/25">
        <Sparkles className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300 uppercase tracking-wider">
          Roadmap Feature
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          {description}
        </p>
      </div>

      {features.length > 0 && (
        <div className="bg-white dark:bg-[#151A26] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 text-left shadow-xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Planned Highlights & Capabilities:
          </h3>
          <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
            {features.map((f, i) => (
              <li key={i} className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Go Back</span>
        </button>
      </div>
    </div>
  );
};

export default ModuleComingSoon;
