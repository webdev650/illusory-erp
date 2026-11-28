import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  User,
  Mail,
  Phone,
  Building,
  Shield,
  KeyRound,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Camera,
  CreditCard,
  Laptop,
  Smartphone,
  LogOut,
  Trash2,
  Clock,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader, Button } from '../components/ui';

export const MyProfile = () => {
  const { user, role, logoutAll } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Editable fields for employee self-service
  const [phone, setPhone] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [currentAddress, setCurrentAddress] = useState({ line1: '', city: '', state: '', pincode: '', country: 'India' });
  const [emergencyContacts, setEmergencyContacts] = useState([{ name: '', relation: '', phone: '' }]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get('/employees/me');
      if (res.success && res.data) {
        setProfile(res.data);
        const p = res.data.personal || {};
        setPhone(p.phone || '');
        setPersonalEmail(p.personalEmail || '');
        if (p.currentAddress) setCurrentAddress(p.currentAddress);
        if (res.data.emergencyContacts?.length > 0) {
          setEmergencyContacts(res.data.emergencyContacts);
        }
      }
    } catch (error) {
      setErr(error.message || 'Could not fetch your employee record');
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      setLoadingSessions(true);
      const res = await api.get('/auth/sessions');
      if (res.success && Array.isArray(res.data)) {
        setSessions(res.data);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchSessions();
  }, []);

  const handleRevokeSession = async (sessionId) => {
    try {
      const res = await api.delete(`/auth/sessions/${sessionId}`);
      if (res.success) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        setMsg('Session revoked successfully.');
      }
    } catch (error) {
      setErr(error.message || 'Failed to revoke session');
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm('Are you sure you want to log out from all devices? You will need to sign in again.')) {
      return;
    }
    await logoutAll();
  };

  const handleSaveSelf = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setErr(null);

    try {
      const res = await api.put('/employees/me', {
        phone,
        personalEmail,
        currentAddress,
        emergencyContacts: emergencyContacts.filter((c) => c.name && c.phone),
      });

      if (res.success) {
        setProfile(res.data);
        setMsg('Your contact information was updated successfully!');
        setTimeout(() => setMsg(null), 4000);
      }
    } catch (error) {
      setErr(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !profile?._id) return;

    const formData = new FormData();
    formData.append('photo', file);

    try {
      setUploadingPhoto(true);
      const res = await api.post(`/employees/${profile._id}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.success) {
        setProfile((prev) => ({
          ...prev,
          personal: { ...prev.personal, photo: res.data },
        }));
        setMsg('Profile photo updated successfully!');
        setTimeout(() => setMsg(null), 3000);
      }
    } catch (error) {
      alert(error.message || 'Photo upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const p = profile?.personal || {};
  const emp = profile?.employment || {};

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="My Profile & Self-Service"
        subtitle="Review your official employment details and keep your contact and emergency information updated"
        breadcrumbs={[{ label: 'My Profile' }]}
      />

      {msg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {err && (
        <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{err}</span>
        </div>
      )}

      {/* Profile Overview Card */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center gap-6">
        <div className="relative group flex-shrink-0">
          {p.photo?.url ? (
            <img
              src={p.photo.url}
              alt="Avatar"
              className="w-24 h-24 rounded-2xl object-cover border-2 border-brand-500 shadow-md"
            />
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-extrabold text-3xl flex items-center justify-center shadow-md">
              {p.firstName?.charAt(0)}
            </div>
          )}

          <label className="absolute inset-0 bg-slate-900/60 rounded-2xl flex flex-col items-center justify-center text-white text-[10px] opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
            <Camera className="w-5 h-5 mb-1" />
            <span>Change</span>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              disabled={uploadingPhoto}
              className="hidden"
            />
          </label>
        </div>

        <div className="flex-1 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {p.firstName} {p.lastName}
            </h2>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 font-bold text-slate-700 dark:text-slate-300 inline-block self-center sm:self-auto">
              {profile?.employeeId}
            </span>
          </div>

          <p className="text-xs text-slate-500 mt-1 font-medium">
            {emp.designation} • {emp.department?.name || 'General Division'}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              {profile?.status?.toUpperCase()}
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
              {emp.workMode || 'Hybrid'}
            </span>
            <Link
              to="/change-password"
              className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 flex items-center ml-2"
            >
              <KeyRound className="w-3.5 h-3.5 mr-1" />
              Change Login Password
            </Link>
          </div>
        </div>
      </div>

      {/* Self-Service Editable Form */}
      <form onSubmit={handleSaveSelf} className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-700 space-y-6">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Editable Contact & Emergency Info
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            You are authorized to update your personal phone, address, and emergency contact directly.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Mobile Phone *
            </label>
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Personal Email
            </label>
            <input
              type="email"
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Current Residential Address
            </label>
            <input
              type="text"
              placeholder="Flat / House / Landmark"
              value={currentAddress.line1}
              onChange={(e) => setCurrentAddress({ ...currentAddress, line1: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl mb-2"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="City"
                value={currentAddress.city}
                onChange={(e) => setCurrentAddress({ ...currentAddress, city: e.target.value })}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
              <input
                type="text"
                placeholder="State"
                value={currentAddress.state}
                onChange={(e) => setCurrentAddress({ ...currentAddress, state: e.target.value })}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
              <input
                type="text"
                placeholder="Pincode"
                value={currentAddress.pincode}
                onChange={(e) => setCurrentAddress({ ...currentAddress, pincode: e.target.value })}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="sm:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-700">
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-2">
              Primary Emergency Contact
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Contact Name"
                value={emergencyContacts[0]?.name || ''}
                onChange={(e) =>
                  setEmergencyContacts([
                    { ...emergencyContacts[0], name: e.target.value },
                    ...emergencyContacts.slice(1),
                  ])
                }
                className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
              <input
                type="text"
                placeholder="Relationship"
                value={emergencyContacts[0]?.relation || ''}
                onChange={(e) =>
                  setEmergencyContacts([
                    { ...emergencyContacts[0], relation: e.target.value },
                    ...emergencyContacts.slice(1),
                  ])
                }
                className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
              <input
                type="text"
                placeholder="Phone Number"
                value={emergencyContacts[0]?.phone || ''}
                onChange={(e) =>
                  setEmergencyContacts([
                    { ...emergencyContacts[0], phone: e.target.value },
                    ...emergencyContacts.slice(1),
                  ])
                }
                className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-brand-500/20 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Changes...' : 'Save Profile Changes'}</span>
          </button>
        </div>
      </form>

      {/* Statutory / Bank details snapshot (Masked) */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-purple-600" />
          Statutory & Bank Records (Masked for Security)
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          To update your statutory or banking details, please submit an official request with verified documents to the HR & Finance Department.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Aadhaar</span>
            <p className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
              {profile?.statutory?.aadhaar || 'XXXX-XXXX-XXXX'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
            <span className="text-[10px] text-slate-400 font-bold uppercase">PAN</span>
            <p className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
              {profile?.statutory?.pan || 'ABCDE****F'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Bank Account</span>
            <p className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
              {profile?.bank?.accountNumber || 'XXXXXXXX1234'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
            <span className="text-[10px] text-slate-400 font-bold uppercase">IFSC</span>
            <p className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
              {profile?.bank?.ifsc || 'HDFC0001234'}
            </p>
          </div>
        </div>
      </div>

      {/* Persistent Login & Active Sessions Management */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700 gap-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Laptop className="w-4 h-4 text-brand-600" />
              Active Sessions & Connected Devices
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Devices currently signed into your Illusory ERP account. You can revoke any unrecognized session.
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogoutAll}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out All Other Devices</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-700/60 mt-4">
          {loadingSessions ? (
            <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
              <span>Loading active sessions...</span>
            </div>
          ) : sessions.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">
              No other active sessions found.
            </p>
          ) : (
            sessions.map((s) => {
              const isMobile = /iphone|ipad|android|mobile/i.test(s.deviceLabel);
              const lastActive = new Date(s.lastUsedAt).toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={s.id}
                  className="py-3.5 flex items-center justify-between gap-4 text-xs"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 flex items-center justify-center flex-shrink-0">
                      {isMobile ? (
                        <Smartphone className="w-4 h-4" />
                      ) : (
                        <Laptop className="w-4 h-4" />
                      )}
                    </span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {s.deviceLabel}
                        </span>
                        {s.isCurrent && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            Current Device
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        IP: {s.ip} • Last active: {lastActive} (IST)
                      </p>
                    </div>
                  </div>

                  {!s.isCurrent && (
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(s.id)}
                      className="px-3 py-1.5 text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Revoke</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

