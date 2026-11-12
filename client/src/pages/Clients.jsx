import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  Search,
  Plus,
  Mail,
  Phone,
  Briefcase,
  Edit2,
  Trash2,
  X,
  ExternalLink,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  FileText,
  MapPin,
} from 'lucide-react';

export const Clients = () => {
  const { hasPermission } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientProjects, setClientProjects] = useState([]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    gstNumber: '',
    industry: '',
    status: 'active',
    notes: '',
  });

  const canCreate = hasPermission('client.create');
  const canUpdate = hasPermission('client.update');
  const canDelete = hasPermission('client.delete');

  const fetchClients = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/clients', { params });
      if (res.success) {
        setClients(res.data.clients || []);
      }
    } catch (err) {
      console.error('Failed to load clients', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchClients();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  const openClientDetail = async (client) => {
    try {
      const res = await api.get(`/clients/${client._id}`);
      if (res.success) {
        setSelectedClient(res.data.client);
        setClientProjects(res.data.projects || []);
        setIsDetailOpen(true);
      }
    } catch (err) {
      console.error('Failed to fetch client detail', err);
    }
  };

  const openCreateModal = () => {
    setEditingClient(null);
    setFormData({
      name: '',
      companyName: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      gstNumber: '',
      industry: '',
      status: 'active',
      notes: '',
    });
    setIsFormOpen(true);
  };

  const openEditModal = (client) => {
    setEditingClient(client);
    setFormData({
      name: client.name || '',
      companyName: client.companyName || '',
      contactPerson: client.contactPerson || '',
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      gstNumber: client.gstNumber || '',
      industry: client.industry || '',
      status: client.status || 'active',
      notes: client.notes || '',
    });
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      if (editingClient) {
        const res = await api.put(`/clients/${editingClient._id}`, formData);
        if (res.success) {
          setIsFormOpen(false);
          fetchClients();
          if (selectedClient?._id === editingClient._id) {
            setSelectedClient(res.data);
          }
        }
      } else {
        const res = await api.post('/clients', formData);
        if (res.success) {
          setIsFormOpen(false);
          fetchClients();
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving client');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteClient = async (client) => {
    if (!window.confirm(`Are you sure you want to remove ${client.name}?`)) return;
    try {
      const res = await api.delete(`/clients/${client._id}`);
      if (res.success) {
        if (selectedClient?._id === client._id) {
          setIsDetailOpen(false);
        }
        fetchClients();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete client');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-brand-600" />
            Client Directory
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Agency client accounts, contracted projects, industry verticals, and accounts
          </p>
        </div>

        {canCreate && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Add New Client
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by client, company, email, contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {['', 'active', 'inactive'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {st === '' ? 'All Clients' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600 mb-2" />
            <p className="text-sm">Loading clients...</p>
          </div>
        ) : clients.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-base font-semibold text-slate-700 dark:text-slate-300">No clients found</p>
            <p className="text-sm mt-1">Get started by creating your first agency client account.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/75 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Client / Organization</th>
                  <th className="py-3.5 px-4">Contact Person</th>
                  <th className="py-3.5 px-4">Contact Info</th>
                  <th className="py-3.5 px-4">Industry & GST</th>
                  <th className="py-3.5 px-4 text-center">Projects</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {clients.map((c) => (
                  <tr
                    key={c._id}
                    onClick={() => openClientDetail(c)}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors cursor-pointer group"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500/10 to-indigo-500/20 text-brand-600 flex items-center justify-center font-bold text-sm flex-shrink-0 border border-brand-500/20">
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors">
                            {c.name}
                          </div>
                          {c.companyName && (
                            <div className="text-xs text-slate-400 truncate max-w-xs">{c.companyName}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-medium">
                      {c.contactPerson || '—'}
                    </td>

                    <td className="py-4 px-4 space-y-1">
                      {c.email && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate max-w-[180px]">{c.email}</span>
                        </div>
                      )}
                      {c.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{c.phone}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {c.industry || 'General Client'}
                      </div>
                      {c.gstNumber && (
                        <div className="text-[11px] font-mono text-slate-400 uppercase">GST: {c.gstNumber}</div>
                      )}
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                        <Briefcase className="w-3 h-3" />
                        {c.projectStats?.active || 0} active / {c.projectStats?.total || 0}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                          c.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${c.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}
                        />
                        {c.status}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {canUpdate && (
                          <button
                            onClick={() => openEditModal(c)}
                            className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Edit Client"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteClient(c)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                            title="Delete Client"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Client Detail Drawer */}
      {isDetailOpen && selectedClient && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsDetailOpen(false)}
          />
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-800 h-full shadow-2xl flex flex-col z-10 border-l border-slate-200 dark:border-slate-700">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-brand-500/20">
                  {selectedClient.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                    {selectedClient.name}
                  </h3>
                  <p className="text-xs text-slate-500">{selectedClient.companyName || selectedClient.industry}</p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Status and Summary Pill */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] font-semibold uppercase text-slate-400">Status</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 capitalize mt-0.5">
                    {selectedClient.status}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] font-semibold uppercase text-slate-400">Total Projects</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {clientProjects.length} contracted
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Contact Information
                </h4>
                <div className="space-y-2 text-sm">
                  {selectedClient.contactPerson && (
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-700/50">
                      <span className="text-slate-500">Contact Person</span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {selectedClient.contactPerson}
                      </span>
                    </div>
                  )}
                  {selectedClient.email && (
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-700/50">
                      <span className="text-slate-500">Email</span>
                      <a href={`mailto:${selectedClient.email}`} className="text-brand-600 hover:underline">
                        {selectedClient.email}
                      </a>
                    </div>
                  )}
                  {selectedClient.phone && (
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-700/50">
                      <span className="text-slate-500">Phone</span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {selectedClient.phone}
                      </span>
                    </div>
                  )}
                  {selectedClient.gstNumber && (
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-700/50">
                      <span className="text-slate-500">GSTIN</span>
                      <span className="font-mono text-xs uppercase font-semibold text-slate-800 dark:text-slate-200">
                        {selectedClient.gstNumber}
                      </span>
                    </div>
                  )}
                  {selectedClient.address && (
                    <div className="py-1">
                      <span className="text-slate-500 block mb-1">Address</span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                        {selectedClient.address}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {selectedClient.notes && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Account Notes</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 p-3 rounded-xl">
                    {selectedClient.notes}
                  </p>
                </div>
              )}

              {/* Projects with this client */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Contracted Projects</h4>
                  <Link
                    to="/projects"
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                  >
                    View All <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>

                {clientProjects.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No projects created for this client yet.</p>
                ) : (
                  <div className="space-y-2">
                    {clientProjects.map((p) => (
                      <Link
                        key={p._id}
                        to={`/projects/${p._id}`}
                        className="block p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand-500 dark:hover:border-brand-500 bg-white dark:bg-slate-900/40 transition-all group"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-mono font-bold text-brand-600">{p.projectCode}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {p.status}
                          </span>
                        </div>
                        <h5 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors">
                          {p.name}
                        </h5>
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                          <span>Progress: {p.progressPercent || 0}%</span>
                          {p.dueDate && <span>Due: {new Date(p.dueDate).toLocaleDateString('en-IN')}</span>}
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                          <div
                            className="bg-brand-600 h-full rounded-full transition-all"
                            style={{ width: `${p.progressPercent || 0}%` }}
                          />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-800/50">
              {canUpdate && (
                <button
                  onClick={() => {
                    setIsDetailOpen(false);
                    openEditModal(selectedClient);
                  }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  Edit Client Info
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Client Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {editingClient ? 'Edit Client Record' : 'Register New Client'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Client / Brand Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Odisha Tourism"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Legal Company Name
                  </label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="e.g. Odisha Tourism Corp Ltd."
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Industry Vertical
                  </label>
                  <input
                    type="text"
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    placeholder="e.g. Tourism, SaaS, Retail"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder="e.g. Manas Mohapatra"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    GSTIN Number
                  </label>
                  <input
                    type="text"
                    value={formData.gstNumber}
                    onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                    placeholder="21AAACG1234A1Z5"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Official Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contact@client.com"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone / Mobile
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. Infocity, Patia, Bhubaneswar"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Account Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Account Notes
                  </label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Important context, contract type..."
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  {formSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingClient ? 'Save Changes' : 'Create Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;
