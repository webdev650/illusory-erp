import React from 'react';
import { Loader2 } from 'lucide-react';
import EmptyState from './EmptyState';

export const DataTable = ({
  columns = [],
  data = [],
  keyField = '_id',
  loading = false,
  emptyMessage = 'No records found',
  emptySubtext = 'Try clearing filters or adding a new record',
  onRowClick,
  className = '',
}) => {
  return (
    <div className={`overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#151A26] ${className}`}>
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
            {columns.map((col, idx) => (
              <th
                key={col.key || idx}
                className={`py-3 px-4 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-500" />
                <span className="text-xs">Loading records...</span>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-12">
                <EmptyState title={emptyMessage} description={emptySubtext} />
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => (
              <tr
                key={row[keyField] || rowIdx}
                onClick={() => onRowClick && onRowClick(row)}
                className={`transition-colors ${
                  onRowClick
                    ? 'cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                    : 'hover:bg-slate-50/40 dark:hover:bg-slate-800/20'
                }`}
              >
                {columns.map((col, colIdx) => (
                  <td
                    key={col.key || colIdx}
                    className={`py-3 px-4 text-slate-700 dark:text-slate-300 ${
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                    } ${col.cellClassName || ''}`}
                  >
                    {col.render ? col.render(row[col.key], row, rowIdx) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;

