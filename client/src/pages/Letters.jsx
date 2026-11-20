import React, { useState } from 'react';
import { FileText, Download, Plus, Eye, CheckCircle2, Clock } from 'lucide-react';

const SAMPLE_TEMPLATES = [
  {
    id: 'TPL-001',
    name: 'Employment Offer Letter',
    type: 'Onboarding',
    variables: ['Candidate Name', 'Designation', 'CTC', 'Joining Date', 'Location'],
    lastModified: '2026-11-10',
  },
  {
    id: 'TPL-002',
    name: 'Appointment & Confirmation Letter',
    type: 'Confirmation',
    variables: ['Employee Name', 'Employee ID', 'Effective Date', 'Department'],
    lastModified: '2026-11-12',
  },
  {
    id: 'TPL-003',
    name: 'Relieving & Experience Certificate',
    type: 'Exit',
    variables: ['Employee Name', 'Employee ID', 'Tenure', 'Designation', 'Last Working Day'],
    lastModified: '2026-11-15',
  },
  {
    id: 'TPL-004',
    name: 'Annual Compensation Revision Letter',
    type: 'Appraisal',
    variables: ['Employee Name', 'Revised CTC', 'Effective Date', 'Band'],
    lastModified: '2026-11-18',
  },
];

const SAMPLE_GENERATED = [
  {
    id: 'DOC-2026-001',
    title: 'Offer Letter - Barsha Rani Jena',
    employee: 'Barsha Rani Jena (IDS002)',
    template: 'Employment Offer Letter',
    status: 'Issued',
    issuedDate: '2024-02-01',
  },
  {
    id: 'DOC-2026-002',
    title: 'Appointment Letter - Mihir Dash',
    employee: 'Mihir Dash (IDS003)',
    template: 'Appointment & Confirmation Letter',
    status: 'Issued',
    issuedDate: '2024-01-20',
  },
  {
    id: 'DOC-2026-003',
    title: 'Offer Letter - Pallabi Kar',
    employee: 'Pallabi Kar (IDS004)',
    template: 'Employment Offer Letter',
    status: 'Draft',
    issuedDate: '2026-11-19',
  },
];

export const Letters = () => {
  const [activeTab, setActiveTab] = useState('templates');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Letters & Official Documents
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Standard studio templates, offer letters, experience certificates, and official records
          </p>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'templates'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            Templates ({SAMPLE_TEMPLATES.length})
          </button>
          <button
            onClick={() => setActiveTab('generated')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'generated'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            Issued Letters ({SAMPLE_GENERATED.length})
          </button>
        </div>
      </div>

      {activeTab === 'templates' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SAMPLE_TEMPLATES.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white dark:bg-[#151A26] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4.5 shadow-2xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      {tpl.name}
                    </h3>
                    <span className="text-[10px] text-slate-400">
                      ID: {tpl.id} • Category: {tpl.type}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Supported Merge Variables:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {tpl.variables.map((v, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium"
                    >
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>Updated: {tpl.lastModified}</span>
                <span className="text-brand-600 dark:text-brand-400 font-semibold cursor-pointer hover:underline">
                  Preview Template
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#151A26] rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-2xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                <th className="py-3 px-4">Document Title</th>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Template</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Issued Date</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {SAMPLE_GENERATED.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-100">
                    {doc.title}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                    {doc.employee}
                  </td>
                  <td className="py-3 px-4 text-slate-500">{doc.template}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        doc.status === 'Issued'
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300'
                      }`}
                    >
                      {doc.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">{doc.issuedDate}</td>
                  <td className="py-3 px-4 text-right">
                    <button className="p-1 rounded-lg text-slate-400 hover:text-brand-600">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Letters;
