import React, { useState } from 'react';
import DashboardWidgetCard from '../../dashboard/DashboardWidgetCard';
import { Smile, AlertOctagon, Sparkles, Send } from 'lucide-react';
import api from '../../../api/axios';

const MOODS = [
  { label: 'Happy', emoji: '😄', color: 'bg-emerald-500' },
  { label: 'Good', emoji: '🙂', color: 'bg-teal-500' },
  { label: 'Cool', emoji: '😎', color: 'bg-indigo-500' },
  { label: 'Confused', emoji: '🤔', color: 'bg-amber-500' },
  { label: 'Sad', emoji: '😔', color: 'bg-blue-500' },
  { label: 'Afraid', emoji: '😨', color: 'bg-purple-500' },
  { label: 'Angry', emoji: '😡', color: 'bg-rose-500' },
  { label: 'Frustrated', emoji: '😤', color: 'bg-red-600' },
];

export const AverageMoodWidget = ({
  data,
  loading,
  error,
  filters,
  isMasked,
  departments,
  onToggleMask,
  onUpdateFilters,
  onApplyFiltersToAll,
  onRefresh,
  onRemove,
}) => {
  const [selectedMood, setSelectedMood] = useState(null);
  const [moodNote, setMoodNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const distribution = data?.distribution || [];
  const totalCheckins = data?.totalCheckins || 0;
  const negativeAlerts = data?.negativeAlerts || [];

  const handleCheckin = async () => {
    if (!selectedMood) return;
    try {
      setSubmitting(true);
      const res = await api.post('/hrms/dashboard/mood-checkin', {
        mood: selectedMood,
        note: moodNote,
      });
      if (res.success) {
        setSubmitted(true);
        onRefresh?.();
      }
    } catch {
      //
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardWidgetCard
      widgetKey="mood_summary"
      title="Studio Mood & Pulse"
      subtitle="Voluntary daily sentiment & team well-being"
      icon={Smile}
      loading={loading}
      error={error}
      isEmpty={totalCheckins === 0 && !negativeAlerts.length}
      emptyMessage="No mood check-ins submitted yet"
      isMasked={isMasked}
      filters={filters}
      departments={departments}
      onToggleMask={onToggleMask}
      onUpdateFilters={onUpdateFilters}
      onApplyFiltersToAll={onApplyFiltersToAll}
      onRefresh={onRefresh}
      onRemove={onRemove}
    >
      <div className="space-y-4">
        {/* Daily Voluntary Check-in Bar */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>How are you feeling today? (Voluntary)</span>
            </span>
            {submitted && (
              <span className="text-[10px] font-bold text-emerald-500">Recorded ✓</span>
            )}
          </div>

          <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar py-1">
            {MOODS.map((m) => (
              <button
                key={m.label}
                onClick={() => setSelectedMood(m.label)}
                className={`p-1.5 rounded-xl text-center flex-1 min-w-[36px] transition-all ${
                  selectedMood === m.label
                    ? 'bg-brand-600 text-white scale-110 shadow-md shadow-brand-500/25 ring-2 ring-brand-400/50'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
                title={m.label}
              >
                <span className="text-base block">{m.emoji}</span>
                <span className="text-[9px] block mt-0.5 truncate">{m.label}</span>
              </button>
            ))}
          </div>

          {selectedMood && !submitted && (
            <div className="flex items-center space-x-2 pt-1">
              <input
                type="text"
                placeholder="Add an optional note..."
                value={moodNote}
                onChange={(e) => setMoodNote(e.target.value)}
                className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
              />
              <button
                onClick={handleCheckin}
                disabled={submitting}
                className="px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg flex items-center space-x-1"
              >
                <Send className="w-3 h-3" />
                <span>Save</span>
              </button>
            </div>
          )}
        </div>

        {/* Sentiment Distribution */}
        <div>
          <div className="flex justify-between items-center text-xs text-slate-500 mb-2">
            <span>Overall Team Sentiment</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {totalCheckins} Responses
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {distribution.map((item, idx) => {
              const moodInfo = MOODS.find((m) => m.label === item.mood) || MOODS[0];
              return (
                <div
                  key={idx}
                  className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-1.5 truncate">
                    <span>{moodInfo.emoji}</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                      {item.mood}
                    </span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {item.percentage}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* HR/Admin Only Alert for repeated negative moods */}
        {negativeAlerts.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/50 space-y-2">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
              <AlertOctagon className="w-4 h-4 text-amber-600" />
              <span>HR Attention: Repeated Low Sentiment Alerts</span>
            </div>
            <div className="space-y-1.5">
              {negativeAlerts.map((alert, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 text-xs"
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {alert.name} ({alert.department})
                  </span>
                  <span className="text-[10px] font-bold text-rose-500">
                    {alert.negativeCount} negative check-ins (last 14d)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardWidgetCard>
  );
};

export default AverageMoodWidget;
