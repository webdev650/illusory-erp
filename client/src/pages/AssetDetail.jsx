import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  Box,
  ChevronLeft,
  QrCode,
  Printer,
  Calendar,
  User,
  Wrench,
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  Tag,
  ArrowRight,
  Loader2,
  X,
} from 'lucide-react';

const formatINR = (paise = 0) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
};

export const AssetDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qrModalOpen, setQrModalOpen] = useState(false);

  useEffect(() => {
    const fetchAsset = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/assets/${id}`);
        if (res.success) {
          setData(res.data);
        }
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to load asset details');
        navigate('/assets');
      } finally {
        setLoading(false);
      }
    };
    fetchAsset();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-600" />
        <p className="text-sm">Loading asset specification...</p>
      </div>
    );
  }

  if (!data || !data.asset) {
    return null;
  }

  const { asset, assignments = [], maintenance = [] } = data;
  const isWarrantyExpiring =
    asset.warrantyExpiry &&
    new Date(asset.warrantyExpiry) > new Date() &&
    new Date(asset.warrantyExpiry) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const isWarrantyExpired = asset.warrantyExpiry && new Date(asset.warrantyExpiry) < new Date();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/assets')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Assets Register
        </button>

        <button
          onClick={() => setQrModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 shadow-xs"
        >
          <QrCode className="w-4 h-4 text-brand-600" /> View QR Sticker
        </button>
      </div>

      {/* Main Asset Header Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300 flex items-center justify-center flex-shrink-0 border border-brand-200 dark:border-brand-800">
            <Box className="w-7 h-7" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-extrabold px-2.5 py-0.5 rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                {asset.assetTag}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                {asset.category?.name || 'Device'}
              </span>
              <span
                className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded-full ${
                  asset.status === 'available'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : asset.status === 'assigned'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                      : asset.status === 'under_repair'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                }`}
              >
                {asset.status.replace('_', ' ')}
              </span>
            </div>

            <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-2">
              {asset.name}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {asset.brand} {asset.model} {asset.serialNumber ? `• Serial: ${asset.serialNumber}` : ''}
            </p>
          </div>
        </div>

        {/* Current Assignee Pill */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-xs min-w-[200px]">
          <span className="text-slate-400 block text-[10px] font-bold uppercase mb-1">
            Current Assignee
          </span>
          {asset.currentAssignee ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-600 text-white font-bold flex items-center justify-center text-xs">
                {asset.currentAssignee.personal?.firstName?.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-slate-800 dark:text-white">
                  {asset.currentAssignee.personal?.firstName}{' '}
                  {asset.currentAssignee.personal?.lastName}
                </p>
                <p className="text-[11px] text-slate-400">
                  {asset.currentAssignee.employeeId}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 font-semibold italic">Unassigned (In Studio Inventory)</p>
          )}
        </div>
      </div>

      {/* Specifications Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Hardware Specs & Cost */}
        <div className="md:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-4 text-xs">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm border-b border-slate-100 dark:border-slate-700 pb-2">
            Technical & Procurement Specs
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Brand</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {asset.brand || '—'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Model</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {asset.model || '—'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Condition</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                {asset.condition || 'Good'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Location</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {asset.location}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Purchase Date</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString('en-IN') : '—'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Warranty</span>
              <span
                className={`font-semibold flex items-center gap-1 ${
                  isWarrantyExpired
                    ? 'text-rose-600'
                    : isWarrantyExpiring
                      ? 'text-amber-600 font-bold'
                      : 'text-slate-800 dark:text-slate-200'
                }`}
              >
                {asset.warrantyExpiry
                  ? new Date(asset.warrantyExpiry).toLocaleDateString('en-IN')
                  : 'No Warranty'}
                {isWarrantyExpiring && <span>(Expiring Soon)</span>}
                {isWarrantyExpired && <span>(Expired)</span>}
              </span>
            </div>

            {hasPermission('asset.viewCost') && asset.purchaseCost !== undefined && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                  Purchase Price
                </span>
                <span className="font-extrabold text-brand-600 dark:text-brand-400 text-sm">
                  {formatINR(asset.purchaseCost)}
                </span>
              </div>
            )}

            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Vendor</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {asset.vendor || '—'}
              </span>
            </div>

            {asset.invoiceNumber && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Invoice</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {asset.invoiceNumber}
                </span>
              </div>
            )}
          </div>

          {asset.notes && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
              <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Notes</span>
              <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                {asset.notes}
              </p>
            </div>
          )}
        </div>

        {/* QR Code Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs flex flex-col items-center justify-center text-center space-y-3">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Device Asset Tag Sticker
          </p>
          <img
            src={`/api/v1/assets/${asset._id}/qr`}
            alt={asset.assetTag}
            className="w-36 h-36 border border-slate-200 dark:border-slate-700 rounded-xl p-1 bg-white"
          />
          <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">
            {asset.assetTag}
          </p>
          <button
            onClick={() => setQrModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Print Sticker Label
          </button>
        </div>
      </div>

      {/* Assignment History Timeline */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-brand-600" />
          Assignment & Custody Timeline ({assignments.length})
        </h3>

        {assignments.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-4">
            This asset has not been assigned to any employee yet.
          </p>
        ) : (
          <div className="space-y-4">
            {assignments.map((asg, idx) => (
              <div
                key={asg._id}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {asg.employee?.personal?.firstName} {asg.employee?.personal?.lastName}
                    </span>
                    <span className="text-[10px] text-slate-400">({asg.employee?.employeeId})</span>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        asg.status === 'active'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {asg.status}
                    </span>

                    {asg.acknowledgement?.accepted ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Acknowledged
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        Pending Ack
                      </span>
                    )}
                  </div>

                  <p className="text-slate-500 text-[11px]">
                    Assigned:{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {new Date(asg.assignedAt).toLocaleDateString('en-IN')}
                    </span>
                    {asg.returnedAt && (
                      <>
                        {' '}
                        • Returned:{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {new Date(asg.returnedAt).toLocaleDateString('en-IN')}
                        </span>
                      </>
                    )}
                  </p>
                  {asg.issueNotes && (
                    <p className="text-slate-600 dark:text-slate-400 italic">
                      Issue note: "{asg.issueNotes}"
                    </p>
                  )}
                  {asg.returnNotes && (
                    <p className="text-slate-600 dark:text-slate-400 italic">
                      Return note: "{asg.returnNotes}"
                    </p>
                  )}
                </div>

                <div className="text-right flex-shrink-0 text-[11px] text-slate-400">
                  <p>Condition at Issue: <span className="capitalize font-semibold text-slate-700 dark:text-slate-300">{asg.conditionAtIssue}</span></p>
                  {asg.conditionAtReturn && (
                    <p>Condition at Return: <span className="capitalize font-semibold text-slate-700 dark:text-slate-300">{asg.conditionAtReturn}</span></p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Maintenance History */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
          <Wrench className="w-4 h-4 text-amber-600" />
          Maintenance & Service Log ({maintenance.length})
        </h3>

        {maintenance.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-4">No repair or service records.</p>
        ) : (
          <div className="space-y-3">
            {maintenance.map((m) => (
              <div
                key={m._id}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-xs flex items-start justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200 capitalize">
                      {m.type}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                      {m.status.replace('_', ' ')}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Started: {new Date(m.startedAt).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 font-semibold mt-1">
                    Issue: {m.issue}
                  </p>
                  {m.notes && <p className="text-slate-500 italic mt-0.5">{m.notes}</p>}
                </div>

                {hasPermission('asset.viewCost') && m.cost !== undefined && (
                  <span className="font-bold text-slate-900 dark:text-white font-mono">
                    {formatINR(m.cost)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Print QR Sticker Modal */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setQrModalOpen(false)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 text-center space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                Asset Physical Tag
              </span>
              <button
                onClick={() => setQrModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Label Area */}
            <div id="printable-qr-card" className="p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl bg-white text-slate-900 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Illusory Design Studios
              </p>
              <img
                src={`/api/v1/assets/${asset._id}/qr`}
                alt={asset.assetTag}
                className="w-44 h-44 mx-auto"
              />
              <p className="font-mono text-base font-extrabold tracking-wider">{asset.assetTag}</p>
              <p className="text-xs font-semibold text-slate-600">{asset.name}</p>
              <p className="text-[10px] text-slate-400">Property of Illusory Design Studios Pvt. Ltd.</p>
            </div>

            <button
              onClick={() => window.print()}
              className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" /> Print Sticker
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetDetail;
