import React, { useState } from 'react';
import {
  Calendar,
  CheckSquare,
  MessageSquare,
  Paperclip,
  Plus,
  AlertCircle,
  Clock,
  MoreVertical,
} from 'lucide-react';

const COLUMNS = [
  { key: 'backlog', label: 'Backlog', color: 'border-slate-300 dark:border-slate-700 bg-slate-500' },
  { key: 'todo', label: 'To Do', color: 'border-blue-400 bg-blue-500' },
  { key: 'in_progress', label: 'In Progress', color: 'border-amber-400 bg-amber-500' },
  { key: 'in_review', label: 'In Review', color: 'border-purple-400 bg-purple-500' },
  { key: 'done', label: 'Done', color: 'border-emerald-400 bg-emerald-500' },
  { key: 'blocked', label: 'Blocked', color: 'border-red-400 bg-red-500' },
];

const PRIORITY_STYLES = {
  urgent: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
  high: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
  medium: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900',
  low: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
};

export const KanbanBoard = ({
  tasks = [],
  onTaskClick,
  onTaskMove,
  onAddTask,
}) => {
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, columnKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== columnKey) {
      setDragOverColumn(columnKey);
    }
  };

  const handleDragLeave = (e, columnKey) => {
    if (dragOverColumn === columnKey) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e, columnKey) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDragOverColumn(null);
    setDraggedTaskId(null);

    if (taskId && onTaskMove) {
      onTaskMove(taskId, columnKey);
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 pt-1 min-h-[600px] select-none">
      {COLUMNS.map((col) => {
        const columnTasks = tasks
          .filter((t) => t.status === col.key)
          .sort((a, b) => (a.order || 0) - (b.order || 0));

        const isOver = dragOverColumn === col.key;

        return (
          <div
            key={col.key}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDragLeave={(e) => handleDragLeave(e, col.key)}
            onDrop={(e) => handleDrop(e, col.key)}
            className={`w-80 flex-shrink-0 flex flex-col rounded-2xl border transition-all ${
              isOver
                ? 'bg-brand-50/50 dark:bg-brand-950/20 border-brand-400 dark:border-brand-600 shadow-md ring-2 ring-brand-500/20'
                : 'bg-slate-100/70 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800'
            }`}
          >
            {/* Column Header */}
            <div className="p-3.5 flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${col.color}`} />
                <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200 tracking-wide uppercase">
                  {col.label}
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-slate-500 shadow-xs border border-slate-200/60 dark:border-slate-700">
                  {columnTasks.length}
                </span>
              </div>

              {onAddTask && (
                <button
                  onClick={() => onAddTask(col.key)}
                  className="p-1 text-slate-400 hover:text-brand-600 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title={`Add task to ${col.label}`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Cards Container */}
            <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto max-h-[calc(100vh-280px)]">
              {columnTasks.length === 0 ? (
                <div className="h-28 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                  <span>No tasks</span>
                  <span className="text-[10px] text-slate-300 dark:text-slate-600 mt-0.5">Drop here</span>
                </div>
              ) : (
                columnTasks.map((t) => {
                  const checklistDone = (t.checklist || []).filter((c) => c.done).length;
                  const checklistTotal = (t.checklist || []).length;
                  const isOverdue =
                    t.dueDate && t.status !== 'done' && new Date(t.dueDate) < new Date();

                  return (
                    <div
                      key={t._id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, t._id)}
                      onClick={() => onTaskClick && onTaskClick(t)}
                      className={`p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs hover:shadow-md hover:border-brand-500/60 dark:hover:border-brand-500/60 transition-all cursor-grab active:cursor-grabbing group ${
                        draggedTaskId === t._id ? 'opacity-40 scale-95' : 'opacity-100'
                      }`}
                    >
                      {/* Top Code & Priority */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono text-[11px] font-bold text-slate-400 group-hover:text-brand-600 transition-colors">
                          {t.taskCode}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                            PRIORITY_STYLES[t.priority] || PRIORITY_STYLES.medium
                          }`}
                        >
                          {t.priority}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-2 leading-relaxed">
                        {t.title}
                      </h4>

                      {/* Labels */}
                      {t.labels && t.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {t.labels.slice(0, 3).map((lbl, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 rounded"
                            >
                              {lbl}
                            </span>
                          ))}
                          {t.labels.length > 3 && (
                            <span className="text-[10px] text-slate-400">+{t.labels.length - 3}</span>
                          )}
                        </div>
                      )}

                      {/* Card Footer: Due Date, Checklist, Assignees */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-3">
                          {t.dueDate && (
                            <span
                              className={`flex items-center gap-1 text-[11px] font-semibold ${
                                isOverdue
                                  ? 'text-red-600 dark:text-red-400 font-bold'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                              title={isOverdue ? 'Overdue task' : 'Due date'}
                            >
                              <Calendar className="w-3 h-3" />
                              {new Date(t.dueDate).toLocaleDateString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          )}

                          {checklistTotal > 0 && (
                            <span
                              className={`flex items-center gap-1 text-[11px] ${
                                checklistDone === checklistTotal
                                  ? 'text-emerald-600 font-bold'
                                  : 'text-slate-400'
                              }`}
                            >
                              <CheckSquare className="w-3 h-3" />
                              {checklistDone}/{checklistTotal}
                            </span>
                          )}

                          {t.attachments && t.attachments.length > 0 && (
                            <span className="flex items-center gap-0.5 text-[11px] text-slate-400">
                              <Paperclip className="w-3 h-3" />
                              {t.attachments.length}
                            </span>
                          )}
                        </div>

                        {/* Assignee Avatars */}
                        <div className="flex items-center -space-x-1.5">
                          {t.assignees && t.assignees.length > 0 ? (
                            t.assignees.slice(0, 3).map((emp) => (
                              <div
                                key={emp._id}
                                className="w-6 h-6 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 text-white font-bold text-[10px] flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-xs"
                                title={`${emp.personal?.firstName || 'Employee'}`}
                              >
                                {emp.personal?.firstName?.charAt(0) || 'U'}
                              </div>
                            ))
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-800" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanBoard;
