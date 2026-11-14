import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Card, PageHeader, Button, Badge, Modal } from '../components/ui';
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
      setMsg(null);
      const endpoint = action === 'approve' ? `/approvals/${id}/approve` : `/approvals/${id}/reject`;
      const res = await api.post(endpoint, {
        comment: commentText,
      });

      if (res.success) {
        setMsg({ type: 'success', text: res.message });
        setCommentModal({ open: false, id: null, action: null });
        await fetchApprovals();
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Action failed' });
    } finally {
      setActingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Approvals & Workflows"
        subtitle="Manage and review multi-tier leaves, timesheets, and equipment requests"
        breadcrumbs={[{ label: 'Approvals' }]}
        badge={
          pendingForMe.length > 0 ? (
            <Badge variant="brand" size="md">
              {pendingForMe.length} pending review
            </Badge>
          ) : null
        }
      />

      {msg && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center gap-2 border ${
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'pending'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <span>Pending for Me</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
            {pendingForMe.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('my')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'my'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <span>My Raised Requests</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {myRequests.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Pending for Me */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingForMe.length === 0 ? (
            <Card className="text-center py-12">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-700 dark:text-slate-200 text-xs">All caught up!</p>
              <p className="text-xs text-slate-400">You have zero items pending your approval.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingForMe.map((req) => (
                <Card
                  key={req._id}
                  padding="p-5"
                  className="space-y-4 text-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
                        {req.type}
                      </span>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-1">
                        {req.title}
                      </h4>
                      <p className="text-slate-500">
                        Requested by: {req.requestedBy?.personal?.firstName} {req.requestedBy?.personal?.lastName} ({req.requestedBy?.employeeId})
                      </p>
                    </div>

                    <Badge variant="warning" size="sm">
                      Step {req.currentStep} of {req.steps?.length}
                    </Badge>
                  </div>

                  {req.metadata && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                      {req.metadata.reason && <p><span className="font-semibold">Reason:</span> "{req.metadata.reason}"</p>}
                      {req.metadata.days && <p><span className="font-semibold">Duration:</span> {req.metadata.days} days</p>}
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAction(req._id, 'reject')}
                      disabled={actingId === req._id}
                      className="text-rose-600 border-rose-200 hover:bg-rose-50"
                    >
                      Reject
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleAction(req._id, 'approve')}
                      disabled={actingId === req._id}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      Approve & Advance
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: My Requests */}
      {activeTab === 'my' && (
        <div className="space-y-4">
          {myRequests.length === 0 ? (
            <Card className="text-center py-12">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-400">You haven't submitted any approval applications yet.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {myRequests.map((req) => (
                <Card
                  key={req._id}
                  padding="p-4"
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {req.type}
                      </span>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100">{req.title}</h4>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Submitted on {new Date(req.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        req.status === 'approved'
                          ? 'success'
                          : req.status === 'rejected'
                          ? 'danger'
                          : 'warning'
                      }
                      size="sm"
                    >
                      {req.status}
                    </Badge>

                    <div className="text-[10px] text-slate-400">
                      Step {req.currentStep} / {req.steps?.length}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action / Review Modal */}
      <Modal
        isOpen={commentModal.open}
        onClose={() => setCommentModal({ open: false, id: null, action: null })}
        title={commentModal.action === 'approve' ? 'Approve Request' : 'Reject Request'}
        subtitle="Add an optional comment or explanation for the employee."
      >
        <form onSubmit={submitAction} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Comments (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Approved. Deliverables look on track."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCommentModal({ open: false, id: null, action: null })}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={commentModal.action === 'approve' ? 'primary' : 'danger'}
              size="sm"
              loading={actingId !== null}
            >
              Confirm {commentModal.action === 'approve' ? 'Approval' : 'Rejection'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Approvals;
