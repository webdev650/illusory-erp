import React, { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  ArrowLeft,
  CheckCircle2,
  X,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import api from '../../api/axios';

export const LateClockInModal = ({
  isOpen,
  intentData,
  onSuccess,
  onCancel,
  onRestartIntent,
}) => {
  const [step, setStep] = useState(1);
  const [selectedReason, setSelectedReason] = useState(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expired, setExpired] = useState(false);

  if (!isOpen || !intentData) return null;

  const {
    intentId,
    serverTime,
    lateMinutes = 0,
    reasons = [],
    reminderText = 'Late entries are tracked monthly. Please check the attendance rule book.',
  } = intentData;

  const formattedPressTime = new Date(serverTime).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const handleSelectReason = (reason) => {
    setSelectedReason(reason);
    setStep(2);
    setError(null);
  };

  const handleCancel = async () => {
    try {
      if (intentId) {
        await api.delete(`/attendance/punch/intent/${intentId}`);
      }
    } catch {
      // Ignore
    }
    onCancel();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReason) {
      setError('Please choose a reason');
      return;
    }

    if (selectedReason.requiresNote && (!note || note.trim().length === 0)) {
      setError(`A brief explanation is mandatory for "${selectedReason.label}".`);
      return;
    }

    if (note.length > 300) {
      setError('Note must be 300 characters or fewer.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api.post('/attendance/punch/late-reason', {
        intentId,
        reasonKey: selectedReason.key,
        note: note.trim(),
      });

      if (res.success) {
        onSuccess(res.data);
      }
    } catch (err) {
      if (err.code === 'INTENT_EXPIRED' || err.status === 410) {
        setExpired(true);
        setError('Your 10-minute clock-in window has expired. Please restart to capture the new time.');
      } else {
        setError(err.message || 'Failed to complete clock-in');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      {/* Container: Bottom Sheet on Mobile (<640px), Centered Modal on Desktop */}
      <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Bar */}
        <div className="p-5 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center flex-shrink-0 shadow-2xs">
              <Clock className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Late Arrival Reason
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Clocked at {formattedPressTime} IST ({lateMinutes} min after policy)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Cancel clock-in"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Expired Window Banner */}
        {expired ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Session Expired</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                The 10-minute reason submission window has expired. Please restart clock-in to record your updated server time.
              </p>
            </div>
            <button
              type="button"
              onClick={onRestartIntent}
              className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Restart Clock In
            </button>
          </div>
        ) : (
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {step === 1 ? (
              /* STEP 1: Select Reason */
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Please select the primary reason for your delay:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {reasons.map((r) => {
                    const isSelected = selectedReason?.key === r.key;
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => handleSelectReason(r)}
                        className={`p-3 rounded-2xl border text-left flex items-center space-x-3 transition-all min-h-[48px] cursor-pointer ${
                          isSelected
                            ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300 ring-2 ring-brand-500/20'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200 hover:border-brand-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <span className="text-2xl flex-shrink-0">{r.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate leading-tight">{r.label}</p>
                          {r.requiresNote && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              Note required
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* STEP 2: Note and Submit */
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-brand-50/60 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800/60">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-2xl">{selectedReason.emoji}</span>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                        {selectedReason.label}
                      </p>
                      <p className="text-[10px] text-brand-600 dark:text-brand-400">
                        Selected Reason
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center space-x-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Change</span>
                  </button>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Additional Details {selectedReason.requiresNote ? '(Required)' : '(Optional)'}
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {note.length}/300
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={300}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={
                      selectedReason.requiresNote
                        ? 'Please describe the circumstances leading to delay...'
                        : 'Any optional notes or context (up to 300 characters)...'
                    }
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                {/* Friendly Rule Book Reminder */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-start space-x-2">
                  <HelpCircle className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{reminderText}</span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={loading}
                    className="w-1/3 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={
                      loading ||
                      (selectedReason.requiresNote && (!note || note.trim().length === 0))
                    }
                    className="w-2/3 py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {loading ? 'Submitting...' : 'Confirm Clock In'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Footer info: frozen timestamp note */}
        {!expired && (
          <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 text-center flex items-center justify-between">
            <span>Punch timestamp frozen at {formattedPressTime}</span>
            <button
              type="button"
              onClick={handleCancel}
              className="text-slate-500 hover:text-red-500 transition-colors font-medium cursor-pointer"
            >
              Cancel punch
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LateClockInModal;
