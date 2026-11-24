import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Button } from '../components/ui';
import { OrgChartTree } from '../components/OrgChartTree';
import {
  Users,
  Search,
  Plus,
  Filter,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  X,
  AlertCircle,
  Building,
  Briefcase,
  CreditCard,
  User,
  ArrowRight,
  FileSpreadsheet,
  LayoutGrid,
  List,
  GitMerge,
  Download,
  ShieldCheck,
  Check,
} from 'lucide-react';

export const HRMS = () => {
  const { hasPermission } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('table');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1, total: 0 });

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [summaryCounts, setSummaryCounts] = useState({ total: 0, active: 0, probation: 0, notice: 0, exited: 0 });
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [bulkModal, setBulkModal] = useState({ open: false, action: null });
  const [bulkReason, setBulkReason] = useState('');
  const [bulkTargetValue, setBulkTargetValue] = useState('');

  // Add Employee Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [createdCredentials, setCreatedCredentials] = useState(null);

  const [formData, setFormData] = useState({
    personal: {
      firstName: '',
      lastName: '',
      officialEmail: '',
      personalEmail: '',
      phone: '',
      gender: 'Prefer not to say',
      bloodGroup: 'Unknown',
      dob: '',
    },
    employment: {
      department: '',
      designation: '',
      dateOfJoining: new Date().toISOString().split('T')[0],
      employeeType: 'Full-Time',
      workMode: 'Hybrid',
      noticePeriodDays: 30,
    },
    contact: {
      currentAddress: { line1: '', city: 'Bhubaneswar', state: 'Odisha', pincode: '751024', country: 'India' },
      permanentAddress: { line1: '', city: 'Bhubaneswar', state: 'Odisha', pincode: '751024', country: 'India' },
    },
    emergencyContact: {
      name: '',
      relation: '',
      phone: '',
    },
    statutory: {
      aadhaar: '',
      pan: '',
      uan: '',
    },
    bank: {
      bankName: '',
      accountHolder: '',
      accountNumber: '',
      ifsc: '',
    },
    salary: {
      ctc: 900000,
      basic: 450000,
      hra: 225000,
      allowances: 225000,
    },
  });

  const fetchEmployees = async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: 10 };
      if (search) params.search = search;
      if (selectedDept) params.department = selectedDept;
      if (selectedStatus) params.status = selectedStatus;

      const res = await api.get('/employees', { params });
      if (res.success) {
        setEmployees(res.data.employees);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.warn('Failed to fetch employees', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      if (res.success) {
        setDepartments(res.data);
      }
    } catch (err) {
      console.warn('Failed to load departments', err);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await api.get('/employees/summary');
      if (res.success) setSummaryCounts(res.data);
    } catch (err) {
      console.warn('Failed to load summary counts:', err);
    }
  };

  useEffect(() => {
    fetchDepartments();
    fetchSummary();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmployees(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, selectedDept, selectedStatus]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to soft-delete ${name}? Their login will also be deactivated.`)) {
      return;
    }
    try {
      await api.delete(`/employees/${id}`);
      fetchEmployees(pagination.page);
    } catch (err) {
      alert(err.message || 'Failed to delete employee');
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      const payload = {
        personal: {
          ...formData.personal,
          currentAddress: formData.contact.currentAddress,
          permanentAddress: formData.contact.permanentAddress,
        },
        employment: {
          ...formData.employment,
        },
        emergencyContacts: formData.emergencyContact.name ? [formData.emergencyContact] : [],
        statutory: formData.statutory,
        bank: formData.bank,
        salary: formData.salary,
        status: 'active',
      };

      const res = await api.post('/employees', payload);
      if (res.success) {
        setCreatedCredentials(res.data.userCredentials);
        fetchEmployees(1);
      }
    } catch (err) {
      setFormError(err.message || 'Error creating employee');
    } finally {
      setFormLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'probation':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case 'notice':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'resigned':
      case 'terminated':
      case 'inactive':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <PageHeader
        title="Employee Master Directory"
        subtitle={`Total of ${pagination.total} employees across all agency disciplines`}
        breadcrumbs={[{ label: 'HRMS' }]}
        actions={
          <div className="flex items-center space-x-2">
            {(hasPermission('employee.import') || hasPermission('*')) && (
              <Link to="/hrms/import">
                <Button variant="outline" size="sm" icon={FileSpreadsheet}>
                  Import Excel
                </Button>
              </Link>
            )}
            {hasPermission('employee.create') ? (
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => {
                  setStep(1);
                  setCreatedCredentials(null);
                  setFormError(null);
                  setIsAddModalOpen(true);
                }}
              >
                Add New Employee
              </Button>
            ) : null}
          </div>
        }
      />

      {/* Summary Filter Chips */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {[
          { label: 'All Employees', value: '', count: summaryCounts.total, color: 'slate' },
          { label: 'Active', value: 'active', count: summaryCounts.active, color: 'emerald' },
          { label: 'Under Probation', value: 'probation', count: summaryCounts.probation, color: 'amber' },
          { label: 'Serving Notice', value: 'notice', count: summaryCounts.notice, color: 'orange' },
          { label: 'Exited / Inactive', value: 'inactive', count: summaryCounts.exited, color: 'rose' },
        ].map((chip) => {
          const isActive = selectedStatus === chip.value;
          return (
            <button
              key={chip.label}
              onClick={() => setSelectedStatus(chip.value)}
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 font-medium transition-all ${
                isActive
                  ? 'bg-violet-950/40 text-violet-300 border-violet-700 ring-1 ring-violet-500'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <span>{chip.label}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-900 font-mono font-bold">
                {chip.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, employee ID, email, or designation..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-700 dark:text-slate-300"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-700 dark:text-slate-300"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="probation">Probation</option>
            <option value="notice">On Notice</option>
            <option value="resigned">Resigned</option>
            <option value="terminated">Terminated</option>
            <option value="inactive">Inactive</option>
          </select>

          {/* Card / Table / Org Chart View Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              title="Grid Cards View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('orgchart')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'orgchart'
                  ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              title="Organization Chart Tree"
            >
              <GitMerge className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* View Mode Switching: OrgChart vs Cards vs Table */}
      {viewMode === 'orgchart' ? (
        <OrgChartTree />
      ) : viewMode === 'cards' ? (
        <div>
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-brand-600 mb-2" />
              <p className="text-xs text-slate-400">Loading master records...</p>
            </div>
          ) : employees.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-8">
              No employees match the specified criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {employees.map((emp) => (
                <div
                  key={emp._id}
                  className="bg-white dark:bg-[#151A26] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4.5 shadow-2xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-md shadow-brand-500/20 flex-shrink-0">
                          {emp.personal?.firstName?.charAt(0)}
                        </div>
                        <div className="truncate">
                          <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                            {emp.personal?.firstName} {emp.personal?.lastName}
                          </h3>
                          <p className="text-xs text-brand-600 dark:text-brand-400 font-medium truncate">
                            {emp.employment?.designation}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(
                          emp.status
                        )}`}
                      >
                        {emp.status}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400">ID:</span>
                        <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                          {emp.employeeId}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Department:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {emp.employment?.department?.name || 'Unassigned'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Work Mode:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {emp.employment?.workMode || 'On-site'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <Link
                      to={`/hrms/employees/${emp._id}`}
                      className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center space-x-1"
                    >
                      <span>View Profile</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                    {hasPermission('employee.delete') && (
                      <button
                        onClick={() => handleDelete(emp._id, emp.personal?.firstName)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                        title="Delete Employee"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600 mb-2" />
            <p className="text-xs text-slate-400">Loading master records...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            No employees match the specified criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                  <th className="py-3.5 px-6">Employee</th>
                  <th className="py-3.5 px-4">Employee ID</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Work Mode</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {employees.map((emp) => (
                  <tr
                    key={emp._id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                          {emp.personal?.firstName?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {emp.personal?.firstName} {emp.personal?.lastName}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {emp.employment?.designation} • {emp.personal?.officialEmail}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-slate-600 dark:text-slate-300">
                      {emp.employeeId}
                    </td>

                    <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                      {emp.employment?.department?.name || 'Unassigned'}
                    </td>

                    <td className="py-3 px-4 text-slate-500">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-[10px] font-medium">
                        {emp.employment?.workMode || 'On-site'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(
                          emp.status
                        )}`}
                      >
                        {emp.status}
                      </span>
                    </td>

                    <td className="py-3 px-6 text-right space-x-2">
                      <Link
                        to={`/hrms/employees/${emp._id}`}
                        className="inline-flex items-center p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors"
                        title="View Full Profile"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>

                      {hasPermission('employee.delete') && (
                        <button
                          onClick={() =>
                            handleDelete(emp._id, `${emp.personal?.firstName} ${emp.personal?.lastName}`)
                          }
                          className="inline-flex items-center p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Soft Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex space-x-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchEmployees(pagination.page - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchEmployees(pagination.page + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* --- ADD EMPLOYEE MULTI-STEP MODAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-700 relative my-8">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-6 right-6 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            {createdCredentials ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Employee Onboarded Successfully!
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  The employee record was generated with an automated ID. A corresponding user login account has also been created.
                </p>

                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-sm mx-auto text-left text-xs font-mono space-y-1">
                  <p className="text-slate-500">Email: <span className="text-slate-900 dark:text-white font-semibold">{createdCredentials.email}</span></p>
                  <p className="text-slate-500">Temporary Password: <span className="text-brand-600 font-bold">{createdCredentials.temporaryPassword}</span></p>
                  <p className="text-[10px] text-amber-600 pt-1">User must change password on first sign-in.</p>
                </div>

                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-6 py-2.5 bg-brand-600 text-white font-semibold text-xs rounded-xl shadow"
                >
                  Close & Refresh Directory
                </button>
              </div>
            ) : (
              <div>
                {/* Wizard header */}
                <div className="mb-6">
                  <span className="text-[10px] font-bold text-brand-600 uppercase tracking-wider">
                    Step {step} of 4
                  </span>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                    {step === 1 && 'Personal Information'}
                    {step === 2 && 'Employment & Department'}
                    {step === 3 && 'Contact & Addresses'}
                    {step === 4 && 'Statutory & Bank Setup'}
                  </h2>
                </div>

                {formError && (
                  <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <form onSubmit={handleCreateSubmit} className="space-y-4">
                  {/* Step 1: Personal */}
                  {step === 1 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">First Name *</label>
                        <input
                          type="text"
                          required
                          value={formData.personal.firstName}
                          onChange={(e) => setFormData({ ...formData, personal: { ...formData.personal, firstName: e.target.value } })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Last Name *</label>
                        <input
                          type="text"
                          required
                          value={formData.personal.lastName}
                          onChange={(e) => setFormData({ ...formData, personal: { ...formData.personal, lastName: e.target.value } })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Official Email *</label>
                        <input
                          type="email"
                          required
                          value={formData.personal.officialEmail}
                          onChange={(e) => setFormData({ ...formData, personal: { ...formData.personal, officialEmail: e.target.value } })}
                          placeholder="name@illusorydesignstudios.com"
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Mobile Phone *</label>
                        <input
                          type="text"
                          required
                          value={formData.personal.phone}
                          onChange={(e) => setFormData({ ...formData, personal: { ...formData.personal, phone: e.target.value } })}
                          placeholder="+91 98765 43210"
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Gender</label>
                        <select
                          value={formData.personal.gender}
                          onChange={(e) => setFormData({ ...formData, personal: { ...formData.personal, gender: e.target.value } })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                          <option value="Prefer not to say">Prefer not to say</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Date of Birth</label>
                        <input
                          type="date"
                          value={formData.personal.dob}
                          onChange={(e) => setFormData({ ...formData, personal: { ...formData.personal, dob: e.target.value } })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 2: Employment */}
                  {step === 2 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Department *</label>
                        <select
                          required
                          value={formData.employment.department}
                          onChange={(e) => setFormData({ ...formData, employment: { ...formData.employment, department: e.target.value } })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                        >
                          <option value="">Select Department</option>
                          {departments.map((d) => (
                            <option key={d._id} value={d._id}>
                              {d.name} ({d.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Designation *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Senior Product Designer"
                          value={formData.employment.designation}
                          onChange={(e) => setFormData({ ...formData, employment: { ...formData.employment, designation: e.target.value } })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                        />
                      </div>

                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Work Mode</label>
                        <select
                          value={formData.employment.workMode}
                          onChange={(e) => setFormData({ ...formData, employment: { ...formData.employment, workMode: e.target.value } })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                        >
                          <option value="Hybrid">Hybrid</option>
                          <option value="On-site">On-site</option>
                          <option value="Remote">Remote</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Joining Date</label>
                        <input
                          type="date"
                          value={formData.employment.dateOfJoining}
                          onChange={(e) => setFormData({ ...formData, employment: { ...formData.employment, dateOfJoining: e.target.value } })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 3: Contact & Address */}
                  {step === 3 && (
                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Current Address</label>
                        <input
                          type="text"
                          placeholder="Line 1, Landmark, Street"
                          value={formData.contact.currentAddress.line1}
                          onChange={(e) => setFormData({
                            ...formData,
                            contact: {
                              ...formData.contact,
                              currentAddress: { ...formData.contact.currentAddress, line1: e.target.value },
                            },
                          })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl mb-2"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            placeholder="City (e.g. Bhubaneswar)"
                            value={formData.contact.currentAddress.city}
                            onChange={(e) => setFormData({
                              ...formData,
                              contact: {
                                ...formData.contact,
                                currentAddress: { ...formData.contact.currentAddress, city: e.target.value },
                              },
                            })}
                            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                          />
                          <input
                            type="text"
                            placeholder="State (e.g. Odisha)"
                            value={formData.contact.currentAddress.state}
                            onChange={(e) => setFormData({
                              ...formData,
                              contact: {
                                ...formData.contact,
                                currentAddress: { ...formData.contact.currentAddress, state: e.target.value },
                              },
                            })}
                            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                          />
                          <input
                            type="text"
                            placeholder="Pincode"
                            value={formData.contact.currentAddress.pincode}
                            onChange={(e) => setFormData({
                              ...formData,
                              contact: {
                                ...formData.contact,
                                currentAddress: { ...formData.contact.currentAddress, pincode: e.target.value },
                              },
                            })}
                            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Emergency Contact</label>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            placeholder="Contact Name"
                            value={formData.emergencyContact.name}
                            onChange={(e) => setFormData({ ...formData, emergencyContact: { ...formData.emergencyContact, name: e.target.value } })}
                            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                          />
                          <input
                            type="text"
                            placeholder="Relation (e.g. Spouse/Parent)"
                            value={formData.emergencyContact.relation}
                            onChange={(e) => setFormData({ ...formData, emergencyContact: { ...formData.emergencyContact, relation: e.target.value } })}
                            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                          />
                          <input
                            type="text"
                            placeholder="Phone Number"
                            value={formData.emergencyContact.phone}
                            onChange={(e) => setFormData({ ...formData, emergencyContact: { ...formData.emergencyContact, phone: e.target.value } })}
                            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Statutory & Bank */}
                  {step === 4 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Aadhaar Card No</label>
                        <input
                          type="text"
                          placeholder="12 digits"
                          value={formData.statutory.aadhaar}
                          onChange={(e) => setFormData({ ...formData, statutory: { ...formData.statutory, aadhaar: e.target.value } })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">PAN Number</label>
                        <input
                          type="text"
                          placeholder="ABCDE1234F"
                          value={formData.statutory.pan}
                          onChange={(e) => setFormData({ ...formData, statutory: { ...formData.statutory, pan: e.target.value.toUpperCase() } })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl uppercase"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Bank Name</label>
                        <input
                          type="text"
                          placeholder="e.g. HDFC Bank"
                          value={formData.bank.bankName}
                          onChange={(e) => setFormData({ ...formData, bank: { ...formData.bank, bankName: e.target.value } })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Account Number</label>
                        <input
                          type="text"
                          placeholder="Bank account number"
                          value={formData.bank.accountNumber}
                          onChange={(e) => setFormData({ ...formData, bank: { ...formData.bank, accountNumber: e.target.value } })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">IFSC Code</label>
                        <input
                          type="text"
                          placeholder="HDFC0001234"
                          value={formData.bank.ifsc}
                          onChange={(e) => setFormData({ ...formData, bank: { ...formData.bank, ifsc: e.target.value.toUpperCase() } })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl uppercase"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Annual CTC (INR)</label>
                        <input
                          type="number"
                          placeholder="e.g. 900000"
                          value={formData.salary.ctc}
                          onChange={(e) => setFormData({ ...formData, salary: { ...formData.salary, ctc: Number(e.target.value) } })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                        />
                      </div>
                    </div>
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
                    {step > 1 ? (
                      <button
                        type="button"
                        onClick={() => setStep(step - 1)}
                        className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300"
                      >
                        Previous Step
                      </button>
                    ) : <div />}

                    {step < 4 ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (step === 1 && (!formData.personal.firstName || !formData.personal.officialEmail)) {
                            setFormError('Please enter at least First Name and Official Email');
                            return;
                          }
                          if (step === 2 && (!formData.employment.department || !formData.employment.designation)) {
                            setFormError('Please select Department and enter Designation');
                            return;
                          }
                          setFormError(null);
                          setStep(step + 1);
                        }}
                        className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
                      >
                        <span>Next Step</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={formLoading}
                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {formLoading ? 'Submitting...' : 'Complete & Onboard Employee'}
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

