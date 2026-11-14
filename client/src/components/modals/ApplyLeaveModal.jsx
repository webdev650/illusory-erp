import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Modal, Button } from '../ui';
import { Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';

export const ApplyLeaveModal = ({ isOpen, onClose, onSuccess }) => {
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    const fetchTypes = async () => {
      try {
        const res = await api.get('/hr/leave/types');
        if (res.success && res.data) {
          setLeaveTypes(res.data);
          if (res.data.length > 0) setLeaveTypeId(res.data[0]._id);
        }
      } catch {
        //
      }
    };
    fetchTypes();
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setMsg({ type: 'error', text: 'Please specify a reason for your leave.' });
      return;
    }

    try {
      setLoading(true);
      setMsg(null);
      const res = await api.post('/hr/leave/apply', {
        leaveTypeId,
        fromDate,
        toDate,
        isHalfDay,
        reason,
      });

      if (res.success) {
        setMsg({ type: 'success', text: res.message });
        setTimeout(() => {
          onClose();
          if (onSuccess) onSuccess();
        }, 1200);
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to submit leave application' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Apply for Leave"
      subtitle="Submit request for manager & HR approval"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {msg && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
              msg.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
            }`}
          >
            {msg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Leave Type
          </label>
          <select
            value={leaveTypeId}
            onChange={(e) => setLeaveTypeId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-brand-500"
          >
            {leaveTypes.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name} ({t.code}) — Quota: {t.yearlyQuota} days
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              From Date
            </label>
            <input
              type="date"
              required
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              To Date
            </label>
            <input
              type="date"
              required
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        <label className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={isHalfDay}
            onChange={(e) => setIsHalfDay(e.target.checked)}
            className="rounded text-brand-600 focus:ring-brand-500"
          />
          <span>Half-Day Leave (0.5 day)</span>
        </label>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Reason for Leave
          </label>
          <textarea
            required
            rows={3}
            placeholder="Please detail your leave reason..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center justify-end space-x-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={loading}>
            Submit Leave
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ApplyLeaveModal;
