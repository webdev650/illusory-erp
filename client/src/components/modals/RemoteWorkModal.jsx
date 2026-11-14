import React, { useState } from 'react';
import api from '../../api/axios';
import { Modal, Button } from '../ui';
import { Home, Calendar, Phone, AlertCircle, CheckCircle2 } from 'lucide-react';

export const RemoteWorkModal = ({ isOpen, onClose, onSuccess }) => {
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setMsg({ type: 'error', text: 'Please provide a reason for remote work.' });
      return;
    }

    try {
      setLoading(true);
      setMsg(null);
      const res = await api.post('/hr/remote-work/apply', {
        fromDate,
        toDate,
        reason,
        contactPhone,
      });

      if (res.success) {
        setMsg({ type: 'success', text: res.message });
        setTimeout(() => {
          onClose();
          if (onSuccess) onSuccess();
        }, 1200);
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to submit application' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Apply for Remote Work (WFH)"
      subtitle="Submit request for manager approval"
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

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Emergency / Reachable Contact Number
          </label>
          <input
            type="tel"
            placeholder="+91 98765 43210"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Reason for Remote Work
          </label>
          <textarea
            required
            rows={3}
            placeholder="e.g. Fiber broadband maintenance at residence / client onsite call..."
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
            Submit Request
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default RemoteWorkModal;

