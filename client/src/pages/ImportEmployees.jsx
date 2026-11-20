import React, { useState, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import axios from 'axios';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  RefreshCw,
  Users,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export default function ImportEmployees() {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [overwrite, setOverwrite] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.match(/\.xlsx$/i)) {
      setFile(droppedFile);
      setPreviewData(null);
      setImportResult(null);
      setErrorMsg('');
    } else {
      setErrorMsg('Please select a valid Excel (.xlsx) file.');
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewData(null);
      setImportResult(null);
      setErrorMsg('');
    }
  };

  // 1. Download Sample Template
  const handleDownloadTemplate = async () => {
    try {
      const response = await axios.get('/api/v1/employees/import/template', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Illusory-Employee-Import-Template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setErrorMsg('Failed to download sample template.');
    }
  };

  // 2. Dry Run / Preview Upload
  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post('/api/v1/employees/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreviewData(res.data.data);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to preview spreadsheet.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Commit Import
  const handleCommit = async () => {
    if (!file) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('overwrite', overwrite);
      const res = await axios.post('/api/v1/employees/import/commit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(res.data.data);
      setPreviewData(null);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to complete employee import.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Download Result Credentials Report
  const handleDownloadReport = async (filename) => {
    try {
      const response = await axios.get(`/api/v1/employees/import/report/${filename}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setErrorMsg('Failed to download credentials report.');
    }
  };

  // Flatten rows from sheets for display
  const allRows =
    previewData?.sheets?.flatMap((s) =>
      s.rows.map((r) => ({ ...r, sheetName: s.sheetName, role: s.role }))
    ) || [];

  const filteredRows =
    activeTab === 'all'
      ? allRows
      : allRows.filter((r) => r.sheetName.toLowerCase() === activeTab.toLowerCase());

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Import Employees"
        subtitle="Bulk import company employees, roles, and records from Excel (.xlsx)"
        breadcrumbs={[
          { label: 'HRMS', path: '/hrms' },
          { label: 'Import Employees' },
        ]}
        actions={
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="flex items-center space-x-2"
            >
              <Download className="w-4 h-4 text-brand-600" />
              <span>Sample Template</span>
            </Button>
            <NavLink to="/hrms">
              <Button variant="ghost" size="sm">
                Back to Employees
              </Button>
            </NavLink>
          </div>
        }
      />

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-start space-x-3 text-red-800 dark:text-red-300">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
          <div className="text-sm font-medium">{errorMsg}</div>
        </div>
      )}

      {/* --- Step 1: File Upload & Option --- */}
      {!importResult && (
        <Card className="p-6">
          <div className="flex flex-col items-center justify-center">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full max-w-2xl border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/20'
                  : file
                  ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/10'
                  : 'border-slate-300 dark:border-slate-700 hover:border-brand-400 bg-slate-50/50 dark:bg-slate-900/50'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".xlsx"
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center space-y-3">
                <div
                  className={`p-4 rounded-2xl ${
                    file ? 'bg-emerald-100 text-emerald-600' : 'bg-brand-100 text-brand-600'
                  }`}
                >
                  {file ? <FileSpreadsheet className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
                    {file ? file.name : 'Choose an Excel spreadsheet or drag and drop'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {file
                      ? `${(file.size / 1024).toFixed(1)} KB — Ready to analyze`
                      : 'Accepts .xlsx files with "Employee", "Admin", and "Super Admin" sheets (Max 5MB)'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between w-full max-w-2xl px-2">
              <label className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span>Overwrite non-empty fields for existing employees</span>
              </label>

              <div className="flex items-center space-x-2">
                {file && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFile(null);
                      setPreviewData(null);
                    }}
                  >
                    Clear
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!file || loading}
                  onClick={handlePreview}
                  className="flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <span>Preview / Dry-Run</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* --- Step 2: Dry Run Preview Table --- */}
      {previewData && !importResult && (
        <div className="space-y-6">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Card className="p-4 text-center">
              <div className="text-2xl font-black text-slate-800 dark:text-white">
                {previewData.totalRows}
              </div>
              <div className="text-xs font-semibold text-slate-500 uppercase mt-1">Total Rows</div>
            </Card>
            <Card className="p-4 text-center border-l-4 border-l-emerald-500">
              <div className="text-2xl font-black text-emerald-600">
                {previewData.willCreateCount}
              </div>
              <div className="text-xs font-semibold text-slate-500 uppercase mt-1">Will Create</div>
            </Card>
            <Card className="p-4 text-center border-l-4 border-l-blue-500">
              <div className="text-2xl font-black text-blue-600">
                {previewData.willUpdateCount}
              </div>
              <div className="text-xs font-semibold text-slate-500 uppercase mt-1">Will Update</div>
            </Card>
            <Card className="p-4 text-center border-l-4 border-l-amber-500">
              <div className="text-2xl font-black text-amber-600">
                {previewData.warningsCount}
              </div>
              <div className="text-xs font-semibold text-slate-500 uppercase mt-1">Warnings</div>
            </Card>
            <Card className="p-4 text-center border-l-4 border-l-red-500">
              <div className="text-2xl font-black text-red-600">
                {previewData.errorsCount}
              </div>
              <div className="text-xs font-semibold text-slate-500 uppercase mt-1">Errors</div>
            </Card>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'all'
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                All Sheets ({allRows.length})
              </button>
              {previewData.sheets?.map((s) => (
                <button
                  key={s.sheetName}
                  onClick={() => setActiveTab(s.sheetName)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab.toLowerCase() === s.sheetName.toLowerCase()
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {s.sheetName} ({s.rows.length})
                </button>
              ))}
            </div>

            <Button
              variant="primary"
              size="md"
              disabled={loading || previewData.errorsCount > 0}
              onClick={handleCommit}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Import to Studio</span>
                </>
              )}
            </Button>
          </div>

          {/* Table */}
          <Card className="overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Row</th>
                    <th className="py-3 px-4">Sheet</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Full Name</th>
                    <th className="py-3 px-4">Work Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Department / Designation</th>
                    <th className="py-3 px-4">Manager</th>
                    <th className="py-3 px-4">Notes & Warnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRows.map((r, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 text-slate-500 font-mono">{r.rowNumber}</td>
                      <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                        {r.sheetName}
                      </td>
                      <td className="py-3 px-4">
                        {r.action === 'CREATE' ? (
                          <Badge variant="success" size="sm">
                            CREATE
                          </Badge>
                        ) : r.action === 'UPDATE' ? (
                          <Badge variant="primary" size="sm">
                            UPDATE
                          </Badge>
                        ) : (
                          <Badge variant="danger" size="sm">
                            ERROR
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                        {r.employeeCode}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                        {r.displayName}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {r.officialEmail}
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize font-semibold text-brand-600 dark:text-brand-400">
                          {r.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {r.department}
                        </div>
                        <div className="text-[11px] text-slate-500">{r.designation}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {r.reportTo || <span className="text-slate-400">-</span>}
                      </td>
                      <td className="py-3 px-4">
                        {r.errors?.length > 0 ? (
                          <div className="space-y-1">
                            {r.errors.map((e, eIdx) => (
                              <div
                                key={eIdx}
                                className="flex items-center space-x-1 text-red-600 text-[11px]"
                              >
                                <XCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{e}</span>
                              </div>
                            ))}
                          </div>
                        ) : r.warnings?.length > 0 ? (
                          <div className="space-y-1">
                            {r.warnings.map((w, wIdx) => (
                              <div
                                key={wIdx}
                                className="flex items-center space-x-1 text-amber-600 text-[11px]"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>{w}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-emerald-600 text-[11px] font-medium flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Valid</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* --- Step 3: Import Complete Confirmation --- */}
      {importResult && (
        <Card className="p-8 text-center max-w-2xl mx-auto space-y-6 border border-emerald-200 dark:border-emerald-900 bg-emerald-50/20 dark:bg-emerald-950/10">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              Import Completed Successfully!
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Real company employees and login accounts have been initialized in Illusory ERP.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <div>
              <div className="text-2xl font-black text-emerald-600">
                {importResult.createdCount}
              </div>
              <div className="text-xs font-semibold text-slate-500 uppercase mt-1">
                New Employees
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-blue-600">
                {importResult.updatedCount}
              </div>
              <div className="text-xs font-semibold text-slate-500 uppercase mt-1">
                Updated
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-800 dark:text-white">
                {importResult.totalProcessed}
              </div>
              <div className="text-xs font-semibold text-slate-500 uppercase mt-1">
                Total Processed
              </div>
            </div>
          </div>

          {importResult.managersNotFound?.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-left space-y-2">
              <div className="flex items-center space-x-2 text-amber-800 dark:text-amber-300 font-semibold text-xs">
                <AlertTriangle className="w-4 h-4" />
                <span>Managers not found in file (set manually in Employee Master):</span>
              </div>
              <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 list-disc list-inside">
                {importResult.managersNotFound.map((m, idx) => (
                  <li key={idx}>
                    {m.employeeName} ({m.employeeCode}) &rarr; Manager: &quot;{m.managerName}&quot;
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="p-4 rounded-xl bg-slate-900 text-slate-200 text-left space-y-2 border border-slate-800">
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400">
              <Lock className="w-4 h-4" />
              <span>Temporary Passwords & Credentials Generated</span>
            </div>
            <p className="text-xs text-slate-400">
              Each newly created employee has been provisioned with a unique cryptographically strong temporary password. Download the CSV report below to distribute credentials securely to your team.
            </p>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadReport(importResult.reportFileName)}
                className="w-full flex items-center justify-center space-x-2 bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Download Credentials Report ({importResult.reportFileName})</span>
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-3 pt-2">
            <NavLink to="/hrms">
              <Button variant="primary" size="md">
                View Employees Directory
              </Button>
            </NavLink>
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                setFile(null);
                setPreviewData(null);
                setImportResult(null);
              }}
            >
              Import Another File
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
