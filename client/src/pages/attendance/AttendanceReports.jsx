import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { PageHeader, Card, Button, Badge } from '../../components/ui';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Clock,
  Users,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Home,
  Coffee,
  X,
} from 'lucide-react';

const REPORT_TABS = [
  { id: 'monthly-register', label: 'Monthly Register', endpoint: '/attendance/reports/monthly-register' },
  { id: 'late-arrivals', label: 'Late Arrivals', endpoint: '/attendance/reports/late-arrivals' },
  { id: 'leave-balance', label: 'Leave Balances', endpoint: '/attendance/reports/leave-balance' },
  { id: 'regularization', label: 'Regularizations', endpoint: '/attendance/reports/regularization' },
  { id: 'remote-work', label: 'Remote Work', endpoint: '/attendance/reports/remote-work' },
  { id: 'overtime', label: 'Overtime', endpoint: '/attendance/reports/overtime' },
  { id: 'comp-off', label: 'Comp-Off Credits', endpoint: '/attendance/reports/comp-off' },
  { id: 'absentee', label: 'Absentee (NOT P/A)', endpoint: '/attendance/reports/absentee' },
  { id: 'missing-punches', label: 'Missing Punches', endpoint: '/attendance/reports/missing-punches' },
];

export const AttendanceReports = () => {
  const { user, role } = useAuth();
  const [activeTab, setActiveTab] = useState('monthly-register');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [month, setMonth] = useState('11');
  const [year, setYear] = useState('2026');
  const [msg, setMsg] = useState(null);

  const currentTab = REPORT_TABS.find((t) => t.id === activeTab);

  const fetchReport = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await api.get(`${currentTab.endpoint}?month=${month}&year=${year}`);
      if (res.success && res.data) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error('Failed to load report:', err);
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to load report data' });
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab, month, year]);

  const handleExportCSV = () => {
    window.open(`${api.defaults.baseURL}${currentTab.endpoint}?month=${month}&year=${year}&format=csv`, '_blank');
  };

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Attendance & Leave Reports"
        subtitle="Permission-scoped audit analytics, monthly attendance registers, and workforce compliance records"
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="border-slate-700 text-slate-200 hover:text-white"
            >
              <Download className="w-4 h-4 mr-1.5" /> Export CSV
            </Button>
          </div>
        }
      />

      {/* Messages */}
      {msg && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm ${
            msg.type === 'error'
              ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
              : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {msg.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-800">
        {REPORT_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
              activeTab === t.id
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Date Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-transparent text-white focus:outline-none"
          >
            <option value="1" className="bg-slate-950">January</option>
            <option value="2" className="bg-slate-950">February</option>
            <option value="3" className="bg-slate-950">March</option>
            <option value="4" className="bg-slate-950">April</option>
            <option value="5" className="bg-slate-950">May</option>
            <option value="6" className="bg-slate-950">June</option>
            <option value="7" className="bg-slate-950">July</option>
            <option value="8" className="bg-slate-950">August</option>
            <option value="9" className="bg-slate-950">September</option>
            <option value="10" className="bg-slate-950">October</option>
            <option value="11" className="bg-slate-950">November</option>
            <option value="12" className="bg-slate-950">December</option>
          </select>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="bg-transparent text-white focus:outline-none ml-1"
          >
            <option value="2025" className="bg-slate-950">2025</option>
            <option value="2026" className="bg-slate-950">2026</option>
            <option value="2027" className="bg-slate-950">2027</option>
          </select>
        </div>
      </div>

      {/* Report Content Table */}
      <Card className="overflow-hidden border-slate-800/80 bg-slate-900/50 shadow-xl">
        <div className="overflow-x-auto max-h-[600px]">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Loading report data...</div>
          ) : !reportData ? (
            <div className="p-12 text-center text-slate-400 text-xs">No records available for the selected period.</div>
          ) : activeTab === 'monthly-register' && reportData.dates ? (
            /* Monthly Register Grid */
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                <tr>
                  <th className="p-3 w-52 sticky left-0 z-30 bg-slate-950 border-r border-slate-800">Employee</th>
                  {reportData.dates.map((dStr) => (
                    <th key={dStr} className="p-1 text-center font-mono min-w-[34px] border-r border-slate-800/60">
                      {parseInt(dStr.split('-')[2], 10)}
                    </th>
                  ))}
                  <th className="p-2 text-center text-emerald-400">Present</th>
                  <th className="p-2 text-center text-indigo-400">Leave</th>
                  <th className="p-2 text-center text-slate-400">Off</th>
                  <th className="p-2 text-center text-rose-400">Absent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {reportData.rows.map((r) => (
                  <tr key={r.employeeId} className="hover:bg-slate-800/20">
                    <td className="p-3 sticky left-0 z-10 bg-slate-900 border-r border-slate-800">
                      <div className="font-medium text-slate-200">{r.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{r.employeeCode}</div>
                    </td>
                    {reportData.dates.map((dStr) => {
                      const st = r.days[dStr];
                      const isPresent = ['LOG_OK', 'BREAK_LOG', 'CHANGED_LOG', 'REMOTE_WORK', 'PARTIAL_DAY'].includes(st);
                      const isLeave = st === 'LEAVE';
                      const isOff = st === 'WEEK_OFF' || st === 'HOLIDAY';

                      return (
                        <td key={dStr} className="p-1 text-center font-mono text-[10px] border-r border-slate-800/40">
                          {isPresent ? (
                            <span className="text-emerald-400 font-bold">P</span>
                          ) : isLeave ? (
                            <span className="text-indigo-400 font-bold">L</span>
                          ) : isOff ? (
                            <span className="text-slate-500">O</span>
                          ) : (
                            <span className="text-rose-400 font-bold">A</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-2 text-center font-mono text-emerald-400 font-bold">{r.summary.present}</td>
                    <td className="p-2 text-center font-mono text-indigo-400 font-bold">{r.summary.leave}</td>
                    <td className="p-2 text-center font-mono text-slate-400">{r.summary.weekOff + r.summary.holiday}</td>
                    <td className="p-2 text-center font-mono text-rose-400 font-bold">{r.summary.notPa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : Array.isArray(reportData) && reportData.length > 0 ? (
            /* Generic Data Rows Table */
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                <tr>
                  {Object.keys(reportData[0]).map((key) => (
                    <th key={key} className="p-3 capitalize">{key.replace(/([A-Z])/g, ' $1')}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/20">
                    {Object.values(row).map((val, colIdx) => (
                      <td key={colIdx} className="p-3 text-slate-300">
                        {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '-')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-slate-400 text-xs">No entries recorded for this report.</div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default AttendanceReports;
