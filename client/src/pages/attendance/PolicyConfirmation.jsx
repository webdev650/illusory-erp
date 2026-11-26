import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button } from '../../components/ui';
import AutomationBanner from '../../components/attendance/AutomationBanner';
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  FileText,
  UserCheck,
  RefreshCw,
  Plus,
  Trash2,
  Power,
  Play,
  Eye,
  Info,
  Layers,
  Scale,
} from 'lucide-react';

export const PolicyConfirmation = () => {
  const { role, user } = useAuth();
  const isSuperAdmin = role === 'super_admin' || user?.role?.key === 'super_admin';
  const isHR = isSuperAdmin || role === 'hr' || user?.role?.key === 'hr';

  const [loading, setLoading] = useState(true);
  const [policyData, setPolicyData] = useState(null);
  const [items, setItems] = useState([]);
  const [criticalDates, setCriticalDates] = useState([]);

  // Automation master switch state
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [automationMeta, setAutomationMeta] = useState({ toggledAt: null, toggledBy: null });
  const [toggleModalOpen, setToggleModalOpen] = useState(false);
  const [targetToggleState, setTargetToggleState] = useState(false);
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [toggleLoading, setToggleLoading] = useState(false);

  // Job preview run modal state
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewResult, setPreviewResult] = useState(null);

  // Critical date modal
  const [critModalOpen, setCritModalOpen] = useState(false);
  const [critForm, setCritForm] = useState({ title: '', date: '', type: 'event', description: '' });

  const loadData = async () => {
    try {
      setLoading(true);
      const [confRes, critRes, autoRes] = await Promise.all([
        api.get('/attendance/policy/confirmations'),
        api.get('/attendance/critical-dates'),
        api.get('/attendance/automation/status'),
      ]);

      if (confRes.success) {
        setPolicyData(confRes.data.policy);
        setItems(confRes.data.items || []);
      }
      if (critRes.success) {
        setCriticalDates(critRes.data || []);
      }
      if (autoRes.success) {
        setAutomationEnabled(autoRes.data.automationEnabled);
        setAutomationMeta({
          toggledAt: autoRes.data.automationToggledAt,
          toggledBy: autoRes.data.automationToggledBy,
        });
      }
    } catch (err) {
      console.warn('Failed to load policy confirmations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenToggleModal = (enable) => {
    if (!isSuperAdmin) {
      alert('Only Super Admin can toggle the Go-Live master automation switch.');
      return;
    }
    setTargetToggleState(enable);
    setTypedConfirmation('');
    setToggleModalOpen(true);
  };

  const handleConfirmToggle = async (e) => {
    e.preventDefault();
    if (targetToggleState && typedConfirmation !== 'ENABLE_AUTOMATION') {
      alert("You must type exactly 'ENABLE_AUTOMATION' to confirm.");
      return;
    }

    try {
      setToggleLoading(true);
      const res = await api.post('/attendance/automation/toggle', {
        enabled: targetToggleState,
        confirmationPhrase: typedConfirmation,
      });

      if (res.success) {
        setAutomationEnabled(res.data.automationEnabled);
        setToggleModalOpen(false);
        loadData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle automation switch');
    } finally {
      setToggleLoading(false);
    }
  };

  const handleRunPreview = async (type) => {
    setPreviewModalOpen(true);
    setPreviewLoading(true);
    setPreviewResult(null);

    let endpoint = '';
    let title = '';

    if (type === 'accrual') {
      endpoint = '/attendance/automation/preview/monthly-accrual';
      title = 'Monthly Leave Accrual Simulation (1st of Month, 00:10 IST)';
    } else if (type === 'missing_clockout') {
      endpoint = '/attendance/automation/preview/missing-clockout';
      title = '19:00 IST Missing Clock-Out Inspection Simulation';
    } else if (type === 'eod_not_pa') {
      endpoint = '/attendance/automation/preview/eod-not-pa';
      title = '23:59 IST EOD Absenteeism (NOT P/A) Simulation';
    } else if (type === 'late_penalties') {
      endpoint = '/attendance/automation/preview/late-penalties';
      title = 'Late Penalty Deduction Counter Simulation';
    }

    setPreviewTitle(title);

    try {
      const res = await api.get(endpoint);
      if (res.success) {
        setPreviewResult(res.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to generate preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleToggleConfirm = async (item) => {
    if (!isHR) return alert('Only HR and Super Admins can confirm policy rules.');
    try {
      const nextStatus = !item.isConfirmed;
      const res = await api.post(`/attendance/policy/confirmations/${item.key}`, {
        isConfirmed: nextStatus,
        notes: nextStatus ? 'Confirmed with HR via Illusory ERP confirmation portal' : '',
      });
      if (res.success) {
        loadData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update confirmation status');
    }
  };

  const handleCreateCriticalDate = async (e) => {
    e.preventDefault();
    if (!critForm.title || !critForm.date) return alert('Title and date are required');
    try {
      const res = await api.post('/attendance/critical-dates', critForm);
      if (res.success) {
        setCritModalOpen(false);
        setCritForm({ title: '', date: '', type: 'event', description: '' });
        loadData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create critical date');
    }
  };

  const handleDeleteCriticalDate = async (id) => {
    if (!confirm('Are you sure you want to remove this critical date?')) return;
    try {
      const res = await api.delete(`/attendance/critical-dates/${id}`);
      if (res.success) loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete critical date');
    }
  };

  const confirmedCount = items.filter((i) => i.isConfirmed).length;
  const pendingCount = items.filter((i) => !i.isConfirmed).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <PageHeader
        title="Rule Book Policy Confirmation & Review"
        subtitle="Verification checklist for Section 12 items from the official Attendance & Leave Rule Book. Items remain unverified until HR marks them confirmed."
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={loadData}
            className="flex items-center gap-1.5 border-slate-700 text-slate-300"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* Prominent Go-Live Automation Banner */}
      <AutomationBanner initialEnabled={automationEnabled} />

      {/* GO-LIVE SAFETY SWITCH CARD */}
      <Card className="p-6 border-slate-800 bg-slate-900/90 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Power className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  Go-Live Master Automation Switch
                  {automationEnabled ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      LIVE (ON)
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      SAFE (OFF)
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-400">
                  {automationEnabled
                    ? 'Automated monthly accrual, 19:00 missing clock-out alerts, 23:59 EOD absenteeism, late penalty tracking, and outbound emails are ACTIVE.'
                    : 'All background crons, leave accrual deductions, reminder emails, and auto-absenteeism sweeps are DISABLED. Real employee records remain untouched.'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isSuperAdmin ? (
              <Button
                variant={automationEnabled ? 'destructive' : 'primary'}
                size="sm"
                onClick={() => handleOpenToggleModal(!automationEnabled)}
                className="font-semibold flex items-center gap-2"
              >
                <Power className="w-4 h-4" />
                {automationEnabled ? 'Turn Switch OFF' : 'Turn Switch ON (Go-Live)'}
              </Button>
            ) : (
              <span className="text-xs text-slate-500 italic">Super Admin role required to toggle</span>
            )}
          </div>
        </div>

        {automationMeta.toggledAt && (
          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Last toggled: {new Date(automationMeta.toggledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
            <span>Audit Logged</span>
          </div>
        )}
      </Card>

      {/* JOB PREVIEW HUB */}
      <Card className="p-6 border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-brand-400" />
              Cron Job Simulation & Preview Hub
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulate and preview background jobs safely before go-live. Calculates counts and targets without writing to the database or dispatching notifications.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => handleRunPreview('accrual')}
            className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/50 hover:border-brand-500/40 text-left transition-all group"
          >
            <div className="flex items-center justify-between text-brand-400 mb-2">
              <Calendar className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-brand-500/10 text-brand-300">Monthly</span>
            </div>
            <div className="font-semibold text-white text-xs">Preview Monthly Accrual</div>
            <div className="text-[11px] text-slate-400 mt-1">Simulates 1-day credit for eligible active staff.</div>
          </button>

          <button
            onClick={() => handleRunPreview('missing_clockout')}
            className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/50 hover:border-amber-500/40 text-left transition-all group"
          >
            <div className="flex items-center justify-between text-amber-400 mb-2">
              <Clock className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-300">19:00 IST</span>
            </div>
            <div className="font-semibold text-white text-xs">Preview Missing Clock-Out</div>
            <div className="text-[11px] text-slate-400 mt-1">Checks employees with punch-in but no punch-out.</div>
          </button>

          <button
            onClick={() => handleRunPreview('eod_not_pa')}
            className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/50 hover:border-rose-500/40 text-left transition-all group"
          >
            <div className="flex items-center justify-between text-rose-400 mb-2">
              <XCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-rose-500/10 text-rose-300">23:59 IST</span>
            </div>
            <div className="font-semibold text-white text-xs">Preview 23:59 EOD Absentee</div>
            <div className="text-[11px] text-slate-400 mt-1">Checks unrecorded employees on today's working day.</div>
          </button>

          <button
            onClick={() => handleRunPreview('late_penalties')}
            className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/50 hover:border-purple-500/40 text-left transition-all group"
          >
            <div className="flex items-center justify-between text-purple-400 mb-2">
              <Scale className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-purple-500/10 text-purple-300">Tier Review</span>
            </div>
            <div className="font-semibold text-white text-xs">Preview Late Penalty Counter</div>
            <div className="text-[11px] text-slate-400 mt-1">Inspects monthly late arrival tiers & deductions.</div>
          </button>
        </div>
      </Card>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 border-slate-800 bg-slate-900/60">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Rule Book Checkpoints</span>
          <p className="text-2xl font-bold text-white mt-1">{items.length}</p>
          <span className="text-xs text-slate-500 mt-0.5 block">Attendance & Leave specifications</span>
        </Card>

        <Card className="p-5 border-emerald-900/40 bg-emerald-950/20">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Confirmed with HR</span>
          <p className="text-2xl font-bold text-emerald-300 mt-1">{confirmedCount}</p>
          <span className="text-xs text-emerald-500/80 mt-0.5 block">Audited & approved live settings</span>
        </Card>

        <Card className="p-5 border-amber-900/40 bg-amber-950/20">
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Pending HR Confirmation</span>
          <p className="text-2xl font-bold text-amber-300 mt-1">{pendingCount}</p>
          <span className="text-xs text-amber-500/80 mt-0.5 block">Badged "unverified, confirm with HR"</span>
        </Card>
      </div>

      {/* Section 12 Rule Book Items Table */}
      <Card className="p-6 border-slate-800 bg-slate-900/80">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-400" />
              Section 12: Rule Book Policy Verification Matrix
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Strict compliance safeguards: Settings operate in non-destructive flag mode until confirmed by HR.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Section / Item</th>
                <th className="py-3 px-4">Rule Book Specification</th>
                <th className="py-3 px-4">ERP Implementation Mode</th>
                <th className="py-3 px-4">Status</th>
                {isHR && <th className="py-3 px-4 text-right">HR Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {items.map((item) => (
                <tr key={item.key} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-white">
                    <span className="block text-xs font-bold text-brand-400">{item.ruleBookSection}</span>
                    {item.label}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-400 max-w-sm">
                    {item.notes}
                  </td>
                  <td className="py-3.5 px-4 text-xs">
                    <span className="font-mono text-slate-300 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                      {item.key}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {item.isConfirmed ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Confirmed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Unverified
                      </span>
                    )}
                  </td>
                  {isHR && (
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        size="xs"
                        variant={item.isConfirmed ? 'outline' : 'primary'}
                        onClick={() => handleToggleConfirm(item)}
                        className={item.isConfirmed ? 'border-slate-700 text-slate-400' : 'bg-brand-600 hover:bg-brand-500 text-white font-semibold'}
                      >
                        {item.isConfirmed ? 'Mark Unverified' : 'Mark Confirmed'}
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Critical Dates Section */}
      <Card className="p-6 border-slate-800 bg-slate-900/80">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              Critical Studio Dates Calendar (Non-Approval Warning Dates)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Shoots, client milestones, releases. Leave applications on these dates will surface an advisory warning.
            </p>
          </div>
          {isHR && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => setCritModalOpen(true)}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white"
            >
              <Plus className="w-4 h-4" />
              Add Critical Date
            </Button>
          )}
        </div>

        {criticalDates.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            No critical milestone dates currently scheduled.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {criticalDates.map((cd) => (
              <div
                key={cd._id}
                className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/40 flex items-start justify-between"
              >
                <div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                    {cd.type}
                  </span>
                  <h4 className="font-semibold text-white text-sm mt-1">{cd.title}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(cd.date).toLocaleDateString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                  {cd.description && <p className="text-[11px] text-slate-500 mt-1 italic">{cd.description}</p>}
                </div>
                {isHR && (
                  <button
                    onClick={() => handleDeleteCriticalDate(cd._id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* TOGGLE CONFIRMATION MODAL */}
      {toggleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {targetToggleState ? 'Confirm Go-Live Master Switch Activation' : 'Confirm Master Switch Deactivation'}
            </h3>

            <div className="mt-3 text-xs text-slate-400 leading-relaxed space-y-2">
              {targetToggleState ? (
                <>
                  <p>
                    Activating the Go-Live master switch will enable live automated leave accruals, missing clock-out notifications, EOD absenteeism sweeps, and outbound emails.
                  </p>
                  <p className="text-amber-300 font-semibold">
                    To prevent accidental activation, type <span className="font-mono bg-amber-950 text-amber-200 px-1 py-0.5 rounded border border-amber-800">ENABLE_AUTOMATION</span> below:
                  </p>
                </>
              ) : (
                <p>
                  Deactivating this switch will immediately pause all background cron operations, reminders, late deduction records, and emails.
                </p>
              )}
            </div>

            <form onSubmit={handleConfirmToggle} className="mt-4 space-y-4">
              {targetToggleState && (
                <input
                  type="text"
                  placeholder="Type ENABLE_AUTOMATION"
                  value={typedConfirmation}
                  onChange={(e) => setTypedConfirmation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                  autoFocus
                />
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setToggleModalOpen(false)}
                  disabled={toggleLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant={targetToggleState ? 'primary' : 'destructive'}
                  size="sm"
                  disabled={toggleLoading || (targetToggleState && typedConfirmation !== 'ENABLE_AUTOMATION')}
                  className="font-semibold"
                >
                  {toggleLoading ? 'Updating...' : targetToggleState ? 'Confirm & Enable' : 'Confirm & Disable'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOB PREVIEW MODAL */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-brand-400" />
                  {previewTitle}
                </h3>
                <span className="text-[11px] text-amber-400 font-mono flex items-center gap-1 mt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Simulation Mode: Nothing saved to database, zero emails/notifications sent.
                </span>
              </div>
              <button
                onClick={() => setPreviewModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              {previewLoading ? (
                <div className="py-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-brand-400" />
                  Simulating job execution across current records...
                </div>
              ) : !previewResult ? (
                <div className="text-center py-8 text-slate-500 text-xs">No simulation data available.</div>
              ) : (
                <div className="space-y-4">
                  {/* Summary Bar */}
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Target Records Found:</span>
                    <span className="font-bold text-brand-400 font-mono text-sm">
                      {previewResult.count ?? (previewResult.employees?.length || previewResult.penalties?.length || 0)}
                    </span>
                  </div>

                  {/* Details Table */}
                  {previewResult.employees && previewResult.employees.length > 0 && (
                    <div className="border border-slate-800 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950 text-slate-400 uppercase font-mono">
                          <tr>
                            <th className="py-2.5 px-3">Employee</th>
                            <th className="py-2.5 px-3">Leave / Info</th>
                            <th className="py-2.5 px-3 text-right">Simulated Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {previewResult.employees.map((emp, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/30">
                              <td className="py-2 px-3 font-medium text-white">
                                {emp.name || emp.employeeName || emp.employeeId}
                                {emp.employeeId && (
                                  <span className="block text-[10px] font-mono text-slate-500">{emp.employeeId}</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-slate-400">
                                {emp.leaveType ? `${emp.leaveType} (${emp.days || 1} day)` : emp.department || 'Active Staff'}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-brand-400">
                                {emp.status === 'would_credit' ? 'Would Credit 1 Day' : 'Would Alert'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Late Penalties Table */}
                  {previewResult.penalties && previewResult.penalties.length > 0 && (
                    <div className="border border-slate-800 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950 text-slate-400 uppercase font-mono">
                          <tr>
                            <th className="py-2.5 px-3">Employee</th>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Late Mins</th>
                            <th className="py-2.5 px-3 text-right">Deduction Tier</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {previewResult.penalties.map((pen, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/30">
                              <td className="py-2 px-3 font-medium text-white">
                                {pen.name || pen.employeeId}
                              </td>
                              <td className="py-2 px-3 text-slate-400">{pen.date}</td>
                              <td className="py-2 px-3 font-mono text-amber-400">{pen.lateMinutes}m</td>
                              <td className="py-2 px-3 text-right font-mono text-rose-400 uppercase">
                                {pen.tier}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {(!previewResult.employees || previewResult.employees.length === 0) &&
                    (!previewResult.penalties || previewResult.penalties.length === 0) && (
                      <div className="text-center py-6 text-slate-500 text-xs italic">
                        Zero employees matched simulation conditions. No action would be taken.
                      </div>
                    )}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setPreviewModalOpen(false)}>
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Critical Date Modal */}
      {critModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-500" />
              Register Critical Studio Date
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Mark an imperative studio milestone, client delivery, or production shoot date.
            </p>

            <form onSubmit={handleCreateCriticalDate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Milestone Title</label>
                <input
                  type="text"
                  placeholder="e.g. Major Game Asset Drop, Commercial Shoot"
                  value={critForm.title}
                  onChange={(e) => setCritForm({ ...critForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Date</label>
                <input
                  type="date"
                  value={critForm.date}
                  onChange={(e) => setCritForm({ ...critForm, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Event Type</label>
                <select
                  value={critForm.type}
                  onChange={(e) => setCritForm({ ...critForm, type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="event">Production Event / Shoot</option>
                  <option value="delivery">Client Milestone Delivery</option>
                  <option value="audit">Statutory / Studio Audit</option>
                  <option value="other">Other High-Impact Date</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Notes explaining why absence should be avoided..."
                  value={critForm.description}
                  onChange={(e) => setCritForm({ ...critForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setCritModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" className="bg-amber-600 hover:bg-amber-500 text-white font-semibold">
                  Register Date
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PolicyConfirmation;
