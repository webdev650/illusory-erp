import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Card, Button } from '../components/ui';
import {
  GitMerge,
  Search,
  User,
  Users,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const OrgChartTree = () => {
  const navigate = useNavigate();
  const [roots, setRoots] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [zoom, setZoom] = useState(1);
  const [allEmployees, setAllEmployees] = useState([]);
  const [assigningId, setAssigningId] = useState(null);
  const [selectedManagerId, setSelectedManagerId] = useState('');

  const loadOrgChart = async () => {
    try {
      setLoading(true);
      const [res, empRes] = await Promise.all([
        api.get('/employees/orgchart'),
        api.get('/employees?limit=100'),
      ]);
      if (res.success) {
        setRoots(res.data.roots || []);
        setUnassigned(res.data.unassigned || []);
      }
      if (empRes.success) {
        setAllEmployees(empRes.data.employees || empRes.data || []);
      }
    } catch (err) {
      console.warn('Failed to load org chart:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrgChart();
  }, []);

  const handleQuickAssign = async (employeeId) => {
    if (!selectedManagerId) return;
    try {
      const res = await api.patch(`/employees/${employeeId}/manager`, {
        managerId: selectedManagerId,
      });
      if (res.success) {
        alert('Reporting manager assigned successfully!');
        setAssigningId(null);
        setSelectedManagerId('');
        loadOrgChart();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Assignment failed');
    }
  };

  // Node Component
  const TreeNode = ({ node }) => {
    const [collapsed, setCollapsed] = useState(false);
    const hasChildren = node.children && node.children.length > 0;
    const isMatched = search.trim() && (
      node.name.toLowerCase().includes(search.toLowerCase()) ||
      node.designation.toLowerCase().includes(search.toLowerCase()) ||
      node.code.toLowerCase().includes(search.toLowerCase())
    );

    return (
      <div className="flex flex-col items-center">
        {/* Node Card */}
        <div
          onClick={() => navigate(`/hrms/employees/${node.id}`)}
          className={`bg-slate-900 border rounded-2xl p-3.5 w-60 shadow-lg cursor-pointer transition-all hover:scale-105 hover:border-violet-500 relative ${
            isMatched
              ? 'border-violet-400 ring-2 ring-violet-500/40'
              : 'border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-violet-600/30 border border-violet-500/40 text-violet-300 font-bold flex items-center justify-center text-xs overflow-hidden shrink-0">
              {node.photo ? (
                <img src={node.photo} alt={node.name} className="w-full h-full object-cover" />
              ) : (
                node.name[0]
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <h4 className="text-xs font-bold text-white truncate">{node.name}</h4>
              <p className="text-[10px] text-slate-400 truncate">{node.designation}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                  {node.code}
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-violet-950 text-violet-300 border border-violet-800 truncate">
                  {node.department}
                </span>
              </div>
            </div>
          </div>

          {/* Children expander badge */}
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCollapsed(!collapsed);
              }}
              className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            >
              {collapsed ? `+${node.children.length}` : '−'}
            </button>
          )}
        </div>

        {/* Child branches */}
        {hasChildren && !collapsed && (
          <div className="flex flex-col items-center">
            {/* Stem */}
            <div className="w-px h-6 bg-slate-700" />

            {/* Children container */}
            <div className="flex items-start gap-6 relative pt-2">
              {node.children.length > 1 && (
                <div className="absolute top-2 left-30 right-30 h-px bg-slate-700" />
              )}
              {node.children.map((child) => (
                <TreeNode key={child.id} node={child} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search hierarchy..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.1, 1.4))}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.1, 0.6))}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:text-white"
            title="Reset Zoom"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Unassigned Manager Callout Panel */}
      {unassigned.length > 0 && (
        <div className="p-4 bg-amber-950/30 border border-amber-800/60 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 text-amber-300 font-bold">
            <AlertTriangle className="w-4 h-4" />
            <span>Unassigned / Inactive Reporting Leads Detected ({unassigned.length} staff)</span>
          </div>
          <p className="text-slate-400 text-[11px]">
            The following employees do not have an active supervisor linked in the master directory:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {unassigned.map((u) => (
              <div key={u.id} className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between gap-2">
                <div>
                  <strong className="text-white block">{u.name}</strong>
                  <span className="text-[10px] text-slate-400 font-mono">{u.code} • {u.designation}</span>
                </div>
                {assigningId === u.id ? (
                  <div className="flex items-center gap-1">
                    <select
                      value={selectedManagerId}
                      onChange={(e) => setSelectedManagerId(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-white"
                    >
                      <option value="">Select Manager</option>
                      {allEmployees.filter((e) => e._id !== u.id).map((e) => (
                        <option key={e._id} value={e._id}>
                          {e.personal?.firstName} {e.personal?.lastName}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleQuickAssign(u.id)}
                      className="px-2 py-1 rounded bg-brand-600 text-white font-bold text-[10px]"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAssigningId(u.id)}
                    className="text-violet-400 hover:underline text-[10px] font-semibold"
                  >
                    Assign Manager
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tree Visualization Area */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 overflow-auto min-h-[500px] flex justify-center">
        {loading ? (
          <div className="py-24 text-center text-slate-500">Generating hierarchical organizational chart...</div>
        ) : (
          <div
            className="transition-transform duration-200 origin-top flex items-start justify-center gap-12"
            style={{ transform: `scale(${zoom})` }}
          >
            {roots.map((root) => (
              <TreeNode key={root.id} node={root} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
