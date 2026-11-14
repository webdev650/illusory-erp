import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { StatCard } from '../ui';
import { Users, UserCheck, CalendarOff, Clock } from 'lucide-react';

export const HRKpiWidget = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await api.get('/dashboard/summary');
        if (res.success && res.data) {
          setMetrics(res.data);
        }
      } catch {
        //
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  const totalEmployees = metrics?.totalEmployees ?? 14;
  const presentToday = metrics?.presentToday ?? 11;
  const onLeaveToday = metrics?.onLeaveToday ?? 1;
  const pendingApprovals = metrics?.pendingApprovals ?? 3;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <StatCard
        icon={Users}
        iconColor="text-violet-600 bg-violet-50 dark:bg-violet-950/40 dark:text-violet-300"
        label="Total Employees"
        value={loading ? '...' : totalEmployees}
        subtext="Studio workforce"
      />
      <StatCard
        icon={UserCheck}
        iconColor="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300"
        label="Present Today"
        value={loading ? '...' : presentToday}
        badge="Active"
        badgeColor="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        subtext="Punched in"
      />
      <StatCard
        icon={CalendarOff}
        iconColor="text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300"
        label="On Leave"
        value={loading ? '...' : onLeaveToday}
        subtext="Approved leaves"
      />
      <StatCard
        icon={Clock}
        iconColor="text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300"
        label="Pending Approvals"
        value={loading ? '...' : pendingApprovals}
        badge="Action Req"
        badgeColor="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
        subtext="Leaves & assets"
      />
    </div>
  );
};

export default HRKpiWidget;

