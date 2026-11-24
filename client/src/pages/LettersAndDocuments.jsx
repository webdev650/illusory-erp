import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Card, Button } from '../components/ui';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Eye,
  ShieldCheck,
  QrCode,
  Layers,
  Calendar,
  X,
  FileCheck,
  Send,
  Lock,
} from 'lucide-react';

export const LettersAndDocuments = () => {
  const { user, role, hasPermission } = useAuth();
  const isSuperAdmin = role === 'super_admin';
  const isHR = role === 'hr' || isSuperAdmin;

  // Tabs
  const [activeTab, setActiveTab] = useState('issued');

  // Data States
  const [letters, setLetters] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Generator Wizard Modal
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [extraFields, setExtraFields] = useState({});
  const [generating, setGenerating] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);

  // Detail Drawer State
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Load Letters
  const loadLetters = async () => {
    try {
      setLoading(true);
      const params = {};
      if (activeTab === 'drafts') params.status = 'draft';
      else if (activeTab === 'pending') params.status = 'pending_approval';
      else if (activeTab === 'issued') params.status = 'issued';

      if (selectedCategory) params.category = selectedCategory;

      const res = await api.get('/letters', { params });
      if (res.success) {
        setLetters(res.data.letters || []);
      }
    } catch (err) {
      console.warn('Failed to load letters:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load Templates
  const loadTemplates = async () => {
    try {
      const res = await api.get('/letters/templates');
      if (res.success) setTemplates(res.data);
    } catch (err) {
      console.warn('Failed to load templates:', err);
    }
  };

  // Load Employees for wizard
  const loadEmployees = async () => {
    try {
      const res = await api.get('/employees?limit=100');
      if (res.success) setAllEmployees(res.data.employees || res.data || []);
    } catch (err) {
      console.warn('Failed to load employees:', err);
    }
  };

  useEffect(() => {
    loadLetters();
    loadTemplates();
    loadEmployees();
  }, [activeTab, selectedCategory]);

  const handleStartWizard = () => {
    setWizardStep(1);
    setSelectedTemplate(null);
    setSelectedEmployeeId('');
    setExtraFields({});
    setWizardOpen(true);
  };

  const handleGenerateSubmit = async (actionType) => {
    if (!selectedTemplate || !selectedEmployeeId) return;
    try {
      setGenerating(true);
      const res = await api.post('/letters/generate', {
        templateId: selectedTemplate._id,
        employeeId: selectedEmployeeId,
        extraFields,
        action: actionType, // 'draft', 'submit', 'issue'
      });
      if (res.success) {
        alert(res.message);
        setWizardOpen(false);
        loadLetters();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleReviewTemplate = async (templateId) => {
    try {
      const res = await api.post(`/letters/templates/${templateId}/review`);
      if (res.success) {
        alert('Template successfully reviewed and unlocked for official company issuance!');
        loadTemplates();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Review failed');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <PageHeader
        title="Official Letters & Documentation"
        subtitle="Generate, review, approve, and issue standardized company letters with letterhead and digital QR verification."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadLetters();
                loadTemplates();
              }}
              disabled={loading}
              className="border-slate-700 text-slate-300 hover:text-white"
            >
              <RotateCcw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            {isHR && (
              <Button
                size="sm"
                onClick={handleStartWizard}
                className="bg-brand-600 hover:bg-brand-500 text-white font-bold"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Generate Letter
              </Button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-6 text-xs font-semibold overflow-x-auto">
        {[
          { id: 'issued', label: 'Issued Letters' },
          { id: 'drafts', label: 'Drafts' },
          { id: 'pending', label: 'Pending Approval' },
          { id: 'templates', label: 'Letter Templates' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 capitalize transition-all border-b-2 ${
              activeTab === tab.id
                ? 'border-violet-500 text-violet-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT: Templates */}
      {activeTab === 'templates' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {templates.map((tpl) => (
            <div
              key={tpl._id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    {tpl.category}
                  </span>
                  {tpl.isSample && !tpl.isReviewed ? (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                      Sample (Unreviewed)
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Reviewed
                    </span>
                  )}
                </div>

                <h4 className="text-sm font-bold text-white">{tpl.name}</h4>
                <p className="text-[11px] text-slate-400 font-mono mt-1">Code: {tpl.code}</p>
                <p className="text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                  {tpl.body.replace(/\{\{[^}]+\}\}/g, '[...]')}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Signatory: {tpl.signatory?.name}</span>
                {tpl.isSample && !tpl.isReviewed && isSuperAdmin && (
                  <button
                    onClick={() => handleReviewTemplate(tpl._id)}
                    className="text-emerald-400 hover:underline font-bold text-[10px]"
                  >
                    Mark Reviewed
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TAB CONTENT: Letters List (Issued, Drafts, Pending) */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl text-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">Reference No</th>
                  <th className="p-3">Document Title</th>
                  <th className="p-3">Issued To</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      Loading letters from official documentation registry...
                    </td>
                  </tr>
                ) : letters.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No documents found in this view.
                    </td>
                  </tr>
                ) : (
                  letters.map((ltr) => (
                    <tr
                      key={ltr._id}
                      onClick={() => {
                        setSelectedLetter(ltr);
                        setDrawerOpen(true);
                      }}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      <td className="p-3 font-mono font-bold text-violet-400">{ltr.refNo}</td>
                      <td className="p-3 text-white font-bold">{ltr.title}</td>
                      <td className="p-3 text-slate-300">
                        {ltr.employee
                          ? `${ltr.employee.personal?.firstName} ${ltr.employee.personal?.lastName}`
                          : ltr.candidate?.name || 'Applicant'}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                          {ltr.category}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            ltr.status === 'issued'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : ltr.status === 'revoked'
                              ? 'bg-rose-500/20 text-rose-400'
                              : ltr.status === 'pending_approval'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {ltr.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">
                        {new Date(ltr.issuedAt || ltr.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={`${api.defaults.baseURL}/letters/${ltr._id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white inline-flex items-center gap-1 font-semibold"
                        >
                          <Download className="w-3.5 h-3.5" /> PDF
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DETAIL DRAWER */}
      {drawerOpen && selectedLetter && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border-l border-slate-800 w-full max-w-xl h-full flex flex-col shadow-2xl overflow-hidden text-xs">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div>
                <span className="text-[10px] font-mono font-bold text-violet-400 block">
                  {selectedLetter.refNo}
                </span>
                <h3 className="text-base font-bold text-white mt-1">{selectedLetter.title}</h3>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Document Status Bar */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Document Status</span>
                  <strong className="text-white uppercase">{selectedLetter.status}</strong>
                </div>
                <a
                  href={`${api.defaults.baseURL}/letters/${selectedLetter._id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" /> Download Signed PDF
                </a>
              </div>

              {/* Rendered Preview */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                <h4 className="text-[11px] font-bold uppercase text-slate-400">Rendered Content</h4>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {selectedLetter.renderedBody}
                </div>
              </div>

              {/* Public Verification Link */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                <h4 className="text-[11px] font-bold uppercase text-slate-400 flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-violet-400" /> Digital QR Verification Token
                </h4>
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/api/v1/verify/${selectedLetter.verificationToken}`}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-400 font-mono text-[10px]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GENERATE LETTER WIZARD MODAL */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm text-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-400" /> Letter Generation Wizard
              </h3>
              <button onClick={() => setWizardOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Step 1: Template Selection */}
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">1. Select Letter Template *</label>
                <select
                  value={selectedTemplate?._id || ''}
                  onChange={(e) => {
                    const t = templates.find((tpl) => tpl._id === e.target.value);
                    setSelectedTemplate(t);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                >
                  <option value="">-- Choose Template --</option>
                  {templates.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name} ({t.category.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Employee Selection */}
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">2. Select Target Employee *</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                >
                  <option value="">-- Choose Employee --</option>
                  {allEmployees.map((e) => (
                    <option key={e._id} value={e._id}>
                      [{e.employeeId}] {e.personal?.firstName} {e.personal?.lastName} ({e.employment?.designation})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => setWizardOpen(false)} className="border-slate-700 text-slate-300">
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleGenerateSubmit('draft')}
                  disabled={generating || !selectedTemplate || !selectedEmployeeId}
                  className="bg-slate-800 hover:bg-slate-700 text-white"
                >
                  Save Draft
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleGenerateSubmit('issue')}
                  disabled={generating || !selectedTemplate || !selectedEmployeeId}
                  className="bg-brand-600 hover:bg-brand-500 text-white font-bold"
                >
                  {generating ? 'Processing...' : 'Generate & Issue'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LettersAndDocuments;
