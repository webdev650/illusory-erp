import React from 'react';
import { Modal, Badge, Button } from '../ui';
import { CheckCircle2, Clock, XCircle, AlertCircle, User, ArrowRight } from 'lucide-react';

export const ApprovalTimelineModal = ({ isOpen, onClose, request }) => {
  if (!request) return null;

  const approval = request.approvalRequest || request;
  const steps = approval?.steps || [];
  const status = approval?.status || request.status || 'pending';

  const getStatusBadge = (s) => {
    switch (s) {
      case 'approved':
        return <Badge variant="success" className="text-xs">Approved</Badge>;
      case 'rejected':
        return <Badge variant="danger" className="text-xs">Rejected</Badge>;
      case 'cancelled':
        return <Badge variant="secondary" className="text-xs">Cancelled</Badge>;
      default:
        return <Badge variant="warning" className="text-xs">Pending Review</Badge>;
    }
  };

  const getStepIcon = (s) => {
    switch (s) {
      case 'approved':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'skipped':
        return <AlertCircle className="w-5 h-5 text-slate-400" />;
      default:
        return <Clock className="w-5 h-5 text-amber-400 animate-pulse" />;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Approval Workflow Timeline" size="md">
      <div className="space-y-6">
        {/* Header Summary */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-start justify-between">
          <div>
            <h4 className="text-sm font-semibold text-white">
              {approval?.title || request.reason || 'Approval Details'}
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Requester: <span className="text-slate-200 font-medium">
                {request.employee?.personal?.firstName} {request.employee?.personal?.lastName}
              </span>
              {request.appliedBy && (
                <span className="ml-2 text-indigo-400 text-[11px]">
                  (On behalf by {request.appliedBy.email})
                </span>
              )}
            </p>
          </div>
          <div>{getStatusBadge(status)}</div>
        </div>

        {/* Steps Progression */}
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
          {steps.length > 0 ? (
            steps.map((step, idx) => {
              const isCurrent = approval?.currentStep === step.order && approval?.status === 'pending';
              const approverName = step.approverEmployee
                ? `${step.approverEmployee.personal?.firstName || 'Assigned'} ${step.approverEmployee.personal?.lastName || 'Manager'}`
                : step.approverRole === 'super_admin'
                ? 'Super Admin Review'
                : 'HR Administration';

              return (
                <div key={idx} className="relative flex items-start gap-4">
                  {/* Icon Marker */}
                  <div className="absolute -left-6 mt-0.5 bg-slate-950 p-0.5 rounded-full ring-4 ring-slate-950">
                    {getStepIcon(step.status)}
                  </div>

                  {/* Step Card */}
                  <div
                    className={`flex-1 p-3.5 rounded-xl border transition-all ${
                      isCurrent
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : step.status === 'approved'
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : step.status === 'rejected'
                        ? 'bg-red-500/5 border-red-500/20'
                        : 'bg-slate-900/40 border-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-200">
                        Stage {step.order}: {step.title || approverName}
                      </span>
                      {getStatusBadge(step.status)}
                    </div>

                    <p className="text-xs text-slate-400">
                      Assigned To: <span className="text-slate-300 font-medium">{approverName}</span>
                    </p>

                    {step.actedAt && (
                      <p className="text-[11px] text-slate-500 mt-1">
                        Acted on: {new Date(step.actedAt).toLocaleString('en-IN')}
                        {step.actedBy?.email && ` by ${step.actedBy.email}`}
                      </p>
                    )}

                    {step.comment && (
                      <div className="mt-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300">
                        <span className="text-slate-500 block text-[10px] uppercase tracking-wider mb-0.5">Note:</span>
                        "{step.comment}"
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-xs text-slate-400 py-4">No approval steps registered yet.</div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-2 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ApprovalTimelineModal;
