import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { WidgetCard, Avatar, Badge } from '../ui';
import { Users, UserX, Clock } from 'lucide-react';

export const TeamOnLeaveWidget = ({ dragHandleProps }) => {
  const [onLeave, setOnLeave] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeamLeave = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const res = await api.get(`/hr/leave/calendar?from=${today}&to=${today}`);
        if (res.success && res.data) {
          setOnLeave(res.data);
        }
      } catch {
        //
      } finally {
        setLoading(false);
      }
    };
    fetchTeamLeave();
  }, []);

  return (
    <WidgetCard
      title="Team On Leave Today"
      subtitle={`${onLeave.length} members out of studio`}
      icon={UserX}
      iconColor="text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300"
      dragHandleProps={dragHandleProps}
      loading={loading}
      empty={onLeave.length === 0}
      emptyMessage="No team members on leave today. Full team strength! ✨"
    >
      <div className="space-y-2">
        {onLeave.map((item) => (
          <div
            key={item._id}
            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50"
          >
            <div className="flex items-center space-x-2.5 truncate">
              <Avatar
                src={item.employee?.personal?.photo?.url}
                name={item.employee?.fullName || 'Employee'}
                size="sm"
              />
              <div className="truncate">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate block">
                  {item.employee?.fullName}
                </span>
                <span className="text-[10px] text-slate-400">
                  {item.employee?.employment?.designation || 'Team Member'}
                </span>
              </div>
            </div>

            <Badge variant="warning" size="sm">
              {item.leaveType?.name || 'On Leave'}
            </Badge>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
};

export default TeamOnLeaveWidget;
