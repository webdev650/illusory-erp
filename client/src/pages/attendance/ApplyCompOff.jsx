import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { PageHeader, Card, Button, Badge, Modal } from '../../components/ui';
import {
  CheckSquare,
  Plus,
  Calendar as CalendarIcon,
  Check,
  X,
  History,
  AlertCircle,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  Info,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import ApprovalTimelineModal from '../../components/requests/ApprovalTimelineModal';

export const ApplyCompOff = () => {
  const { user, role } = useAuth();
  const isHRAdmin = role === 'super_admin' || role === 'hr';

  const [viewTab, setViewTab] = useState('claims'); // 'claims' | 'ledger'
  const [requests, setRequests] = useState([]);
  const [ledgerData, setLedgerData] = useState({ credits: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [activeStatusTab, setActiveStatusTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [employees, setEmployees] = useState([]);

  // Modals
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [timelineRequest, setTimelineRequest] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    employeeId: '',
    workedDate: new Date().toISOString().split('T')[0],
    reason: '',
  });
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (activeStatusTab !== 'all') queryParams.append('status', activeStatusTab);
      if (selectedEmployeeId) queryParams.append('employeeId', selectedEmployeeId);

      const ledgerParams = new URLSearchParams();
      if (selectedEmployeeId) ledgerParams.append('employeeId', selectedEmployeeId);

      const [reqRes, ledgerRes, empRes] = await Promise.all([
        api.get(`/attendance/requests/comp-off?${queryParams.toString()}`),
        api.get(`/attendance/requests/comp-off/credits?${ledgerParams.toString()}`),
        isHRAdmin ? api.get('/employees') : Promise.resolve({ data: [] }),
      ]);

      if (reqRes.success) setRequests(reqRes.data || []);
      if (ledgerRes.success) setLedgerData(ledgerRes.data || { credits: [], summary: {} });
      if (empRes.data) setEmployees(empRes.data);
    } catch (err) {
      console.error('Failed to load comp-off data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeStatusTab, selectedEmployeeId]);

  // Live verification of biometric presence on worked date
  const handleVerifyPresence = async () => {
    if (!formData.workedDate) return;
    setVerifying(true);
    setVerificationResult(null);
    setFormError('');

    try {
      const queryParams = new URLSearchParams({
        workedDate: formData.workedDate,
      });
      if (formData.employeeId) queryParams.append('employeeId', formData.employeeId);

      const res = await api.get(`/attendance/requests/comp-off/verify-presence?${queryParams.toString()}`);
      if (res.success) {
        setVerificationResult(res.data);
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Presence verification check failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleApprovalAction = async (approvalId, action) => {
    try {
      const res = await api.post(`/approvals/${approvalId}/${action}`, {
        comment: `${action === 'approve' ? 'Approved' : 'Rejected'} via Comp-Off screen`,
      });
      if (res.success) fetchData();
    } catch (err) {
      alert(err.response?.data?.message || `Failed to ${action} request`);
    }
  };

  const handleCancel = async (approvalId) => {
    if (!window.confirm('Are you sure you want to cancel this comp-off claim?')) return;
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
        workedDate: formData.workedDate,
        reason: formData.reason,
        employeeId: formData.employeeId || undefined,
      };

      const res = await api.post('/attendance/requests/comp-off', payload);
      if (res.success) {
        setIsApplyOpen(false);
        setFormData({
          employeeId: '',
          workedDate: new Date().toISOString().split('T')[0],
          reason: '',
        });
        setVerificationResult(null);
        fetchData();
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to submit comp-off claim');
    } finally {
      setSubmitting(false);
    }
  };

  // Find credits expiring in <= 7 days
  const expiringSoonCount = useMemo(() => {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return (ledgerData.credits || []).filter((c) => {
      const exp = new Date(c.expiresAt);
      return c.status === 'active' && exp >= now && exp <= in7Days;
    }).length;
  }, [ledgerData.credits]);

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
      <PageHeader
        title="Apply Comp-Off Credits"
        subtitle="Claim compensatory off leave credits for working on company holidays or Sunday week-offs. 60-day validity."
      >
        <Button
          variant="primary"
          onClick={() => {
            setIsApplyOpen(true);
            setVerificationResult(null);
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          Claim Comp-Off
        </Button>
      </PageHeader>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <span className="text-xs font-medium text-emerald-400">Active Comp-Off Days</span>
          <div className="mt-2 text-2xl font-bold text-emerald-400">
            {ledgerData.summary?.activeDays || 0} days
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {(ledgerData.summary?.activeMinutes || 0) / 60} hrs unexpired
          </span>
        </Card>

        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <span className="text-xs font-medium text-amber-400">Expiring in 7 Days</span>
          <div className="mt-2 text-2xl font-bold text-amber-400">{expiringSoonCount}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Consume before lapse</span>
        </Card>

        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <span className="text-xs font-medium text-slate-400">Total Credits Earned</span>
          <div className="mt-2 text-2xl font-bold text-white">
            {ledgerData.summary?.totalEarned || 0}
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <span className="text-xs font-medium text-slate-500">Expired / Lapsed</span>
          <div className="mt-2 text-2xl font-bold text-slate-400">
            {ledgerData.summary?.expiredCount || 0}
          </div>
        </Card>
      </div>

      {/* View Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewTab('claims')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              viewTab === 'claims'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            Credit Claims History
          </button>
          <button
            onClick={() => setViewTab('ledger')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              viewTab === 'ledger'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            FIFO Credit Ledger (60 Days Expiry)
          </button>
        </div>

        {isHRAdmin && employees.length > 0 && (
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-1.5 outline-none focus:border-indigo-500"
          >
            <option value="">All Staff</option>
            {employees.map((emp) => (
              <option key={emp._id} value={emp._id}>
                {emp.personal?.firstName} {emp.personal?.lastName} ({emp.employeeId})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Tab 1: Claims History */}
      {viewTab === 'claims' && (
        <div className="space-y-4">
          <Card className="p-3 bg-slate-900/40 border-slate-800/80">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800/80 overflow-x-auto">
                {['all', 'pending', 'approved', 'rejected', 'cancelled'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveStatusTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                      activeStatusTab === tab
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search claims..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl pl-9 pr-3 py-1.5 outline-none focus:border-indigo-500 w-44 md:w-56"
                />
              </div>
            </div>
          </Card>

          {/* Floating Bulk Action Bar */}
          {selectedIds.length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-indigo-500/40 shadow-2xl backdrop-blur-md px-5 py-3 rounded-2xl flex items-center gap-4 z-50">
              <span className="text-xs font-semibold text-white">
                {selectedIds.length} claim(s) selected
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

          {/* Claims Table */}
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
                    <th className="p-3.5">Worked Date</th>
                    <th className="p-3.5">Verified Hours</th>
                    <th className="p-3.5">Credit Granted</th>
                    <th className="p-3.5">Reason</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        Loading comp-off claims...
                      </td>
                    </tr>
                  ) : filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        No comp-off claims found.
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
                            {new Date(req.workedDate).toLocaleDateString('en-IN', {
                              weekday: 'short',
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="p-3.5 font-mono text-slate-200">
                            {((req.workedMinutes || 465) / 60).toFixed(1)} hrs
                          </td>
                          <td className="p-3.5">
                            <span className="font-semibold text-emerald-400">
                              +{req.creditDays || 1} day
                            </span>{' '}
                            <span className="text-[10px] text-slate-500">
                              ({(req.creditMinutes || 465) / 60}h)
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
                                    title="Approve Claim"
                                    className="p-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleApprovalAction(approval._id, 'reject')}
                                    title="Reject Claim"
                                    className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              {((isRequester && isPending) || (isHRAdmin && req.status === 'approved')) && (
                                <button
                                  onClick={() => handleCancel(approval?._id)}
                                  title="Cancel Claim"
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
        </div>
      )}

      {/* Tab 2: FIFO Credit Ledger */}
      {viewTab === 'ledger' && (
        <Card className="bg-slate-900/40 border-slate-800/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="p-3.5">Earned Date</th>
                  <th className="p-3.5">Credit Allocation</th>
                  <th className="p-3.5">Used Minutes</th>
                  <th className="p-3.5">Available Balance</th>
                  <th className="p-3.5">Expiration Date (+60 Days)</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {ledgerData.credits?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No comp-off credits registered in ledger.
                    </td>
                  </tr>
                ) : (
                  ledgerData.credits?.map((credit) => {
                    const now = new Date();
                    const exp = new Date(credit.expiresAt);
                    const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
                    const isExpiring = credit.status === 'active' && daysLeft <= 7 && daysLeft >= 0;

                    const availMinutes = credit.creditMinutes - credit.usedMinutes;

                    return (
                      <tr key={credit._id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="p-3.5 font-medium text-slate-200">
                          {new Date(credit.earnedDate).toLocaleDateString('en-IN', {
                            weekday: 'short',
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="p-3.5">
                          <span className="font-semibold text-slate-200">
                            {(credit.creditMinutes / 465).toFixed(1)} day
                          </span>{' '}
                          <span className="text-[10px] text-slate-500">
                            ({(credit.creditMinutes / 60).toFixed(1)} hrs)
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-400">
                          {(credit.usedMinutes / 60).toFixed(1)} hrs
                        </td>
                        <td className="p-3.5">
                          <span className="font-bold text-emerald-400">
                            {(availMinutes / 60).toFixed(1)} hrs
                          </span>{' '}
                          <span className="text-[10px] text-slate-500">
                            ({parseFloat((availMinutes / 465).toFixed(2))} days)
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="font-medium text-slate-300">
                            {exp.toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                          {credit.status === 'active' && (
                            <span
                              className={`text-[10px] font-semibold ${
                                isExpiring ? 'text-amber-400 animate-pulse' : 'text-slate-500'
                              }`}
                            >
                              {daysLeft > 0 ? `${daysLeft} days remaining` : 'Expires today'}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <Badge
                            variant={
                              credit.status === 'active'
                                ? 'success'
                                : credit.status === 'used'
                                ? 'secondary'
                                : 'danger'
                            }
                            className="capitalize"
                          >
                            {credit.status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Claim Comp-Off Modal */}
      <Modal isOpen={isApplyOpen} onClose={() => setIsApplyOpen(false)} title="Claim Comp-Off Credit" size="md">
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
                Claim On Behalf Of (Optional)
              </label>
              <select
                value={formData.employeeId}
                onChange={(e) => {
                  setFormData({ ...formData, employeeId: e.target.value });
                  setVerificationResult(null);
                }}
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

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Worked Date</label>
            <div className="flex gap-2">
              <input
                type="date"
                required
                value={formData.workedDate}
                onChange={(e) => {
                  setFormData({ ...formData, workedDate: e.target.value });
                  setVerificationResult(null);
                }}
                className="flex-1 bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500"
              />
              <Button
                type="button"
                variant="secondary"
                disabled={verifying}
                onClick={handleVerifyPresence}
                className="text-xs shrink-0 flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                {verifying ? 'Checking...' : 'Verify Presence'}
              </Button>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Must be Sunday or declared company holiday with minimum 4.0 hours clocked
            </span>
          </div>

          {/* Verification Status Feedback */}
          {verificationResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                verificationResult.eligible
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}
            >
              {verificationResult.eligible ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="font-semibold">
                  {verificationResult.eligible
                    ? `Eligible for Comp-Off Credit (${verificationResult.workedHours} hrs worked)`
                    : 'Not Eligible for Comp-Off'}
                </div>
                <div className="text-[11px] opacity-90">{verificationResult.reason}</div>
                {verificationResult.isHoliday && (
                  <div className="text-[10px] opacity-75">
                    Recognized Holiday: {verificationResult.holidayName}
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Reason / Deliverables Handled
            </label>
            <textarea
              rows={3}
              required
              placeholder="Explain the critical delivery or sprint that required weekend presence..."
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-3 outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <span>
              Once approved by your manager and HR, credits are added to your ledger with{' '}
              <strong className="text-slate-200">60 days validity</strong> and consumed in FIFO order
              when applying for Comp-Off leave.
            </span>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsApplyOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || (verificationResult && !verificationResult.eligible)}
            >
              {submitting ? 'Submitting...' : 'Claim Comp-Off'}
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

export default ApplyCompOff;
