import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useTimer } from '../context/TimerContext';
import {
  X,
  Clock,
  Calendar,
  CheckSquare,
  MessageSquare,
  Paperclip,
  Activity,
  Plus,
  Trash2,
  Send,
  User,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  AtSign,
  Tag,
  Flag,
  Play,
  Square,
} from 'lucide-react';

export const TaskModal = ({ taskId, onClose, onTaskUpdated, allEmployees = [] }) => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { activeTimer, isRunning, startTimer, stopTimer } = useTimer();
  const [task, setTask] = useState(null);
  const [subtasks, setSubtasks] = useState([]);
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [activeTab, setActiveTab] = useState('details'); // details | checklist | comments | activity
  const [loading, setLoading] = useState(true);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [newCommentBody, setNewCommentBody] = useState('');
  const [selectedMentions, setSelectedMentions] = useState([]);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [timerLoading, setTimerLoading] = useState(false);

  const fetchTaskDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/tasks/${taskId}`);
      if (res.success) {
        setTask(res.data);
        setSubtasks(res.data.subtasks || []);
        setComments(res.data.comments || []);
        setActivities(res.data.activities || []);
      }
    } catch (err) {
      console.error('Failed to load task details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) {
      fetchTaskDetails();
    }
  }, [taskId]);

  const handleStatusChange = async (newStatus) => {
    try {
      const res = await api.patch(`/tasks/${task._id}/status`, { status: newStatus });
      if (res.success) {
        setTask((prev) => ({ ...prev, status: newStatus }));
        if (onTaskUpdated) onTaskUpdated();
        fetchTaskDetails();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handlePriorityChange = async (newPriority) => {
    try {
      const res = await api.put(`/tasks/${task._id}`, { priority: newPriority });
      if (res.success) {
        setTask((prev) => ({ ...prev, priority: newPriority }));
        if (onTaskUpdated) onTaskUpdated();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update priority');
    }
  };

  const handleToggleChecklist = async (index) => {
    const updatedChecklist = [...(task.checklist || [])];
    updatedChecklist[index].done = !updatedChecklist[index].done;

    try {
      const res = await api.put(`/tasks/${task._id}`, { checklist: updatedChecklist });
      if (res.success) {
        setTask((prev) => ({ ...prev, checklist: updatedChecklist }));
        if (onTaskUpdated) onTaskUpdated();
      }
    } catch (err) {
      console.error('Failed to toggle checklist', err);
    }
  };

  const isThisTaskTimerRunning =
    isRunning && (activeTimer?.task?._id || activeTimer?.task) === task?._id;

  const handleToggleTimer = async () => {
    if (!hasPermission('activity.logOwn')) return;
    try {
      setTimerLoading(true);
      if (isThisTaskTimerRunning) {
        await stopTimer();
        fetchTaskDetails();
      } else {
        await startTimer({
          project: task.project?._id || task.project,
          task: task._id,
          description: task.title,
          isBillable: true,
          category: 'project_work',
        });
      }
    } catch (err) {
      alert(err.message || 'Timer action failed');
    } finally {
      setTimerLoading(false);
    }
  };

  const handleAddChecklistItem = async (e) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;

    const updatedChecklist = [...(task.checklist || []), { text: newChecklistText.trim(), done: false }];
    try {
      const res = await api.put(`/tasks/${task._id}`, { checklist: updatedChecklist });
      if (res.success) {
        setTask((prev) => ({ ...prev, checklist: updatedChecklist }));
        setNewChecklistText('');
        if (onTaskUpdated) onTaskUpdated();
      }
    } catch (err) {
      alert('Failed to add checklist item');
    }
  };

  const handleRemoveChecklistItem = async (index) => {
    const updatedChecklist = task.checklist.filter((_, i) => i !== index);
    try {
      const res = await api.put(`/tasks/${task._id}`, { checklist: updatedChecklist });
      if (res.success) {
        setTask((prev) => ({ ...prev, checklist: updatedChecklist }));
        if (onTaskUpdated) onTaskUpdated();
      }
    } catch (err) {
      console.error('Failed to remove checklist item', err);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newCommentBody.trim()) return;

    setIsSubmittingComment(true);
    try {
      const res = await api.post(`/tasks/${task._id}/comments`, {
        body: newCommentBody.trim(),
        mentions: selectedMentions,
      });
      if (res.success) {
        setComments((prev) => [...prev, res.data]);
        setNewCommentBody('');
        setSelectedMentions([]);
        fetchTaskDetails();
      }
    } catch (err) {
      alert('Failed to submit comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploadingAttachment(true);
    try {
      const res = await api.post(`/tasks/${task._id}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.success) {
        setTask((prev) => ({
          ...prev,
          attachments: [...(prev.attachments || []), res.data],
        }));
        fetchTaskDetails();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'File upload failed');
    } finally {
      setUploadingAttachment(false);
    }
  };

  if (loading || !task) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={onClose} />
        <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 h-full shadow-2xl flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      </div>
    );
  }

  const checklistDoneCount = (task.checklist || []).filter((c) => c.done).length;
  const checklistTotalCount = (task.checklist || []).length;
  const isOverdue =
    task.dueDate && task.status !== 'done' && new Date(task.dueDate) < new Date();

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 h-full shadow-2xl flex flex-col z-10 border-l border-slate-200 dark:border-slate-700">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
              {task.taskCode}
            </span>
            <span className="text-xs text-slate-400 capitalize font-medium">{task.type}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title & Quick Status Bar */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-snug">
              {task.title}
            </h2>
            {task.project && (
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                <span>Project:</span>
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {task.project.name} ({task.project.projectCode})
                </span>
              </p>
            )}
          </div>

          {/* Status & Priority Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Status</span>
              <select
                value={task.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full text-xs font-semibold px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 capitalize focus:outline-none focus:ring-1 focus:ring-brand-500 dark:text-white"
              >
                {['backlog', 'todo', 'in_progress', 'in_review', 'done', 'blocked'].map((st) => (
                  <option key={st} value={st}>
                    {st.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Priority</span>
              <select
                value={task.priority}
                onChange={(e) => handlePriorityChange(e.target.value)}
                className="w-full text-xs font-semibold px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 capitalize focus:outline-none focus:ring-1 focus:ring-brand-500 dark:text-white"
              >
                {['low', 'medium', 'high', 'urgent'].map((pr) => (
                  <option key={pr} value={pr}>
                    {pr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Due Date</span>
              <div
                className={`text-xs font-semibold mt-1 flex items-center gap-1 ${
                  isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-IN') : 'No Date'}
                {isOverdue && <span className="text-[10px] font-bold px-1 rounded bg-red-100 text-red-700">Overdue</span>}
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Time Logged</span>
              <div className="text-xs font-semibold mt-1 text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-brand-600" />
                  <span className="font-bold text-slate-900 dark:text-white">
                    {task.loggedHours || 0}h
                  </span>
                  <span className="text-slate-400">/ {task.estimatedHours || 0}h</span>
                </div>

                {hasPermission('activity.logOwn') && (
                  <button
                    onClick={handleToggleTimer}
                    disabled={timerLoading}
                    title={isThisTaskTimerRunning ? 'Stop Timer' : 'Start Timer for this task'}
                    className={`p-1 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold ${
                      isThisTaskTimerRunning
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}
                  >
                    {isThisTaskTimerRunning ? (
                      <>
                        <Square className="w-2.5 h-2.5 fill-current" />
                        Stop
                      </>
                    ) : (
                      <>
                        <Play className="w-2.5 h-2.5 fill-current" />
                        Timer
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Assignees & Reporter */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-xs text-slate-400 block mb-1 font-semibold uppercase tracking-wider">
                Assignees ({task.assignees?.length || 0})
              </span>
              <div className="flex items-center -space-x-1.5">
                {task.assignees && task.assignees.length > 0 ? (
                  task.assignees.map((emp) => (
                    <div
                      key={emp._id}
                      className="w-7 h-7 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 text-white font-bold text-[11px] flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-xs"
                      title={`${emp.personal?.firstName} ${emp.personal?.lastName} (${emp.employment?.designation})`}
                    >
                      {emp.personal?.firstName?.charAt(0)}
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">Unassigned</span>
                )}
              </div>
            </div>

            {task.reporter && (
              <div className="text-right">
                <span className="text-xs text-slate-400 block mb-1 font-semibold uppercase tracking-wider">
                  Reporter
                </span>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {task.reporter.personal?.firstName} {task.reporter.personal?.lastName}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Description</h4>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50/50 dark:bg-slate-900/30 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                {task.description}
              </p>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="border-b border-slate-200 dark:border-slate-700 flex items-center gap-6">
            <button
              onClick={() => setActiveTab('checklist')}
              className={`pb-3 text-xs font-semibold flex items-center gap-1.5 transition-colors relative ${
                activeTab === 'checklist'
                  ? 'text-brand-600 dark:text-brand-400'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Checklist ({checklistDoneCount}/{checklistTotalCount})
              {activeTab === 'checklist' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 rounded-full" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('comments')}
              className={`pb-3 text-xs font-semibold flex items-center gap-1.5 transition-colors relative ${
                activeTab === 'comments'
                  ? 'text-brand-600 dark:text-brand-400'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Discussion ({comments.length})
              {activeTab === 'comments' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 rounded-full" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('activity')}
              className={`pb-3 text-xs font-semibold flex items-center gap-1.5 transition-colors relative ${
                activeTab === 'activity'
                  ? 'text-brand-600 dark:text-brand-400'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              History ({activities.length})
              {activeTab === 'activity' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 rounded-full" />
              )}
            </button>
          </div>

          {/* Tab Content: Checklist */}
          {activeTab === 'checklist' && (
            <div className="space-y-4">
              {/* Progress Bar */}
              {checklistTotalCount > 0 && (
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>Task Checklist Completion</span>
                    <span>
                      {Math.round((checklistDoneCount / checklistTotalCount) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all"
                      style={{
                        width: `${(checklistDoneCount / checklistTotalCount) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Items List */}
              <div className="space-y-2">
                {(task.checklist || []).map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors"
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer text-xs flex-1">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => handleToggleChecklist(idx)}
                        className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
                      />
                      <span
                        className={`${
                          item.done
                            ? 'line-through text-slate-400'
                            : 'text-slate-700 dark:text-slate-200 font-medium'
                        }`}
                      >
                        {item.text}
                      </span>
                    </label>
                    <button
                      onClick={() => handleRemoveChecklistItem(idx)}
                      className="text-slate-400 hover:text-red-500 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add checklist input */}
              <form onSubmit={handleAddChecklistItem} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a step to checklist..."
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold"
                >
                  Add
                </button>
              </form>
            </div>
          )}

          {/* Tab Content: Comments / Discussion */}
          {activeTab === 'comments' && (
            <div className="space-y-4">
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-4">
                    No comments yet. Start the conversation below!
                  </p>
                ) : (
                  comments.map((c) => (
                    <div
                      key={c._id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {c.author?.employee?.personal
                            ? `${c.author.employee.personal.firstName} ${c.author.employee.personal.lastName}`
                            : c.author?.email}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(c.createdAt).toLocaleDateString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {c.body}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* New Comment Input */}
              <form onSubmit={handleAddComment} className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <textarea
                  rows="3"
                  placeholder="Type a comment or question... (Mentions will trigger in-app notification)"
                  value={newCommentBody}
                  onChange={(e) => setNewCommentBody(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                />

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Use @ to alert team members
                  </span>
                  <button
                    type="submit"
                    disabled={isSubmittingComment || !newCommentBody.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {isSubmittingComment ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Post Comment
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tab Content: Activity Timeline */}
          {activeTab === 'activity' && (
            <div className="space-y-3">
              {activities.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4">No activity logged yet.</p>
              ) : (
                <div className="relative pl-4 space-y-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                  {activities.map((act) => (
                    <div key={act._id} className="relative flex items-start gap-3 text-xs">
                      <div className="w-3 h-3 rounded-full bg-brand-500 border-2 border-white dark:border-slate-800 -ml-[19px] mt-1" />
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {act.actor?.employee?.personal
                            ? `${act.actor.employee.personal.firstName} ${act.actor.employee.personal.lastName}`
                            : act.actor?.email}
                        </span>{' '}
                        <span className="text-slate-500">
                          {act.action === 'STATUS_CHANGE'
                            ? `moved task from ${act.from} to ${act.to}`
                            : act.action === 'CREATED'
                            ? 'created this task'
                            : act.action === 'COMMENT_ADDED'
                            ? 'added a comment'
                            : act.action}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(act.createdAt).toLocaleDateString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskModal;

