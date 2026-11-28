import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { useOutletContext } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

// Widgets
import WelcomeBannerWidget from '../components/widgets/WelcomeBannerWidget';
import HRKpiWidget from '../components/widgets/HRKpiWidget';
import AttendanceWidget from '../components/widgets/AttendanceWidget';
import MyTasksWidget from '../components/widgets/MyTasksWidget';
import TasksDueTodayWidget from '../components/widgets/TasksDueTodayWidget';
import WeeklyHoursWidget from '../components/widgets/WeeklyHoursWidget';
import MyProjectsWidget from '../components/widgets/MyProjectsWidget';
import LeaveBalanceWidget from '../components/widgets/LeaveBalanceWidget';
import TeamOnLeaveWidget from '../components/widgets/TeamOnLeaveWidget';
import PendingApprovalsWidget from '../components/widgets/PendingApprovalsWidget';
import AnnouncementsWidget from '../components/widgets/AnnouncementsWidget';
import HolidaysWidget from '../components/widgets/HolidaysWidget';
import CelebrationsWidget from '../components/widgets/CelebrationsWidget';
import ChartsWidget from '../components/widgets/ChartsWidget';
import SortableWidget from '../components/widgets/SortableWidget';

import { Button } from '../components/ui';
import {
  SlidersHorizontal,
  RotateCcw,
  Check,
  Sparkles,
} from 'lucide-react';

export const Home = () => {
  const { user, role, hasPermission } = useAuth();
  const { preferences, updatePreferences, resetLayout } = usePreferences();
  const outletCtx = useOutletContext();
  const [isCustomizeMode, setIsCustomizeMode] = useState(false);

  const isSuperAdmin = role === 'super_admin';
  const isAttendanceTracked = user?.employee?.employment?.attendanceTracked ?? true;
  const shouldShowAttendance = isAttendanceTracked;

  const isAdminOrHr = ['super_admin', 'admin', 'hr'].includes(role) || hasPermission('dashboard.read');
  const isManagerOrAdmin = ['super_admin', 'admin', 'hr', 'project_manager'].includes(role);

  // Setup DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Default layout if none set
  const defaultLeftLayout = [
    'welcome',
    isAdminOrHr ? 'kpi' : null,
    'my_tasks',
    'tasks_due',
    'weekly_hours',
    'my_projects',
    'leave_balance',
    isManagerOrAdmin ? 'team_on_leave' : null,
    'pending_approvals',
    'announcements',
    'charts',
  ].filter(Boolean);

  const homeLayout = preferences?.homeLayout?.length
    ? preferences.homeLayout
    : defaultLeftLayout;

  const hiddenWidgets = preferences?.hiddenWidgets || [];

  // Filter widgets by visibility and permissions
  const activeWidgetIds = useMemo(() => {
    return homeLayout.filter((widgetId) => {
      if (hiddenWidgets.includes(widgetId)) return false;
      if (widgetId === 'kpi' && !isAdminOrHr) return false;
      if (widgetId === 'team_on_leave' && !isManagerOrAdmin) return false;
      return true;
    });
  }, [homeLayout, hiddenWidgets, isAdminOrHr, isManagerOrAdmin]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = activeWidgetIds.indexOf(active.id);
      const newIndex = activeWidgetIds.indexOf(over.id);
      const reordered = arrayMove(activeWidgetIds, oldIndex, newIndex);
      updatePreferences({ homeLayout: reordered });
    }
  };

  // Render widget by key
  const renderWidget = (id) => {
    switch (id) {
      case 'welcome':
        return <WelcomeBannerWidget />;
      case 'kpi':
        return isAdminOrHr ? <HRKpiWidget /> : null;
      case 'my_tasks':
        return <MyTasksWidget />;
      case 'tasks_due':
        return <TasksDueTodayWidget />;
      case 'weekly_hours':
        return <WeeklyHoursWidget />;
      case 'my_projects':
        return <MyProjectsWidget />;
      case 'leave_balance':
        return <LeaveBalanceWidget />;
      case 'team_on_leave':
        return isManagerOrAdmin ? <TeamOnLeaveWidget /> : null;
      case 'pending_approvals':
        return <PendingApprovalsWidget />;
      case 'announcements':
        return <AnnouncementsWidget />;
      case 'upcoming_holidays':
        return <HolidaysWidget />;
      case 'celebrations':
        return <CelebrationsWidget />;
      case 'charts':
        return <ChartsWidget />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top dashboard action bar */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Studio Dashboard
          </h1>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            Your live operational command center
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {isCustomizeMode && (
            <Button
              variant="outline"
              size="sm"
              icon={RotateCcw}
              onClick={() => resetLayout()}
            >
              Reset Layout
            </Button>
          )}

          <Button
            variant={isCustomizeMode ? 'primary' : 'outline'}
            size="sm"
            icon={isCustomizeMode ? Check : SlidersHorizontal}
            onClick={() => setIsCustomizeMode(!isCustomizeMode)}
          >
            {isCustomizeMode ? 'Finish Customizing' : 'Customize Layout'}
          </Button>
        </div>
      </div>

      {/* Mobile Top Attendance Card (<1024px): Prominent Clock-in right at the top */}
      {shouldShowAttendance && (
        <div className="lg:hidden mb-6">
          <AttendanceWidget />
        </div>
      )}

      {/* Two-Column Main Layout: LEFT (Wide) & RIGHT (Attendance & Small Widgets) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Wide widget stack (7 cols on lg, 8 cols on xl) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6 min-w-0">
          {activeWidgetIds.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
              <Sparkles className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No widgets displayed</p>
              <p className="text-xs text-slate-400 mt-1">Click "Customize Layout" above to add widgets to your home dashboard.</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={activeWidgetIds}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-6">
                  {activeWidgetIds.map((id) => (
                    <SortableWidget
                      key={id}
                      id={id}
                      isCustomizeMode={isCustomizeMode}
                    >
                      {renderWidget(id)}
                    </SortableWidget>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* RIGHT COLUMN: Narrow fixed column (5 cols on lg, 4 cols on xl) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* Top fixed Attendance Widget (shown on desktop only for tracked staff) */}
          {shouldShowAttendance && (
            <div className="hidden lg:block">
              <AttendanceWidget />
            </div>
          )}

          {/* Celebrations this week */}
          <CelebrationsWidget />

          {/* Upcoming holidays */}
          <HolidaysWidget />
        </div>
      </div>
    </div>
  );
};

export default Home;
