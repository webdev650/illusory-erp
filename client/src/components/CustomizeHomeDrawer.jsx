import React from 'react';
import { usePreferences } from '../context/PreferencesContext';
import { Drawer, Button } from './ui';
import {
  RotateCcw,
  Eye,
  EyeOff,
  Move,
  LayoutDashboard,
  Check,
} from 'lucide-react';

const WIDGET_DEFINITIONS = [
  { key: 'welcome', label: 'Welcome Banner Card' },
  { key: 'kpi', label: 'Studio KPI Summary Metrics' },
  { key: 'my_tasks', label: 'My Open Tasks' },
  { key: 'tasks_due', label: 'Tasks Due Today & Overdue' },
  { key: 'weekly_hours', label: 'My Weekly Hours (Activity Tracker)' },
  { key: 'my_projects', label: 'My Active Projects' },
  { key: 'leave_balance', label: 'Leave Balance Cards' },
  { key: 'team_on_leave', label: 'Team on Leave Today' },
  { key: 'pending_approvals', label: 'Pending Approvals Queue' },
  { key: 'announcements', label: 'Studio Announcements' },
  { key: 'upcoming_holidays', label: 'Upcoming Odisha Holidays' },
  { key: 'celebrations', label: 'Birthdays & Work Anniversaries' },
  { key: 'charts', label: 'Studio Analytics & Status Charts' },
];

export const CustomizeHomeDrawer = ({ isOpen, onClose }) => {
  const { preferences, updatePreferences, resetLayout } = usePreferences();

  const hiddenWidgets = preferences?.hiddenWidgets || [];

  const toggleWidgetVisibility = (key) => {
    const nextHidden = hiddenWidgets.includes(key)
      ? hiddenWidgets.filter((k) => k !== key)
      : [...hiddenWidgets, key];

    updatePreferences({ hiddenWidgets: nextHidden });
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Customize Home Dashboard"
      subtitle="Show or hide widgets and reset your workspace layout"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="outline"
            size="sm"
            icon={RotateCcw}
            onClick={() => {
              resetLayout();
            }}
          >
            Reset to Default
          </Button>
          <Button variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Helper Tip Card */}
        <div className="p-3.5 rounded-xl bg-brand-50/70 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-900/40 text-xs text-brand-800 dark:text-brand-300 flex items-start space-x-2.5">
          <Move className="w-4 h-4 mt-0.5 flex-shrink-0 text-brand-600" />
          <p>
            Toggle widgets on or off below. To reorder widgets directly on your Home page, click
            the <strong>"Customize Layout"</strong> toggle in the top-right of your dashboard and
            drag them.
          </p>
        </div>

        {/* Widgets checklist */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Visible Widgets
          </h4>

          <div className="space-y-1.5">
            {WIDGET_DEFINITIONS.map((w) => {
              const isHidden = hiddenWidgets.includes(w.key);

              return (
                <div
                  key={w.key}
                  onClick={() => toggleWidgetVisibility(w.key)}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    !isHidden
                      ? 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/60 text-slate-400 opacity-60'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                        !isHidden
                          ? 'bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {!isHidden ? <Check className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-xs font-semibold">{w.label}</span>
                  </div>

                  <span className="text-[11px] font-medium text-slate-400">
                    {!isHidden ? 'Visible' : 'Hidden'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Drawer>
  );
};

export default CustomizeHomeDrawer;
