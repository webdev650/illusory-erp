import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { PageHeader, Card, Button, Badge } from '../../components/ui';
import {
  CreditCard,
  Calendar,
  Clock,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Lock,
  Unlock,
  History,
  Search,
  Filter,
  Save,
  Check,
  X,
  ArrowRight,
  FileSpreadsheet,
  HelpCircle,
  ChevronDown,
  Layers,
} from 'lucide-react';

export const LeaveBalanceSettlement = () => {
  const { user, role, permissions = [] } = useAuth();
  const isSuperAdmin = role === 'super_admin';
  const isHRAdmin = isSuperAdmin || role === 'hr' || permissions.includes('leave.settle') || permissions.includes('*');

  // Policy Year State
  const [policyYears, setPolicyYears] = useState([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [activePolicyYear, setActivePolicyYear] = useState(null);

  // Settlement Matrix State
  const [loading, setLoading] = useState(true);
  const [matrixData, setMatrixData] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [dirtyRows, setDirtyRows] = useState({}); // { [balanceId]: { settlementMinutes, forwardType, overrideReason } }

  // Action & Modal States
  const [saving, setSaving] = useState(false);
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [selectedEmpHistory, setSelectedEmpHistory] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Import Opening Balances State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);

  // Policy Comparison State
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false);
  const [comparisonList, setComparisonList] = useState([]);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonRounding, setComparisonRounding] = useState('none');

  const loadPolicyComparison = async (roundingOverride) => {
    try {
      setComparisonLoading(true);
      const r = roundingOverride !== undefined ? roundingOverride : comparisonRounding;
      const res = await api.get(`/attendance/settlement/policy-comparison?rounding=${r}`);
      if (res.success && res.data?.comparison) {
        setComparisonList(res.data.comparison);
      }
    } catch (err) {
      console.error('Failed to load policy comparison:', err);
    } finally {
      setComparisonLoading(false);
    }
  };

  const [msg, setMsg] = useState(null);

  // 1. Load Policy Years
  const loadPolicyYears = async () => {
    try {
      const res = await api.get('/attendance/settlement/years');
      if (res.success && res.data) {
        setPolicyYears(res.data);
        if (!selectedYearId && res.data.length > 0) {
          setSelectedYearId(res.data[0]._id);
          setActivePolicyYear(res.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load policy years:', err);
    }
  };

  // 2. Load Settlement Matrix
  const loadMatrix = async (pyId) => {
    const idToUse = pyId || selectedYearId;
    if (!idToUse) return;

    setLoading(true);
    setMsg(null);
    try {
      const res = await api.get(`/attendance/settlement/matrix?policyYearId=${idToUse}`);
      if (res.success && res.data) {
        setActivePolicyYear(res.data.policyYear);
        setMatrixData(res.data.matrix || []);
        setPendingRequests(res.data.pendingRequests || []);
        setDirtyRows({});
      }
    } catch (err) {
      console.error('Failed to load settlement matrix:', err);
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to load settlement matrix' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicyYears();
  }, []);

  useEffect(() => {
    if (selectedYearId) {
      loadMatrix(selectedYearId);
    }
  }, [selectedYearId]);

  // Departments for filtering
  const departments = useMemo(() => {
    const set = new Set();
    matrixData.forEach((item) => {
      if (item.employee?.department) set.add(item.employee.department);
    });
    return Array.from(set);
  }, [matrixData]);

  // Filtered employees
  const filteredMatrix = useMemo(() => {
    return matrixData.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        item.employee.name.toLowerCase().includes(q) ||
        item.employee.employeeCode.toLowerCase().includes(q);
      const matchesDept = deptFilter === 'all' || item.employee.department === deptFilter;
      return matchesSearch && matchesDept;
    });
  }, [matrixData, searchQuery, deptFilter]);

  // Summary Totals
  const totals = useMemo(() => {
    let closingDays = 0;
    let carriedDays = 0;
    let encashedDays = 0;
    let lapsedDays = 0;

    matrixData.forEach((item) => {
      item.rows.forEach((r) => {
        const dirty = dirtyRows[r.balanceId];
        const closing = r.closingDays || 0;
        closingDays += closing;

        if (dirty) {
          const type = dirty.forwardType || r.forwardType;
          const sett = dirty.settlementDays !== undefined ? dirty.settlementDays : r.settlementDays;
          if (type === 'carry_forward') carriedDays += sett;
          else if (type === 'encash') encashedDays += sett;
          else lapsedDays += closing;
        } else {
          carriedDays += r.carriedForwardDays || 0;
          encashedDays += r.encashedDays || 0;
          lapsedDays += r.lapsedDays || 0;
        }
      });
    });

    return {
      employeesCount: matrixData.length,
      closingDays: closingDays.toFixed(2),
      carriedDays: carriedDays.toFixed(2),
      encashedDays: encashedDays.toFixed(2),
      lapsedDays: lapsedDays.toFixed(2),
    };
  }, [matrixData, dirtyRows]);

  const isFinalised = activePolicyYear?.status === 'finalised';
  const minutesPerDay = activePolicyYear?.minutesPerDay || 465;

  // Handle Input Change for Row Settlement
  const handleRowChange = (balanceId, field, value, maxAllowedDays, grossClosingDays) => {
    if (isFinalised) return;

    setDirtyRows((prev) => {
      const existing = prev[balanceId] || {};
      const updated = { ...existing };

      if (field === 'settlementDays') {
        const numDays = parseFloat(value) || 0;
        const cappedDays = Math.max(0, Math.min(grossClosingDays, maxAllowedDays > 0 ? Math.min(numDays, maxAllowedDays) : numDays));
        updated.settlementDays = cappedDays;
        updated.settlementMinutes = Math.round(cappedDays * minutesPerDay);
      } else if (field === 'forwardType') {
        updated.forwardType = value;
      } else if (field === 'overrideReason') {
        updated.overrideReason = value;
      }

      return {
        ...prev,
        [balanceId]: updated,
      };
    });
  };

  // Bulk set forward type for a specific leave type
  const handleBulkSetForwardType = (leaveTypeCode, targetType) => {
    if (isFinalised) return;

    const newDirty = { ...dirtyRows };
    matrixData.forEach((item) => {
      item.rows.forEach((r) => {
        if (r.leaveTypeCode === leaveTypeCode) {
          if (targetType === 'encash' && !r.encashable) return;
          newDirty[r.balanceId] = {
            ...(newDirty[r.balanceId] || {}),
            forwardType: targetType,
          };
        }
      });
    });

    setDirtyRows(newDirty);
  };

  // Save Draft Updates
  const handleSaveDraft = async () => {
    const updates = Object.keys(dirtyRows).map((balanceId) => ({
      balanceId,
      forwardType: dirtyRows[balanceId].forwardType,
      settlementMinutes: dirtyRows[balanceId].settlementMinutes,
      overrideReason: dirtyRows[balanceId].overrideReason || 'Manual adjustment',
    }));

    if (updates.length === 0) {
      setMsg({ type: 'info', text: 'No changes detected to save.' });
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const res = await api.post('/attendance/settlement/draft', {
        policyYearId: activePolicyYear._id,
        updates,
      });

      if (res.success) {
        setMsg({ type: 'success', text: res.message || 'Draft changes saved successfully' });
        loadMatrix();
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to save draft' });
    } finally {
      setSaving(false);
    }
  };

  // Save With Settlement (Writes carry forward into next year's opening)
  const handleSaveWithSettlement = async () => {
    if (!window.confirm('Save with Settlement will finalize carry forward allocations and write them into next year\'s opening balances. Continue?')) {
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      // First persist any pending draft changes
      if (Object.keys(dirtyRows).length > 0) {
        const updates = Object.keys(dirtyRows).map((balanceId) => ({
          balanceId,
          forwardType: dirtyRows[balanceId].forwardType,
          settlementMinutes: dirtyRows[balanceId].settlementMinutes,
          overrideReason: dirtyRows[balanceId].overrideReason,
        }));
        await api.post('/attendance/settlement/draft', {
          policyYearId: activePolicyYear._id,
          updates,
        });
      }

      const res = await api.post('/attendance/settlement/settle', {
        policyYearId: activePolicyYear._id,
      });

      if (res.success) {
        setMsg({ type: 'success', text: res.message || 'Settlement processed and next year opening balances allocated!' });
        loadMatrix();
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to process settlement' });
    } finally {
      setSaving(false);
    }
  };

  // Finalise Policy Year (Locks Year & Attendance Logs)
  const handleFinalise = async () => {
    if (pendingRequests.length > 0) {
      setPendingModalOpen(true);
      return;
    }

    if (!window.confirm(`Are you sure you want to FINALISE and LOCK policy year ${activePolicyYear.code}? No further attendance logs, regularization requests, or leave balance edits dated inside this year will be permitted.`)) {
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const res = await api.post('/attendance/settlement/finalise', {
        policyYearId: activePolicyYear._id,
      });

      if (res.success) {
        setMsg({ type: 'success', text: res.message || 'Policy year has been finalised and locked.' });
        loadPolicyYears();
        loadMatrix();
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to finalise policy year' });
    } finally {
      setSaving(false);
    }
  };

  // Reopen Policy Year (Super Admin only)
  const handleReopen = async (e) => {
    e.preventDefault();
    if (!reopenReason.trim()) {
      alert('A clear reason is required to reopen a finalised policy year.');
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const res = await api.post('/attendance/settlement/reopen', {
        policyYearId: activePolicyYear._id,
        reason: reopenReason,
      });

      if (res.success) {
        setMsg({ type: 'success', text: res.message || 'Policy year successfully reopened.' });
        setReopenModalOpen(false);
        setReopenReason('');
        loadPolicyYears();
        loadMatrix();
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to reopen policy year' });
    } finally {
      setSaving(false);
    }
  };

  // Recalculate Balances
  const handleRecalculate = async () => {
    setLoading(true);
    try {
      const res = await api.post('/attendance/settlement/recalculate', {
        policyYearId: activePolicyYear._id,
      });
      if (res.success) {
        setMsg({ type: 'success', text: res.message || 'Balances recalculated successfully' });
        loadMatrix();
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to recalculate balances' });
    } finally {
      setLoading(false);
    }
  };

  // View Row History Drawer
  const openRowHistory = async (emp) => {
    setSelectedEmpHistory(emp);
    setHistoryLoading(true);
    setHistoryDrawerOpen(true);
    try {
      const res = await api.get(`/attendance/settlement/history/${emp._id}`);
      if (res.success && res.data) {
        setHistoryLogs(res.data);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Import Opening Balances Preview
  const handleImportPreview = async () => {
    if (!importText.trim()) return;

    setImporting(true);
    try {
      // Parse CSV or TSV lines: employeeCode, leaveTypeCode, openingDays, takenDays
      const lines = importText.trim().split('\n');
      const rows = [];

      for (const line of lines) {
        const parts = line.split(/[,\t]/).map((p) => p.trim());
        if (parts.length >= 3) {
          rows.push({
            employeeCode: parts[0],
            leaveTypeCode: parts[1],
            openingDays: parseFloat(parts[2]) || 0,
            takenDays: parseFloat(parts[3]) || 0,
          });
        }
      }

      const res = await api.post('/attendance/settlement/import', {
        policyYearId: activePolicyYear._id,
        rows,
        dryRun: true,
      });

      if (res.success && res.data) {
        setImportPreview(res.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to preview import');
    } finally {
      setImporting(false);
    }
  };

  // Commit Import
  const handleImportCommit = async () => {
    if (!importPreview || importPreview.errorCount > 0) return;

    setImporting(true);
    try {
      const res = await api.post('/attendance/settlement/import', {
        policyYearId: activePolicyYear._id,
        rows: importPreview.preview.map((p) => ({
          employeeCode: p.employeeCode,
          leaveTypeCode: p.leaveTypeCode,
          openingMinutes: p.openingMinutes,
          takenMinutes: p.takenMinutes,
        })),
        dryRun: false,
      });

      if (res.success) {
        setMsg({ type: 'success', text: res.message || 'Opening balances imported successfully!' });
        setImportModalOpen(false);
        setImportText('');
        setImportPreview(null);
        loadMatrix();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to commit import');
    } finally {
      setImporting(false);
    }
  };

  // Download Exports
  const handleExportSheet = () => {
    window.open(`${api.defaults.baseURL}/attendance/settlement/export/settlement?policyYearId=${activePolicyYear._id}`, '_blank');
  };

  const handleExportLedger = () => {
    window.open(`${api.defaults.baseURL}/attendance/settlement/export/ledger?policyYearId=${activePolicyYear._id}`, '_blank');
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <PageHeader
        title="Leave Balance Settlement"
        subtitle="Annual leave carry-forward, lapsed quota calculation, and encashment finalization"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {/* Year Selector */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 shadow-sm">
              <Calendar className="w-4 h-4 text-violet-400" />
              <select
                value={selectedYearId}
                onChange={(e) => setSelectedYearId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
              >
                {policyYears.map((py) => (
                  <option key={py._id} value={py._id} className="bg-slate-900 text-white">
                    {py.code} ({py.status.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {/* Shift Rate Badge */}
            <Badge variant="outline" className="border-slate-700 text-slate-300 font-mono text-xs">
              <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
              {activePolicyYear?.hoursPerDay || 7.75} h/day (465m)
            </Badge>

            {/* Recalculate */}
            {!isFinalised && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRecalculate}
                className="border-slate-700 text-slate-300 hover:text-white"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Recalculate
              </Button>
            )}

            {/* Import Opening */}
            {!isFinalised && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setImportPreview(null);
                  setImportText('');
                  setImportModalOpen(true);
                }}
                className="border-slate-700 text-slate-300 hover:text-white"
              >
                <Upload className="w-3.5 h-3.5 mr-1" /> Import Opening
              </Button>
            )}

            {/* Export Dropdown */}
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportSheet}
                className="border-slate-700 text-slate-300 hover:text-white"
              >
                <Download className="w-3.5 h-3.5 mr-1" /> Settlement CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportLedger}
                className="border-slate-700 text-slate-300 hover:text-white"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1" /> Ledger CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  loadPolicyComparison();
                  setComparisonModalOpen(true);
                }}
                className="border-indigo-500/40 text-indigo-300 hover:bg-indigo-950/40 shadow-sm"
              >
                <Layers className="w-3.5 h-3.5 mr-1 text-indigo-400" /> Policy Comparison
              </Button>
            </div>

            {/* Action Buttons */}
            {!isFinalised ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveDraft}
                  disabled={saving || Object.keys(dirtyRows).length === 0}
                  className="bg-slate-800 hover:bg-slate-700 text-white"
                >
                  <Save className="w-3.5 h-3.5 mr-1" /> Save Draft
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveWithSettlement}
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  Save With Settlement
                </Button>
                <Button
                  size="sm"
                  onClick={handleFinalise}
                  disabled={saving}
                  className="bg-violet-600 hover:bg-violet-500 text-white"
                >
                  <Lock className="w-3.5 h-3.5 mr-1" /> Finalise Policy Year
                </Button>
              </div>
            ) : isSuperAdmin ? (
              <Button
                size="sm"
                onClick={() => setReopenModalOpen(true)}
                className="bg-rose-600 hover:bg-rose-500 text-white"
              >
                <Unlock className="w-3.5 h-3.5 mr-1" /> Reopen Policy Year
              </Button>
            ) : (
              <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-950/20 px-3 py-1">
                <Lock className="w-3.5 h-3.5 mr-1" /> Year Finalised & Locked
              </Badge>
            )}
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

      {/* Status Warning Banner */}
      {isFinalised && (
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-semibold text-white">Read-Only Finalised Mode:</span> This policy year is finalised and locked. Attendance logs, regularization requests, and leave balances are permanently closed.
            </div>
          </div>
          {isSuperAdmin && (
            <span className="text-rose-400 font-medium">Super Admin: Reopen button available above</span>
          )}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <div className="text-[11px] text-slate-400 uppercase font-semibold">Staff Count</div>
          <div className="text-2xl font-bold text-white mt-1">{totals.employeesCount}</div>
        </Card>
        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <div className="text-[11px] text-slate-400 uppercase font-semibold">Total Closing</div>
          <div className="text-2xl font-bold text-slate-200 mt-1">{totals.closingDays} <span className="text-xs text-slate-500 font-normal">days</span></div>
        </Card>
        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <div className="text-[11px] text-emerald-400 uppercase font-semibold">Carry Forward</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{totals.carriedDays} <span className="text-xs text-emerald-500 font-normal">days</span></div>
        </Card>
        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <div className="text-[11px] text-sky-400 uppercase font-semibold">Encashment</div>
          <div className="text-2xl font-bold text-sky-400 mt-1">{totals.encashedDays} <span className="text-xs text-sky-500 font-normal">days</span></div>
        </Card>
        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <div className="text-[11px] text-rose-400 uppercase font-semibold">Lapsed Quota</div>
          <div className="text-2xl font-bold text-rose-400 mt-1">{totals.lapsedDays} <span className="text-xs text-rose-500 font-normal">days</span></div>
        </Card>
      </div>

      {/* Filter and Bulk Setting Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search staff by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Quick Bulk Action */}
        {!isFinalised && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Bulk Forward Rule:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkSetForwardType('AL', 'carry_forward')}
              className="border-slate-800 hover:bg-slate-800 text-[11px] h-7"
            >
              Carry All AL
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkSetForwardType('CL', 'lapsed')}
              className="border-slate-800 hover:bg-slate-800 text-[11px] h-7"
            >
              Lapse All CL
            </Button>
          </div>
        )}
      </div>

      {/* Main Settlement Matrix Table */}
      <Card className="overflow-hidden border-slate-800/80 bg-slate-900/50 shadow-xl">
        <div className="overflow-x-auto max-h-[650px] relative">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3 w-56 sticky left-0 z-30 bg-slate-950 border-r border-slate-800">
                  Employee
                </th>
                <th className="p-3 w-32">Leave Type</th>
                <th className="p-3 text-right">Opening</th>
                <th className="p-3 text-right">Entitlement</th>
                <th className="p-3 text-right">Carried In</th>
                <th className="p-3 text-right">Taken</th>
                <th className="p-3 text-right">Pending</th>
                <th className="p-3 text-right">Closing</th>
                <th className="p-3 text-center w-36">Forward Type</th>
                <th className="p-3 text-right w-28">Settlement</th>
                <th className="p-3 text-right">Carry Fwd</th>
                <th className="p-3 text-right">Encash</th>
                <th className="p-3 text-right">Lapsed</th>
                <th className="p-3 text-center w-14">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={14} className="p-12 text-center text-slate-400">
                    Loading leave balance settlement matrix...
                  </td>
                </tr>
              ) : filteredMatrix.length === 0 ? (
                <tr>
                  <td colSpan={14} className="p-12 text-center text-slate-400">
                    No records found matching filters.
                  </td>
                </tr>
              ) : (
                filteredMatrix.map((empGroup) => {
                  const emp = empGroup.employee;

                  return empGroup.rows.map((row, rowIdx) => {
                    const dirty = dirtyRows[row.balanceId];
                    const isRowDirty = !!dirty;

                    const activeForwardType = dirty?.forwardType || row.forwardType;
                    const activeSettlementDays = dirty?.settlementDays !== undefined ? dirty.settlementDays : row.settlementDays;

                    // Compute dynamic row values
                    let displayCarryDays = 0;
                    let displayEncashDays = 0;
                    let displayLapseDays = 0;

                    if (activeForwardType === 'carry_forward') {
                      displayCarryDays = activeSettlementDays;
                      displayLapseDays = Math.max(0, row.closingDays - displayCarryDays);
                    } else if (activeForwardType === 'encash') {
                      displayEncashDays = activeSettlementDays;
                      displayLapseDays = Math.max(0, row.closingDays - displayEncashDays);
                    } else {
                      displayLapseDays = row.closingDays;
                    }

                    return (
                      <tr
                        key={`${emp._id}_${row.leaveTypeId}`}
                        className={`hover:bg-slate-800/20 transition-colors ${
                          isRowDirty ? 'bg-amber-950/10' : ''
                        }`}
                      >
                        {/* Employee Name (Sticky column for first row of group) */}
                        {rowIdx === 0 ? (
                          <td
                            rowSpan={empGroup.rows.length}
                            className="p-3 sticky left-0 z-10 bg-slate-900 border-r border-slate-800 align-top"
                          >
                            <div className="font-medium text-slate-200">{emp.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {emp.employeeCode} &bull; {emp.department}
                            </div>
                            <div className="mt-1">
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                                  emp.status === 'probation'
                                    ? 'bg-amber-500/10 text-amber-400'
                                    : 'bg-emerald-500/10 text-emerald-400'
                                }`}
                              >
                                {emp.status}
                              </span>
                            </div>
                          </td>
                        ) : null}

                        {/* Leave Type */}
                        <td className="p-3">
                          <span className="font-semibold text-slate-300">{row.leaveTypeName}</span>
                          <span className="text-[10px] text-slate-500 font-mono ml-1.5">({row.leaveTypeCode})</span>
                        </td>

                        {/* Opening */}
                        <td className="p-3 text-right font-mono text-slate-300">
                          {row.openingDays > 0 ? row.openingDays.toFixed(2) : '-'}
                        </td>

                        {/* Entitlement */}
                        <td className="p-3 text-right font-mono text-slate-300">
                          {row.entitlementDays > 0 ? row.entitlementDays.toFixed(2) : '-'}
                        </td>

                        {/* Carried In */}
                        <td className="p-3 text-right font-mono text-slate-300">
                          {row.carriedInDays > 0 ? row.carriedInDays.toFixed(2) : '-'}
                        </td>

                        {/* Taken */}
                        <td className="p-3 text-right font-mono text-rose-300">
                          {row.takenDays > 0 ? row.takenDays.toFixed(2) : '-'}
                        </td>

                        {/* Pending */}
                        <td className="p-3 text-right font-mono text-amber-300">
                          {row.pendingDays > 0 ? row.pendingDays.toFixed(2) : '-'}
                        </td>

                        {/* Closing */}
                        <td className="p-3 text-right font-mono font-semibold text-white">
                          {row.closingDays > 0 ? row.closingDays.toFixed(2) : '0.00'}
                        </td>

                        {/* Forward Type Dropdown */}
                        <td className="p-2 text-center">
                          <select
                            disabled={isFinalised}
                            value={activeForwardType}
                            onChange={(e) =>
                              handleRowChange(row.balanceId, 'forwardType', e.target.value, row.maxCarryDays, row.closingDays)
                            }
                            className={`w-full bg-slate-950 border rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500 ${
                              isRowDirty ? 'border-amber-500 ring-1 ring-amber-500/40' : 'border-slate-800'
                            }`}
                          >
                            <option value="lapsed">Lapsed</option>
                            <option value="carry_forward">Carry Forward</option>
                            {row.encashable && <option value="encash">Encash</option>}
                          </select>
                        </td>

                        {/* Settlement Input */}
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            max={row.closingDays}
                            disabled={isFinalised || activeForwardType === 'lapsed'}
                            value={activeForwardType === 'lapsed' ? 0 : activeSettlementDays}
                            onChange={(e) =>
                              handleRowChange(row.balanceId, 'settlementDays', e.target.value, row.maxCarryDays, row.closingDays)
                            }
                            className={`w-20 text-right bg-slate-950 border rounded-md px-2 py-1 font-mono text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500 ${
                              isRowDirty ? 'border-amber-500 ring-1 ring-amber-500/40 bg-amber-950/20' : 'border-slate-800'
                            }`}
                          />
                        </td>

                        {/* Carried Forward Result */}
                        <td className="p-3 text-right font-mono text-emerald-400 font-semibold">
                          {displayCarryDays > 0 ? displayCarryDays.toFixed(2) : '-'}
                        </td>

                        {/* Encashed Result */}
                        <td className="p-3 text-right font-mono text-sky-400 font-semibold">
                          {displayEncashDays > 0 ? displayEncashDays.toFixed(2) : '-'}
                        </td>

                        {/* Lapsed Result */}
                        <td className="p-3 text-right font-mono text-rose-400 font-semibold">
                          {displayLapseDays > 0 ? displayLapseDays.toFixed(2) : '-'}
                        </td>

                        {/* History Audit Button */}
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => openRowHistory(emp)}
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            title="Audit History"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  });
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Pending Requests Resolver */}
      {pendingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-400" />
                  Cannot Finalise: Pending Requests Exist
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  All leave requests in this policy year must be approved or rejected before finalising.
                </p>
              </div>
              <button
                onClick={() => setPendingModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-3 text-xs">
              {pendingRequests.map((req) => (
                <div key={req.requestId} className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white">{req.employeeName}</span>
                    <span className="text-[11px] text-slate-500 font-mono ml-2">({req.employeeCode})</span>
                    <div className="text-slate-400 mt-0.5">
                      {req.leaveType} &bull; {req.days} day(s) &bull;{' '}
                      {new Date(req.fromDate).toLocaleDateString('en-IN')} to {new Date(req.toDate).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-950/20">
                    Pending
                  </Badge>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">Go to HR Approvals to resolve these items.</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPendingModalOpen(false)}
                className="border-slate-700 text-slate-300"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reopen Policy Year (Super Admin) */}
      {reopenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Unlock className="w-5 h-5 text-rose-400" />
                Reopen Policy Year ({activePolicyYear?.code})
              </h3>
              <button
                onClick={() => setReopenModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
              Reopening will unlock attendance and leave records for this year and rollback carried-in balances for next year (only if unused).
            </div>

            <form onSubmit={handleReopen} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Reopen Justification Reason * (Mandatory for compliance)
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Audit correction required for Q4 maternity leave quota"
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReopenModalOpen(false)}
                  className="border-slate-700 text-slate-300"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-rose-600 hover:bg-rose-500 text-white">
                  Confirm Reopen
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Import Opening Balances */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Upload className="w-5 h-5 text-violet-400" />
                  Import Opening Balances ({activePolicyYear?.code})
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Format: EmployeeCode, LeaveTypeCode, OpeningDays, TakenDays (comma or tab separated)
                </p>
              </div>
              <button
                onClick={() => setImportModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              {!importPreview ? (
                <div>
                  <textarea
                    rows={8}
                    placeholder="IDS-E26-OP001, AL, 12, 2&#10;IDS-E26-OP002, CL, 6, 1&#10;IDS-E26-OP003, SL, 8, 0"
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                  <div className="text-[11px] text-slate-500 mt-2">
                    Tip: You can copy/paste rows directly from Excel or Google Sheets.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">
                      Evaluated: <strong>{importPreview.totalRows}</strong> | Valid:{' '}
                      <strong className="text-emerald-400">{importPreview.validCount}</strong> | Errors:{' '}
                      <strong className="text-rose-400">{importPreview.errorCount}</strong>
                    </span>
                    <button
                      onClick={() => setImportPreview(null)}
                      className="text-violet-400 hover:underline"
                    >
                      Edit Raw Text
                    </button>
                  </div>

                  <div className="border border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead className="bg-slate-950 border-b border-slate-800 text-slate-400">
                        <tr>
                          <th className="p-2">Row</th>
                          <th className="p-2">Code</th>
                          <th className="p-2">Employee</th>
                          <th className="p-2">Leave Type</th>
                          <th className="p-2 text-right">Opening</th>
                          <th className="p-2 text-right">Taken</th>
                          <th className="p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {importPreview.preview.map((p) => (
                          <tr key={p.rowIndex} className={!p.isValid ? 'bg-rose-950/20' : ''}>
                            <td className="p-2 text-slate-500">{p.rowIndex}</td>
                            <td className="p-2 text-white">{p.employeeCode}</td>
                            <td className="p-2 text-slate-300">{p.employeeName || '-'}</td>
                            <td className="p-2 text-slate-300">{p.leaveTypeCode}</td>
                            <td className="p-2 text-right text-emerald-400">{p.openingDays}</td>
                            <td className="p-2 text-right text-rose-400">{p.takenDays}</td>
                            <td className="p-2">
                              {p.isValid ? (
                                <span className="text-emerald-400">Valid</span>
                              ) : (
                                <span className="text-rose-400">{p.errors.join(', ')}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportModalOpen(false)}
                className="border-slate-700 text-slate-300"
              >
                Cancel
              </Button>
              {!importPreview ? (
                <Button
                  size="sm"
                  onClick={handleImportPreview}
                  disabled={importing || !importText.trim()}
                  className="bg-violet-600 hover:bg-violet-500 text-white"
                >
                  {importing ? 'Evaluating...' : 'Dry-Run Preview'}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleImportCommit}
                  disabled={importing || importPreview.errorCount > 0}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {importing ? 'Committing...' : 'Commit Import'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Drawer: Audit History */}
      {historyDrawerOpen && selectedEmpHistory && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border-l border-slate-800 w-full max-w-xl h-full flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-violet-400" />
                  Settlement History: {selectedEmpHistory.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-mono">{selectedEmpHistory.employeeCode}</p>
              </div>
              <button
                onClick={() => setHistoryDrawerOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-3 text-xs">
              {historyLoading ? (
                <div className="p-8 text-center text-slate-400">Loading audit history...</div>
              ) : historyLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400">No settlement audit entries recorded yet.</div>
              ) : (
                historyLogs.map((h) => (
                  <div key={h._id} className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white capitalize">{h.action.replace('_', ' ')}</span>
                      <span className="text-[11px] font-mono text-slate-500">
                        {new Date(h.createdAt).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="text-slate-300">
                      Leave Type: <strong className="text-violet-300">{h.leaveType?.name || 'All'}</strong>
                    </div>

                    {h.reason && (
                      <div className="text-[11px] text-slate-400 italic">
                        Reason: {h.reason}
                      </div>
                    )}

                    <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-1.5 flex items-center justify-between">
                      <span>Changed by: {h.changedBy?.email}</span>
                      <span className="font-mono">{h.policyYear?.code}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistoryDrawerOpen(false)}
                className="border-slate-700 text-slate-300"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Policy Comparison (Joining vs Confirmation vs Old BizCompass System) */}
      {comparisonModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-400" />
                  Policy Comparison Matrix: Joining Date vs Confirmation Date vs Old System
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Read-only comparison of annual leave quotas for all 9 real employees under both policy models.
                </p>
              </div>
              <button
                onClick={() => setComparisonModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Context Notice & Rounding Selector */}
            <div className="p-4 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Awaiting HR Decision:</strong> Currently defaulted to <em>From Joining Date</em>. Confirmation mode aligns with BizCompass zero-probation balances.
                </span>
              </div>

              {/* Rounding simulation */}
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl">
                <span className="text-slate-400 text-[11px] px-2">Round to:</span>
                {[
                  { key: 'none', label: 'None (Exact)' },
                  { key: 'nearest_half', label: 'Nearest 0.5d' },
                  { key: 'round_down_half', label: 'Floor 0.5d' },
                ].map((r) => (
                  <button
                    key={r.key}
                    onClick={() => {
                      setComparisonRounding(r.key);
                      loadPolicyComparison(r.key);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all ${
                      comparisonRounding === r.key
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Matrix Table */}
            <div className="p-6 overflow-y-auto flex-1">
              {comparisonLoading ? (
                <div className="py-12 flex justify-center items-center text-xs text-slate-400">
                  <Clock className="w-5 h-5 animate-spin mr-2" />
                  Calculating comparative entitlements...
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                      <th className="py-3 px-3">Employee</th>
                      <th className="py-3 px-2">Status / Dates</th>
                      <th className="py-3 px-3 bg-slate-800/40 text-slate-300">
                        Rule A: From Joining (CL/AL/SL/BL/PL = Total)
                      </th>
                      <th className="py-3 px-3 bg-emerald-950/30 text-emerald-300">
                        Rule B: From Confirmation (CL/AL/SL/BL/PL = Total)
                      </th>
                      <th className="py-3 px-3 bg-violet-950/30 text-violet-300">
                        Old System Reference <span className="block text-[9px] lowercase italic font-normal text-violet-400">(from old system screenshot, verify)</span>
                      </th>
                      <th className="py-3 px-3 text-right">Variance Analysis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                    {comparisonList.map((row) => (
                      <tr key={row.employeeId} className="hover:bg-slate-800/30">
                        <td className="py-3 px-3 font-sans font-semibold text-white">
                          <div>
                            <span>{row.name}</span>
                            <span className="block text-[10px] font-mono text-slate-400">{row.employeeCode}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 font-sans text-slate-300">
                          <div className="space-y-0.5">
                            <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                              row.status === 'probation'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                            }`}>
                              {row.status}
                            </span>
                            <div className="text-[10px] text-slate-400 font-mono">
                              DOJ: {row.dateOfJoining ? new Date(row.dateOfJoining).toISOString().split('T')[0] : '-'}
                            </div>
                            {row.confirmationDate && (
                              <div className="text-[10px] text-emerald-400 font-mono">
                                Conf: {new Date(row.confirmationDate).toISOString().split('T')[0]}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Joining Rule */}
                        <td className="py-3 px-3 bg-slate-950/20 text-slate-300">
                          <div>
                            <span className="font-bold text-white">{row.joining.total}d</span>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {row.joining.cl} / {row.joining.al} / {row.joining.sl} / {row.joining.bl} / {row.joining.pl}
                            </div>
                          </div>
                        </td>

                        {/* Confirmation Rule */}
                        <td className="py-3 px-3 bg-emerald-950/20 text-emerald-200">
                          <div>
                            <span className="font-bold">{row.confirmation.total}d</span>
                            <div className="text-[10px] text-emerald-400 mt-0.5">
                              {row.confirmation.cl} / {row.confirmation.al} / {row.confirmation.sl} / {row.confirmation.bl} / {row.confirmation.pl}
                            </div>
                          </div>
                        </td>

                        {/* Reference Old System */}
                        <td className="py-3 px-3 bg-violet-950/20 text-violet-200">
                          <div>
                            <span className="font-bold">{row.referenceOldSystem.total}d</span>
                            <div className="text-[10px] text-violet-400 mt-0.5">
                              {row.referenceOldSystem.cl} / {row.referenceOldSystem.al} / {row.referenceOldSystem.sl} / {row.referenceOldSystem.bl} / {row.referenceOldSystem.pl}
                            </div>
                          </div>
                        </td>

                        {/* Variance badge */}
                        <td className="py-3 px-3 text-right font-sans">
                          {row.differences.matchesConfirmation ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                              <Check className="w-3 h-3" /> Matches Old System
                            </span>
                          ) : row.differences.hasJoiningMismatch ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                              +{row.differences.joiningDiff}d vs Old System
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Identical</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setComparisonModalOpen(false)}
                className="border-slate-700 text-slate-300"
              >
                Close Comparison
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveBalanceSettlement;
