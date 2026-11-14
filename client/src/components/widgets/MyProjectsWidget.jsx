import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import api from '../../api/axios';
import { WidgetCard, Badge } from '../ui';
import { Briefcase, ArrowRight } from 'lucide-react';

export const MyProjectsWidget = ({ dragHandleProps }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await api.get('/projects?status=active&limit=4');
        if (res.success && res.data?.projects) {
          setProjects(res.data.projects);
        }
      } catch {
        //
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  return (
    <WidgetCard
      title="My Active Projects"
      subtitle={`${projects.length} client engagements`}
      icon={Briefcase}
      iconColor="text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300"
      dragHandleProps={dragHandleProps}
      loading={loading}
      empty={projects.length === 0}
      emptyMessage="No active projects assigned."
      actions={
        <NavLink
          to="/projects"
          className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center space-x-1"
        >
          <span>All Projects</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </NavLink>
      }
    >
      <div className="space-y-3">
        {projects.map((prj) => (
          <NavLink
            key={prj._id}
            to={`/projects/${prj._id}`}
            className="block p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="truncate pr-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate block">
                  {prj.name}
                </span>
                <span className="text-[10px] text-slate-400">
                  {prj.client?.name || 'Internal'} • {prj.projectCode}
                </span>
              </div>
              <Badge variant="brand" size="sm">
                {prj.priority || 'active'}
              </Badge>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Progress</span>
                <span className="font-semibold">{prj.progressPercent || 0}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="bg-brand-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${prj.progressPercent || 0}%` }}
                />
              </div>
            </div>
          </NavLink>
        ))}
      </div>
    </WidgetCard>
  );
};

export default MyProjectsWidget;

