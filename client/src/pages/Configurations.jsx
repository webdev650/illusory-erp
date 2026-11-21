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
} from 'lucide-react';

export const Configurations = () => {
  const { role: myRole, user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('users');

  // Data states
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [holidayYear, setHolidayYear] = useState(2026);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  // Modal states
  const [createUserModal, setCreateUserModal] = useState(false);
  const [createDeptModal, setCreateDeptModal] = useState(false);
  const [holidayModal, setHolidayModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);

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

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes, deptsRes, holidaysRes] = await Promise.all([
        api.get('/users'),
        api.get('/roles'),
        api.get('/departments'),
        api.get(`/hr/holidays?year=${holidayYear}`),
      ]);

      if (usersRes.success) setUsers(usersRes.data);
      if (rolesRes.success) setRoles(rolesRes.data);
      if (deptsRes.success) setDepartments(deptsRes.data);
      if (holidaysRes.success) setHolidays(holidaysRes.data);
    } catch (err) {
      console.warn('Failed to load configuration data', err);
    } finally {
      setLoading(false);
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

