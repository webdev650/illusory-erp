import React from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export const PageHeader = ({
  title,
  subtitle,
  breadcrumbs = [],
  actions,
  badge,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200/80 dark:border-slate-800 ${className}`}
    >
      <div className="space-y-1">
        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <nav className="flex items-center space-x-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-1">
            <NavLink to="/" className="hover:text-slate-700 dark:hover:text-slate-300">
              Home
            </NavLink>
            {breadcrumbs.map((bc, idx) => (
              <React.Fragment key={idx}>
                <ChevronRight className="w-3 h-3 text-slate-400" />
                {bc.path ? (
                  <NavLink to={bc.path} className="hover:text-slate-700 dark:hover:text-slate-300">
                    {bc.label}
                  </NavLink>
                ) : (
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">
                    {bc.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* Title and optional Badge */}
        <div className="flex items-center space-x-3">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h1>
          {badge && <div>{badge}</div>}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>

      {/* Action Buttons Slot */}
      {actions && (
        <div className="flex items-center space-x-2.5 flex-shrink-0">{actions}</div>
      )}
    </div>
  );
};

export default PageHeader;
