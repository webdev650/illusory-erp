import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button } from '../../components/ui';
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
} from 'lucide-react';

export const PolicyConfirmation = () => {
  const { role } = useAuth();
  const isHR = role === 'hr' || role === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [policyData, setPolicyData] = useState(null);
  const [items, setItems] = useState([]);
  const [criticalDates, setCriticalDates] = useState([]);

  // Critical date modal
  const [critModalOpen, setCritModalOpen] = useState(false);
  const [critForm, setCritForm] = useState({ title: '', date: '', type: 'event', description: '' });

  const loadData = async () => {
    try {
      setLoading(true);
      const [confRes, critRes] = await Promise.all([
        api.get('/attendance/policy/confirmations'),
        api.get('/attendance/critical-dates'),
      ]);

      if (confRes.success) {
        setPolicyData(confRes.data.policy);
        setItems(confRes.data.items || []);
      }
      if (critRes.success) {
        setCriticalDates(critRes.data || []);
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
              Shoots, client presentations, and release deadlines. Employees applying for leave on these dates receive an advisory warning.
            </p>
          </div>
          {isHR && (
            <Button size="sm" onClick={() => setCritModalOpen(true)} className="bg-brand-600 hover:bg-brand-500 text-white flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              Add Critical Date
            </Button>
          )}
        </div>

        {criticalDates.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">No critical dates scheduled yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {criticalDates.map((cd) => (
              <div key={cd._id} className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">{cd.title}</span>
                  <span className="text-[11px] text-amber-400 font-mono">
                    {new Date(cd.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block mt-0.5">{cd.type}</span>
                </div>
                {isHR && (
                  <button
                    onClick={() => handleDeleteCriticalDate(cd._id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Critical Date Modal */}
      {critModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Add Critical Studio Date</h3>
            <form onSubmit={handleCreateCriticalDate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Major Client Milestone Presentation"
                  value={critForm.title}
                  onChange={(e) => setCritForm({ ...critForm, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={critForm.date}
                  onChange={(e) => setCritForm({ ...critForm, date: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Category</label>
                <select
                  value={critForm.type}
                  onChange={(e) => setCritForm({ ...critForm, type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                >
                  <option value="shoot">Production Shoot</option>
                  <option value="client_milestone">Client Milestone</option>
                  <option value="deadline">Project Deadline</option>
                  <option value="event">Company Event</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button size="sm" variant="outline" type="button" onClick={() => setCritModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" className="bg-brand-600 hover:bg-brand-500 text-white font-bold">
                  Save Critical Date
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
