import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Card, PageHeader, Button, Badge } from '../components/ui';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Check,
  X,
  FileText,
  Calendar,
  Send,
  Layers,
  Search,
  Filter,
  Download,
  Upload,
  User,
  Users,
  ChevronRight,
  ChevronLeft,
  MessageSquare,
  ShieldAlert,
  ArrowRight,
  Info,
  CalendarDays,
  FileSpreadsheet,
  CornerUpLeft,
  UserCheck,
} from 'lucide-react';

export const Approvals = () => {
  const { user, role, permissions = [] } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get('id');

  const isSuperAdmin = role === 'super_admin';
  const isHR = role === 'hr' || isSuperAdmin;
  const isManager = role === 'manager' || isHR;

  // Tabs
  const [activeTab, setActiveTab] = useState('waiting');
  const [counts, setCounts] = useState({ waitingForMe: 0, allPending: 0, myTeam: 0, raisedByMe: 0 });

  // Data
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 });

  // Filter States
  const [typeFilter, setTypeFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  // Drawer Detail State
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);

  // Action Modals / Prompts
  const [actionModal, setActionModal] = useState({ open: false, type: null, id: null, title: '' });
  const [actionComment, setActionComment] = useState('');
  const [acting, setActing] = useState(false);
  const [msg, setMsg] = useState(null);

  // Delegation Modal State
  const [delegationModalOpen, setDelegationModalOpen] = useState(false);
  const [delegations, setDelegations] = useState([]);
  const [newDelegation, setNewDelegation] = useState({ delegateId: '', fromDate: '', toDate: '', reason: '' });
  const [allEmployees, setAllEmployees] = useState([]);

  // Load live counts
  const loadCounts = useCallback(async () => {
    try {
      const res = await api.get('/approvals/counts');
      if (res.success) setCounts(res.data);
    } catch (err) {
      console.warn('Counts load error:', err);
    }
  }, []);

  // Load inbox list
  const loadInbox = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        tab: activeTab,
        page: pagination.page,
        limit: pagination.limit,
      };
      if (typeFilter !== 'all') params.type = typeFilter;
      if (urgencyFilter !== 'all') params.urgency = urgencyFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.get('/approvals/inbox', { params });
      if (res.success) {
        setRequests(res.data.requests);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Inbox load error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, pagination.page, pagination.limit, typeFilter, urgencyFilter, searchQuery]);

  // Load details into drawer
  const openDrawer = async (reqItem) => {
    try {
      setSelectedRequest(reqItem);
      setDrawerOpen(true);
      setDetailLoading(true);
      setSearchParams({ id: reqItem._id });

      const res = await api.get(`/approvals/${reqItem._id}`);
      if (res.success) {
        setDetailData(res.data);
      }
    } catch (err) {
      console.error('Failed to load approval detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedRequest(null);
    setDetailData(null);
    searchParams.delete('id');
    setSearchParams(searchParams);
  };

  // Keyboard navigation & quick shortcuts (A = approve, R = reject, J = next, K = prev)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (!drawerOpen || !selectedRequest) return;

      if (e.key === 'a' || e.key === 'A') {
        setActionModal({ open: true, type: 'approve', id: selectedRequest._id, title: 'Approve Request' });
      } else if (e.key === 'r' || e.key === 'R') {
        setActionModal({ open: true, type: 'reject', id: selectedRequest._id, title: 'Reject Request' });
      } else if (e.key === 'j' || e.key === 'J') {
        // Next item
        const idx = requests.findIndex((r) => r._id === selectedRequest._id);
        if (idx < requests.length - 1) openDrawer(requests[idx + 1]);
      } else if (e.key === 'k' || e.key === 'K') {
        // Prev item
        const idx = requests.findIndex((r) => r._id === selectedRequest._id);
        if (idx > 0) openDrawer(requests[idx - 1]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen, selectedRequest, requests]);

  // Auto-open if query param ?id= was supplied
  useEffect(() => {
    if (initialId && !drawerOpen) {
      openDrawer({ _id: initialId });
    }
  }, [initialId]);

  useEffect(() => {
    loadCounts();
    loadInbox();
  }, [loadCounts, loadInbox]);

  // Load employees for delegation
  const loadEmployees = async () => {
    try {
      const res = await api.get('/employees?limit=100');
      if (res.success) setAllEmployees(res.data.employees || res.data || []);
      const dRes = await api.get('/approvals/delegations');
      if (dRes.success) setDelegations(dRes.data);
    } catch (err) {
      console.warn('Delegation bootstrap error:', err);
    }
  };

  // Checkbox toggle
  const toggleSelectRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === requests.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(requests.map((r) => r._id));
    }
  };

  // Actions
  const handleActionSubmit = async (e) => {
    e.preventDefault();
    if (!actionModal.id || !actionModal.type) return;

    try {
      setActing(true);
      const endpoint = `/approvals/${actionModal.id}/${actionModal.type}`;
      const res = await api.post(endpoint, { comment: actionComment });
      if (res.success) {
        setMsg(`Request ${actionModal.type}d successfully!`);
        setTimeout(() => setMsg(null), 3500);
        setActionModal({ open: false, type: null, id: null, title: '' });
        setActionComment('');
        closeDrawer();
        loadCounts();
        loadInbox();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Action failed');
    } finally {
      setActing(false);
    }
  };

  // Bulk actions
  const handleBulkAction = async (action) => {
    if (selectedIds.length === 0) return;
    const comment = prompt(`Enter comments for bulk ${action}:`);
    if (action === 'reject' && (!comment || !comment.trim())) {
      alert('A comment is mandatory when rejecting requests.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/approvals/bulk', {
        action,
        ids: selectedIds,
        comment: comment || '',
      });
      if (res.success) {
        alert(res.message);
        setSelectedIds([]);
        loadCounts();
        loadInbox();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Bulk action failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <PageHeader
        title="Approvals Center"
        subtitle="Universal review queue for leaves, timesheets, regularizations, comp-offs, and administrative requests."
        badge={
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-violet-500/20 text-violet-400 border border-violet-500/30">
            {counts.waitingForMe} Pending Action
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadCounts();
                loadInbox();
              }}
              disabled={loading}
              className="border-slate-700 text-slate-300 hover:text-white"
            >
              <RotateCcw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadEmployees();
                setDelegationModalOpen(true);
              }}
              className="border-slate-700 text-slate-300 hover:text-white"
            >
              <UserCheck className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Out of Office / Delegations
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`${api.defaults.baseURL}/approvals/export`, '_blank')}
              className="border-slate-700 text-slate-300 hover:text-white"
            >
              <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
            </Button>
          </div>
        }
      />

      {/* Success Notification Alert */}
      {msg && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-800 text-emerald-300 rounded-2xl flex items-center gap-3 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-6 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab('waiting');
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          className={`pb-3 capitalize transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'waiting'
              ? 'border-violet-500 text-violet-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Waiting for me</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-violet-950 text-violet-300 border border-violet-800 font-mono">
            {counts.waitingForMe}
          </span>
        </button>

        {isHR && (
          <button
            onClick={() => {
              setActiveTab('all_pending');
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className={`pb-3 capitalize transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'all_pending'
                ? 'border-violet-500 text-violet-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>All Pending (Org)</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
              {counts.allPending}
            </span>
          </button>
        )}

        {isManager && (
          <button
            onClick={() => {
              setActiveTab('my_team');
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className={`pb-3 capitalize transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'my_team'
                ? 'border-violet-500 text-violet-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>My Team</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
              {counts.myTeam}
            </span>
          </button>
        )}

        <button
          onClick={() => {
            setActiveTab('history');
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          className={`pb-3 capitalize transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'history'
              ? 'border-violet-500 text-violet-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>History & Decisions</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('raised_by_me');
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          className={`pb-3 capitalize transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'raised_by_me'
              ? 'border-violet-500 text-violet-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Raised by me</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
            {counts.raisedByMe}
          </span>
        </button>
      </div>

      {/* Filter and Bulk Actions Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search employee or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 w-56"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white focus:outline-none"
          >
            <option value="all">All Request Types</option>
            <option value="leave">Leaves</option>
            <option value="regularization">Log Regularization</option>
            <option value="remote_work">Remote Work</option>
            <option value="partial_day">Partial Day</option>
            <option value="comp_off">Comp-Off</option>
            <option value="timesheet">Timesheet</option>
            <option value="asset_request">Asset Request</option>
          </select>

          {/* Urgency Filter */}
          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white focus:outline-none"
          >
            <option value="all">All Urgency SLAs</option>
            <option value="on_time">On Time</option>
            <option value="due_soon">Due Soon (&lt;12h)</option>
            <option value="overdue">Overdue SLA</option>
          </select>
        </div>

        {/* Bulk Action Controls */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="font-semibold text-slate-300">
              {selectedIds.length} selected
            </span>
            <Button
              size="sm"
              onClick={() => handleBulkAction('approve')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white h-7 px-2.5 text-xs"
            >
              <Check className="w-3 h-3 mr-1" /> Bulk Approve
            </Button>
            <Button
              size="sm"
              onClick={() => handleBulkAction('reject')}
              className="bg-rose-600 hover:bg-rose-500 text-white h-7 px-2.5 text-xs"
            >
              <X className="w-3 h-3 mr-1" /> Bulk Reject
            </Button>
          </div>
        )}
      </div>

      {/* Approvals Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={requests.length > 0 && selectedIds.length === requests.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-700 bg-slate-900 text-violet-500 focus:ring-0"
                  />
                </th>
                <th className="p-3">Applicant</th>
                <th className="p-3">Type</th>
                <th className="p-3">Summary</th>
                <th className="p-3">Waiting On</th>
                <th className="p-3">SLA Status</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Loading requests from approval registry...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No approval requests found in this queue.
                  </td>
                </tr>
              ) : (
                requests.map((r) => {
                  const isChecked = selectedIds.includes(r._id);
                  return (
                    <tr
                      key={r._id}
                      onClick={() => openDrawer(r)}
                      className={`hover:bg-slate-800/40 transition-colors cursor-pointer ${
                        isChecked ? 'bg-violet-950/20' : ''
                      }`}
                    >
                      <td
                        className="p-3 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectRow(r._id);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded border-slate-700 bg-slate-900 text-violet-500 focus:ring-0"
                        />
                      </td>

                      {/* Applicant */}
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-violet-600/30 border border-violet-500/40 text-violet-300 font-bold flex items-center justify-center text-[10px]">
                            {r.requestedBy?.personal?.firstName?.[0] || 'U'}
                          </div>
                          <div>
                            <p className="font-bold text-white leading-tight">
                              {r.requestedBy?.personal?.firstName} {r.requestedBy?.personal?.lastName}
                            </p>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {r.requestedBy?.employeeId}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Type Chip */}
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-violet-300 border border-slate-700">
                          {r.typeLabel}
                        </span>
                      </td>

                      {/* Summary */}
                      <td className="p-3 text-slate-200 font-mono text-[11px] max-w-xs truncate">
                        {r.summary}
                      </td>

                      {/* Waiting On */}
                      <td className="p-3">
                        <span className="text-slate-300 font-medium">
                          {r.waitingOn}
                        </span>
                        {r.isDelegated && (
                          <span className="ml-1 text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                            Delegated
                          </span>
                        )}
                        <span className="block text-[10px] text-slate-500">
                          {r.daysPending} day(s) pending
                        </span>
                      </td>

                      {/* SLA Urgency Badge */}
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            r.urgency === 'overdue'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : r.urgency === 'due_soon'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {r.urgency === 'overdue' ? 'Overdue' : r.urgency === 'due_soon' ? 'Due Soon' : 'On Time'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            r.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : r.status === 'rejected'
                              ? 'bg-rose-500/20 text-rose-400'
                              : r.status === 'returned'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-indigo-500/20 text-indigo-400'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {r.status === 'pending' && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setActionModal({ open: true, type: 'approve', id: r._id, title: 'Approve Request' })}
                              className="p-1 rounded-lg bg-emerald-950/60 text-emerald-400 hover:bg-emerald-900 border border-emerald-800"
                              title="Approve"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setActionModal({ open: true, type: 'reject', id: r._id, title: 'Reject Request' })}
                              className="p-1 rounded-lg bg-rose-950/60 text-rose-400 hover:bg-rose-900 border border-rose-800"
                              title="Reject"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setActionModal({ open: true, type: 'return', id: r._id, title: 'Return for Correction' })}
                              className="p-1 rounded-lg bg-amber-950/60 text-amber-400 hover:bg-amber-900 border border-amber-800"
                              title="Return for Correction"
                            >
                              <CornerUpLeft className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-slate-400">
          <span>
            Total: <strong>{pagination.total}</strong> records | Page {pagination.page} of {pagination.pages}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={pagination.page >= pagination.pages}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* DETAIL DRAWER */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border-l border-slate-800 w-full max-w-2xl h-full flex flex-col shadow-2xl overflow-hidden">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-violet-950 text-violet-400 border border-violet-800">
                  {detailData?.registryConfig?.label || selectedRequest?.typeLabel}
                </span>
                <h3 className="text-base font-bold text-white mt-1.5">
                  {selectedRequest?.title || 'Approval Review'}
                </h3>
              </div>
              <button
                onClick={closeDrawer}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {detailLoading ? (
                <div className="py-16 text-center text-slate-500">Loading deep request context...</div>
              ) : (
                <>
                  {/* Context Card: Employee details */}
                  {detailData?.context && (
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-bold uppercase text-slate-400 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-violet-400" /> Employee Context Card
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {detailData.context.employee?.code}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                        <div>
                          <span className="text-slate-500 block">Name</span>
                          <strong className="text-white">{detailData.context.employee?.name}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Designation</span>
                          <strong className="text-slate-300">{detailData.context.employee?.designation}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Department</span>
                          <strong className="text-slate-300">{detailData.context.employee?.department}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Late This Month</span>
                          <strong className="text-amber-400">{detailData.context.monthLateCount} incident(s)</strong>
                        </div>
                      </div>

                      {/* Absence Clashes Warning */}
                      {detailData.context.clashes?.length > 0 && (
                        <div className={`p-3 rounded-xl border flex items-start gap-2 ${
                          detailData.context.clashWarning
                            ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                            : 'bg-amber-950/40 border-amber-800 text-amber-300'
                        }`}>
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <strong>Team Absence Conflict Alert:</strong> {detailData.context.clashes.length} colleague(s) from the same department are on leave during requested dates:
                            <ul className="list-disc pl-4 mt-1 font-mono text-[10px]">
                              {detailData.context.clashes.map((c, i) => (
                                <li key={i}>{c.employeeName} ({c.days} days)</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Type Details from Registry */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <h4 className="text-[11px] font-bold uppercase text-slate-400 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-400" /> Request Payload Details
                    </h4>

                    {detailData?.details?.balanceBefore && (
                      <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl grid grid-cols-3 gap-2 text-center text-[11px]">
                        <div>
                          <span className="text-slate-400 block">Allocated</span>
                          <span className="font-bold text-white">{detailData.details.balanceBefore.allocated} d</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Used So Far</span>
                          <span className="font-bold text-rose-400">{detailData.details.balanceBefore.used} d</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Closing Remaining</span>
                          <span className="font-bold text-emerald-400">{detailData.details.balanceBefore.closingDays} d</span>
                        </div>
                      </div>
                    )}

                    <div className="text-slate-300 leading-relaxed font-mono text-[11px]">
                      {detailData?.details?.reason && (
                        <p><strong>Justification:</strong> {detailData.details.reason}</p>
                      )}
                    </div>
                  </div>

                  {/* Approval Timeline Steps */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <h4 className="text-[11px] font-bold uppercase text-slate-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-violet-400" /> Step Approval Timeline
                    </h4>

                    <div className="space-y-3">
                      {(detailData?.approval?.steps || []).map((step, idx) => (
                        <div
                          key={step._id || idx}
                          className="flex items-start gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800"
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                            step.status === 'approved'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : step.status === 'rejected'
                              ? 'bg-rose-950 text-rose-400 border border-rose-800'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <strong className="text-white">{step.title || `Step ${idx + 1}`}</strong>
                              <span className="uppercase text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                                {step.status}
                              </span>
                            </div>
                            <p className="text-slate-400 text-[10px] mt-0.5">
                              Reviewer: {step.approverEmployee ? `${step.approverEmployee.personal?.firstName} ${step.approverEmployee.personal?.lastName}` : (step.approverRole || 'Unassigned')}
                            </p>
                            {step.comment && (
                              <p className="mt-1 text-slate-300 italic bg-slate-950 p-1.5 rounded-lg border border-slate-800/80">
                                "{step.comment}"
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Drawer Actions Footer */}
            {selectedRequest?.status === 'pending' && (
              <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                  <span>Shortcuts:</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">A</kbd> Approve
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">R</kbd> Reject
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">J/K</kbd> Next/Prev
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setActionModal({ open: true, type: 'return', id: selectedRequest._id, title: 'Return for Correction' })}
                    className="border-amber-700 text-amber-300 hover:bg-amber-950/40"
                    variant="outline"
                  >
                    Return
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setActionModal({ open: true, type: 'reject', id: selectedRequest._id, title: 'Reject Request' })}
                    className="bg-rose-600 hover:bg-rose-500 text-white"
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setActionModal({ open: true, type: 'approve', id: selectedRequest._id, title: 'Approve Request' })}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    Approve
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ACTION COMMENT MODAL */}
      {actionModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">{actionModal.title}</h3>
            <form onSubmit={handleActionSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  {actionModal.type === 'reject' || actionModal.type === 'return' ? 'Mandatory Reason / Comment *' : 'Optional Approver Comment'}
                </label>
                <textarea
                  rows={3}
                  required={actionModal.type === 'reject' || actionModal.type === 'return'}
                  placeholder="Enter comments, guidelines, or conditions..."
                  value={actionComment}
                  onChange={(e) => setActionComment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setActionModal({ open: false, type: null, id: null, title: '' })}
                  className="border-slate-700 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  type="submit"
                  disabled={acting}
                  className={
                    actionModal.type === 'reject'
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }
                >
                  {acting ? 'Processing...' : 'Confirm Action'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Approvals;
