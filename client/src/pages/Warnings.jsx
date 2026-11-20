import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { AlertTriangle, Plus, CheckCircle, Clock, ShieldAlert, X, Loader2 } from 'lucide-react';

export const Warnings = () => {
  const { user, hasPermission } = useAuth();
  const [warnings, setWarnings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [formData, setFormData] = useState({
    employee: '',
    type: 'warning',
    title: '',
    reason: '',
    improvementPlan: '',
    endDate: '',
  });

  const [closeTarget, setCloseTarget] = useState(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [closeLoading, setCloseLoading] = useState(false);

  const fetchWarnings = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterType !== 'all') params.append('type', filterType);
      if (filterStatus !== 'all') params.append('status', filterStatus);

      const res = await api.get(`/hrms/warnings?${params.toString()}`);
      if (res.success && res.data) {
        setWarnings(res.data);
      }
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarnings();
  }, [filterType, filterStatus]);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await api.get('/employees?limit=100');
        if (res.success && res.data?.employees) {
          setEmployees(res.data.employees);
        }
      } catch {
        //
      }
    };
    fetchEmployees();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.employee || !formData.reason) return;

    try {
      setCreateLoading(true);
      const res = await api.post('/hrms/warnings', formData);
      if (res.success) {
        setIsCreateOpen(false);
        setFormData({
          employee: '',
          type: 'warning',
          title: '',
          reason: '',
          improvementPlan: '',
          endDate: '',
        });
        fetchWarnings();
      }
    } catch {
      //
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCloseWarning = async (e) => {
    e.preventDefault();
    if (!closeTarget) return;

    try {
      setCloseLoading(true);
      const res = await api.patch(`/hrms/warnings/${closeTarget._id}/close`, {
        resolutionNote,
      });
      if (res.success) {
        setCloseTarget(null);
        setResolutionNote('');
        fetchWarnings();
      }
    } catch {
      //
    } finally {
      setCloseLoading(false);
    }
  };

  const canManage = hasPermission('hr.access') || hasPermission('user.manage');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Warnings & Performance Improvement Plans (PIP)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Formal performance notices, developmental timelines, and resolution tracking
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl text-xs shadow-xs shadow-brand-500/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Issue Notice / PIP</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-[#151A26] rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-400 uppercase">Type:</span>
          <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
            {['all', 'warning', 'pip'].map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1 font-semibold rounded-md transition-all ${
                  filterType === t
                    ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {t === 'all' ? 'All Notices' : t === 'pip' ? 'PIPs Only' : 'Warnings Only'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-400 uppercase">Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:border-brand-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="closed">Closed / Resolved</option>
          </select>
        </div>
      </div>

      {/* Warnings List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
          <p className="text-xs">Loading performance records...</p>
        </div>
      ) : warnings.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-[#151A26] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-8 space-y-2">
          <ShieldAlert className="w-10 h-10 text-emerald-500 mx-auto opacity-70" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            No active notices or PIPs
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            All team members meet studio performance and conduct benchmarks.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {warnings.map((w) => {
            const isPip = w.type === 'pip';
            const isActive = w.status === 'active';

            return (
              <div
                key={w._id}
                className="bg-white dark:bg-[#151A26] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs flex flex-col justify-between space-y-3"
              >
                <div>
                  {/* Top Badge & Date */}
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isPip
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}
                    >
                      {isPip ? 'PIP (30-60 Days)' : 'Formal Warning'}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                      }`}
                    >
                      {isActive ? 'Active' : 'Closed'}
                    </span>
                  </div>

                  {/* Employee Info */}
                  <div className="flex items-center space-x-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 font-bold flex items-center justify-center text-xs flex-shrink-0">
                      {w.employee?.personal?.firstName?.charAt(0) || 'U'}
                    </div>
                    <div className="truncate">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {w.employee?.personal?.firstName} {w.employee?.personal?.lastName}
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        {w.employee?.employeeId}
                      </p>
                    </div>
                  </div>

                  {/* Title & Reason */}
                  <div className="pt-2 space-y-1 text-xs">
                    <h5 className="font-semibold text-slate-800 dark:text-slate-100">
                      {w.title}
                    </h5>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-3">
                      {w.reason}
                    </p>
                    {w.improvementPlan && (
                      <div className="p-2 bg-slate-50 dark:bg-slate-900/60 rounded-lg text-[11px] text-slate-600 dark:text-slate-300 mt-2">
                        <span className="font-bold block text-slate-700 dark:text-slate-200">
                          Target Deliverables:
                        </span>
                        {w.improvementPlan}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Dates & Close action */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                  <span>
                    Issued: {new Date(w.issuedAt || w.createdAt).toLocaleDateString()}
                  </span>
                  {isActive && canManage && (
                    <button
                      onClick={() => setCloseTarget(w)}
                      className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 dark:bg-slate-800 dark:hover:bg-emerald-950/40 rounded-lg transition-colors text-slate-700 dark:text-slate-200"
                    >
                      Close / Resolve
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#151A26] rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Issue Notice / PIP
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Employee *</label>
                <select
                  required
                  value={formData.employee}
                  onChange={(e) => setFormData({ ...formData, employee: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100"
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.personal?.firstName} {emp.personal?.lastName} ({emp.employeeId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100"
                >
                  <option value="warning">Formal Warning</option>
                  <option value="pip">Performance Improvement Plan (PIP)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 30-Day PIP: Deliverable Punctuality"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">
                  Reason & Background *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Specific observations, feedback, or metrics..."
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">
                  Improvement Plan / Action Items
                </label>
                <textarea
                  rows={2}
                  placeholder="Expected milestones, weekly check-in times..."
                  value={formData.improvementPlan}
                  onChange={(e) =>
                    setFormData({ ...formData, improvementPlan: e.target.value })
                  }
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Target End Date</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-xs"
                >
                  {createLoading ? 'Saving...' : 'Issue Notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLOSE MODAL */}
      {closeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#151A26] rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Close / Resolve Notice
            </h3>
            <p className="text-xs text-slate-400">
              Provide a final resolution note before closing this performance record.
            </p>

            <form onSubmit={handleCloseWarning} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">
                  Resolution Note *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Completed target deliverables, attendance normalized."
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setCloseTarget(null)}
                  className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={closeLoading}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs"
                >
                  {closeLoading ? 'Closing...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Warnings;
