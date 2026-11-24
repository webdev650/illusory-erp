import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Card, Button, Badge } from '../components/ui';
import {
  Settings,
  Users,
  Shield,
  Building2,
  Plus,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Unlock,
  Check,
  RotateCcw,
  Calendar,
  Trash2,
  Edit2,
  Clock,
  AlertTriangle,
  Layers,
  FileSpreadsheet,
  HelpCircle,
} from 'lucide-react';

export const Configurations = () => {
  const { role: myRole, user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('users');

  // Data states
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [holidayYear, setHolidayYear] = useState(2026);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  // Modal states
  const [createUserModal, setCreateUserModal] = useState(false);
  const [createDeptModal, setCreateDeptModal] = useState(false);
  const [holidayModal, setHolidayModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [assignShiftModal, setAssignShiftModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    employeeId: '',
    shiftId: '',
    startDate: new Date().toISOString().split('T')[0],
    type: 'special',
    reason: '',
  });
  const [assignLoading, setAssignLoading] = useState(false);

  // Holiday Form State
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    date: '',
    type: 'festival',
    description: '',
  });

  // Form states
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('hr');
  const [formLoading, setFormLoading] = useState(false);

  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [newDeptDesc, setNewDeptDesc] = useState('');

  // Leave Policy & Comparison State
  const [leavePolicyYear, setLeavePolicyYear] = useState(null);
  const [entitlementStartSetting, setEntitlementStartSetting] = useState('joining');
  const [entitlementRoundingSetting, setEntitlementRoundingSetting] = useState('none');
  const [comparisonRoundingPreview, setComparisonRoundingPreview] = useState('none');
  const [comparisonList, setComparisonList] = useState([]);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);

  const loadLeavePolicyAndComparison = async (roundingOverride) => {
    try {
      setComparisonLoading(true);
      const roundingToUse = roundingOverride !== undefined ? roundingOverride : comparisonRoundingPreview;
      const [yearsRes, compRes] = await Promise.all([
        api.get('/attendance/settlement/years').catch(() => ({ data: [] })),
        api.get(`/attendance/settlement/policy-comparison?rounding=${roundingToUse}`).catch(() => ({ data: null })),
      ]);

      if (yearsRes.success && yearsRes.data?.length > 0) {
        const cur = yearsRes.data[0];
        setLeavePolicyYear(cur);
        setEntitlementStartSetting(cur.entitlementStart || 'joining');
        setEntitlementRoundingSetting(cur.entitlementRounding || 'none');
      }

      if (compRes?.success && compRes.data?.comparison) {
        setComparisonList(compRes.data.comparison);
      }
    } catch (err) {
      console.warn('Failed to load leave policy comparison:', err);
    } finally {
      setComparisonLoading(false);
    }
  };

  const handleSavePolicySettings = async () => {
    if (!leavePolicyYear?._id) return;
    setPolicySaving(true);
    try {
      const res = await api.put(`/attendance/settlement/years/${leavePolicyYear._id}/settings`, {
        entitlementStart: entitlementStartSetting,
        entitlementRounding: entitlementRoundingSetting,
      });
      if (res.success) {
        setMsg('Leave policy settings updated successfully!');
        loadLeavePolicyAndComparison();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update policy settings');
    } finally {
      setPolicySaving(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes, deptsRes, holidaysRes, shiftsRes, empsRes] = await Promise.all([
        api.get('/users'),
        api.get('/roles'),
        api.get('/departments'),
        api.get(`/hr/holidays?year=${holidayYear}`),
        api.get('/attendance/roster/shifts').catch(() => ({ data: [] })),
        api.get('/employees').catch(() => ({ data: [] })),
      ]);

      if (usersRes.success) setUsers(usersRes.data);
      if (rolesRes.success) setRoles(rolesRes.data);
      if (deptsRes.success) setDepartments(deptsRes.data);
      if (holidaysRes.success) setHolidays(holidaysRes.data);
      if (shiftsRes?.data) setShifts(shiftsRes.data);
      if (empsRes?.data) setEmployees(empsRes.data);
    } catch (err) {
      console.warn('Failed to load configuration data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignShift = async (e) => {
    e.preventDefault();
    setAssignLoading(true);
    try {
      const res = await api.post('/attendance/roster/assign', {
        assignments: [
          {
            employeeId: assignForm.employeeId,
            date: assignForm.startDate,
            shiftId: assignForm.shiftId,
            type: assignForm.type,
          },
        ],
        reason: assignForm.reason || 'Assigned via Configurations > Shifts',
      });
      if (res.success) {
        setMsg('Shift assigned successfully!');
        setAssignShiftModal(false);
        setAssignForm({
          employeeId: '',
          shiftId: '',
          startDate: new Date().toISOString().split('T')[0],
          type: 'special',
          reason: '',
        });
        loadData();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to assign shift');
    } finally {
      setAssignLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [holidayYear]);

  const handleSaveHoliday = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      if (editingHoliday) {
        const res = await api.put(`/hr/holidays/${editingHoliday._id}`, holidayForm);
        if (res.success) {
          setMsg(`Holiday updated successfully`);
          setHolidayModal(false);
          setEditingHoliday(null);
          loadData();
        }
      } else {
        const res = await api.post('/hr/holidays', holidayForm);
        if (res.success) {
          setMsg(`Holiday created successfully`);
          setHolidayModal(false);
          loadData();
        }
      }
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      alert(err.message || 'Failed to save holiday');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteHoliday = async (id, name) => {
    if (!window.confirm(`Delete holiday "${name}"?`)) return;
    try {
      const res = await api.delete(`/hr/holidays/${id}`);
      if (res.success) {
        setMsg(`Holiday removed`);
        setTimeout(() => setMsg(null), 3000);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete holiday');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const res = await api.post('/users', {
        email: newUserEmail,
        roleKey: newUserRole,
      });
      if (res.success) {
        setCreateUserModal(false);
        setNewUserEmail('');
        setMsg(`Created ${newUserRole} account for ${newUserEmail}. Temporary password: ChangeMe@123`);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to create user');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleUserStatus = async (id, email) => {
    try {
      const res = await api.patch(`/users/${id}/status`);
      if (res.success) {
        setMsg(`Account status changed for ${email}`);
        setTimeout(() => setMsg(null), 3000);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Action failed');
    }
  };

  const handleResetPassword = async (id, email) => {
    if (!window.confirm(`Reset password for ${email} to default temporary password?`)) {
      return;
    }
    try {
      const res = await api.post(`/users/${id}/reset-password`);
      if (res.success) {
        setMsg(`Password reset to ChangeMe@123 for ${email}`);
        setTimeout(() => setMsg(null), 4000);
      }
    } catch (err) {
      alert(err.message || 'Failed to reset password');
    }
  };

  const handleForcePasswordReset = async (id, email) => {
    if (!window.confirm(`Force password change on next login for ${email}?`)) {
      return;
    }
    try {
      const res = await api.post(`/users/${id}/force-reset`);
      if (res.success) {
        setMsg(`Password reset requirement flagged for ${email}. They must set a new password on next login.`);
        setTimeout(() => setMsg(null), 4000);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to force password reset');
    }
  };

  const handleCreateDept = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const res = await api.post('/departments', {
        name: newDeptName,
        code: newDeptCode,
        description: newDeptDesc,
      });
      if (res.success) {
        setCreateDeptModal(false);
        setNewDeptName('');
        setNewDeptCode('');
        setNewDeptDesc('');
        setMsg(`Department ${newDeptName} created successfully`);
        setTimeout(() => setMsg(null), 3000);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to create department');
    } finally {
      setFormLoading(false);
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
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Configurations & RBAC"
        subtitle="Manage user accounts, roles & dynamic permissions, and studio department structures"
        breadcrumbs={[{ label: 'Configurations' }]}
      />

      {msg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 space-x-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'users'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Accounts ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'roles'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Roles & RBAC Matrix ({roles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('departments')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'departments'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Departments ({departments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('holidays')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'holidays'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Holidays ({holidays.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('shifts')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'shifts'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Shifts & Timings ({shifts.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('leave-policy');
            loadLeavePolicyAndComparison();
          }}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'leave-policy'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Leave Policy & Comparison</span>
        </button>
      </div>

      {/* Tab 1: Users Management */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500">
              Manage system access, create administrative accounts, or reset employee passwords.
            </p>
            <button
              onClick={() => setCreateUserModal(true)}
              className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create User Account</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase font-bold text-[10px]">
                  <th className="py-3 px-6">User / Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Linked Employee</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="py-3 px-6 font-semibold text-slate-800 dark:text-slate-100">
                      {u.email}
                      {u.mustChangePassword && (
                        <span className="ml-2 text-[10px] font-medium text-amber-600">
                          (Password change required)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-xs text-brand-600 uppercase">
                        {u.role?.name || u.role?.key}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {u.employee ? (
                        <span>
                          [{u.employee.employeeId}] {u.employee.personal?.firstName} {u.employee.personal?.lastName}
                        </span>
                      ) : (
                        <span className="italic text-slate-400">Standalone User</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.isActive
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-right space-x-2">
                      <button
                        onClick={() => handleForcePasswordReset(u._id, u.email)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Force password reset on next login"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleResetPassword(u._id, u.email)}
                        className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Reset to ChangeMe@123"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>

                      {String(currentUser?._id) !== String(u._id) && (
                        <button
                          onClick={() => handleToggleUserStatus(u._id, u.email)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            u.isActive
                              ? 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                              : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={u.isActive ? 'Deactivate User' : 'Activate User'}
                        >
                          {u.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Roles & Permissions */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            System Roles with dynamic Permission Keys (enforced at API & UI levels):
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {roles.map((r) => (
              <div
                key={r._id}
                className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-brand-600" />
                    {r.name}
                  </h3>
                  <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {r.key}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{r.description || 'Configured system role.'}</p>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Assigned Permission Keys:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {r.permissions.map((perm, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-mono text-[10px]"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Departments */}
      {activeTab === 'departments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500">
              Agency operational divisions and discipline departments.
            </p>
            <button
              onClick={() => setCreateDeptModal(true)}
              className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Department</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {departments.map((d) => (
              <div
                key={d._id}
                className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">{d.name}</span>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                    {d.code}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{d.description || 'Agency operational discipline.'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {createUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Create Administrative Account</h3>
            <p className="text-xs text-slate-500 mb-4">
              Create an administrative user for HR, Sales, or management with initial password ChangeMe@123.
            </p>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Official Email *</label>
                <input
                  type="email"
                  required
                  placeholder="name@illusorydesignstudios.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Role Type *</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value="hr">HR Manager (Employee Master access)</option>
                  <option value="admin">Admin (Operational & User control)</option>
                  {myRole === 'super_admin' && (
                    <option value="super_admin">Super Admin (Full unrestricted access)</option>
                  )}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateUserModal(false)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold disabled:opacity-50"
                >
                  {formLoading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Department Modal */}
      {createDeptModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Add New Department</h3>
            <form onSubmit={handleCreateDept} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Department Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Artificial Intelligence"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Code (Uppercase) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI"
                  value={newDeptCode}
                  onChange={(e) => setNewDeptCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Focus area..."
                  value={newDeptDesc}
                  onChange={(e) => setNewDeptDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateDeptModal(false)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold disabled:opacity-50"
                >
                  {formLoading ? 'Adding...' : 'Save Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab 4: Holidays Management */}
      {activeTab === 'holidays' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500">
              Company-wide declared holidays. Seeded entries carry a <span className="font-semibold text-amber-600">Sample - verify with HR</span> tag.
            </p>
            <div className="flex items-center gap-2">
              <select
                value={holidayYear}
                onChange={(e) => setHolidayYear(Number(e.target.value))}
                className="px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              >
                <option value={2026}>Year 2026</option>
                <option value={2027}>Year 2027</option>
              </select>

              <button
                onClick={() => {
                  setEditingHoliday(null);
                  setHolidayForm({ name: '', date: '', type: 'festival', description: '' });
                  setHolidayModal(true);
                }}
                className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Holiday</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase font-bold text-[10px]">
                  <th className="py-3 px-6">Holiday Name</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Status / Verification</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {holidays.map((h) => (
                  <tr key={h._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="py-3 px-6 font-semibold text-slate-800 dark:text-slate-100">
                      {h.name}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                      {new Date(h.date).toLocaleDateString('en-IN', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {h.type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {h.isSample ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          Sample - verify with HR
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Verified Holiday
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 italic max-w-xs truncate">
                      {h.description || '-'}
                    </td>
                    <td className="py-3 px-6 text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditingHoliday(h);
                          setHolidayForm({
                            name: h.name,
                            date: new Date(h.date).toISOString().split('T')[0],
                            type: h.type || 'festival',
                            description: h.description || '',
                          });
                          setHolidayModal(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-brand-600 rounded-lg transition-colors"
                        title="Edit holiday"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteHoliday(h._id, h.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                        title="Delete holiday"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Shifts & Timings */}
      {activeTab === 'shifts' && (
        <div className="space-y-6">
          {/* HR Confirmation Note for Aryan Biswal */}
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold text-amber-900 dark:text-amber-200">
                Confirm Aryan Biswal's timing with HR
              </p>
              <p className="text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
                Historical records in BizCompass showed <strong>7.45 working hours/day</strong> for Aryan Biswal and <strong>7.75 hours/day</strong> for all other staff. Currently, all staff are defaulted to the standard General Studio Shift (7.75 h). Please verify with HR before reassigning or creating a custom shift.
              </p>
            </div>
          </div>

          {/* Active Shift Templates */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-600" />
                  Active Studio Shifts ({shifts.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official studio working hours and break durations configured in policy.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {shifts.map((s) => (
                <div
                  key={s._id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white text-xs">{s.name}</span>
                    {s.isDefault && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        Default Shift
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400 pt-1">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Hours:</span>
                      <span className="font-mono font-medium">{s.startTime} - {s.endTime}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Working Time:</span>
                      <span className="font-mono font-medium">{s.fullDayHours || (s.workingMinutes / 60).toFixed(2)}h ({s.workingMinutes}m)</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Unpaid Break:</span>
                      <span className="font-mono font-medium">{s.unpaidBreakMinutes} mins</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Grace Time:</span>
                      <span className="font-mono font-medium">{s.graceMinutes} mins</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Employee Shift Allocation Table */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Employee Shift Roster Allocation ({employees.length} Staff)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  View and assign shifts per employee with audit tracking.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-100 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-6">Employee</th>
                    <th className="py-3 px-4">Department / Designation</th>
                    <th className="py-3 px-4">Assigned Shift</th>
                    <th className="py-3 px-4">Working Hours</th>
                    <th className="py-3 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {employees.map((emp) => {
                    const defaultShiftName = shifts.find((s) => s.isDefault)?.name || 'General Studio Shift';
                    const defaultHours = shifts.find((s) => s.isDefault)?.fullDayHours || 7.75;
                    const isAryan = emp.personal?.firstName?.toLowerCase().includes('aryan');

                    return (
                      <tr key={emp._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="py-3 px-6 font-semibold text-slate-800 dark:text-slate-100">
                          <div className="flex flex-col">
                            <span>{emp.personal?.firstName} {emp.personal?.lastName}</span>
                            <span className="text-[10px] font-mono text-slate-400">{emp.employeeId}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          <div className="flex flex-col">
                            <span>{emp.employment?.department?.name || 'Designing'}</span>
                            <span className="text-[10px] text-slate-400">{emp.employment?.designation || '-'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {defaultShiftName}
                            <span className="text-[9px] uppercase px-1 rounded bg-slate-200 dark:bg-slate-600 font-bold">Standard</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                          {defaultHours} hrs/day
                          {isAryan && (
                            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200">
                              BizCompass: 7.45h
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-6 text-right">
                          <button
                            onClick={() => {
                              setAssignForm({
                                employeeId: emp._id,
                                shiftId: shifts[0]?._id || '',
                                startDate: new Date().toISOString().split('T')[0],
                                type: 'special',
                                reason: isAryan ? 'Confirm Aryan Biswal shift timing with HR' : 'Assign shift',
                              });
                              setAssignShiftModal(true);
                            }}
                            className="px-3 py-1.5 rounded-xl border border-brand-200 dark:border-brand-800 hover:bg-brand-50 dark:hover:bg-brand-950/40 text-brand-600 dark:text-brand-400 font-semibold text-[11px] transition-colors"
                          >
                            Assign Shift
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Assign Shift */}
      {assignShiftModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              Assign Shift to Employee
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Assign a custom or special roster shift for an employee with audit tracking.
            </p>

            <form onSubmit={handleAssignShift} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  Employee <span className="text-rose-500">*</span>
                </label>
                <select
                  value={assignForm.employeeId}
                  onChange={(e) => setAssignForm({ ...assignForm, employeeId: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value="">Select Employee</option>
                  {employees.map((e) => (
                    <option key={e._id} value={e._id}>
                      {e.personal?.firstName} {e.personal?.lastName} ({e.employeeId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  Target Shift <span className="text-rose-500">*</span>
                </label>
                <select
                  value={assignForm.shiftId}
                  onChange={(e) => setAssignForm({ ...assignForm, shiftId: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value="">Select Shift</option>
                  {shifts.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.startTime} - {s.endTime}, {s.fullDayHours || (s.workingMinutes / 60).toFixed(2)}h)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                    Effective Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={assignForm.startDate}
                    onChange={(e) => setAssignForm({ ...assignForm, startDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                    Assignment Type
                  </label>
                  <select
                    value={assignForm.type}
                    onChange={(e) => setAssignForm({ ...assignForm, type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="special">Special / Temporary</option>
                    <option value="default">Regular Shift</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  Reason / Notes <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows="2"
                  value={assignForm.reason}
                  onChange={(e) => setAssignForm({ ...assignForm, reason: e.target.value })}
                  placeholder="e.g. Adjusted timings as requested by HR..."
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignShiftModal(false)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignLoading}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold disabled:opacity-50"
                >
                  {assignLoading ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab 6: Leave Policy & Comparison */}
      {activeTab === 'leave-policy' && (
        <div className="space-y-6">
          {/* HR Decision Context Banner */}
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold text-amber-900 dark:text-amber-200">
                Awaiting HR Decision: Leave Entitlement Start & Rounding Rules
              </p>
              <p className="text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
                Historical records in BizCompass showed that staff on probation had <strong>0 Casual, 0 Annual, 0 Sick, and 0 Bereavement leave</strong> (only 1 Probation Leave). Under the default joining-date rule, 6 unconfirmed staff receive ~100 days of leave they did not have in BizCompass. The setting below defaults to <strong>From Joining Date</strong> (current behavior). Once HR confirms, switch to <strong>From Confirmation Date</strong> with one click.
              </p>
            </div>
          </div>

          {/* Policy Settings Configuration Card */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-brand-600" />
                  Leave Entitlement & Rounding Configuration ({leavePolicyYear?.code || 'PY-2026'})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure when annual leave quotas begin and whether days round to the nearest half day.
                </p>
              </div>
              <button
                onClick={handleSavePolicySettings}
                disabled={policySaving}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {policySaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Save Policy Settings</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Setting 1: Entitlement Start */}
              <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                <label className="font-bold text-slate-900 dark:text-slate-100 block">
                  1. Entitlement Start Policy (<span className="text-brand-600">entitlementStart</span>)
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="entitlementStart"
                      value="joining"
                      checked={entitlementStartSetting === 'joining'}
                      onChange={() => setEntitlementStartSetting('joining')}
                      className="mt-0.5 text-brand-600 focus:ring-brand-500"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        From Joining Date (Default / Current)
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Pro-rata calculation begins from the employee's date of joining regardless of probation status.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer pt-1 border-t border-slate-200/60 dark:border-slate-800">
                    <input
                      type="radio"
                      name="entitlementStart"
                      value="confirmation"
                      checked={entitlementStartSetting === 'confirmation'}
                      onChange={() => setEntitlementStartSetting('confirmation')}
                      className="mt-0.5 text-brand-600 focus:ring-brand-500"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        From Confirmation Date (Recommended by BizCompass Audit)
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        While in probation, employees receive <strong>ONLY Probation Leave (1 day)</strong>. Regular leave (CL, AL, SL, BL) starts upon confirmation date, pro-rated to year-end.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Setting 2: Entitlement Rounding */}
              <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                <label className="font-bold text-slate-900 dark:text-slate-100 block">
                  2. Entitlement Rounding Policy (<span className="text-brand-600">entitlementRounding</span>)
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="entitlementRounding"
                      value="none"
                      checked={entitlementRoundingSetting === 'none'}
                      onChange={() => setEntitlementRoundingSetting('none')}
                      className="mt-0.5 text-brand-600 focus:ring-brand-500"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        None (Exact Decimals, e.g. 3.33d, 2.92d)
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Stored in integer minutes; displayed without rounding to fractions.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer pt-1 border-t border-slate-200/60 dark:border-slate-800">
                    <input
                      type="radio"
                      name="entitlementRounding"
                      value="nearest_half"
                      checked={entitlementRoundingSetting === 'nearest_half'}
                      onChange={() => setEntitlementRoundingSetting('nearest_half')}
                      className="mt-0.5 text-brand-600 focus:ring-brand-500"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        Nearest Half Day (0.5 Day Multiples)
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Rounds to standard half-day units (e.g. 2.92d &rarr; 3.0d, 3.33d &rarr; 3.5d, 1.67d &rarr; 1.5d).
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer pt-1 border-t border-slate-200/60 dark:border-slate-800">
                    <input
                      type="radio"
                      name="entitlementRounding"
                      value="round_down_half"
                      checked={entitlementRoundingSetting === 'round_down_half'}
                      onChange={() => setEntitlementRoundingSetting('round_down_half')}
                      className="mt-0.5 text-brand-600 focus:ring-brand-500"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        Round Down to Half Day (Floor 0.5 Day)
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Conservative floor rounding (e.g. 2.92d &rarr; 2.5d, 3.33d &rarr; 3.0d).
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Policy Comparison Table */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-brand-600" />
                  Policy Comparison Matrix: Joining vs Confirmation vs Old BizCompass System
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Read-only comparison of annual entitlement across all 9 real staff under both rules.
                </p>
              </div>

              {/* Rounding Simulation Pills */}
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl text-[11px]">
                <span className="text-slate-400 px-2 font-medium">Simulate Rounding:</span>
                {[
                  { key: 'none', label: 'None' },
                  { key: 'nearest_half', label: 'Nearest 0.5d' },
                  { key: 'round_down_half', label: 'Floor 0.5d' },
                ].map((r) => (
                  <button
                    key={r.key}
                    onClick={() => {
                      setComparisonRoundingPreview(r.key);
                      loadLeavePolicyAndComparison(r.key);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                      comparisonRoundingPreview === r.key
                        ? 'bg-white dark:bg-slate-800 text-brand-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              {comparisonLoading ? (
                <div className="py-12 flex justify-center items-center text-xs text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Loading policy comparison data...
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-100 dark:border-slate-700 text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-3">Status / Dates</th>
                      <th className="py-3 px-4 bg-slate-100/50 dark:bg-slate-800/50">
                        Rule A: From Joining (CL/AL/SL/BL/PL = Total)
                      </th>
                      <th className="py-3 px-4 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300">
                        Rule B: From Confirmation (CL/AL/SL/BL/PL = Total)
                      </th>
                      <th className="py-3 px-4 bg-violet-50/50 dark:bg-violet-950/20 text-violet-900 dark:text-violet-300">
                        Old System Reference <span className="block text-[9px] lowercase italic font-normal text-violet-500">(from old system screenshot, verify)</span>
                      </th>
                      <th className="py-3 px-4 text-right">Variance Analysis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-mono text-[11px]">
                    {comparisonList.map((row) => (
                      <tr key={row.employeeId} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="py-3 px-4 font-sans font-semibold text-slate-800 dark:text-slate-100">
                          <div>
                            <span>{row.name}</span>
                            <span className="block text-[10px] font-mono text-slate-400">{row.employeeCode}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-sans text-slate-600 dark:text-slate-300">
                          <div className="space-y-0.5">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              row.status === 'probation'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}>
                              {row.status}
                            </span>
                            <div className="text-[10px] text-slate-400 font-mono">
                              DOJ: {row.dateOfJoining ? new Date(row.dateOfJoining).toISOString().split('T')[0] : '-'}
                            </div>
                            {row.confirmationDate && (
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                                Conf: {new Date(row.confirmationDate).toISOString().split('T')[0]}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Joining Rule */}
                        <td className="py-3 px-4 bg-slate-50/40 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300">
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">{row.joining.total} days</span>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {row.joining.cl} / {row.joining.al} / {row.joining.sl} / {row.joining.bl} / {row.joining.pl}
                            </div>
                          </div>
                        </td>

                        {/* Confirmation Rule */}
                        <td className="py-3 px-4 bg-emerald-50/30 dark:bg-emerald-950/10 text-emerald-900 dark:text-emerald-200">
                          <div>
                            <span className="font-bold">{row.confirmation.total} days</span>
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                              {row.confirmation.cl} / {row.confirmation.al} / {row.confirmation.sl} / {row.confirmation.bl} / {row.confirmation.pl}
                            </div>
                          </div>
                        </td>

                        {/* Old System Reference */}
                        <td className="py-3 px-4 bg-violet-50/30 dark:bg-violet-950/10 text-violet-900 dark:text-violet-200">
                          <div>
                            <span className="font-bold">{row.referenceOldSystem.total} days</span>
                            <div className="text-[10px] text-violet-600 dark:text-violet-400 mt-0.5">
                              {row.referenceOldSystem.cl} / {row.referenceOldSystem.al} / {row.referenceOldSystem.sl} / {row.referenceOldSystem.bl} / {row.referenceOldSystem.pl}
                            </div>
                          </div>
                        </td>

                        {/* Differences */}
                        <td className="py-3 px-4 text-right font-sans">
                          {row.differences.matchesConfirmation ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <Check className="w-3 h-3" /> Matches Old System
                            </span>
                          ) : row.differences.hasJoiningMismatch ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              +{row.differences.joiningDiff}d vs Old System
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-semibold">Identical</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Holiday */}
      {holidayModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              {editingHoliday ? 'Edit Company Holiday' : 'Add New Company Holiday'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Configured holidays apply to studio attendance schedules and leave allowances.
            </p>

            <form onSubmit={handleSaveHoliday} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  Holiday Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diwali / Durga Puja"
                  value={holidayForm.name}
                  onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={holidayForm.date}
                  onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">Category</label>
                <select
                  value={holidayForm.type}
                  onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value="festival">Festival Holiday</option>
                  <option value="national">National Holiday</option>
                  <option value="restricted">Restricted / Optional Holiday</option>
                  <option value="optional">Optional Holiday</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">Description / Remarks</label>
                <input
                  type="text"
                  placeholder="Official celebration details..."
                  value={holidayForm.description}
                  onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setHolidayModal(false)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold disabled:opacity-50"
                >
                  {formLoading ? 'Saving...' : 'Save Holiday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

