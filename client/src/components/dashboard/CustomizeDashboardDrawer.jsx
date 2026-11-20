import React from 'react';
import { X, RotateCcw, Eye, EyeOff, LayoutGrid } from 'lucide-react';

export const CustomizeDashboardDrawer = ({
  isOpen,
  onClose,
  allWidgets = [],
  layout = [],
  hiddenWidgets = [],
  widgetSizes = {},
  onToggleVisibility,
  onChangeSize,
  onResetLayout,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-sm bg-white dark:bg-[#151A26] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <LayoutGrid className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Customize Dashboard
                </h2>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Toggle widgets and adjust grid sizes
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body: Widgets List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3 no-scrollbar">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              <span>Available Widgets ({allWidgets.length})</span>
              <span>Size</span>
            </div>

            {allWidgets.map((w) => {
              const isHidden = hiddenWidgets.includes(w.key);
              const currentSize = widgetSizes[w.key] || w.defaultSize || 'M';

              return (
                <div
                  key={w.key}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                    isHidden
                      ? 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/50 opacity-60'
                      : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-750 shadow-xs'
                  }`}
                >
                  {/* Left: Eye + Title */}
                  <div className="flex items-center space-x-2.5 truncate mr-2">
                    <button
                      onClick={() => onToggleVisibility(w.key)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isHidden
                          ? 'bg-slate-200 text-slate-500 dark:bg-slate-800'
                          : 'bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400'
                      }`}
                      title={isHidden ? 'Show Widget' : 'Hide Widget'}
                    >
                      {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <div className="truncate">
                      <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {w.title}
                      </h4>
                      <span className="text-[10px] text-slate-400">
                        {isHidden ? 'Hidden' : 'Visible on dashboard'}
                      </span>
                    </div>
                  </div>

                  {/* Right: Size Pill Selector (S, M, L) */}
                  <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg flex-shrink-0">
                    {['S', 'M', 'L'].map((sz) => (
                      <button
                        key={sz}
                        disabled={isHidden}
                        onClick={() => onChangeSize(w.key, sz)}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${
                          currentSize === sz
                            ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-xs'
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                        }`}
                        title={
                          sz === 'S'
                            ? 'Small (4 columns)'
                            : sz === 'M'
                            ? 'Medium (6 columns)'
                            : 'Large (12 columns full-width)'
                        }
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer: Reset & Done */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
            <button
              onClick={onResetLayout}
              className="flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Layout</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl text-xs shadow-md shadow-brand-500/20"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomizeDashboardDrawer;
