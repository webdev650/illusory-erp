import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { PageHeader, Card, Button, Badge } from '../../components/ui';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  RotateCcw,
  HelpCircle,
  FileCheck,
} from 'lucide-react';

export const CutoverReadiness = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const fetchReadiness = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/attendance/settlement/cutover-readiness');
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load cutover readiness:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load readiness status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReadiness();
  }, []);

  const summary = data?.summary || { total: 9, done: 0, pending: 9, isReadyForCutover: false };
  const checklist = data?.checklist || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Cutover Readiness Checklist"
        subtitle="Verification gates required before locking 2026 cutover baseline and going live with real leave balances."
        badge={
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              summary.isReadyForCutover
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}
          >
            {summary.isReadyForCutover ? 'Ready for Cutover' : `${summary.pending} Action(s) Pending`}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchReadiness}
              disabled={loading}
              className="border-slate-700 text-slate-300 hover:text-white"
            >
              <RotateCcw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/hrms/attendance/settlement')}
              className="bg-brand-600 hover:bg-brand-500 text-white"
            >
              Back to Settlement
            </Button>
          </div>
        }
      />

      {/* Safety Notice Banner */}
      <div className="p-4 bg-amber-950/30 border border-amber-800/60 rounded-2xl text-xs text-amber-200 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-amber-300">Live Policy & Employee Protection Guardrail Active</h4>
          <p className="mt-1 text-slate-300">
            No inferred probation statuses, confirmation dates, or policy settings have been applied to live employee records.
            Items marked in <strong>amber</strong> represent decisions awaiting explicit confirmation by HR. BizCompass cutover opening balances serve as the authoritative override baseline upon import.
          </p>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <span className="text-slate-400 text-xs font-semibold uppercase">Total Verification Gates</span>
          <p className="text-2xl font-bold text-white mt-1">{summary.total}</p>
          <span className="text-[11px] text-slate-500">Core operational prerequisites</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <span className="text-emerald-400 text-xs font-semibold uppercase">Confirmed & Completed</span>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{summary.done}</p>
          <span className="text-[11px] text-emerald-500/80">Verified without assumptions</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <span className="text-amber-400 text-xs font-semibold uppercase">Awaiting HR Clarification</span>
          <p className="text-2xl font-bold text-amber-400 mt-1">{summary.pending}</p>
          <span className="text-[11px] text-amber-500/80">Pending formal confirmation</span>
        </div>
      </div>

      {/* Checklist Items */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-violet-400" />
          Cutover Gate Verification Matrix
        </h3>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">Evaluating cutover readiness status...</div>
        ) : error ? (
          <div className="p-4 bg-rose-950/30 border border-rose-800/60 rounded-xl text-xs text-rose-300">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {checklist.map((item, idx) => (
              <div
                key={item.id || idx}
                className={`bg-slate-900/90 border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                  item.status === 'done'
                    ? 'border-emerald-500/30 bg-emerald-950/10'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                      {item.category}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 ${
                        item.status === 'done'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {item.status === 'done' ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> Done
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3" /> Pending
                        </>
                      )}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white mb-1.5">{item.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">{item.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-800/80">
                  <div className="text-[11px] font-mono text-slate-300 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 mb-3 truncate">
                    {item.currentValue}
                  </div>

                  {item.targetScreen && (
                    <button
                      onClick={() => navigate(item.targetScreen)}
                      className="inline-flex items-center text-xs font-semibold text-brand-400 hover:text-brand-300 hover:underline gap-1"
                    >
                      <span>Open Setting</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CutoverReadiness;
