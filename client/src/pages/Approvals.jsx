import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Loader2,
  Check,
  X,
  FileText,
  Calendar,
  Send,
} from 'lucide-react';

export const Approvals = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingForMe, setPendingForMe] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [commentModal, setCommentModal] = useState({ open: false, id: null, action: null });
  const [commentText, setCommentText] = useState('');
  const [msg, setMsg] = useState(null);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const [pendingRes, myRes] = await Promise.all([
        api.get('/approvals/pending-for-me'),
        api.get('/approvals/my-requests'),
      ]);

      if (pendingRes.success) setPendingForMe(pendingRes.data);
      if (myRes.success) setMyRequests(myRes.data);
    } catch (err) {
      console.warn('Error fetching approvals', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const handleAction = async (id, action) => {
    setCommentModal({ open: true, id, action });
    setCommentText('');
  };

  const submitAction = async (e) => {
    e.preventDefault();
    const { id, action } = commentModal;
    if (!id || !action) return;

    try {
      setActingId(id);
      const endpoint = action === 'approve' ? `/approvals/${id}/approve` : `/approvals/${id}/reject`;
      const res = await api.post(endpoint, { comment: commentText });

      if (res.success) {
        setCommentModal({ open: false, id: null, action: null });
        setMsg(`Request successfully ${action === 'approve' ? 'approved' : 'rejected'}`);
        setTimeout(() => setMsg(null), 3000);
        fetchApprovals();
      }
    } catch (err) {
      alert(err.message || 'Action failed');
    } finally {
      setActingId(null);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this request?')) return;
    try {
      const res = await api.post(`/approvals/${id}/cancel`);
      if (res.success) {
        setMsg('Request cancelled successfully');
        setTimeout(() => setMsg(null), 3000);
        fetchApprovals();
      }
    } catch (err) {
      alert(err.message || 'Failed to cancel');
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <Clock className="w-6 h-6 text-brand-600" />
          Approval Workflows Hub
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Review requests requiring your verification or track the status of applications you raised.
        </p>
      </div>

      {msg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 space-x-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'pending'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <span>Pending for Me</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-100 text-brand-700">
            {pendingForMe.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('my')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'my'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <span>My Raised Requests</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            {myRequests.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Pending for Me */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingForMe.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center text-slate-400 text-xs border border-slate-200 dark:border-slate-700">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-700 dark:text-slate-200">All caught up!</p>
              <p>You have zero items pending your approval.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingForMe.map((req) => (
                <div
                  key={req._id}
                  className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4 text-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-brand-50 text-brand-700">
                        {req.type}
                      </span>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-1">
                        {req.title}
                      </h4>
                      <p className="text-slate-500">
                        Requested by: {req.requestedBy?.personal?.firstName} {req.requestedBy?.personal?.lastName} ({req.requestedBy?.employeeId})
                      </p>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-700">
                      Step {req.currentStep} of {req.steps?.length}
                    </span>
                  </div>

                  {req.metadata && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                      {req.metadata.reason && <p><span className="font-semibold">Reason:</span> "{req.metadata.reason}"</p>}
                      {req.metadata.days && <p><span className="font-semibold">Duration:</span> {req.metadata.days} days</p>}
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleAction(req._id, 'reject')}
                      disabled={actingId === req._id}
                      className="px-3.5 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleAction(req._id, 'approve')}
                      disabled={actingId === req._id}
                      className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    >
                      Approve & Advance
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: My Requests */}
      {activeTab === 'my' && (
        <div className="space-y-4">
          {myRequests.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center text-slate-400 text-xs border border-slate-200 dark:border-slate-700">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p>You haven't submitted any approval applications yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myRequests.map((req) => (
                <div
                  key={req._id}
                  className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 text-xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-brand-50 text-brand-700">
                          {req.type}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                          {req.title}
                        </h4>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        Submitted on {new Date(req.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          req.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : req.status === 'rejected'
                            ? 'bg-rose-100 text-rose-700'
                            : req.status === 'cancelled'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {req.status}
                      </span>

                      {req.status === 'pending' && (
                        <button
                          onClick={() => handleCancel(req._id)}
                          className="px-2.5 py-1 rounded-full text-[10px] font-semibold border border-rose-200 text-rose-600 hover:bg-rose-50"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Multi-step pipeline progression */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                    <span className="text-[10px] font-bold uppercase text-slate-400 mb-2 block">
                      Approval Chain
                    </span>
                    <div className="flex flex-wrap items-center gap-3">
                      {req.steps.map((st, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div
                            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-[11px] ${
                              st.status === 'approved'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : st.status === 'rejected'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-50 text-slate-500 border-slate-200'
                            }`}
                          >
                            <span className="font-bold">Step {st.order}:</span>
                            <span>{st.title || st.approverRole?.toUpperCase() || 'Review'}</span>
                            <span className="font-semibold text-[10px] uppercase">({st.status})</span>
                          </div>
                          {i < req.steps.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-slate-300" />}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Comment Modal */}
      {commentModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700 text-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              Confirm {commentModal.action === 'approve' ? 'Approval' : 'Rejection'}
            </h3>
            <p className="text-slate-400 mb-3">
              Add a brief comment or remark for the requester and audit trail.
            </p>

            <form onSubmit={submitAction} className="space-y-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Comment</label>
                <textarea
                  rows={3}
                  placeholder={commentModal.action === 'approve' ? 'e.g. Approved. Good to go.' : 'e.g. Please reschedule due to client demo.'}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCommentModal({ open: false, id: null, action: null })}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actingId !== null}
                  className={`px-4 py-1.5 rounded-xl text-white font-semibold ${
                    commentModal.action === 'approve' ? 'bg-emerald-600' : 'bg-rose-600'
                  }`}
                >
                  {actingId ? 'Processing...' : 'Submit Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
