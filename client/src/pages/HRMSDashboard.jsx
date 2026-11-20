import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { usePreferences } from '../context/PreferencesContext';
import DashboardGrid from '../components/dashboard/DashboardGrid';

// Import all 12 widgets
import EmployeeStatusTypeWidget from '../components/widgets/hrms/EmployeeStatusTypeWidget';
import OverviewStatsWidget from '../components/widgets/hrms/OverviewStatsWidget';
import EmployeeStrengthWidget from '../components/widgets/hrms/EmployeeStrengthWidget';
import NetGrowthWidget from '../components/widgets/hrms/NetGrowthWidget';
import EmployeeDistributionWidget from '../components/widgets/hrms/EmployeeDistributionWidget';
import LeaveTypeWidget from '../components/widgets/hrms/LeaveTypeWidget';
import LateReasonWidget from '../components/widgets/hrms/LateReasonWidget';
import EmployeeGrowthWidget from '../components/widgets/hrms/EmployeeGrowthWidget';
import LateAttendanceChartWidget from '../components/widgets/hrms/LateAttendanceChartWidget';
import LateArrivalTodayWidget from '../components/widgets/hrms/LateArrivalTodayWidget';
import NoLeaveEmployeeWidget from '../components/widgets/hrms/NoLeaveEmployeeWidget';
import AverageMoodWidget from '../components/widgets/hrms/AverageMoodWidget';

const DEFAULT_HRMS_LAYOUT = [
  'overview_stats',
  'status_type',
  'strength',
  'net_growth',
  'distribution',
  'growth',
  'late_attendance',
  'late_today',
  'leave_types',
  'late_reasons',
  'no_leave',
  'mood_summary',
];

const DEFAULT_HRMS_SIZES = {
  overview_stats: 'L',
  status_type: 'M',
  strength: 'M',
  net_growth: 'M',
  distribution: 'M',
  growth: 'M',
  late_attendance: 'M',
  late_today: 'S',
  leave_types: 'M',
  late_reasons: 'S',
  no_leave: 'S',
  mood_summary: 'M',
};

const HRMS_WIDGET_REGISTRY = [
  { key: 'overview_stats', title: 'Employee Overview Statistics', defaultSize: 'L' },
  { key: 'status_type', title: 'Employee Status & Type', defaultSize: 'M' },
  { key: 'strength', title: 'Employee Strength', defaultSize: 'M' },
  { key: 'net_growth', title: 'Net Growth', defaultSize: 'M' },
  { key: 'distribution', title: 'Employee Distribution', defaultSize: 'M' },
  { key: 'growth', title: 'Employee Growth Comparison', defaultSize: 'M' },
  { key: 'late_attendance', title: 'Late Attendance Analytics', defaultSize: 'M' },
  { key: 'late_today', title: 'Late Arrival Today', defaultSize: 'S' },
  { key: 'leave_types', title: 'Leave Type Breakdown', defaultSize: 'M' },
  { key: 'late_reasons', title: 'Late Arrival Reasons', defaultSize: 'S' },
  { key: 'no_leave', title: 'No Leave Employees', defaultSize: 'S' },
  { key: 'mood_summary', title: 'Studio Mood & Pulse', defaultSize: 'M' },
];

