import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  FileText,
  Calendar,
  User,
  CheckCircle2,
  Building2,
  Clock,
  ArrowLeft,
} from 'lucide-react';

export const VerifyDocument = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [docData, setDocData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    const fetchVerification = async () => {
      try {
        setLoading(true);
        // Call public verification endpoint
        const res = await api.get(`/letters/verify/${token}`);
        if (res.success && res.data) {
          setDocData(res.data);
        } else {
          setErrorMsg(res.message || 'Invalid or unrecognized document');
        }
      } catch (err) {
        setErrorMsg(err.response?.data?.message || 'Document verification failed or token is invalid');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchVerification();
    } else {
      setErrorMsg('No verification token provided in URL');
      setLoading(false);
    }
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 antialiased selection:bg-brand-500 selection:text-white">
      {/* Background radial gradient glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_20%,rgba(99,102,241,0.12),transparent_70%)]" />

      <div className="relative z-10 w-full max-w-lg">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-400 mb-3 shadow-inner">
            <Building2 className="w-3.5 h-3.5 text-brand-400" />
            <span>Official Document Verification Gateway</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Illusory Design Studios</h1>
          <p className="text-xs text-slate-400 mt-1">
            DLF Cybercity, Patia, Bhubaneswar, Odisha - 751024
          </p>
        </div>

        {/* Verification Card */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
              <p className="text-sm text-slate-400 animate-pulse">Verifying cryptographic signature...</p>
            </div>
          ) : errorMsg ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl mx-auto flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Unrecognized Document</h2>
              <p className="text-sm text-slate-400 max-w-sm mx-auto mb-6">
                {errorMsg}
              </p>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-500 font-mono break-all mb-6">
                Token: {token}
              </div>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Return to Illusory ERP
              </Link>
            </div>
          ) : docData?.isValid ? (
            <div>
              {/* Authenticated Valid Banner */}
              <div className="flex items-center gap-3 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl mb-6">
                <ShieldCheck className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-300">Authentic Official Document</h3>
                  <p className="text-xs text-emerald-400/80">
                    Digitally generated and verified by Illusory ERP records.
                  </p>
                </div>
              </div>

              {/* Document Metadata List */}
              <div className="space-y-4 divide-y divide-slate-800/60">
                <div className="pt-2 flex justify-between items-start">
                  <span className="text-xs text-slate-400">Document Title</span>
                  <span className="text-sm font-bold text-white text-right max-w-[260px]">
                    {docData.title}
                  </span>
                </div>

                <div className="pt-3 flex justify-between items-center">
                  <span className="text-xs text-slate-400">Reference Number</span>
                  <span className="font-mono text-xs font-bold text-brand-300 bg-brand-950/50 px-2 py-1 rounded border border-brand-800/50">
                    {docData.refNo}
                  </span>
                </div>

                <div className="pt-3 flex justify-between items-center">
                  <span className="text-xs text-slate-400">Issued To</span>
                  <span className="text-sm font-medium text-slate-200">
                    {docData.issuedTo}
                  </span>
                </div>

                <div className="pt-3 flex justify-between items-center">
                  <span className="text-xs text-slate-400">Date of Issue</span>
                  <span className="text-xs text-slate-300">
                    {docData.issuedDate ? new Date(docData.issuedDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      timeZone: 'Asia/Kolkata',
                    }) : '—'}
                  </span>
                </div>

                <div className="pt-3 flex justify-between items-center">
                  <span className="text-xs text-slate-400">Status</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" />
                    ISSUED & VALID
                  </span>
                </div>
              </div>

              {/* Security Seal Footer */}
              <div className="mt-8 pt-4 border-t border-slate-800 text-center">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  This document has been digitally stamped with SHA-256 tamper-proof verification.
                  For queries, reach HR at <span className="text-slate-400">hr@illusorydesignstudios.com</span>.
                </p>
              </div>
            </div>
          ) : (
            <div>
              {/* Revoked Document Notice */}
              <div className="flex items-center gap-3 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl mb-6">
                <ShieldAlert className="w-6 h-6 text-rose-400 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-rose-300">Document Revoked / Inactive</h3>
                  <p className="text-xs text-rose-400/80">
                    This document was officially recalled or revoked by company HR.
                  </p>
                </div>
              </div>

              <div className="space-y-4 divide-y divide-slate-800/60">
                <div className="pt-2 flex justify-between items-start">
                  <span className="text-xs text-slate-400">Document Title</span>
                  <span className="text-sm font-bold text-white text-right max-w-[260px]">
                    {docData.title}
                  </span>
                </div>

                <div className="pt-3 flex justify-between items-center">
                  <span className="text-xs text-slate-400">Reference Number</span>
                  <span className="font-mono text-xs font-bold text-slate-400">
                    {docData.refNo}
                  </span>
                </div>

                <div className="pt-3 flex justify-between items-center">
                  <span className="text-xs text-slate-400">Issued To</span>
                  <span className="text-sm font-medium text-slate-200">
                    {docData.issuedTo}
                  </span>
                </div>

                <div className="pt-3 flex justify-between items-center">
                  <span className="text-xs text-slate-400">Revocation Date</span>
                  <span className="text-xs text-rose-300 font-medium">
                    {docData.revokedAt ? new Date(docData.revokedAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      timeZone: 'Asia/Kolkata',
                    }) : '—'}
                  </span>
                </div>

                {docData.revocationReason && (
                  <div className="pt-3 flex flex-col gap-1">
                    <span className="text-xs text-slate-400">Reason for Revocation</span>
                    <span className="text-xs text-rose-200 bg-rose-950/40 border border-rose-900/50 p-2.5 rounded-lg">
                      {docData.revocationReason}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-4 border-t border-slate-800 text-center">
                <p className="text-[11px] text-slate-500">
                  Status: REVOKED. This document is no longer recognized as valid proof.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center mt-6">
          <p className="text-[11px] text-slate-600">
            CIN: U72900OR2024PTC045123 • Bhubaneswar, Odisha
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyDocument;
