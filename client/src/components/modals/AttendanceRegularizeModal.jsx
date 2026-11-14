import React, { useState } from 'react';
import api from '../../api/axios';
import { Modal, Button } from '../ui';
import { Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

export const AttendanceRegularizeModal = ({
  isOpen,
  onClose,
  targetDate,
  onSuccess,
}) => {
  const [requestedCheckIn, setRequestedCheckIn] = useState('09:30');
  const [requestedCheckOut, setRequestedCheckOut] = useState('18:30');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const formattedDate = targetDate
    ? new Date(targetDate).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setMsg({ type: 'error', text: 'Please explain the reason for manual log adjustment.' });
      return;
    }

    try {
      setLoading(true);
      setMsg(null);

      // Create Date objects from time inputs
      const checkInDateTime = new Date(`${formattedDate}T${requestedCheckIn}:00`);
      const checkOutDateTime = new Date(`${formattedDate}T${requestedCheckOut}:00`);

      const res = await api.post('/hr/attendance/regularization', {
        date: formattedDate,
        requestedCheckIn: checkInDateTime,
        requestedCheckOut: checkOutDateTime,
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
      setMsg({ type: 'error', text: err.message || 'Failed to submit regularization' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add / Regularize Attendance Log"
      subtitle={`Manual punch request for ${new Date(formattedDate).toLocaleDateString()}`}
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
              Clock In Time
            </label>
            <input
              type="time"
              required
              value={requestedCheckIn}
              onChange={(e) => setRequestedCheckIn(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Clock Out Time
            </label>
            <input
              type="time"
              required
              value={requestedCheckOut}
              onChange={(e) => setRequestedCheckOut(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Reason / Explanation
          </label>
          <textarea
            required
            rows={3}
            placeholder="e.g. Forgot punch card due to early client shoot / biometric network outage..."
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
            Submit to HR
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AttendanceRegularizeModal;
