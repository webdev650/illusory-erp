import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { PageHeader, Card, Button, Badge, Modal } from '../../components/ui';
import {
  Clock,
  Plus,
  Calendar as CalendarIcon,
  Check,
  X,
  History,
  AlertCircle,
  Search,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import ApprovalTimelineModal from '../../components/requests/ApprovalTimelineModal';

export const ApplyPartialDay = () => {
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
    type: 'late_coming',
    minutes: 30,
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (activeTab !== 'all') queryParams.append('status', activeTab);
      if (selectedEmployeeId) queryParams.append('employeeId', selectedEmployeeId);

      const [reqRes, empRes] = await Promise.all([
        api.get(`/attendance/requests/partial-day?${queryParams.toString()}`),
        isHRAdmin ? api.get('/employees') : Promise.resolve({ data: [] }),
      ]);

      if (reqRes.success) setRequests(reqRes.data || []);
      if (empRes.data) setEmployees(empRes.data);
    } catch (err) {
      console.error('Failed to load partial day requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, selectedEmployeeId]);

  const handleApprovalAction = async (approvalId, action) => {
    try {
      const res = await api.post(`/approvals/${approvalId}/${action}`, {
        comment: `${action === 'approve' ? 'Approved' : 'Rejected'} via Partial Day screen`,
      });
      if (res.success) fetchData();
    } catch (err) {
      alert(err.response?.data?.message || `Failed to ${action} request`);
    }
  };

  const handleCancel = async (approvalId) => {
    if (!window.confirm('Are you sure you want to cancel this partial day request?')) return;
    try {
      const res = await api.post(`/approvals/${approvalId}/cancel`);
      if (res.success) fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel request');
    }
  };

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

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      const payload = {
        date: formData.date,
        type: formData.type,
        minutes: parseInt(formData.minutes, 10),
        reason: formData.reason,
        employeeId: formData.employeeId || undefined,
      };

      const res = await api.post('/attendance/requests/partial-day', payload);
      if (res.success) {
        setIsApplyOpen(false);
        setFormData({
          employeeId: '',
          date: new Date().toISOString().split('T')[0],
          type: 'late_coming',
          minutes: 30,
          reason: '',
        });
        fetchData();
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to submit partial day request');
    } finally {
      setSubmitting(false);
    }
  };

  // Monthly policy usage calculation (for current user or selected employee)
  const currentMonthUsage = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const usedInMonth = requests.filter((r) => {
      const d = new Date(r.date);
      return (
        d.getMonth() === currentMonth &&
        d.getFullYear() === currentYear &&
        ['pending', 'approved'].includes(r.status)
      );
    });

    const usedCount = usedInMonth.length;
    const remaining = Math.max(0, 3 - usedCount);

    return { usedCount, remaining };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    if (!searchQuery) return requests;
    const q = searchQuery.toLowerCase();
    return requests.filter(
      (r) =>
        r.employee?.personal?.firstName?.toLowerCase().includes(q) ||
        r.employee?.personal?.lastName?.toLowerCase().includes(q) ||
        r.employee?.employeeId?.toLowerCase().includes(q) ||
        r.type?.toLowerCase().includes(q) ||
        r.reason?.toLowerCase().includes(q)
    );
  }, [requests, searchQuery]);

  const getTypeLabel = (t) => {
    switch (t) {
      case 'late_coming':
        return 'Late Coming';
      case 'early_leaving':
        return 'Early Leaving';
      case 'short_leave':
        return 'Short Leave (Mid-Day)';
      default:
        return t;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Apply Partial Day"
        subtitle="Late coming, early leaving, or short leave excuse requests. Excuses penalty minutes from attendance."
      >
        <Button
          variant="primary"
          onClick={() => setIsApplyOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          Apply Partial Day
        </Button>
      </PageHeader>

      {/* Monthly Cap Banner & Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-slate-900 border-indigo-500/30 col-span-1 md:col-span-2 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                Monthly Policy Allowance
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/20 text-indigo-300 font-bold">
                Max 3 / Month
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-white">
              {currentMonthUsage.remaining} of 3 Available
            </div>
            <p className="text-xs text-slate-400 mt-1">
              You have used {currentMonthUsage.usedCount} partial day request(s) this calendar month.
            </p>
          </div>
          <div className="flex gap-1.5 p-2 bg-slate-950/60 rounded-xl border border-slate-800">
            {[1, 2, 3].map((num) => (
              <div
                key={num}
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                  num <= currentMonthUsage.usedCount
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {num <= currentMonthUsage.usedCount ? '✓' : num}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <span className="text-xs font-medium text-amber-400">Pending Approvals</span>
          <div className="mt-2 text-2xl font-bold text-amber-400">
            {requests.filter((r) => r.status === 'pending').length}
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <span className="text-xs font-medium text-emerald-400">Approved This Month</span>
          <div className="mt-2 text-2xl font-bold text-emerald-400">
            {requests.filter((r) => r.status === 'approved').length}
          </div>
        </Card>
      </div>

      {/* Control Bar */}
      <Card className="p-4 bg-slate-900/40 border-slate-800/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                placeholder="Search partial days..."
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
                <th className="p-3.5">Excuse Type</th>
                <th className="p-3.5">Minutes Excused</th>
                <th className="p-3.5">Reason</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    Loading partial day requests...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No partial day requests found.
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
                      <td className="p-3.5 text-slate-300 font-medium">
                        {new Date(req.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="p-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {getTypeLabel(req.type)}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-200">
                        <span className="font-bold">{req.minutes} mins</span>{' '}
                        <span className="text-[11px] text-slate-500">
                          ({(req.minutes / 60).toFixed(1)} hrs)
                        </span>
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

      {/* Apply Partial Day Modal */}
      <Modal isOpen={isApplyOpen} onClose={() => setIsApplyOpen(false)} title="Apply Partial Day Excuse" size="md">
        <form onSubmit={handleApplySubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

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
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Date</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Excuse Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500"
              >
                <option value="late_coming">Late Coming (Arrival Delay)</option>
                <option value="early_leaving">Early Leaving (Departure)</option>
                <option value="short_leave">Short Leave (Mid-Day)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Duration to Excuse
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[15, 30, 45, 60, 90, 120, 180, 240].map((mins) => (
                <button
                  type="button"
                  key={mins}
                  onClick={() => setFormData({ ...formData, minutes: mins })}
                  className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                    formData.minutes === mins
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Reason & Details</label>
            <textarea
              rows={3}
              required
              placeholder="State reason clearly..."
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-3 outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <span>
              Maximum 3 partial-day requests are permitted per employee per calendar month. Excuses late/short time from daily penalty calculations.
            </span>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsApplyOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Apply Partial Day'}
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

export default ApplyPartialDay;
