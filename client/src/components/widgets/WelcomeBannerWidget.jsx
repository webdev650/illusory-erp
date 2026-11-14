import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../ui';
import WelcomeIllustration from '../illustrations/WelcomeIllustration';
import { Sparkles } from 'lucide-react';

const FRIENDLY_LINES = [
  "Ready to craft exceptional digital experiences today?",
  "Let's turn creative visions into impactful reality.",
  "Great design is intelligence made visible. Have a productive day!",
  "Collaborate, iterate, and build something wonderful.",
  "Your studio dashboard is synced and ready.",
  "Every pixel counts. Let's make today count too!",
  "Welcome back to Illusory Design Studios workspace.",
];

export const WelcomeBannerWidget = () => {
  const { user, role } = useAuth();

  const firstName =
    user?.employee?.personal?.firstName || user?.email?.split('@')[0] || 'Team';

  // Rotate line daily based on day of year
  const dayOfYear = Math.floor(
    (new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24
  );
  const friendlyLine = FRIENDLY_LINES[dayOfYear % FRIENDLY_LINES.length];

  return (
    <Card
      padding="p-6 sm:p-7"
      className="relative overflow-hidden bg-gradient-to-r from-brand-50/70 via-white to-indigo-50/40 dark:from-brand-950/20 dark:via-[#151A26] dark:to-indigo-950/20 border-brand-100/70 dark:border-brand-900/30"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-600 dark:text-brand-400">
              Illusory Design Studios
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
            <span className="text-[10px] font-semibold text-slate-400 capitalize">
              {role?.replace('_', ' ')} Workspace
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Hello, {firstName} 👋
          </h2>

          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            {friendlyLine}
          </p>
        </div>

        {/* Decorative illustration */}
        <div className="hidden sm:flex items-center justify-end flex-shrink-0">
          <WelcomeIllustration className="w-48 sm:w-56 h-auto" />
        </div>
      </div>
    </Card>
  );
};

export default WelcomeBannerWidget;

