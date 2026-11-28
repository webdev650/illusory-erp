import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../ui';
import WelcomeIllustration from '../illustrations/WelcomeIllustration';
import api from '../../api/axios';

export const toProperCase = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const WelcomeBannerWidget = () => {
  const { user, role } = useAuth();
  const [greetingData, setGreetingData] = useState(null);

  const rawFirstName =
    user?.employee?.personal?.firstName || user?.email?.split('@')[0] || 'Team';
  const properFirstName = toProperCase(rawFirstName);

  useEffect(() => {
    let isMounted = true;
    const fetchGreeting = async () => {
      try {
        const res = await api.get('/home/greeting');
        if (isMounted && res.success && res.data) {
          setGreetingData(res.data);
        }
      } catch {
        // Fallback to local default
      }
    };
    fetchGreeting();
    return () => {
      isMounted = false;
    };
  }, []);

  const headline = greetingData?.greeting || `Hello, ${properFirstName} 👋`;
  const subline = greetingData?.subtext || "Great to see you again! Let's make today productive.";

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
            {headline}
          </h2>

          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            {subline}
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

