import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { PageHeader, Card, Button, Badge, Modal } from '../../components/ui';
import {
  Clock,
  Plus,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Calendar as CalendarIcon,
  User,
  Users,
  Check,
  X,
  History,
  Info,
} from 'lucide-react';
import ApprovalTimelineModal from '../../components/requests/ApprovalTimelineModal';

export const LogRegularization = () => {
  const { user, role } = useAuth();
  const isHRAdmin = role === 'super_admin' || role === 'hr';

  const [requests, setRequests] = useState([]);
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
    date: new Date().toISOString().split('T')[0],
    punchType: 'in',
    time: '10:00',
    reasonCategory: 'Forgot to clock in/out',
    reasonText: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Calculate min date (15 days ago)
  const minDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    return d.toISOString().split('T')[0];
  }, []);

  const maxDate = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Fetch requests & employees
  const fetchData = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (activeTab !== 'all') queryParams.append('status', activeTab);
      if (selectedEmployeeId) queryParams.append('employeeId', selectedEmployeeId);

      const [reqRes, empRes] = await Promise.all([
        api.get(`/attendance/requests/regularization?${queryParams.toString()}`),
        isHRAdmin ? api.get('/employees') : Promise.resolve({ data: [] }),
      ]);

      if (reqRes.success) setRequests(reqRes.data || []);
      if (empRes.data) setEmployees(empRes.data);
    } catch (err) {
      console.error('Failed to load regularization requests:', err);
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
        comment: `${action === 'approve' ? 'Approved' : 'Rejected'} via Log Regularization screen`,
      });
      if (res.success) {
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || `Failed to ${action} request`);
    }
  };

  // Handle cancellation
  const handleCancel = async (approvalId) => {
    if (!window.confirm('Are you sure you want to cancel this request?')) return;
    try {
      const res = await api.post(`/approvals/${approvalId}/cancel`);
      if (res.success) fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel request');
    }
  };

  // Bulk approve/reject
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
      const fullDateTime = new Date(`${formData.date}T${formData.time}:00`);
      const reason = formData.reasonText
        ? `${formData.reasonCategory}: ${formData.reasonText}`
        : formData.reasonCategory;

      const payload = {
        date: formData.date,
        punchType: formData.punchType,
        requestedTime: fullDateTime.toISOString(),
        reason,
        employeeId: formData.employeeId || undefined,
      };

      const res = await api.post('/attendance/requests/regularization', payload);
      if (res.success) {
        setIsApplyOpen(false);
        setFormData({
          employeeId: '',
          date: new Date().toISOString().split('T')[0],
          punchType: 'in',
          time: '10:00',
          reasonCategory: 'Forgot to clock in/out',
          reasonText: '',
        });
        fetchData();
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to submit regularization request');
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((r) => r.status === 'pending').length,
      approved: requests.filter((r) => r.status === 'approved').length,
      rejected: requests.filter((r) => r.status === 'rejected').length,
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    if (!searchQuery) return requests;
    const q = searchQuery.toLowerCase();
    return requests.filter(
      (r) =>
        r.employee?.personal?.firstName?.toLowerCase().includes(q) ||
        r.employee?.personal?.lastName?.toLowerCase().includes(q) ||
        r.employee?.employeeId?.toLowerCase().includes(q) ||
        r.reason?.toLowerCase().includes(q)
    );
  }, [requests, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Apply Log Regularization"
        subtitle="Submit clock-in/out regularization for missed punches, biometric errors, or external studio meetings"
      >
        <Button
          variant="primary"
          onClick={() => setIsApplyOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          Apply Regularization
        </Button>
      </PageHeader>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <span className="text-xs font-medium text-slate-400">Total Requests</span>
          <div className="mt-2 text-2xl font-bold text-white">{metrics.total}</div>
        </Card>
        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <span className="text-xs font-medium text-amber-400">Pending Approval</span>
          <div className="mt-2 text-2xl font-bold text-amber-400">{metrics.pending}</div>
        </Card>
        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <span className="text-xs font-medium text-emerald-400">Approved</span>
          <div className="mt-2 text-2xl font-bold text-emerald-400">{metrics.approved}</div>
        </Card>
        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <span className="text-xs font-medium text-red-400">Rejected</span>
          <div className="mt-2 text-2xl font-bold text-red-400">{metrics.rejected}</div>
        </Card>
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
                placeholder="Search requests..."
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
            {selectedIds.length} request(s) selected
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
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Punch Type</th>
                <th className="p-3.5">Requested Time</th>
                <th className="p-3.5">Reason</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    Loading requests...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No regularization requests found.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const approval = req.approvalRequest;
                  const isPending = req.status === 'pending';
                  const isRequester =
                    user?.employee && String(req.employee?._id || req.employee) === String(user.employee._id);

                  // Approver eligibility check
                  const currentStep = approval?.steps?.[approval?.currentStep - 1];
                  const canActOnStep =
                    isPending &&
                    !isRequester && // STRICT zero self-approval
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
                      <td className="p-3.5 text-slate-300 font-medium">
                        {new Date(req.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            req.punchType === 'in'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          }`}
                        >
                          {req.punchType === 'in' ? 'Clock In' : 'Clock Out'}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-300 font-mono text-xs">
                        {new Date(req.requestedTime || req.date).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </td>
                      <td className="p-3.5 text-slate-300 max-w-xs truncate" title={req.reason}>
                        {req.reason}
                        {req.appliedBy && (
                          <div className="text-[10px] text-indigo-400">
                            Applied on behalf by {req.appliedBy.email}
                          </div>
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
                                title="Approve Request"
                                className="p-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleApprovalAction(approval._id, 'reject')}
                                title="Reject Request"
                                className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {((isRequester && isPending) || (isHRAdmin && req.status === 'approved')) && (
                            <button
                              onClick={() => handleCancel(approval?._id)}
                              title="Cancel Request"
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

      {/* Apply Regularization Modal */}
      <Modal
        isOpen={isApplyOpen}
        onClose={() => setIsApplyOpen(false)}
        title="Apply Log Regularization"
        size="md"
      >
        <form onSubmit={handleApplySubmit} className="space-y-4">
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

          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Punch Date</label>
              <input
                type="date"
                required
                min={minDate}
                max={maxDate}
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Max 15 days backdate</span>
            </div>

            {/* Time */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Requested Time
              </label>
              <input
                type="time"
                required
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Punch Type */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Punch Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, punchType: 'in' })}
                className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                  formData.punchType === 'in'
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                Clock In
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, punchType: 'out' })}
                className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                  formData.punchType === 'out'
                    ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                Clock Out
              </button>
            </div>
          </div>

          {/* Reason Category */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Reason Category
            </label>
            <select
              value={formData.reasonCategory}
              onChange={(e) => setFormData({ ...formData, reasonCategory: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500"
            >
              <option value="Biometric scanner failed to recognize fingerprint">
                Biometric scanner failed to recognize fingerprint
              </option>
              <option value="Forgot to clock in/out">Forgot to clock in/out</option>
              <option value="Client meeting outside studio before arrival">
                Client meeting outside studio before arrival
              </option>
              <option value="Power outage or studio network drop">
                Power outage or studio network drop
              </option>
              <option value="Other">Other reason</option>
            </select>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Additional Remarks / Justification
            </label>
            <textarea
              rows={3}
              required={formData.reasonCategory === 'Other'}
              placeholder="Provide context for your reporting manager and HR..."
              value={formData.reasonText}
              onChange={(e) => setFormData({ ...formData, reasonText: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-3 outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <span>
              Once approved by your manager and HR, your punch log will be registered with source{' '}
              <strong className="text-slate-300">regularized</strong> and marked as{' '}
              <strong className="text-indigo-400">Changed Log</strong> in attendance rolls.
            </span>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsApplyOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Request'}
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

export default LogRegularization;
