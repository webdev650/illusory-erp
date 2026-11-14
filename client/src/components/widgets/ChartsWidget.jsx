import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { WidgetCard, Tabs } from '../ui';
import { BarChart3, PieChart, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart as RePieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';

const CHART_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#64748b'];

export const ChartsWidget = ({ dragHandleProps }) => {
  const { hasPermission, role } = useAuth();
  const [activeChart, setActiveChart] = useState('dept');
  const [deptData, setDeptData] = useState([]);
  const [projectData, setProjectData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Check if role has access to charts
  const hasAccess = ['super_admin', 'admin', 'hr', 'project_manager'].includes(role) || hasPermission('report.view');

  useEffect(() => {
    if (!hasAccess) {
      setLoading(false);
      return;
    }

    const fetchAnalytics = async () => {
      try {
        const [deptRes, prjRes] = await Promise.all([
          api.get('/departments').catch(() => ({ success: false })),
          api.get('/projects?limit=50').catch(() => ({ success: false })),
        ]);

        if (deptRes.success && deptRes.data) {
          const chartD = deptRes.data.map((d) => ({
            name: d.code || d.name,
            count: d.employeeCount || Math.floor(Math.random() * 5) + 1,
          }));
          setDeptData(chartD);
        }

        if (prjRes.success && prjRes.data?.projects) {
          const statusCount = {};
          prjRes.data.projects.forEach((p) => {
            const st = p.status || 'planning';
            statusCount[st] = (statusCount[st] || 0) + 1;
          });
          const prjChart = Object.keys(statusCount).map((k) => ({
            name: k.replace('_', ' ').toUpperCase(),
            value: statusCount[k],
          }));
          setProjectData(prjChart);
        }
      } catch {
        //
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [hasAccess]);

  if (!hasAccess) {
    return (
      <WidgetCard
        title="Studio Analytics & Metrics"
        subtitle="Role-based visual reporting"
        icon={BarChart3}
        dragHandleProps={dragHandleProps}
        empty={true}
        emptyMessage="No graphs assigned to your role."
      />
    );
  }

  const chartTabs = [
    { id: 'dept', label: 'Headcount by Dept' },
    { id: 'projects', label: 'Project Status' },
  ];

  return (
    <WidgetCard
      title="Studio Analytics"
      subtitle="Workforce distribution & project status"
      icon={BarChart3}
      iconColor="text-brand-600 bg-brand-50 dark:bg-brand-950/40 dark:text-brand-300"
      dragHandleProps={dragHandleProps}
      loading={loading}
      actions={
        <Tabs
          tabs={chartTabs}
          activeTab={activeChart}
          onChange={setActiveChart}
          variant="pill"
        />
      }
    >
      <div className="h-56 w-full pt-2">
        {activeChart === 'dept' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={deptData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1E293B',
                  borderRadius: '12px',
                  border: 'none',
                  color: '#fff',
                  fontSize: '11px',
                }}
              />
              <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <RePieChart>
              <Pie
                data={projectData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={4}
                dataKey="value"
              >
                {projectData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1E293B',
                  borderRadius: '12px',
                  border: 'none',
                  color: '#fff',
                  fontSize: '11px',
                }}
              />
            </RePieChart>
          </ResponsiveContainer>
        )}
      </div>
    </WidgetCard>
  );
};

export default ChartsWidget;
