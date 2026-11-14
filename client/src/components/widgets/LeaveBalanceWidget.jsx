import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { WidgetCard } from '../ui';
import { Calendar, CheckCircle2 } from 'lucide-react';

export const LeaveBalanceWidget = ({ dragHandleProps }) => {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const res = await api.get('/hr/leave/balances');
        if (res.success && res.data) {
          setBalances(res.data);
        }
      } catch {
        //
      } finally {
        setLoading(false);
      }
    };
    fetchBalances();
  }, []);

  return (
    <WidgetCard
      title="My Leave Balances"
      subtitle={`Calendar Year ${new Date().getFullYear()}`}
      icon={Calendar}
      iconColor="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300"
      dragHandleProps={dragHandleProps}
      loading={loading}
      empty={balances.length === 0}
      emptyMessage="No leave balances configured for this year."
    >
      <div className="grid grid-cols-3 gap-2.5">
        {balances.slice(0, 3).map((bal) => {
          const available = (bal.allocated || 0) + (bal.carried || 0) - (bal.used || 0) - (bal.pending || 0);

          return (
            <div
              key={bal._id}
              className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                {bal.leaveType?.name || 'Leave'}
              </span>
              <span className="text-xl font-extrabold text-slate-900 dark:text-white font-mono my-0.5 block">
                {available}
              </span>
              <span className="text-[10px] text-slate-400">
                of {bal.allocated} days left
              </span>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
};

export default LeaveBalanceWidget;

