import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import api from '../../api/axios';
import { WidgetCard, Badge } from '../ui';
import { Clock, ArrowRight, CheckCircle2 } from 'lucide-react';

export const PendingApprovalsWidget = ({ dragHandleProps }) => {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApprovals = async () => {
      try {
        const res = await api.get('/approvals/pending');
        if (res.success && res.data) {
          setApprovals(res.data);
        }
      } catch {
        //
      } finally {
        setLoading(false);
      }
    };
    fetchApprovals();
  }, []);

  return (
    <WidgetCard
      title="Pending Approvals"
      subtitle={`${approvals.length} requests awaiting your review`}
      icon={Clock}
      iconColor="text-brand-600 bg-brand-50 dark:bg-brand-950/40 dark:text-brand-300"
      dragHandleProps={dragHandleProps}
      loading={loading}
      empty={approvals.length === 0}
      emptyMessage="No pending approvals waiting for your action."
      actions={
        <NavLink
          to="/approvals"
          className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center space-x-1"
        >
          <span>All Approvals</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </NavLink>
      }
    >
      <div className="space-y-2">
        {approvals.slice(0, 4).map((item) => (
          <NavLink
            key={item._id}
            to="/approvals"
            className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="truncate pr-2">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block truncate">
                {item.title}
              </span>
              <span className="text-[10px] text-slate-400">
                Requested by {item.requestedBy?.fullName || 'Employee'} •{' '}
                {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <Badge variant="brand" size="sm">
              Review
            </Badge>
          </NavLink>
        ))}
      </div>
    </WidgetCard>
  );
};

export default PendingApprovalsWidget;
