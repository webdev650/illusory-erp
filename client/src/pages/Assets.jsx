import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Button } from '../components/ui';
import {
  Box,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  QrCode,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Wrench,
  Key,
  ShieldCheck,
  Eye,
  EyeOff,
  User,
  Users,
  Send,
  X,
  Loader2,
  Calendar,
  DollarSign,
  Briefcase,
  Layers,
  FileText,
  RotateCcw,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#64748b'];

const formatINR = (paise = 0) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
};

export const Assets = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'register';
  const [activeTab, setActiveTab] = useState(initialTab);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Shared Data
  const [categories, setCategories] = useState([]);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    const fetchShared = async () => {
      try {
        const [catRes, empRes] = await Promise.all([
          api.get('/assets/categories'),
          api.get('/employees?limit=200'),
        ]);
        if (catRes.success) setCategories(catRes.data || []);
        if (empRes.success) setEmployees(empRes.data.employees || []);
      } catch (err) {
        console.warn('Failed to load asset categories/employees', err);
      }
    };
    fetchShared();
  }, []);

  // ==========================================
  // TAB 1: OVERVIEW & ALERTS
  // ==========================================
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      setLoadingSummary(true);
      const res = await api.get('/assets/summary');
      if (res.success) setSummary(res.data);
    } catch (err) {
      console.warn('Failed to load asset summary', err);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') {
      fetchSummary();
    }
  }, [activeTab, fetchSummary]);

  // ==========================================
  // TAB 2: ASSET REGISTER (Hardware Table)
  // ==========================================
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterWarrantyExpiring, setFilterWarrantyExpiring] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [targetAssetForAssign, setTargetAssetForAssign] = useState(null);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [targetAssetForReturn, setTargetAssetForReturn] = useState(null);
  const [qrModalAsset, setQrModalAsset] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);

  // Forms State
  const [assetForm, setAssetForm] = useState({
    name: '',
    category: '',
    brand: '',
    model: '',
    serialNumber: '',
    purchaseDate: '',
    purchaseCostINR: '',
    vendor: '',
    invoiceNumber: '',
    warrantyExpiry: '',
    condition: 'new',
    location: 'Studio (Bhubaneswar)',
    notes: '',
    customValues: {},
  });

  const [assignForm, setAssignForm] = useState({
    employeeId: '',
    expectedReturnDate: '',
    conditionAtIssue: 'good',
    issueNotes: '',
  });

  const [returnForm, setReturnForm] = useState({
    conditionAtReturn: 'good',
    returnNotes: '',
    markUnderRepair: false,
  });

  const fetchAssets = useCallback(async () => {
    try {
      setLoadingAssets(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (filterCategory) params.set('category', filterCategory);
      if (filterStatus) params.set('status', filterStatus);
      if (filterWarrantyExpiring) params.set('warrantyExpiring', 'true');
      params.set('page', pagination.page);
      params.set('limit', 25);

      const res = await api.get(`/assets?${params.toString()}`);
      if (res.success) {
        setAssets(res.data.assets || []);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.warn('Failed to load assets register', err);
    } finally {
      setLoadingAssets(false);
    }
  }, [searchQuery, filterCategory, filterStatus, filterWarrantyExpiring, pagination.page]);

  useEffect(() => {
    if (activeTab === 'register') {
      fetchAssets();
    }
  }, [activeTab, fetchAssets]);

  // Selected Category Custom Fields
  const selectedCategoryObj = useMemo(() => {
    return categories.find((c) => c._id === assetForm.category);
  }, [categories, assetForm.category]);

  const handleOpenAddAsset = () => {
    setEditingAsset(null);
    setAssetForm({
      name: '',
      category: categories[0]?._id || '',
      brand: '',
      model: '',
      serialNumber: '',
      purchaseDate: '',
      purchaseCostINR: '',
      vendor: '',
      invoiceNumber: '',
      warrantyExpiry: '',
      condition: 'new',
      location: 'Studio (Bhubaneswar)',
      notes: '',
      customValues: {},
    });
    setAddModalOpen(true);
  };

  const handleSaveAsset = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: assetForm.name,
        category: assetForm.category,
        brand: assetForm.brand,
        model: assetForm.model,
        serialNumber: assetForm.serialNumber || undefined,
        purchaseDate: assetForm.purchaseDate || undefined,
        purchaseCost: assetForm.purchaseCostINR ? Math.round(Number(assetForm.purchaseCostINR) * 100) : 0,
        vendor: assetForm.vendor,
        invoiceNumber: assetForm.invoiceNumber,
        warrantyExpiry: assetForm.warrantyExpiry || undefined,
        condition: assetForm.condition,
        location: assetForm.location,
        notes: assetForm.notes,
        customValues: assetForm.customValues,
      };

      if (editingAsset) {
        await api.put(`/assets/${editingAsset._id}`, payload);
      } else {
        await api.post('/assets', payload);
      }

      setAddModalOpen(false);
      fetchAssets();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to save asset');
    }
  };

  const handleOpenAssign = (asset) => {
    setTargetAssetForAssign(asset);
    setAssignForm({
      employeeId: '',
      expectedReturnDate: '',
      conditionAtIssue: asset.condition || 'good',
      issueNotes: '',
    });
    setAssignModalOpen(true);
  };

  const handleConfirmAssign = async (e) => {
    e.preventDefault();
    if (!assignForm.employeeId) {
      alert('Please select an employee');
      return;
    }
    try {
      await api.post(`/assets/${targetAssetForAssign._id}/assign`, assignForm);
      setAssignModalOpen(false);
      fetchAssets();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign asset');
    }
  };

  const handleOpenReturn = (asset) => {
    setTargetAssetForReturn(asset);
    setReturnForm({
      conditionAtReturn: asset.condition || 'good',
      returnNotes: '',
      markUnderRepair: false,
    });
    setReturnModalOpen(true);
  };

  const handleConfirmReturn = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/assets/${targetAssetForReturn._id}/return`, returnForm);
      setReturnModalOpen(false);
      fetchAssets();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to return asset');
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await api.get('/assets/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'illusory_assets_register.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to export assets CSV');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/assets/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'asset_import_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to download template');
    }
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    const file = e.target.file?.files[0];
    if (!file) return;

    try {
      setImporting(true);
      const text = await file.text();
      const res = await api.post('/assets/import', { csv: text });
      if (res.success) {
        setImportResult(res.data);
        fetchAssets();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to process bulk import');
    } finally {
      setImporting(false);
    }
  };

  // ==========================================
  // TAB 3: MY ASSETS & REQUESTS
  // ==========================================
  const [myAssetsData, setMyAssetsData] = useState({ currentAssets: [], pastAssignments: [] });
  const [myRequests, setMyRequests] = useState([]);
  const [loadingMyAssets, setLoadingMyAssets] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ category: '', reason: '', neededBy: '' });
  const [reportIssueModalAsset, setReportIssueModalAsset] = useState(null);
  const [issueText, setIssueText] = useState('');

  const fetchMyAssets = useCallback(async () => {
    try {
      setLoadingMyAssets(true);
      const [assetsRes, reqRes] = await Promise.all([
        api.get('/assets/my'),
        api.get('/assets/requests'),
      ]);
      if (assetsRes.success) setMyAssetsData(assetsRes.data || { currentAssets: [], pastAssignments: [] });
      if (reqRes.success) setMyRequests(reqRes.data || []);
    } catch (err) {
      console.warn('Failed to load my assets', err);
    } finally {
      setLoadingMyAssets(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'my_assets') {
      fetchMyAssets();
    }
  }, [activeTab, fetchMyAssets]);

  const handleAcknowledge = async (assignmentId) => {
    try {
      await api.post(`/assets/assignments/${assignmentId}/acknowledge`);
      fetchMyAssets();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to acknowledge receipt');
    }
  };

  const handleSendRequest = async (e) => {
    e.preventDefault();
    try {
      await api.post('/assets/requests', requestForm);
      setRequestModalOpen(false);
      setRequestForm({ category: '', reason: '', neededBy: '' });
      fetchMyAssets();
      alert('Asset request submitted for manager approval');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit asset request');
    }
  };

  const handleReportIssue = async (e) => {
    e.preventDefault();
    if (!issueText.trim()) return;
    try {
      await api.post(`/assets/${reportIssueModalAsset._id}/report-issue`, { issue: issueText });
      setReportIssueModalAsset(null);
      setIssueText('');
      fetchMyAssets();
      alert('Issue reported. IT helpdesk has been notified.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to report issue');
    }
  };

  // ==========================================
  // TAB 4: REQUESTS & TO FULFIL (IT / HR)
  // ==========================================
  const [toFulfilRequests, setToFulfilRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [fulfilModalTarget, setFulfilModalTarget] = useState(null);
  const [availableCategoryAssets, setAvailableCategoryAssets] = useState([]);
  const [selectedAssetToFulfil, setSelectedAssetToFulfil] = useState('');

  const fetchToFulfil = useCallback(async () => {
    try {
      setLoadingRequests(true);
      const [fulfilRes, allRes] = await Promise.all([
        api.get('/assets/requests/to-fulfil'),
        api.get('/assets/requests'),
      ]);
      if (fulfilRes.success) setToFulfilRequests(fulfilRes.data || []);
      if (allRes.success) setAllRequests(allRes.data || []);
    } catch (err) {
      console.warn('Failed to load requests queue', err);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'to_fulfil') {
      fetchToFulfil();
    }
  }, [activeTab, fetchToFulfil]);

  const handleOpenFulfil = async (reqItem) => {
    setFulfilModalTarget(reqItem);
    setSelectedAssetToFulfil('');
    try {
      const res = await api.get(
        `/assets?category=${reqItem.category?._id || reqItem.category}&status=available`
      );
      if (res.success) {
        setAvailableCategoryAssets(res.data.assets || []);
      }
    } catch (err) {
      alert('Failed to load available assets for this category');
    }
  };

  const handleConfirmFulfil = async () => {
    if (!selectedAssetToFulfil) {
      alert('Please select an asset to assign');
      return;
    }
    try {
      await api.post(`/assets/requests/${fulfilModalTarget._id}/fulfil`, {
        assetId: selectedAssetToFulfil,
        conditionAtIssue: 'good',
        issueNotes: 'Fulfilled via Asset Request workflow',
      });
      setFulfilModalTarget(null);
      fetchToFulfil();
      alert('Asset assigned and request marked fulfilled!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to fulfil request');
    }
  };

  // ==========================================
  // TAB 5: MAINTENANCE TICKETS
  // ==========================================
  const [maintenanceTickets, setMaintenanceTickets] = useState([]);
  const [loadingMaintenance, setLoadingMaintenance] = useState(false);
  const [newMaintenanceModalOpen, setNewMaintenanceModalOpen] = useState(false);
  const [newMaintenanceForm, setNewMaintenanceForm] = useState({
    assetId: '',
    type: 'repair',
    issue: '',
    vendor: '',
    costINR: '',
    notes: '',
  });

  const fetchMaintenance = useCallback(async () => {
    try {
      setLoadingMaintenance(true);
      const res = await api.get('/assets/maintenance');
      if (res.success) setMaintenanceTickets(res.data || []);
    } catch (err) {
      console.warn('Failed to load maintenance records', err);
    } finally {
      setLoadingMaintenance(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'maintenance') {
      fetchMaintenance();
    }
  }, [activeTab, fetchMaintenance]);

  const handleCreateMaintenance = async (e) => {
    e.preventDefault();
    try {
      await api.post('/assets/maintenance', {
        assetId: newMaintenanceForm.assetId,
        type: newMaintenanceForm.type,
        issue: newMaintenanceForm.issue,
        vendor: newMaintenanceForm.vendor,
        cost: newMaintenanceForm.costINR ? Math.round(Number(newMaintenanceForm.costINR) * 100) : 0,
        notes: newMaintenanceForm.notes,
      });
      setNewMaintenanceModalOpen(false);
      fetchMaintenance();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to log maintenance record');
    }
  };

  const handleCompleteMaintenance = async (ticketId) => {
    try {
      await api.put(`/assets/maintenance/${ticketId}`, { status: 'completed' });
      fetchMaintenance();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to complete maintenance ticket');
    }
  };

  // ==========================================
  // TAB 6: SOFTWARE LICENSES
  // ==========================================
  const [licenses, setLicenses] = useState([]);
  const [licenseSummary, setLicenseSummary] = useState(null);
  const [loadingLicenses, setLoadingLicenses] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState({});
  const [revealingId, setRevealingId] = useState(null);
  const [addLicenseModalOpen, setAddLicenseModalOpen] = useState(false);
  const [assignSeatTarget, setAssignSeatTarget] = useState(null);
  const [selectedSeatEmpId, setSelectedSeatEmpId] = useState('');

  const [licenseForm, setLicenseForm] = useState({
    name: '',
    vendor: '',
    licenseType: 'subscription',
    totalSeats: 5,
    licenseKey: '',
    renewalDate: '',
    costINR: '',
    billingCycle: 'yearly',
    notes: '',
  });

  const fetchLicenses = useCallback(async () => {
    try {
      setLoadingLicenses(true);
      const [licRes, sumRes] = await Promise.all([
        api.get('/assets/licenses'),
        api.get('/assets/licenses/summary'),
      ]);
      if (licRes.success) setLicenses(licRes.data || []);
      if (sumRes.success) setLicenseSummary(sumRes.data || null);
    } catch (err) {
      console.warn('Failed to load software licenses', err);
    } finally {
      setLoadingLicenses(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'licenses') {
      fetchLicenses();
    }
  }, [activeTab, fetchLicenses]);

  const handleRevealKey = async (licId) => {
    if (!hasPermission('asset.viewSecrets')) {
      alert('Access Denied: You do not have permission to reveal license secrets.');
      return;
    }
    try {
      setRevealingId(licId);
      const res = await api.post(`/assets/licenses/${licId}/reveal-key`);
      if (res.success && res.data) {
        setRevealedKeys((prev) => ({ ...prev, [licId]: res.data.key }));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to decrypt license key');
    } finally {
      setRevealingId(null);
    }
  };

  const handleSaveLicense = async (e) => {
    e.preventDefault();
    try {
      await api.post('/assets/licenses', {
        name: licenseForm.name,
        vendor: licenseForm.vendor,
        licenseType: licenseForm.licenseType,
        totalSeats: Number(licenseForm.totalSeats),
        licenseKey: licenseForm.licenseKey,
        renewalDate: licenseForm.renewalDate,
        cost: licenseForm.costINR ? Math.round(Number(licenseForm.costINR) * 100) : 0,
        billingCycle: licenseForm.billingCycle,
        notes: licenseForm.notes,
      });
      setAddLicenseModalOpen(false);
      fetchLicenses();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create license');
    }
  };

  const handleAssignSeat = async () => {
    if (!selectedSeatEmpId) return;
    try {
      await api.post(`/assets/licenses/${assignSeatTarget._id}/assign`, {
        employeeId: selectedSeatEmpId,
      });
      setAssignSeatTarget(null);
      setSelectedSeatEmpId('');
      fetchLicenses();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to allocate seat');
    }
  };

  const handleRevokeSeat = async (licId, empId) => {
    if (!window.confirm('Revoke this employee\'s license allocation?')) return;
    try {
      await api.delete(`/assets/licenses/${licId}/assign/${empId}`);
      fetchLicenses();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to revoke seat');
    }
  };

  const canManageAssets = hasPermission(['asset.create', 'asset.assign', 'asset.maintain']);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <PageHeader
        title="Assets & Equipment Management"
        subtitle="Studio hardware registry, employee assignments, software licenses, maintenance & exit clearance"
        breadcrumbs={[{ label: 'Assets' }]}
        actions={
          activeTab === 'register' && canManageAssets ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={Upload}
                onClick={() => {
                  setImportResult(null);
                  setImportModalOpen(true);
                }}
              >
                Bulk Import
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={handleOpenAddAsset}
              >
                Add Asset
              </Button>
            </div>
          ) : activeTab === 'my_assets' ? (
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setRequestModalOpen(true)}
            >
              Request Equipment
            </Button>
          ) : activeTab === 'licenses' && hasPermission('license.manage') ? (
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setAddLicenseModalOpen(true)}
            >
              Add License
            </Button>
          ) : null
        }
      />

      {/* Tabs Navigation */}
      <div className="flex items-center space-x-1 border-b border-slate-200 dark:border-slate-700 overflow-x-auto scrollbar-none">
        {canManageAssets && (
          <button
            onClick={() => handleTabChange('overview')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            Overview
          </button>
        )}

        <button
          onClick={() => handleTabChange('register')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'register'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <Box className="w-4 h-4" />
          Asset Register
        </button>

        <button
          onClick={() => handleTabChange('my_assets')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'my_assets'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <User className="w-4 h-4" />
          My Assets
          {myAssetsData.currentAssets.some((a) => !a.acknowledgement?.accepted) && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse ml-0.5" />
          )}
        </button>

        {hasPermission(['asset.assign', 'asset.approveRequest']) && (
          <button
            onClick={() => handleTabChange('to_fulfil')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'to_fulfil'
                ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Requests &amp; Fulfil
            {toFulfilRequests.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white ml-1">
                {toFulfilRequests.length}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => handleTabChange('maintenance')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'maintenance'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <Wrench className="w-4 h-4" />
          Maintenance Log
        </button>

        {hasPermission('license.read') && (
          <button
            onClick={() => handleTabChange('licenses')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'licenses'
                ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Key className="w-4 h-4" />
            Software Licenses
          </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* TAB 1: OVERVIEW                                           */}
      {/* ========================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Alerts Banner */}
          {summary && (summary.expiringWarranties > 0 || summary.expiringLicenses > 0) && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  Equipment &amp; Subscription Expiry Notice (Within 30 Days)
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  {summary.expiringWarranties} hardware warranties and {summary.expiringLicenses} software license subscriptions are expiring within the next 30 days.
                </p>
              </div>
            </div>
          )}

          {/* KPI Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Assets</span>
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 block">
                {summary?.total || 0}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned</span>
              <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1 block">
                {summary?.assigned || 0}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Available</span>
              <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block">
                {summary?.available || 0}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Under Repair</span>
              <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 block">
                {summary?.underRepair || 0}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Expiring Soon</span>
              <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1 block">
                {(summary?.expiringWarranties || 0) + (summary?.expiringLicenses || 0)}
              </span>
            </div>

            {hasPermission('asset.viewCost') && summary?.totalCostPaise !== null && (
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Inventory Value</span>
                <span className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400 mt-1 block truncate">
                  {formatINR(summary?.totalCostPaise || 0)}
                </span>
              </div>
            )}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Category */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-4">
                Hardware Inventory by Category
              </h3>
              <div className="h-60 w-full text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={summary?.categoryCounts || []}
                    margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                  >
                    <XAxis
                      dataKey="categoryName"
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      interval={0}
                    />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                    />
                    <Bar dataKey="count" name="Assets" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* By Status */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-4">
                Assets Distribution by Status
              </h3>
              <div className="h-60 w-full flex items-center justify-center text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Available', value: summary?.available || 0 },
                        { name: 'Assigned', value: summary?.assigned || 0 },
                        { name: 'Under Repair', value: summary?.underRepair || 0 },
                        { name: 'Lost / Retired', value: (summary?.lost || 0) + (summary?.retired || 0) },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                    >
                      {COLORS.map((col, idx) => (
                        <Cell key={`cell-${idx}`} fill={col} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: ASSET REGISTER                                     */}
      {/* ========================================================= */}
      {activeTab === 'register' && (
        <div className="space-y-4">
          {/* Search & Filter Controls */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by tag, serial, model, brand..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
              </div>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 capitalize"
              >
                <option value="">All Statuses</option>
                {['available', 'assigned', 'under_repair', 'lost', 'retired'].map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium cursor-pointer ml-1">
                <input
                  type="checkbox"
                  checked={filterWarrantyExpiring}
                  onChange={(e) => setFilterWarrantyExpiring(e.target.checked)}
                  className="rounded text-brand-600"
                />
                Warranty Expiring &lt;30d
              </label>
            </div>

            {hasPermission('asset.export') && (
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1 hover:bg-slate-50"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" /> Export CSV
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="px-5 py-3">Tag &amp; Name</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Condition</th>
                    <th className="px-5 py-3">Current Assignee</th>
                    <th className="px-5 py-3">Warranty</th>
                    {hasPermission('asset.viewCost') && <th className="px-5 py-3">Cost</th>}
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {loadingAssets ? (
                    <tr>
                      <td colSpan="8" className="py-12 text-center text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                        Loading assets register...
                      </td>
                    </tr>
                  ) : assets.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-slate-400">
                        No equipment found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    assets.map((ast) => (
                      <tr
                        key={ast._id}
                        onClick={() => navigate(`/assets/${ast._id}`)}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-700/20 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <span className="font-mono font-bold text-slate-900 dark:text-white mr-2 block">
                            {ast.assetTag}
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {ast.name}
                          </span>
                          <span className="text-[11px] text-slate-400 block">
                            {ast.brand} {ast.model} {ast.serialNumber ? `• ${ast.serialNumber}` : ''}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-600 dark:text-slate-300">
                          {ast.category?.name || 'Device'}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              ast.status === 'available'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : ast.status === 'assigned'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                  : ast.status === 'under_repair'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            }`}
                          >
                            {ast.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 capitalize font-medium text-slate-600 dark:text-slate-300">
                          {ast.condition || 'new'}
                        </td>
                        <td className="px-5 py-3.5">
                          {ast.currentAssignee ? (
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {ast.currentAssignee.personal?.firstName}{' '}
                              {ast.currentAssignee.personal?.lastName}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">In Stock</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                          {ast.warrantyExpiry
                            ? new Date(ast.warrantyExpiry).toLocaleDateString('en-IN')
                            : '—'}
                        </td>
                        {hasPermission('asset.viewCost') && (
                          <td className="px-5 py-3.5 font-bold font-mono text-slate-800 dark:text-slate-200">
                            {ast.purchaseCost !== undefined ? formatINR(ast.purchaseCost) : '—'}
                          </td>
                        )}
                        <td
                          className="px-5 py-3.5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            {ast.status === 'available' && hasPermission('asset.assign') && (
                              <button
                                onClick={() => handleOpenAssign(ast)}
                                className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 rounded-lg font-bold text-[11px]"
                              >
                                Assign
                              </button>
                            )}

                            {ast.status === 'assigned' && hasPermission('asset.return') && (
                              <button
                                onClick={() => handleOpenReturn(ast)}
                                className="px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 rounded-lg font-bold text-[11px]"
                              >
                                Return
                              </button>
                            )}

                            <button
                              onClick={() => setQrModalAsset(ast)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                              title="QR Sticker"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: MY ASSETS                                          */}
      {/* ========================================================= */}
      {activeTab === 'my_assets' && (
        <div className="space-y-6">
          {/* Active Custody Hardware */}
          <div className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Box className="w-5 h-5 text-brand-600" />
              Equipment Currently in My Possession ({myAssetsData.currentAssets.length})
            </h2>

            {loadingMyAssets ? (
              <div className="py-12 text-center text-slate-400">Loading your devices...</div>
            ) : myAssetsData.currentAssets.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 text-xs">
                You currently have no hardware equipment checked out to you.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myAssetsData.currentAssets.map((asg) => (
                  <div
                    key={asg._id}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-3"
                  >
                    {/* Unacknowledged Notice */}
                    {!asg.acknowledgement?.accepted && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          Please acknowledge physical receipt of this device.
                        </span>
                        <button
                          onClick={() => handleAcknowledge(asg._id)}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                        >
                          Accept Receipt
                        </button>
                      </div>
                    )}

                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 mr-2">
                          {asg.asset?.assetTag}
                        </span>
                        <span className="text-xs text-slate-400">
                          {asg.asset?.category?.name || 'Device'}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                          {asg.asset?.name}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {asg.asset?.brand} {asg.asset?.model}{' '}
                          {asg.asset?.serialNumber ? `• Serial: ${asg.asset.serialNumber}` : ''}
                        </p>
                      </div>

                      {asg.acknowledgement?.accepted && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Acknowledged
                        </span>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                      <span className="text-slate-400">
                        Assigned on {new Date(asg.assignedAt).toLocaleDateString('en-IN')}
                      </span>
                      <button
                        onClick={() => setReportIssueModalAsset(asg.asset)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1"
                      >
                        <Wrench className="w-3 h-3 text-amber-500" /> Report Issue
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My Requests List */}
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-indigo-600" />
              My Equipment Requests ({myRequests.length})
            </h2>

            {myRequests.length === 0 ? (
              <p className="text-xs text-slate-400 italic">You have no equipment requests pending.</p>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700 text-xs">
                {myRequests.map((req) => (
                  <div key={req._id} className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {req.category?.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            req.status === 'approved'
                              ? 'bg-blue-100 text-blue-800'
                              : req.status === 'fulfilled'
                                ? 'bg-emerald-100 text-emerald-800'
                                : req.status === 'rejected'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>
                      <p className="text-slate-500 mt-0.5">Reason: "{req.reason}"</p>
                    </div>

                    <span className="text-slate-400 text-[11px]">
                      Requested on {new Date(req.createdAt).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: REQUESTS & TO FULFIL (IT / HR)                      */}
      {/* ========================================================= */}
      {activeTab === 'to_fulfil' && (
        <div className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Approved Requests Ready for Device Allocation ({toFulfilRequests.length})
            </h2>

            {toFulfilRequests.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 text-xs">
                All approved requests have been fulfilled!
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700 text-xs">
                {toFulfilRequests.map((req) => (
                  <div key={req._id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {req.employee?.personal?.firstName} {req.employee?.personal?.lastName}
                        </span>
                        <span className="text-slate-400">({req.employee?.employment?.designation})</span>
                        <span className="px-2 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 font-semibold">
                          Requested: {req.category?.name}
                        </span>
                      </div>
                      <p className="text-slate-500 italic">"{req.reason}"</p>
                    </div>

                    <button
                      onClick={() => handleOpenFulfil(req)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                    >
                      <Box className="w-3.5 h-3.5" /> Allocate &amp; Fulfil
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: MAINTENANCE LOG                                    */}
      {/* ========================================================= */}
      {activeTab === 'maintenance' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-600" />
              Service Tickets &amp; Repairs
            </h2>

            {canManageAssets && (
              <button
                onClick={() => {
                  setNewMaintenanceForm({
                    assetId: assets[0]?._id || '',
                    type: 'repair',
                    issue: '',
                    vendor: '',
                    costINR: '',
                    notes: '',
                  });
                  setNewMaintenanceModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Log Maintenance Ticket
              </button>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="px-5 py-3">Asset</th>
                    <th className="px-5 py-3">Issue Reported</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Reported By</th>
                    <th className="px-5 py-3">Status</th>
                    {hasPermission('asset.viewCost') && <th className="px-5 py-3">Cost</th>}
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {maintenanceTickets.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-slate-400">
                        No maintenance tickets on record.
                      </td>
                    </tr>
                  ) : (
                    maintenanceTickets.map((t) => (
                      <tr key={t._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20">
                        <td className="px-5 py-3 font-semibold text-slate-900 dark:text-white">
                          <span className="font-mono font-bold mr-1">{t.asset?.assetTag}</span>
                          {t.asset?.name}
                        </td>
                        <td className="px-5 py-3 text-slate-700 dark:text-slate-300 font-medium">
                          {t.issue}
                        </td>
                        <td className="px-5 py-3 capitalize text-slate-500">{t.type}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                          {t.reportedBy?.personal?.firstName} {t.reportedBy?.personal?.lastName}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              t.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : t.status === 'in_progress'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {t.status.replace('_', ' ')}
                          </span>
                        </td>
                        {hasPermission('asset.viewCost') && (
                          <td className="px-5 py-3 font-mono font-bold">
                            {t.cost !== undefined ? formatINR(t.cost) : '—'}
                          </td>
                        )}
                        <td className="px-5 py-3 text-right">
                          {t.status !== 'completed' && canManageAssets && (
                            <button
                              onClick={() => handleCompleteMaintenance(t._id)}
                              className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-[11px]"
                            >
                              Mark Completed
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 6: SOFTWARE LICENSES                                  */}
      {/* ========================================================= */}
      {activeTab === 'licenses' && (
        <div className="space-y-6">
          {/* Licenses KPI */}
          {licenseSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Licenses</span>
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 block">
                  {licenseSummary.totalLicenses}
                </span>
              </div>

              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Seats</span>
                <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1 block">
                  {licenseSummary.totalSeats}
                </span>
              </div>

              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Used Seats</span>
                <span className="text-2xl font-extrabold text-brand-600 dark:text-brand-400 mt-1 block">
                  {licenseSummary.usedSeats}
                </span>
              </div>

              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Renewals This Month</span>
                <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1 block">
                  {licenseSummary.renewalsThisMonth}
                </span>
              </div>
            </div>
          )}

          {/* Licenses Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {licenses.map((lic) => {
              const used = lic.usedSeats || 0;
              const total = lic.totalSeats || 1;
              const ratio = Math.round((used / total) * 100);
              const isRevealed = Boolean(revealedKeys[lic._id]);

              return (
                <div
                  key={lic._id}
                  className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-4 text-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-[10px] uppercase">
                        {lic.vendor}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                        {lic.name}
                      </h3>
                      <p className="text-slate-400 capitalize">{lic.licenseType.replace('_', ' ')}</p>
                    </div>

                    <span className="font-semibold text-slate-500">
                      Renews:{' '}
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {new Date(lic.renewalDate).toLocaleDateString('en-IN')}
                      </span>
                    </span>
                  </div>

                  {/* Seat Usage Bar */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-slate-400 font-semibold">Seat Allocation</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {used} / {total} seats ({ratio}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          ratio >= 100 ? 'bg-rose-500' : ratio >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, ratio)}%` }}
                      />
                    </div>
                  </div>

                  {/* License Key Mask & Reveal */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        License Key
                      </span>
                      <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {isRevealed ? revealedKeys[lic._id] : '••••••••••••••••••••••••'}
                      </span>
                    </div>

                    {hasPermission('asset.viewSecrets') && (
                      <button
                        onClick={() => handleRevealKey(lic._id)}
                        disabled={revealingId === lic._id}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1"
                      >
                        {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {isRevealed ? 'Hide' : 'Reveal'}
                      </button>
                    )}
                  </div>

                  {/* Allocated Employees Tags */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-400 font-semibold">Assigned Users</span>
                      {hasPermission('license.manage') && used < total && (
                        <button
                          onClick={() => {
                            setAssignSeatTarget(lic);
                            setSelectedSeatEmpId('');
                          }}
                          className="text-[11px] font-bold text-brand-600 hover:underline"
                        >
                          + Assign Seat
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {(lic.assignedTo || []).length === 0 ? (
                        <span className="text-slate-400 italic">No seats assigned yet</span>
                      ) : (
                        lic.assignedTo.map((asg) => (
                          <span
                            key={asg.employee?._id || asg.employee}
                            className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 font-medium flex items-center gap-1.5"
                          >
                            <span>
                              {asg.employee?.personal?.firstName} {asg.employee?.personal?.lastName}
                            </span>
                            {hasPermission('license.manage') && (
                              <button
                                onClick={() =>
                                  handleRevokeSeat(lic._id, asg.employee?._id || asg.employee)
                                }
                                className="text-indigo-400 hover:text-rose-600"
                                title="Revoke seat"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Add / Edit Asset                                   */}
      {/* ========================================================= */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setAddModalOpen(false)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Box className="w-5 h-5 text-brand-600" />
                Register New Equipment
              </h3>
              <button
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAsset} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Asset Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MacBook Pro 16 M3 Max"
                    value={assetForm.name}
                    onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={assetForm.category}
                    onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Brand
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Apple, Dell, Sony"
                    value={assetForm.brand}
                    onChange={(e) => setAssetForm({ ...assetForm, brand: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Model
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. A2991"
                    value={assetForm.model}
                    onChange={(e) => setAssetForm({ ...assetForm, model: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. C02F1234MD6R"
                    value={assetForm.serialNumber}
                    onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                  />
                </div>
              </div>

              {/* Dynamic Category Custom Fields */}
              {selectedCategoryObj?.customFields && selectedCategoryObj.customFields.length > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 space-y-2">
                  <p className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[10px]">
                    {selectedCategoryObj.name} Specifications
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedCategoryObj.customFields.map((field) => (
                      <div key={field.label}>
                        <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          {field.label}
                        </label>
                        <input
                          type={field.type === 'number' ? 'number' : 'text'}
                          value={assetForm.customValues[field.label] || ''}
                          onChange={(e) =>
                            setAssetForm({
                              ...assetForm,
                              customValues: {
                                ...assetForm.customValues,
                                [field.label]: e.target.value,
                              },
                            })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    value={assetForm.purchaseDate}
                    onChange={(e) => setAssetForm({ ...assetForm, purchaseDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Warranty Expiry
                  </label>
                  <input
                    type="date"
                    value={assetForm.warrantyExpiry}
                    onChange={(e) => setAssetForm({ ...assetForm, warrantyExpiry: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>

                {hasPermission('asset.viewCost') && (
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Purchase Cost (INR)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 185000"
                      value={assetForm.purchaseCostINR}
                      onChange={(e) =>
                        setAssetForm({ ...assetForm, purchaseCostINR: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Condition
                  </label>
                  <select
                    value={assetForm.condition}
                    onChange={(e) => setAssetForm({ ...assetForm, condition: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 capitalize"
                  >
                    {['new', 'good', 'fair', 'poor'].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={assetForm.location}
                    onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <textarea
                  rows="2"
                  value={assetForm.notes}
                  onChange={(e) => setAssetForm({ ...assetForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-xs"
                >
                  Save Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Assign Asset Dialog                                */}
      {/* ========================================================= */}
      {assignModalOpen && targetAssetForAssign && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setAssignModalOpen(false)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <User className="w-5 h-5 text-brand-600" />
              Assign Equipment: {targetAssetForAssign.assetTag}
            </h3>
            <p className="text-xs text-slate-500">
              {targetAssetForAssign.name} ({targetAssetForAssign.brand} {targetAssetForAssign.model})
            </p>

            <form onSubmit={handleConfirmAssign} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assign To Employee *
                </label>
                <select
                  required
                  value={assignForm.employeeId}
                  onChange={(e) => setAssignForm({ ...assignForm, employeeId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.personal?.firstName} {emp.personal?.lastName} ({emp.employeeId} - {emp.employment?.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Condition at Issue
                </label>
                <select
                  value={assignForm.conditionAtIssue}
                  onChange={(e) =>
                    setAssignForm({ ...assignForm, conditionAtIssue: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 capitalize"
                >
                  {['new', 'good', 'fair', 'poor'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Expected Return Date (Optional)
                </label>
                <input
                  type="date"
                  value={assignForm.expectedReturnDate}
                  onChange={(e) =>
                    setAssignForm({ ...assignForm, expectedReturnDate: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Handover Notes
                </label>
                <textarea
                  rows="2"
                  placeholder="e.g. Handed over with 140W USB-C charger and case..."
                  value={assignForm.issueNotes}
                  onChange={(e) => setAssignForm({ ...assignForm, issueNotes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Return Asset Dialog                                */}
      {/* ========================================================= */}
      {returnModalOpen && targetAssetForReturn && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setReturnModalOpen(false)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-brand-600" />
              Return Asset to Studio: {targetAssetForReturn.assetTag}
            </h3>

            <form onSubmit={handleConfirmReturn} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Condition at Return
                </label>
                <select
                  value={returnForm.conditionAtReturn}
                  onChange={(e) =>
                    setReturnForm({ ...returnForm, conditionAtReturn: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 capitalize"
                >
                  {['new', 'good', 'fair', 'poor'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Return / Inspection Notes
                </label>
                <textarea
                  rows="2"
                  placeholder="e.g. Device returned in clean condition, charger included..."
                  value={returnForm.returnNotes}
                  onChange={(e) => setReturnForm({ ...returnForm, returnNotes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 resize-none"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={returnForm.markUnderRepair}
                  onChange={(e) =>
                    setReturnForm({ ...returnForm, markUnderRepair: e.target.checked })
                  }
                  className="rounded text-brand-600"
                />
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Mark as "Under Repair" (Needs servicing/maintenance)
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReturnModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold"
                >
                  Confirm Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: QR Code Preview & Print                            */}
      {/* ========================================================= */}
      {qrModalAsset && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setQrModalAsset(null)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 text-center space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                Asset Physical Tag
              </span>
              <button
                onClick={() => setQrModalAsset(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl bg-white text-slate-900 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Illusory Design Studios
              </p>
              <img
                src={`/api/v1/assets/${qrModalAsset._id}/qr`}
                alt={qrModalAsset.assetTag}
                className="w-44 h-44 mx-auto"
              />
              <p className="font-mono text-base font-extrabold tracking-wider">
                {qrModalAsset.assetTag}
              </p>
              <p className="text-xs font-semibold text-slate-700">{qrModalAsset.name}</p>
            </div>

            <button
              onClick={() => window.print()}
              className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs"
            >
              <Printer className="w-4 h-4" /> Print Label
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Bulk CSV Import                                    */}
      {/* ========================================================= */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setImportModalOpen(false)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-brand-600" />
                Bulk Import Assets (CSV)
              </h3>
              <button
                onClick={() => setImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  Standard Template Format
                </p>
                <p className="text-[11px] text-slate-500">
                  Download the sample CSV formatted with valid headers.
                </p>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-brand-600 text-xs flex items-center gap-1 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" /> Sample CSV
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select CSV File *
                </label>
                <input
                  type="file"
                  name="file"
                  accept=".csv"
                  required
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                />
              </div>

              {importResult && (
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    Successfully imported {importResult.successful?.length || 0} assets.
                  </div>

                  {importResult.errors?.length > 0 && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 space-y-1">
                      <p className="font-bold">
                        {importResult.errors.length} rows encountered validation errors:
                      </p>
                      <div className="max-h-32 overflow-y-auto space-y-0.5 text-[11px]">
                        {importResult.errors.map((err, idx) => (
                          <p key={idx}>
                            • Row {err.row}: {err.error}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={importing}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold flex items-center gap-1.5 shadow-xs"
                >
                  {importing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Upload &amp; Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Employee Asset Request                             */}
      {/* ========================================================= */}
      {requestModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setRequestModalOpen(false)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-brand-600" />
              Request Hardware Equipment
            </h3>

            <form onSubmit={handleSendRequest} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category *
                </label>
                <select
                  required
                  value={requestForm.category}
                  onChange={(e) => setRequestForm({ ...requestForm, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="">Select Equipment Category</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Business Reason &amp; Deliverables *
                </label>
                <textarea
                  required
                  rows="3"
                  placeholder="e.g. Needed for 4K video rendering and mobile UI prototyping for client PRJ-2026-001..."
                  value={requestForm.reason}
                  onChange={(e) => setRequestForm({ ...requestForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 resize-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Needed By Date
                </label>
                <input
                  type="date"
                  value={requestForm.neededBy}
                  onChange={(e) => setRequestForm({ ...requestForm, neededBy: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRequestModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-xs"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Report Issue on My Asset                           */}
      {/* ========================================================= */}
      {reportIssueModalAsset && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setReportIssueModalAsset(null)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-600" />
              Report Issue on {reportIssueModalAsset.assetTag}
            </h3>
            <p className="text-xs text-slate-500">
              {reportIssueModalAsset.name} ({reportIssueModalAsset.brand} {reportIssueModalAsset.model})
            </p>

            <form onSubmit={handleReportIssue} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Describe Problem *
                </label>
                <textarea
                  required
                  rows="3"
                  placeholder="e.g. Keyboard spacebar sticking, battery draining in under 1 hour..."
                  value={issueText}
                  onChange={(e) => setIssueText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReportIssueModalAsset(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  Send to IT Helpdesk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Allocate & Fulfil Asset Request                    */}
      {/* ========================================================= */}
      {fulfilModalTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setFulfilModalTarget(null)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Box className="w-5 h-5 text-emerald-600" />
              Fulfil Request: {fulfilModalTarget.category?.name}
            </h3>
            <p className="text-slate-500">
              For: {fulfilModalTarget.employee?.personal?.firstName}{' '}
              {fulfilModalTarget.employee?.personal?.lastName} (
              {fulfilModalTarget.employee?.employeeId})
            </p>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Available Asset in Stock *
                </label>
                {availableCategoryAssets.length === 0 ? (
                  <p className="text-rose-600 italic">
                    No available assets in category "{fulfilModalTarget.category?.name}". Please
                    register or return an asset first.
                  </p>
                ) : (
                  <select
                    value={selectedAssetToFulfil}
                    onChange={(e) => setSelectedAssetToFulfil(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <option value="">Select Device to Assign</option>
                    {availableCategoryAssets.map((ast) => (
                      <option key={ast._id} value={ast._id}>
                        {ast.assetTag} - {ast.name} ({ast.brand} {ast.model})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFulfilModalTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmFulfil}
                  disabled={!selectedAssetToFulfil}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50"
                >
                  Confirm Allocation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Allocate License Seat                              */}
      {/* ========================================================= */}
      {assignSeatTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setAssignSeatTarget(null)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Assign Seat: {assignSeatTarget.name}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Employee *
                </label>
                <select
                  value={selectedSeatEmpId}
                  onChange={(e) => setSelectedSeatEmpId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.personal?.firstName} {emp.personal?.lastName} ({emp.employeeId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignSeatTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignSeat}
                  disabled={!selectedSeatEmpId}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-50"
                >
                  Confirm Seat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Add Software License                               */}
      {/* ========================================================= */}
      {addLicenseModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setAddLicenseModalOpen(false)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 z-10 space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-brand-600" />
              Add Software Subscription / License
            </h3>

            <form onSubmit={handleSaveLicense} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Software Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Figma Enterprise"
                  value={licenseForm.name}
                  onChange={(e) => setLicenseForm({ ...licenseForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Vendor *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Figma, Adobe"
                    value={licenseForm.vendor}
                    onChange={(e) => setLicenseForm({ ...licenseForm, vendor: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Total Seats *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={licenseForm.totalSeats}
                    onChange={(e) => setLicenseForm({ ...licenseForm, totalSeats: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  License Key / Activation Token (Encrypted at rest)
                </label>
                <input
                  type="text"
                  placeholder="e.g. FIGMA-ENT-9876-XXXX-YYYY"
                  value={licenseForm.licenseKey}
                  onChange={(e) => setLicenseForm({ ...licenseForm, licenseKey: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Renewal Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={licenseForm.renewalDate}
                    onChange={(e) =>
                      setLicenseForm({ ...licenseForm, renewalDate: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>

                {hasPermission('asset.viewCost') && (
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Annual Cost (INR)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 120000"
                      value={licenseForm.costINR}
                      onChange={(e) => setLicenseForm({ ...licenseForm, costINR: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddLicenseModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold"
                >
                  Save License
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Assets;
