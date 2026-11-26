import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { PageHeader, Card, Button, Badge, Modal } from '../../components/ui';
import {
  FileText,
  Plus,
  Calendar as CalendarIcon,
  Check,
  X,
  History,
  AlertCircle,
  Search,
  Paperclip,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import ApprovalTimelineModal from '../../components/requests/ApprovalTimelineModal';

export const ApplyLeave = () => {
  const { user, role } = useAuth();
  const isHRAdmin = role === 'super_admin' || role === 'hr';

  const [requests, setRequests] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [employees, setEmployees] = useState([]);

  // Modals & Drawers
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [timelineRequest, setTimelineRequest] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    employeeId: '',
    leaveTypeId: '',
    fromDate: new Date().toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0],
    isHalfDay: false,
    reason: '',
    documentUrl: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Fetch balances & requests
  const fetchData = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (activeTab !== 'all') queryParams.append('status', activeTab);
      if (selectedEmployeeId) queryParams.append('employeeId', selectedEmployeeId);

      const balParams = new URLSearchParams();
      if (selectedEmployeeId) balParams.append('employeeId', selectedEmployeeId);

      const [reqRes, balRes, empRes] = await Promise.all([
        api.get(`/attendance/requests/leave?${queryParams.toString()}`),
        api.get(`/attendance/requests/leave/balances?${balParams.toString()}`),
        isHRAdmin ? api.get('/employees') : Promise.resolve({ data: [] }),
      ]);

      if (reqRes.success) setRequests(reqRes.data || []);
      if (balRes.success) {
        setBalances(balRes.data || []);
        if (!formData.leaveTypeId && balRes.data?.length > 0) {
          setFormData((prev) => ({ ...prev, leaveTypeId: balRes.data[0].leaveType?._id }));
        }
      }
      if (empRes.data) setEmployees(empRes.data);
    } catch (err) {
      console.error('Failed to load leave data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, selectedEmployeeId]);

  // Handle single action approve/reject
  const handleApprovalAction = async (approvalId, action) => {
    try {
      const res = await api.post(`/approvals/${approvalId}/${action}`, {
        comment: `${action === 'approve' ? 'Approved' : 'Rejected'} via Leave Management screen`,
      });
      if (res.success) fetchData();
    } catch (err) {
      alert(err.response?.data?.message || `Failed to ${action} leave request`);
    }
  };

  // Handle cancellation
  const handleCancel = async (approvalId) => {
    if (!window.confirm('Are you sure you want to cancel this leave application? Quota will be restored.')) return;
    try {
      const res = await api.post(`/approvals/${approvalId}/cancel`);
      if (res.success) fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel request');
    }
  };

  // Bulk action
  const handleBulkAction = async (action) => {
    if (!selectedIds.length) return;
    setBulkActionLoading(true);
    try {
      const res = await api.post('/approvals/bulk-action', {
        ids: selectedIds,
        action,
        comment: `Bulk ${action}d via HRMS Attendance suite`,
      });
      if (res.success) {
        setSelectedIds([]);
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Bulk operation failed');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Submit Apply Form
  const handleApplySubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      const payload = {
        leaveTypeId: formData.leaveTypeId,
        fromDate: formData.fromDate,
        toDate: formData.toDate,
        isHalfDay: formData.isHalfDay,
        reason: formData.reason,
        document: formData.documentUrl ? { url: formData.documentUrl, name: 'Attachment' } : undefined,
        employeeId: formData.employeeId || undefined,
      };

      const res = await api.post('/attendance/requests/leave', payload);
      if (res.success) {
        setIsApplyOpen(false);
        setFormData({
          employeeId: '',
          leaveTypeId: balances[0]?.leaveType?._id || '',
          fromDate: new Date().toISOString().split('T')[0],
          toDate: new Date().toISOString().split('T')[0],
          isHalfDay: false,
          reason: '',
          documentUrl: '',
        });
        fetchData();
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to submit leave application');
    } finally {
      setSubmitting(false);
    }
  };

  // Selected leave type details
  const selectedTypeObj = useMemo(() => {
    return balances.find((b) => String(b.leaveType?._id) === String(formData.leaveTypeId));
  }, [balances, formData.leaveTypeId]);

  const filteredRequests = useMemo(() => {
    if (!searchQuery) return requests;
    const q = searchQuery.toLowerCase();
    return requests.filter(
      (r) =>
        r.employee?.personal?.firstName?.toLowerCase().includes(q) ||
        r.employee?.personal?.lastName?.toLowerCase().includes(q) ||
        r.employee?.employeeId?.toLowerCase().includes(q) ||
        r.leaveType?.name?.toLowerCase().includes(q) ||
        r.reason?.toLowerCase().includes(q)
    );
  }, [requests, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Apply Leave"
        subtitle="Manage and request studio leaves with automated quota tracking, holiday exclusions, and carry-forward balances"
      >
        <Button
          variant="primary"
          onClick={() => setIsApplyOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          Apply Leave
        </Button>
      </PageHeader>

      {/* Rule Book Advisory Notice */}
      <div className="bg-indigo-950/40 border border-indigo-800/40 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-indigo-300">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-indigo-400 flex-shrink-0" />
          <span>
            <strong className="text-white">Applied does not mean Approved:</strong> Leave is only valid upon explicit review and confirmation by your Reporting Manager and HR.
          </span>
        </div>
        <span className="text-[11px] text-indigo-400/80 font-medium font-mono">Rule Book §6</span>
      </div>

      {/* Quotas Balance Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {balances.map((b) => (
          <Card key={b.leaveType?._id} className="p-3.5 bg-slate-900/60 border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                  {b.leaveType?.code}
                </span>
                <span className="text-[10px] text-indigo-400 font-medium">
                  {b.leaveType?.paid ? 'Paid' : 'Unpaid'}
                </span>
              </div>
              <div className="mt-1 font-semibold text-xs text-white truncate" title={b.leaveType?.name}>
                {b.leaveType?.name}
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-baseline justify-between">
              <div>
                <span className="text-xl font-bold text-white">{b.available}</span>
                <span className="text-[10px] text-slate-500 ml-1">avail</span>
              </div>
              <div className="text-[10px] text-slate-500 text-right">
                <div>Alloc: {b.allocated}</div>
                <div>Used: {b.used}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Control Bar */}
      <Card className="p-4 bg-slate-900/40 border-slate-800/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800/80 overflow-x-auto">
            {['all', 'pending', 'approved', 'rejected', 'cancelled'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                  activeTab === tab
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            {isHRAdmin && employees.length > 0 && (
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
              >
                <option value="">All Staff</option>
                {employees.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.personal?.firstName} {emp.personal?.lastName} ({emp.employeeId})
                  </option>
                ))}
              </select>
            )}

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search leaves..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl pl-9 pr-3 py-2 outline-none focus:border-indigo-500 w-44 md:w-56"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-indigo-500/40 shadow-2xl backdrop-blur-md px-5 py-3 rounded-2xl flex items-center gap-4 z-50">
          <span className="text-xs font-semibold text-white">
            {selectedIds.length} leave application(s) selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="success"
              disabled={bulkActionLoading}
              onClick={() => handleBulkAction('approve')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> Approve
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={bulkActionLoading}
              onClick={() => handleBulkAction('reject')}
              className="bg-red-600 hover:bg-red-500 text-white text-xs flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" /> Reject
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSelectedIds([])}
              className="text-xs"
            >
              Deselect
            </Button>
          </div>
        </div>
      )}

      {/* Requests Table */}
      <Card className="bg-slate-900/40 border-slate-800/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
              <tr>
                {isHRAdmin && (
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredRequests.length > 0 &&
                        selectedIds.length === filteredRequests.filter((r) => r.status === 'pending').length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          const pendingIds = filteredRequests
                            .filter((r) => r.status === 'pending')
                            .map((r) => r.approvalRequest?._id || r._id);
                          setSelectedIds(pendingIds);
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                    />
                  </th>
                )}
                <th className="p-3.5">Employee</th>
                <th className="p-3.5">Leave Type</th>
                <th className="p-3.5">Date Range</th>
                <th className="p-3.5">Days</th>
                <th className="p-3.5">Reason</th>
                <th className="p-3.5">Document</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    Loading leaves...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    No leave applications found.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const approval = req.approvalRequest;
                  const isPending = req.status === 'pending';
                  const isRequester =
                    user?.employee && String(req.employee?._id || req.employee) === String(user.employee._id);

                  const currentStep = approval?.steps?.[approval?.currentStep - 1];
                  const canActOnStep =
                    isPending &&
                    !isRequester &&
                    (role === 'super_admin' ||
                      (currentStep?.approverEmployee &&
                        String(currentStep.approverEmployee?._id || currentStep.approverEmployee) ===
                          String(user?.employee?._id)) ||
                      (currentStep?.approverRole && currentStep.approverRole === role));

                  return (
                    <tr key={req._id} className="hover:bg-slate-800/20 transition-colors">
                      {isHRAdmin && (
                        <td className="p-3.5 text-center">
                          {isPending && (
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(approval?._id || req._id)}
                              onChange={(e) => {
                                const targetId = approval?._id || req._id;
                                if (e.target.checked) {
                                  setSelectedIds((prev) => [...prev, targetId]);
                                } else {
                                  setSelectedIds((prev) => prev.filter((id) => id !== targetId));
                                }
                              }}
                              className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                            />
                          )}
                        </td>
                      )}
                      <td className="p-3.5">
                        <div className="font-medium text-slate-200">
                          {req.employee?.personal?.firstName} {req.employee?.personal?.lastName}
                        </div>
                        <div className="text-[11px] text-slate-500">{req.employee?.employeeId}</div>
                      </td>
                      <td className="p-3.5">
                        <Badge variant="indigo" className="font-medium">
                          {req.leaveType?.name || 'Leave'}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-slate-300 font-medium">
                        {new Date(req.fromDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        {' - '}
                        {new Date(req.toDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="p-3.5">
                        <span className="font-semibold text-slate-200">
                          {req.days} {req.days === 1 ? 'day' : 'days'}
                        </span>
                        {req.isHalfDay && <span className="text-[10px] text-amber-400 block">(Half Day)</span>}
                      </td>
                      <td className="p-3.5 text-slate-300 max-w-xs truncate" title={req.reason}>
                        {req.reason}
                        {req.appliedBy && (
                          <div className="text-[10px] text-indigo-400">
                            On behalf by {req.appliedBy.email}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        {req.document?.url ? (
                          <a
                            href={req.document.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 hover:underline"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            Attachment
                          </a>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <button
                          onClick={() => setTimelineRequest(req)}
                          className="group inline-flex items-center gap-1.5 focus:outline-none"
                        >
                          <Badge
                            variant={
                              req.status === 'approved'
                                ? 'success'
                                : req.status === 'rejected'
                                ? 'danger'
                                : req.status === 'cancelled'
                                ? 'secondary'
                                : 'warning'
                            }
                            className="capitalize cursor-pointer group-hover:ring-1 group-hover:ring-indigo-400"
                          >
                            {req.status}
                          </Badge>
                          <History className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400" />
                        </button>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canActOnStep && (
                            <>
                              <button
                                onClick={() => handleApprovalAction(approval._id, 'approve')}
                                title="Approve Leave"
                                className="p-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleApprovalAction(approval._id, 'reject')}
                                title="Reject Leave"
                                className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {((isRequester && isPending) || (isHRAdmin && req.status === 'approved')) && (
                            <button
                              onClick={() => handleCancel(approval?._id)}
                              title="Cancel Leave Application"
                              className="px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Apply Leave Modal */}
      <Modal isOpen={isApplyOpen} onClose={() => setIsApplyOpen(false)} title="Apply Leave Application" size="md">
        <form onSubmit={handleApplySubmit} className="space-y-4">
          <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-800/40 text-xs text-indigo-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0" />
            <span><strong className="text-white">Applied does not mean Approved.</strong> Submission triggers the manager & HR approval workflow.</span>
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* On Behalf selection for HR/Super Admin */}
          {isHRAdmin && employees.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Apply On Behalf Of (Optional)
              </label>
              <select
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500"
              >
                <option value="">Myself ({user?.email})</option>
                {employees.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.personal?.firstName} {emp.personal?.lastName} ({emp.employeeId})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Leave Type */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Leave Type</label>
            <select
              required
              value={formData.leaveTypeId}
              onChange={(e) => setFormData({ ...formData, leaveTypeId: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500"
            >
              {balances.map((b) => (
                <option key={b.leaveType?._id} value={b.leaveType?._id}>
                  {b.leaveType?.name} ({b.available} days available)
                </option>
              ))}
            </select>
          </div>

          {/* Dates Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">From Date</label>
              <input
                type="date"
                required
                value={formData.fromDate}
                onChange={(e) => setFormData({ ...formData, fromDate: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">To Date</label>
              <input
                type="date"
                required
                value={formData.toDate}
                onChange={(e) => setFormData({ ...formData, toDate: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Half Day Toggle */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="halfDayToggle"
              checked={formData.isHalfDay}
              onChange={(e) => setFormData({ ...formData, isHalfDay: e.target.checked })}
              className="rounded border-slate-700 text-indigo-600 focus:ring-0"
            />
            <label htmlFor="halfDayToggle" className="text-xs text-slate-300 cursor-pointer">
              Half Day Leave (240 minutes working equivalent)
            </label>
          </div>

          {/* Document attachment if needed */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Medical / Supporting Document URL (Required for SL &gt; 2 days)
            </label>
            <input
              type="url"
              placeholder="https://..."
              value={formData.documentUrl}
              onChange={(e) => setFormData({ ...formData, documentUrl: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Reason for Leave</label>
            <textarea
              rows={3}
              required
              placeholder="State reason clearly..."
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-3 outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsApplyOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Apply Leave'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Timeline Modal */}
      <ApprovalTimelineModal
        isOpen={!!timelineRequest}
        onClose={() => setTimelineRequest(null)}
        request={timelineRequest}
      />
    </div>
  );
};

export default ApplyLeave;