export const HRMSDashboard = () => {
  const { getDashboardConfig, updateDashboardConfig } = usePreferences();
  const savedConfig = getDashboardConfig('hrms', DEFAULT_HRMS_LAYOUT);

  const [layout, setLayout] = useState(savedConfig.layout || DEFAULT_HRMS_LAYOUT);
  const [hiddenWidgets, setHiddenWidgets] = useState(savedConfig.hiddenWidgets || []);
  const [widgetSizes, setWidgetSizes] = useState({ ...DEFAULT_HRMS_SIZES, ...(savedConfig.widgetSizes || {}) });
  const [isMasked, setIsMasked] = useState(false);
  const [departments, setDepartments] = useState([]);

  // Per-widget data and loading state
  const [widgetData, setWidgetData] = useState({});
  const [loadingMap, setLoadingMap] = useState({});
  const [errorMap, setErrorMap] = useState({});
  const [filterMap, setFilterMap] = useState(savedConfig.filters || {});

  // Fetch departments for filter dropdowns
  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await api.get('/departments');
        if (res.success && res.data) {
          setDepartments(res.data);
        }
      } catch {
        // Fallback silently
      }
    };
    fetchDepts();
  }, []);

  // Fetch single widget data
  const fetchWidget = useCallback(
    async (key, customFilters = null) => {
      setLoadingMap((prev) => ({ ...prev, [key]: true }));
      setErrorMap((prev) => ({ ...prev, [key]: null }));

      const currentFilter = customFilters || filterMap[key] || {};
      const params = new URLSearchParams();
      if (currentFilter.department) params.append('department', currentFilter.department);
      if (currentFilter.employeeType) params.append('employeeType', currentFilter.employeeType);
      if (currentFilter.groupBy) params.append('groupBy', currentFilter.groupBy);
      if (currentFilter.crossBy) params.append('crossBy', currentFilter.crossBy);
      if (currentFilter.from) params.append('from', currentFilter.from);
      if (currentFilter.to) params.append('to', currentFilter.to);

      const endpointMap = {
        overview_stats: '/hrms/dashboard/overview-stats',
        status_type: '/hrms/dashboard/status-summary',
        strength: '/hrms/dashboard/strength?months=12',
        net_growth: '/hrms/dashboard/net-growth?months=12',
        distribution: `/hrms/dashboard/distribution?${params.toString()}`,
        growth: '/hrms/dashboard/growth?months=12',
        late_attendance: `/hrms/dashboard/late-attendance?${params.toString()}`,
        late_today: `/hrms/dashboard/late-today?${params.toString()}`,
        leave_types: `/hrms/dashboard/leave-types?${params.toString()}`,
        late_reasons: `/hrms/dashboard/late-reasons?${params.toString()}`,
        no_leave: `/hrms/dashboard/no-leave?${params.toString()}`,
        mood_summary: `/hrms/dashboard/mood-summary?${params.toString()}`,
      };

      const url = endpointMap[key];
      if (!url) return;

      try {
        const res = await api.get(url);
        if (res.success && res.data !== undefined) {
          setWidgetData((prev) => ({ ...prev, [key]: res.data }));
        }
      } catch (err) {
        setErrorMap((prev) => ({
          ...prev,
          [key]: err.message || 'Failed to load widget metrics',
        }));
      } finally {
        setLoadingMap((prev) => ({ ...prev, [key]: false }));
      }
    },
    [filterMap]
  );

  // Fetch all active widgets on mount
  useEffect(() => {
    layout.forEach((key) => {
      if (!hiddenWidgets.includes(key)) {
        fetchWidget(key);
      }
    });
  }, [layout, hiddenWidgets, fetchWidget]);

  // Layout updates
  const handleUpdateLayout = (newLayout) => {
    setLayout(newLayout);
    updateDashboardConfig('hrms', { layout: newLayout });
  };

  const handleUpdateHidden = (newHidden) => {
    setHiddenWidgets(newHidden);
    updateDashboardConfig('hrms', { hiddenWidgets: newHidden });
  };

  const handleUpdateSizes = (newSizes) => {
    setWidgetSizes(newSizes);
    updateDashboardConfig('hrms', { widgetSizes: newSizes });
  };

  const handleResetLayout = () => {
    setLayout(DEFAULT_HRMS_LAYOUT);
    setHiddenWidgets([]);
    setWidgetSizes(DEFAULT_HRMS_SIZES);
    updateDashboardConfig('hrms', {
      layout: DEFAULT_HRMS_LAYOUT,
      hiddenWidgets: [],
      widgetSizes: DEFAULT_HRMS_SIZES,
      filters: {},
    });
    DEFAULT_HRMS_LAYOUT.forEach((k) => fetchWidget(k, {}));
  };

  const handleRefreshAll = () => {
    layout.forEach((key) => {
      if (!hiddenWidgets.includes(key)) {
        fetchWidget(key);
      }
    });
  };

  // Filter updates
  const handleUpdateFilters = (key, newFilter) => {
    const updated = { ...filterMap, [key]: newFilter };
    setFilterMap(updated);
    updateDashboardConfig('hrms', { filters: updated });
    fetchWidget(key, newFilter);
  };

  const handleApplyFiltersToAll = (appliedFilter) => {
    const newFilterMap = {};
    layout.forEach((k) => {
      newFilterMap[k] = appliedFilter;
    });
    setFilterMap(newFilterMap);
    updateDashboardConfig('hrms', { filters: newFilterMap });
    layout.forEach((k) => fetchWidget(k, appliedFilter));
  };

  // Widget Renderer
  const renderWidget = (key, widgetDef) => {
    const commonProps = {
      data: widgetData[key],
      loading: loadingMap[key] || false,
      error: errorMap[key],
      filters: filterMap[key] || {},
      departments,
      isMasked,
      onToggleMask: () => setIsMasked(!isMasked),
      onUpdateFilters: (f) => handleUpdateFilters(key, f),
      onApplyFiltersToAll: handleApplyFiltersToAll,
      onRefresh: () => fetchWidget(key),
      onRemove: () => handleUpdateHidden([...hiddenWidgets, key]),
    };

    switch (key) {
      case 'overview_stats':
        return <OverviewStatsWidget {...commonProps} />;
      case 'status_type':
        return <EmployeeStatusTypeWidget {...commonProps} />;
      case 'strength':
        return <EmployeeStrengthWidget {...commonProps} />;
      case 'net_growth':
        return <NetGrowthWidget {...commonProps} />;
      case 'distribution':
        return (
          <EmployeeDistributionWidget
            {...commonProps}
            onParamChange={(params) => {
              const current = filterMap[key] || {};
              const updated = { ...current, ...params };
              handleUpdateFilters(key, updated);
            }}
          />
        );
      case 'growth':
        return <EmployeeGrowthWidget {...commonProps} />;
      case 'late_attendance':
        return <LateAttendanceChartWidget {...commonProps} />;
      case 'late_today':
        return <LateArrivalTodayWidget {...commonProps} />;
      case 'leave_types':
        return <LeaveTypeWidget {...commonProps} />;
      case 'late_reasons':
        return <LateReasonWidget {...commonProps} />;
      case 'no_leave':
        return <NoLeaveEmployeeWidget {...commonProps} />;
      case 'mood_summary':
        return <AverageMoodWidget {...commonProps} />;
      default:
        return null;
    }
  };

  return (
    <DashboardGrid
      dashboardKey="hrms"
      title="HRMS Dashboard"
      subtitle="Workforce metrics, headcount growth, late attendance & studio pulse"
      allWidgets={HRMS_WIDGET_REGISTRY}
      layout={layout}
      hiddenWidgets={hiddenWidgets}
      widgetSizes={widgetSizes}
      onUpdateLayout={handleUpdateLayout}
      onUpdateHiddenWidgets={handleUpdateHidden}
      onUpdateSizes={handleUpdateSizes}
      onResetLayout={handleResetLayout}
      onRefreshAll={handleRefreshAll}
      renderWidget={renderWidget}
    />
  );
};

export default HRMSDashboard;
