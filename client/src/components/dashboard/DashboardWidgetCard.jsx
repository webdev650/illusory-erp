import React, { useState } from 'react';
import {
  GripVertical,
  Eye,
  EyeOff,
  Filter,
  RotateCw,
  X,
  Share2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export const DashboardWidgetCard = ({
  widgetKey,
  title,
  subtitle,
  icon: Icon,
  dragHandleProps,
  isMasked,
  onToggleMask,
  filters,
  onUpdateFilters,
  onApplyFiltersToAll,
  onRefresh,
  onRemove,
  loading = false,
  error = null,
  isEmpty = false,
  emptyMessage = 'No data available',
  departments = [],
  children,
  className = '',
}) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters || {});

  const handleApplyFilter = () => {
    onUpdateFilters?.(localFilters);
    setIsFilterOpen(false);
  };

  const handleApplyToAll = () => {
    onApplyFiltersToAll?.(localFilters);
    setIsFilterOpen(false);
  };

  return (
    <div
      className={`bg-white dark:bg-[#151A26] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col h-full relative transition-shadow hover:shadow-md ${className}`}
    >
      {/* Widget Header */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
        {/* Left: Drag Handle & Title */}
        <div className="flex items-center space-x-2 truncate">
          <button
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 rounded transition-colors"
            title="Drag to reorder"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          {Icon && (
            <div className="w-6 h-6 rounded-lg bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center flex-shrink-0">
              <Icon className="w-3.5 h-3.5" />
            </div>
          )}
          <div className="truncate">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-tight truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
          {/* Eye Toggle */}
          {onToggleMask && (
            <button
              onClick={onToggleMask}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={isMasked ? 'Reveal Values' : 'Hide Values'}
            >
              {isMasked ? <EyeOff className="w-3.5 h-3.5 text-brand-500" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Filter Popover Toggle */}
          <div className="relative">
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`p-1 rounded-md transition-colors ${
                isFilterOpen || Object.keys(filters || {}).length > 0
                  ? 'bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Widget Filters"
            >
              <Filter className="w-3.5 h-3.5" />
            </button>

            {/* Filter Dropdown Popover */}
            {isFilterOpen && (
              <div className="absolute right-0 top-8 z-30 w-64 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl text-xs space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-200">
                  <span>Widget Filters</span>
                  <button
                    onClick={() => setIsFilterOpen(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Department filter */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                    Department
                  </label>
                  <select
                    value={localFilters.department || ''}
                    onChange={(e) =>
                      setLocalFilters({ ...localFilters, department: e.target.value })
                    }
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">All Departments</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Employee Type filter */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                    Workforce Type
                  </label>
                  <select
                    value={localFilters.employeeType || ''}
                    onChange={(e) =>
                      setLocalFilters({ ...localFilters, employeeType: e.target.value })
                    }
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">All Types</option>
                    <option value="Full-Time">Full-Time</option>
                    <option value="Probation">Probation</option>
                    <option value="Intern">Intern</option>
                    <option value="Contract">Contract</option>
                  </select>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={handleApplyToAll}
                    className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center space-x-1"
                    title="Apply these filters to all widgets on the dashboard"
                  >
                    <Share2 className="w-3 h-3" />
                    <span>Apply for all</span>
                  </button>
                  <button
                    onClick={handleApplyFilter}
                    className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Refresh */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className={`p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                loading ? 'animate-spin text-brand-500' : ''
              }`}
              title="Refresh Widget"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Remove / Close */}
          {onRemove && (
            <button
              onClick={onRemove}
              className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              title="Remove from Dashboard"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Widget Body */}
      <div className="p-4 flex-1 flex flex-col justify-center">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
            <span className="text-[11px]">Loading metrics...</span>
          </div>
        ) : error ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-2 px-4">
            <AlertCircle className="w-5 h-5 text-rose-500" />
            <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-md font-medium hover:bg-slate-200"
              >
                Retry
              </button>
            )}
          </div>
        ) : isEmpty ? (
          <div className="py-10 flex flex-col items-center justify-center text-center space-y-1.5 px-4 text-slate-400 dark:text-slate-500">
            <p className="text-xs font-medium">{emptyMessage}</p>
            <p className="text-[10px] text-slate-400">No records matching the current filters.</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export default DashboardWidgetCard;
