import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';

export const AutomationBanner = ({ initialEnabled = null }) => {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(initialEnabled === null);

  useEffect(() => {
    if (initialEnabled !== null) {
      setEnabled(initialEnabled);
      setLoading(false);
      return;
    }
    let isMounted = true;
    api
      .get('/attendance/automation/status')
      .then((res) => {
        if (isMounted && res.success) {
          setEnabled(res.data.automationEnabled);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [initialEnabled]);

  if (loading || enabled === true) return null;

  return (
    <div className="mb-6 bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200 shadow-sm animate-fadeIn">
      <div className="flex items-start sm:items-center gap-3">
        <div className="p-2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-lg shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <div className="font-semibold text-sm flex items-center gap-2">
            Automation is OFF (not live)
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
              Safety Switch Active
            </span>
          </div>
          <div className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-0.5">
            Master automation switch is disabled. Automated leave accruals, missing clock-out alerts, 23:59 EOD absenteeism, late penalty generation, reminders, and emails are currently inactive. Real employees will not be modified.
          </div>
        </div>
      </div>
      <Link
        to="/hrms/attendance/policy-confirmation"
        className="text-xs font-semibold px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shrink-0 self-start sm:self-center"
      >
        View Go-Live Switch
      </Link>
    </div>
  );
};

export default AutomationBanner;
