import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  User,
  Building,
  Mail,
  Phone,
  Calendar,
  FileText,
  Upload,
  Clock,
  ArrowLeft,
  Shield,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Camera,
  Box,
  RotateCcw,
  Key,
} from 'lucide-react';

export const EmployeeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission, role } = useAuth();

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [clearanceData, setClearanceData] = useState(null);
  const [loadingClearance, setLoadingClearance] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('active');
  const [confirmationDate, setConfirmationDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusRemarks, setStatusRemarks] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [msg, setMsg] = useState(null);

  // Reporting Manager modal states
  const [managerModalOpen, setManagerModalOpen] = useState(false);
  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [savingManager, setSavingManager] = useState(false);

  const openManagerModal = async () => {
    try {
      if (allEmployees.length === 0) {
        const res = await api.get('/employees');
        if (res.success) {
          setAllEmployees(res.data.filter((e) => String(e._id) !== String(id)));
        }
      }
      setSelectedManagerId(employee?.employment?.reportingManager?._id || '');
      setManagerModalOpen(true);
    } catch (err) {
      alert('Failed to load employee list');
    }
  };

  const handleUpdateManager = async (e) => {
    e.preventDefault();
    setSavingManager(true);
    try {
      const res = await api.patch(`/employees/${id}/manager`, {
        managerId: selectedManagerId || null,
      });
      if (res.success) {
        setEmployee(res.data);
        setManagerModalOpen(false);
        setMsg('Reporting manager updated successfully');
        setTimeout(() => setMsg(null), 3000);
      }
    } catch (err) {
      alert(err.message || 'Failed to update reporting manager');
    } finally {
      setSavingManager(false);
    }
  };

  const fetchClearance = async () => {
    try {
      setLoadingClearance(true);
      const res = await api.get(`/assets/clearance/${id}`);
      if (res.success) setClearanceData(res.data);
    } catch (err) {
      console.warn('Failed to fetch clearance', err);
    } finally {
      setLoadingClearance(false);
    }
  };

  const fetchEmployee = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/employees/${id}`);
      if (res.success) {
        setEmployee(res.data);
        setNewStatus(res.data.status);
      }
    } catch (err) {
      alert(err.message || 'Error fetching employee profile');
      navigate('/hrms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployee();
    fetchClearance();
  }, [id]);

  const handleResolveClearanceItem = async (itemId, status) => {
    try {
      const res = await api.post(`/assets/clearance/${id}/items/${itemId}`, {
        status,
        note: `Marked ${status} by HR administrator`,
      });
      if (res.success) {
        setClearanceData(res.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update clearance item');
    }
  };

  const handleCompleteClearance = async () => {
    try {
      const res = await api.post(`/assets/clearance/${id}/complete`);
      if (res.success) {
        setClearanceData(res.data);
        alert('Exit clearance successfully completed!');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Cannot complete exit clearance');
    }
  };

  const handleStatusChange = async (e) => {
    e.preventDefault();
    try {
      const res = await api.patch(`/employees/${id}/status`, {
        status: newStatus,
        confirmationDate: newStatus === 'active' ? confirmationDate : null,
        reason: statusRemarks,
      });
      if (res.success) {
        setEmployee(res.data);
        setStatusModalOpen(false);
        setMsg('Employment status updated and leave balances recalculated successfully!');
        setTimeout(() => setMsg(null), 3500);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to update status');
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);

    try {
      setUploadingPhoto(true);
      const res = await api.post(`/employees/${id}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.success) {
        setEmployee((prev) => ({
          ...prev,
          personal: { ...prev.personal, photo: res.data },
        }));
        setMsg('Profile photo updated successfully!');
        setTimeout(() => setMsg(null), 3000);
      }
    } catch (err) {
      alert(err.message || 'Photo upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDocUpload = async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('docFileInput');
    const typeInput = document.getElementById('docTypeInput');
    const nameInput = document.getElementById('docNameInput');

    if (!fileInput?.files?.[0]) return;

    const formData = new FormData();
    formData.append('document', fileInput.files[0]);
    formData.append('type', typeInput.value);
    formData.append('name', nameInput.value || fileInput.files[0].name);

    try {
      setUploadingDoc(true);
      const res = await api.post(`/employees/${id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.success) {
        setEmployee((prev) => ({
          ...prev,
          documents: [...(prev.documents || []), res.data],
        }));
        setMsg('Document uploaded to Cloudinary successfully!');
        setTimeout(() => setMsg(null), 3000);
        fileInput.value = '';
        nameInput.value = '';
      }
    } catch (err) {
      alert(err.message || 'Document upload failed');
    } finally {
      setUploadingDoc(false);
    }
  };

  if (loading || !employee) {
    return (
      <div className="py-24 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const p = employee.personal || {};
  const emp = employee.employment || {};

  return (
    <div className="space-y-6">
      {/* Back button & banner */}
      <div className="flex items-center justify-between">
        <Link
          to="/hrms"
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Employee Directory
        </Link>

        {hasPermission('employee.update') && (
          <button
            onClick={() => setStatusModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-sm"
          >
            Change Status ({employee.status.toUpperCase()})
          </button>
        )}
      </div>

      {msg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {/* Profile Header Card */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="relative group">
            {p.photo?.url ? (
              <img
                src={p.photo.url}
                alt="Profile"
                className="w-20 h-20 rounded-2xl object-cover border-2 border-brand-500 shadow-md"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-md">
                {p.firstName?.charAt(0)}
              </div>
            )}

            <label className="absolute inset-0 bg-slate-900/60 rounded-2xl flex items-center justify-center text-white opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
              <Camera className="w-5 h-5" />
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={uploadingPhoto}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {p.firstName} {p.lastName}
              </h1>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 font-bold text-slate-700 dark:text-slate-300">
                {employee.employeeId}
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500 mt-1">
              {emp.designation} • {emp.department?.name || 'General Division'}
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {p.officialEmail}
              </span>
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {p.phone}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="px-4 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Status</span>
            <div className="flex items-center justify-center gap-1.5 mt-0.5">
              <p className="text-xs font-bold text-emerald-600 uppercase">{employee.status}</p>
              {!emp.isStatusVerified && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800" title="Inferred / Unverified by HR">
                  ⚠️ Unverified
                </span>
              )}
            </div>
          </div>
          <div className="px-4 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Work Mode</span>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">{emp.workMode || 'Hybrid'}</p>
          </div>
        </div>
      </div>

      {/* Tabs navigation: 13 Comprehensive Master Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 space-x-6 text-xs font-semibold overflow-x-auto">
        {[
          'overview',
          'personal',
          'employment',
          'history',
          'education',
          'experience',
          'documents',
          'statutory & bank',
          'compensation',
          'assets & access',
          'leave & attendance',
          'performance',
          ...( ['notice', 'resigned', 'terminated'].includes(employee.status) ? ['exit'] : [] ),
        ].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 capitalize transition-all border-b-2 shrink-0 ${
              activeTab === tab
                ? 'border-brand-600 text-brand-600 dark:text-brand-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Personal Details</h3>
            <div className="space-y-2 text-xs divide-y divide-slate-100 dark:divide-slate-700">
              <div className="flex justify-between py-2">
                <span className="text-slate-400">Gender</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{p.gender}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-400">Date of Birth</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{p.dob ? new Date(p.dob).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-400">Blood Group</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{p.bloodGroup}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-400">Personal Email</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{p.personalEmail || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Current & Permanent Address</h3>
            <div className="space-y-3 text-xs">
              <div>
                <p className="font-bold text-slate-700 dark:text-slate-300">Current Address</p>
                <p className="text-slate-500 mt-0.5">
                  {p.currentAddress?.line1 || 'Patia, Infocity Road'}, {p.currentAddress?.city || 'Bhubaneswar'}, {p.currentAddress?.state || 'Odisha'} - {p.currentAddress?.pincode || '751024'}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                <p className="font-bold text-slate-700 dark:text-slate-300">Emergency Contacts</p>
                {(employee.emergencyContacts || []).length > 0 ? (
                  employee.emergencyContacts.map((c, i) => (
                    <p key={i} className="text-slate-500 mt-1">
                      {c.name} ({c.relation}) — <span className="font-mono text-slate-700 dark:text-slate-300">{c.phone}</span>
                    </p>
                  ))
                ) : (
                  <p className="text-slate-400">None specified</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Employment */}
      {activeTab === 'employment' && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Employment Profile</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Department</span>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{emp.department?.name || 'Unassigned'}</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Employee Type</span>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{emp.employeeType || 'Full-Time'}</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Joining Date</span>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{emp.dateOfJoining ? new Date(emp.dateOfJoining).toLocaleDateString() : 'N/A'}</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Confirmation Date</span>
                {emp.confirmationDate && !emp.isConfirmationDateVerified && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    ⚠️ Unverified
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                {emp.confirmationDate ? new Date(emp.confirmationDate).toLocaleDateString() : (employee.status === 'probation' ? 'Under Probation' : 'Not Set')}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Notice Period</span>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{emp.noticePeriodDays || 30} Days</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-start">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Reporting Lead</span>
                {hasPermission('employee.update') && (
                  <button
                    type="button"
                    onClick={openManagerModal}
                    className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 hover:underline"
                  >
                    {emp.reportingManager ? 'Change' : 'Set Manager'}
                  </button>
                )}
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                {emp.reportingManager ? `${emp.reportingManager.personal?.firstName} ${emp.reportingManager.personal?.lastName}` : 'Studio Management / Unassigned'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: History */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Role & Status Timeline</h3>
          {(employee.history || []).length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No promotional or status modifications recorded yet.</p>
          ) : (
            <div className="space-y-4">
              {employee.history.map((h, i) => (
                <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 text-xs">
                  <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0 font-bold">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">{h.type}</span>
                    <p className="text-slate-500 mt-0.5">
                      Transition from <span className="font-semibold text-slate-700 dark:text-slate-300">{h.from || 'Initial'}</span> to <span className="font-semibold text-slate-700 dark:text-slate-300">{h.to}</span>
                    </p>
                    {h.remarks && <p className="text-slate-400 mt-1 italic">{h.remarks}</p>}
                    <span className="text-[10px] text-slate-400 mt-1 block">{new Date(h.date).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Statutory & Bank */}
      {activeTab === 'statutory & bank' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-600" />
              Statutory Compliance (Protected & Masked)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Aadhaar</span>
                <p className="text-sm font-mono font-bold text-slate-900 dark:text-white mt-1">
                  {employee.statutory?.aadhaar || 'Masked / Protected'}
                </p>
                {hasPermission('employee.revealSensitive') && (
                  <button
                    onClick={async () => {
                      const reason = prompt('Mandatory justification reason to unmask Aadhaar:');
                      if (!reason) return;
                      const res = await api.post(`/employees/${id}/reveal`, { field: 'aadhaar', reason });
                      if (res.success) alert(`Unmasked Aadhaar: ${res.data.value}`);
                    }}
                    className="mt-2 text-[10px] text-brand-600 hover:underline font-semibold"
                  >
                    Reveal Aadhaar
                  </button>
                )}
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 text-[10px] uppercase font-bold">PAN</span>
                <p className="text-sm font-mono font-bold text-slate-900 dark:text-white mt-1">
                  {employee.statutory?.pan || 'Masked / Protected'}
                </p>
                {hasPermission('employee.revealSensitive') && (
                  <button
                    onClick={async () => {
                      const reason = prompt('Mandatory justification reason to unmask PAN:');
                      if (!reason) return;
                      const res = await api.post(`/employees/${id}/reveal`, { field: 'pan', reason });
                      if (res.success) alert(`Unmasked PAN: ${res.data.value}`);
                    }}
                    className="mt-2 text-[10px] text-brand-600 hover:underline font-semibold"
                  >
                    Reveal PAN
                  </button>
                )}
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 text-[10px] uppercase font-bold">UAN</span>
                <p className="text-sm font-mono font-bold text-slate-900 dark:text-white mt-1">
                  {employee.statutory?.uan || 'N/A'}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 text-[10px] uppercase font-bold">ESI Number</span>
                <p className="text-sm font-mono font-bold text-slate-900 dark:text-white mt-1">
                  {employee.statutory?.esiNumber || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              Bank Account Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Bank Name</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{employee.bank?.bankName || 'N/A'}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Account Number</span>
                <p className="text-sm font-mono font-bold text-slate-900 dark:text-white mt-1">{employee.bank?.accountNumber || 'Masked / Protected'}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 text-[10px] uppercase font-bold">IFSC Code</span>
                <p className="text-sm font-mono font-bold text-slate-900 dark:text-white mt-1">{employee.bank?.ifsc || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Compensation */}
      {activeTab === 'compensation' && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Compensation & Salary Revisions</h3>
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300">
              Managed in Payroll Module
            </span>
            <p className="text-xs text-slate-500 mt-3 max-w-md mx-auto">
              CTC breakdown, basic allowances, deductions, and salary revision history are maintained in the Payroll Master.
            </p>
          </div>
        </div>
      )}

      {/* Tab: Personal */}
      {activeTab === 'personal' && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Personal & Family Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Marital Status</span>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{p.maritalStatus || 'Single'}</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Nationality</span>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">Indian</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Languages</span>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">English, Hindi, Odia</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Education */}
      {activeTab === 'education' && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Education Qualifications</h3>
          {(employee.education || []).length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No academic credentials uploaded yet.</p>
          ) : (
            <div className="space-y-3 text-xs">
              {employee.education.map((edu, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <strong className="text-white text-sm">{edu.course || edu.degree}</strong>
                  <p className="text-slate-400">{edu.institution} ({edu.year})</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Experience */}
      {activeTab === 'experience' && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Past Work Experience & Skills</h3>
          {(employee.experience || []).length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No prior employer history recorded.</p>
          ) : (
            <div className="space-y-3 text-xs">
              {employee.experience.map((exp, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <strong className="text-white text-sm">{exp.designation}</strong>
                  <p className="text-slate-400">{exp.company}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Exit */}
      {activeTab === 'exit' && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Exit Clearance & F&F Settlement</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Exit Type</span>
              <p className="text-sm font-bold text-rose-500 mt-1">{employee.exit?.type || 'Resignation'}</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Last Working Day</span>
              <p className="text-sm font-bold text-white mt-1">
                {employee.exit?.lastWorkingDay ? new Date(employee.exit.lastWorkingDay).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <span className="text-slate-400 text-[10px] uppercase font-bold">F&F Settlement Status</span>
              <p className="text-sm font-bold text-amber-500 mt-1">{employee.exit?.fnfStatus || 'Pending'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Documents */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          {hasPermission('employee.update') && (
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <Upload className="w-4 h-4 text-brand-600" />
                Upload Employee Document to Cloudinary
              </h3>
              <form onSubmit={handleDocUpload} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs items-end">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Document Category</label>
                  <select id="docTypeInput" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
                    <option value="OFFER_LETTER">Offer Letter</option>
                    <option value="APPOINTMENT_LETTER">Appointment Letter</option>
                    <option value="ID_PROOF">ID Proof</option>
                    <option value="RESUME">Resume</option>
                    <option value="EXPERIENCE_LETTER">Experience Letter</option>
                    <option value="EDUCATION">Education Certificate</option>
                    <option value="OTHER">Other Document</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">Display Name</label>
                  <input
                    id="docNameInput"
                    type="text"
                    placeholder="e.g. Appointment Letter Sign.pdf"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">Select File (PDF, JPG, PNG &lt; 5MB)</label>
                  <input
                    id="docFileInput"
                    type="file"
                    required
                    accept=".pdf,image/*"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div className="sm:col-span-3 pt-2">
                  <button
                    type="submit"
                    disabled={uploadingDoc}
                    className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl text-xs disabled:opacity-50"
                  >
                    {uploadingDoc ? 'Uploading...' : 'Upload Document'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Uploaded Records</h3>
            {(employee.documents || []).length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No documents uploaded for this employee yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {employee.documents.map((doc, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-brand-600 flex-shrink-0" />
                      <span className="font-bold text-slate-800 dark:text-slate-100 truncate">{doc.name}</span>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {doc.type}
                    </span>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-brand-600 hover:underline text-[11px] font-medium pt-1"
                    >
                      View / Download File &rarr;
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Assets & Exit Clearance */}
      {activeTab === 'assets & clearance' && (
        <div className="space-y-6">
          {/* Exit Clearance Banner */}
          {['notice', 'resigned', 'terminated'].includes(employee.status) && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="font-bold text-amber-900 dark:text-amber-200">
                    Exit Clearance in Progress (Employee is on {employee.status})
                  </p>
                  <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                    Clearance Status:{' '}
                    <span className="font-bold uppercase tracking-wider">
                      {clearanceData?.status || 'pending'}
                    </span>
                  </p>
                </div>
              </div>

              {clearanceData?.status !== 'cleared' && (
                <button
                  onClick={handleCompleteClearance}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs"
                >
                  Complete Exit Clearance
                </button>
              )}
            </div>
          )}

          {/* Checklist Card */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Custody Checklist: Hardware Assets &amp; Software Licenses
                </h3>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                  clearanceData?.status === 'cleared'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {clearanceData?.status || 'pending'}
              </span>
            </div>

            {loadingClearance ? (
              <div className="py-8 text-center text-slate-400 text-xs">Loading custody records...</div>
            ) : !clearanceData || (clearanceData.checklist || []).length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4">
                No physical devices or software licenses are currently checked out to this employee.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
                {clearanceData.checklist.map((item) => (
                  <div
                    key={item._id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {item.name}
                        </span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {item.tagOrKey}
                        </span>
                        <span
                          className={`px-2 py-0.2 rounded text-[10px] font-bold uppercase ${
                            item.status === 'returned' || item.status === 'revoked'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'lost'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] capitalize">
                        Type: {item.itemType} {item.note ? `• Note: "${item.note}"` : ''}
                      </p>
                    </div>

                    {item.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        {item.itemType === 'asset' ? (
                          <>
                            <button
                              onClick={() => handleResolveClearanceItem(item._id, 'returned')}
                              className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-bold text-[11px]"
                            >
                              Mark Returned
                            </button>
                            <button
                              onClick={() => handleResolveClearanceItem(item._id, 'lost')}
                              className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg font-bold text-[11px]"
                            >
                              Mark Lost
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleResolveClearanceItem(item._id, 'revoked')}
                            className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-bold text-[11px]"
                          >
                            Revoke License Seat
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Performance */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b pb-4 dark:border-slate-700">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Performance Appraisals & Cycles</h3>
                <p className="text-xs text-slate-500">Official evaluation history and published review scores for this employee.</p>
              </div>
              <span className="text-xs px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-md font-medium">
                Confidential Scoping Enforced
              </span>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">Annual Review Cycle 2026</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Status: In Progress • Manager: Assigned Reporting Lead</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    Cycle Active
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-500 italic p-3 bg-slate-50/50 rounded-xl border border-slate-100 dark:border-slate-800">
                ℹ️ Note: Per studio confidentiality rules, evaluator comments and calibration adjustments are displayed only after outcomes are formally published by HR. Internal manager recommendation notes are restricted to HR administrators.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Set Employment Status Modal */}
      {statusModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">Set Employment Status</h3>
            <p className="text-xs text-slate-500 mb-4">
              Transition status for {employee?.personal?.firstName} {employee?.personal?.lastName}. This action is audit logged and recalculates leave balances.
            </p>
            <form onSubmit={handleStatusChange} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">Employment Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                >
                  <option value="probation">Probation (Under Evaluation)</option>
                  <option value="active">Confirmed (Full-Time Regular)</option>
                  <option value="notice">On Notice (Resigned / Serving Notice)</option>
                  <option value="resigned">Resigned</option>
                  <option value="terminated">Terminated</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {newStatus === 'active' && (
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">Confirmation Date</label>
                  <input
                    type="date"
                    required
                    value={confirmationDate}
                    onChange={(e) => setConfirmationDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Date when probation was successfully completed and employment was confirmed.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">Reason / HR Remarks</label>
                <textarea
                  rows={3}
                  required
                  value={statusRemarks}
                  onChange={(e) => setStatusRemarks(e.target.value)}
                  placeholder="Mandatory justification (e.g. Completed 6-month probation review, Evaluation sign-off, Resignation accepted)..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <span>
                  {newStatus === 'active'
                    ? 'Confirming status will automatically recalculate balances and retire future Probation Leave while safely preserving any historical taken records.'
                    : 'Changing to probation will recalculate 2026 pro-rata entitlements including Probation Leave eligibility.'}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStatusModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-sm"
                >
                  Set Employment Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set Reporting Manager Modal */}
      {managerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full shadow-xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Assign Reporting Manager</h3>
            <p className="text-xs text-slate-500 mb-4">
              Select the supervisor who will approve leaves, timesheets, and review performance for {employee.personal?.firstName} {employee.personal?.lastName}.
            </p>

            <form onSubmit={handleUpdateManager} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-semibold">Reporting Lead</label>
                <select
                  value={selectedManagerId}
                  onChange={(e) => setSelectedManagerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value="">None (Studio Management / Unassigned)</option>
                  {allEmployees.map((e) => (
                    <option key={e._id} value={e._id}>
                      [{e.employeeId}] {e.personal?.firstName} {e.personal?.lastName} ({e.employment?.department?.name || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setManagerModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingManager}
                  className="px-4 py-1.5 rounded-xl bg-brand-600 text-white font-semibold disabled:opacity-50"
                >
                  {savingManager ? 'Saving...' : 'Save Manager'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

