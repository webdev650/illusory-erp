import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ERP_MODULES } from '../config/modules';
import { Card, Badge, Button } from '../components/ui';
import { Sparkles, ArrowLeft, Clock, CheckCircle2 } from 'lucide-react';

export const ComingSoon = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  // Find module details in registry
  const mod = ERP_MODULES.find((m) => m.path === currentPath) || {
    label: currentPath.split('/').pop()?.toUpperCase() || 'Module',
    description: 'This module is scheduled for development in Phase 2 of the Illusory ERP roadmap.',
    plannedFeatures: [
      'Dedicated role-based workflow automation',
      'Integration with employee master and attendance records',
      'Exportable analytics and multi-tier approvals',
    ],
  };

  return (
    <div className="py-12 px-4 max-w-2xl mx-auto">
      <Card padding="p-8 sm:p-10" className="text-center relative overflow-hidden">
        {/* Glow icon */}
        <div className="w-16 h-16 rounded-3xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300 flex items-center justify-center mx-auto mb-5 shadow-soft">
          <Sparkles className="w-8 h-8" />
        </div>

        <Badge variant="brand" size="md" className="mb-3">
          <Clock className="w-3.5 h-3.5 mr-1" />
          <span>Roadmap Feature (Coming Soon)</span>
        </Badge>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {mod.label} Module
        </h1>

        <p className="mt-3 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-lg mx-auto">
          {mod.description}
        </p>

        {/* Planned Features List */}
        {mod.plannedFeatures && mod.plannedFeatures.length > 0 && (
          <div className="mt-8 text-left bg-slate-50/70 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Planned Deliverables for {mod.label}
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              {mod.plannedFeatures.map((feat, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 flex justify-center gap-3">
          <Link to="/">
            <Button variant="outline" size="sm" icon={ArrowLeft}>
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default ComingSoon;
