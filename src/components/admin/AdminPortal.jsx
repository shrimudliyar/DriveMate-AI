import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Eye,
  FileText,
  AlertTriangle,
  Car,
  Calendar,
  Phone,
  Mail,
  Award,
  ExternalLink,
  ChevronRight,
  Filter,
  Check,
  X,
  FileCheck,
  LayoutDashboard,
  Layers
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function AdminPortal({ currentTab = 'admin-overview', onSelectTab }) {
  const { user, profile, role, isLoading: authLoading } = useAuth();

  // Active view: 'overview' | 'applications' | 'verified'
  const [activeView, setActiveView] = useState(() => {
    if (currentTab === 'admin-applications') return 'applications';
    if (currentTab === 'admin-verified') return 'verified';
    return 'overview';
  });

  // Overview stats
  const [stats, setStats] = useState({
    pending_verifications: 0,
    verified_pilots: 0,
    rejected_applications: 0,
    total_drivers: 0,
    total_bookings: 0,
    active_drives: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Applications list
  const [applications, setApplications] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsError, setAppsError] = useState(null);

  // Application detail review modal
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  // Approval / Rejection action states
  const [actionConfirm, setActionConfirm] = useState(null); // 'approve' | 'reject' | null
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Sync internal view with currentTab from parent navigation
  useEffect(() => {
    if (currentTab === 'admin-applications') setActiveView('applications');
    else if (currentTab === 'admin-verified') setActiveView('verified');
    else if (currentTab === 'admin-overview') setActiveView('overview');
  }, [currentTab]);

  const handleSwitchView = (view) => {
    setActiveView(view);
    if (onSelectTab) {
      if (view === 'applications') onSelectTab('admin-applications');
      else if (view === 'verified') onSelectTab('admin-verified');
      else onSelectTab('admin-overview');
    }
  };

  // Fetch KPI Stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const data = await api.getAdminStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load admin overview stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch Applications with status & search filters
  const fetchApplications = useCallback(async () => {
    try {
      setAppsLoading(true);
      setAppsError(null);
      const effectiveStatus = activeView === 'verified' ? 'verified' : statusFilter;
      const data = await api.getDriverApplications({
        status: effectiveStatus,
        search: searchQuery,
      });
      setApplications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load driver applications:', err);
      setAppsError(err.message || 'Failed to load applications from server.');
    } finally {
      setAppsLoading(false);
    }
  }, [activeView, statusFilter, searchQuery]);

  // Load initial data only after auth session is established with admin role
  useEffect(() => {
    if (!authLoading && user && role === 'admin') {
      fetchStats();
    }
  }, [authLoading, user, role, fetchStats]);

  useEffect(() => {
    if (!authLoading && user && role === 'admin') {
      fetchApplications();
    }
  }, [authLoading, user, role, fetchApplications]);

  // Open Driver Detail modal with signed document URLs
  const handleOpenDetail = async (driverId) => {
    try {
      setDetailLoading(true);
      setDetailError(null);
      setActionConfirm(null);
      setRejectionReason('');
      setRejectionError('');
      const fullDetail = await api.getDriverApplicationDetail(driverId);
      setSelectedDriver(fullDetail);
    } catch (err) {
      console.error(`Failed to load driver application ${driverId}:`, err);
      setDetailError(err.message || 'Failed to retrieve application details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedDriver(null);
    setActionConfirm(null);
    setRejectionReason('');
    setRejectionError('');
    setDetailError(null);
  };

  // Approve Driver Application
  const handleConfirmApprove = async () => {
    if (!selectedDriver) return;
    try {
      setActionSubmitting(true);
      const updated = await api.approveDriverApplication(selectedDriver.id);

      // Verify that the backend returned confirmed verified status
      const isVerified = updated && (
        updated.verification_status === 'Police & Background Verified' || 
        updated.verification_status === 'verified'
      );

      if (!isVerified) {
        throw new Error(
          'Approval was not persisted by the server. Verification status is still ' + 
          (updated?.verification_status || 'unknown')
        );
      }

      // Synchronize modal state immediately
      setSelectedDriver(updated);
      setActionConfirm(null);

      // Optimistically sync applications list in memory
      setApplications(prev => prev.map(app => (app.id === selectedDriver.id ? { ...app, ...updated } : app)));

      showToast(`Driver ${updated.name || updated.full_name || selectedDriver.id} approved successfully!`, 'success');
      await Promise.all([fetchStats(), fetchApplications()]);
    } catch (err) {
      console.error('Failed to approve driver application:', err);
      showToast(err.message || 'Approval failed.', 'danger');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Reject Driver Application
  const handleConfirmReject = async () => {
    if (!selectedDriver) return;
    if (!rejectionReason.trim()) {
      setRejectionError('Rejection reason is mandatory. Please state why the application was declined.');
      return;
    }

    try {
      setActionSubmitting(true);
      setRejectionError('');
      const updated = await api.rejectDriverApplication(selectedDriver.id, rejectionReason.trim());

      if (!updated || updated.verification_status !== 'rejected') {
        throw new Error(
          'Rejection was not persisted by the server. Status is still ' + 
          (updated?.verification_status || 'unknown')
        );
      }

      // Synchronize modal state immediately
      setSelectedDriver(updated);
      setActionConfirm(null);

      // Optimistically sync applications list in memory
      setApplications(prev => prev.map(app => (app.id === selectedDriver.id ? { ...app, ...updated } : app)));

      showToast(`Driver application ${selectedDriver.id} rejected. Reason recorded.`, 'warning');
      await Promise.all([fetchStats(), fetchApplications()]);
    } catch (err) {
      console.error('Failed to reject driver application:', err);
      setRejectionError(err.message || 'Rejection failed.');
      showToast(err.message || 'Rejection failed.', 'danger');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'police & background verified' || s === 'verified') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Police Verified</span>
        </span>
      );
    }
    if (s === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
          <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          <span>Application Rejected</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
        <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        <span>Pending Verification</span>
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-bold shadow-elevated ${
            toastMessage.type === 'danger'
              ? 'bg-rose-600 text-white border-rose-700'
              : toastMessage.type === 'warning'
              ? 'bg-amber-600 text-white border-amber-700'
              : 'bg-emerald-600 text-white border-emerald-700'
          }`}>
            <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
            <span>{toastMessage.message}</span>
          </div>
        </div>
      )}

      {/* Admin Top Header Banner */}
      <section className="dm-card p-6 sm:p-8 relative overflow-hidden bg-white dark:bg-brand-navy-dark border border-slate-200 dark:border-brand-navy-border shadow-soft">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-sky text-brand-navy text-xs font-extrabold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Platform Admin Console</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-dark dark:text-white tracking-tight">
              Driver Verification & Fleet Operations
            </h1>
            <p className="text-xs sm:text-sm text-brand-muted dark:text-slate-300 mt-1 max-w-2xl">
              Inspect applicant credentials, review private documents via short-lived signed URLs, and approve certified pilots for client vehicle dispatch.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-center">
            <div className="text-right hidden sm:block">
              <span className="text-xs font-bold text-brand-dark dark:text-white block">
                {profile?.name || user?.email || 'Administrator'}
              </span>
              <span className="text-[11px] text-brand-muted dark:text-slate-400 block">
                Role: Server-Validated Admin
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                fetchStats();
                fetchApplications();
              }}
              title="Refresh Data"
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-brand-navy-surface dark:hover:bg-brand-navy-subtle text-brand-muted dark:text-slate-300 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${(statsLoading || appsLoading) ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* View Selection Tabs */}
        <div className="flex items-center gap-2 pt-6 border-t border-slate-200 dark:border-brand-navy-border mt-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => handleSwitchView('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeView === 'overview'
                ? 'bg-brand-navy text-white dark:bg-brand-sky dark:text-brand-navy shadow-sm'
                : 'text-brand-muted dark:text-slate-400 hover:bg-brand-grey-subtle dark:hover:bg-brand-navy-surface'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Overview & KPIs</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchView('applications')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeView === 'applications'
                ? 'bg-brand-navy text-white dark:bg-brand-sky dark:text-brand-navy shadow-sm'
                : 'text-brand-muted dark:text-slate-400 hover:bg-brand-grey-subtle dark:hover:bg-brand-navy-surface'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Driver Applications</span>
            {stats.pending_verifications > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white">
                {stats.pending_verifications}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSwitchView('verified')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeView === 'verified'
                ? 'bg-brand-navy text-white dark:bg-brand-sky dark:text-brand-navy shadow-sm'
                : 'text-brand-muted dark:text-slate-400 hover:bg-brand-grey-subtle dark:hover:bg-brand-navy-surface'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Verified Fleet</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500 text-white">
              {stats.verified_pilots}
            </span>
          </button>
        </div>
      </section>

      {/* VIEW 1: OVERVIEW & KPI METRICS */}
      {activeView === 'overview' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* KPI Cards Grid */}
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Pending Verifications */}
            <div className="dm-card p-5 bg-white dark:bg-brand-navy-dark border-l-4 border-l-amber-500 shadow-soft">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-brand-muted dark:text-slate-400 uppercase tracking-wider">
                  Pending Review
                </span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                  {statsLoading ? '—' : stats.pending_verifications}
                </span>
                <span className="text-[10px] text-brand-muted dark:text-slate-400 block mt-0.5">
                  Action required
                </span>
              </div>
            </div>

            {/* Verified Pilots */}
            <div className="dm-card p-5 bg-white dark:bg-brand-navy-dark border-l-4 border-l-emerald-500 shadow-soft">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-brand-muted dark:text-slate-400 uppercase tracking-wider">
                  Verified Pilots
                </span>
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {statsLoading ? '—' : stats.verified_pilots}
                </span>
                <span className="text-[10px] text-brand-muted dark:text-slate-400 block mt-0.5">
                  Background cleared
                </span>
              </div>
            </div>

            {/* Rejected Applications */}
            <div className="dm-card p-5 bg-white dark:bg-brand-navy-dark border-l-4 border-l-rose-500 shadow-soft">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-brand-muted dark:text-slate-400 uppercase tracking-wider">
                  Rejected
                </span>
                <XCircle className="w-4 h-4 text-rose-500" />
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400">
                  {statsLoading ? '—' : stats.rejected_applications}
                </span>
                <span className="text-[10px] text-brand-muted dark:text-slate-400 block mt-0.5">
                  Declined with reason
                </span>
              </div>
            </div>

            {/* Total Registered Drivers */}
            <div className="dm-card p-5 bg-white dark:bg-brand-navy-dark border-l-4 border-l-brand-navy dark:border-l-brand-sky shadow-soft">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-brand-muted dark:text-slate-400 uppercase tracking-wider">
                  Total Fleet
                </span>
                <Users className="w-4 h-4 text-brand-navy dark:text-brand-sky" />
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-extrabold text-brand-dark dark:text-white">
                  {statsLoading ? '—' : stats.total_drivers}
                </span>
                <span className="text-[10px] text-brand-muted dark:text-slate-400 block mt-0.5">
                  Platform pilots
                </span>
              </div>
            </div>

            {/* Total Customer Bookings */}
            <div className="dm-card p-5 bg-white dark:bg-brand-navy-dark border-l-4 border-l-indigo-500 shadow-soft">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-brand-muted dark:text-slate-400 uppercase tracking-wider">
                  Total Bookings
                </span>
                <Calendar className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
                  {statsLoading ? '—' : stats.total_bookings}
                </span>
                <span className="text-[10px] text-brand-muted dark:text-slate-400 block mt-0.5">
                  Lifetime requests
                </span>
              </div>
            </div>

            {/* Active Drives */}
            <div className="dm-card p-5 bg-white dark:bg-brand-navy-dark border-l-4 border-l-sky-500 shadow-soft">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-brand-muted dark:text-slate-400 uppercase tracking-wider">
                  Active Drives
                </span>
                <Car className="w-4 h-4 text-sky-500" />
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-extrabold text-sky-600 dark:text-sky-400">
                  {statsLoading ? '—' : stats.active_drives}
                </span>
                <span className="text-[10px] text-brand-muted dark:text-slate-400 block mt-0.5">
                  On the road now
                </span>
              </div>
            </div>
          </section>

          {/* Quick Action: Pending Driver Applications needing attention */}
          <section className="dm-card p-6 bg-white dark:bg-brand-navy-dark border border-slate-200 dark:border-brand-navy-border shadow-soft space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-brand-dark dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span>Applications Requiring Verification</span>
                </h3>
                <p className="text-xs text-brand-muted dark:text-slate-400">
                  Drivers in pending status cannot accept dispatches or toggle duty online until approved.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setStatusFilter('pending_verification');
                  handleSwitchView('applications');
                }}
                className="text-xs font-bold text-brand-navy dark:text-brand-sky hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View all in queue</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {applications.filter(a => a.verification_status === 'pending_verification').length === 0 ? (
              <div className="py-8 text-center text-xs text-brand-muted dark:text-slate-400 border border-dashed border-slate-200 dark:border-brand-navy-border rounded-xl">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="font-bold text-brand-dark dark:text-white">All caught up!</p>
                <p>No driver applications are currently waiting for background review.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-brand-navy-border">
                {applications
                  .filter(a => a.verification_status === 'pending_verification')
                  .slice(0, 5)
                  .map((app) => (
                    <div key={app.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-brand-dark dark:text-white block truncate">
                          {app.name || app.full_name || 'Driver Applicant'}
                        </span>
                        <span className="text-[11px] text-brand-muted dark:text-slate-400 block truncate">
                          License: {app.license_number || 'Under review'} • Exp: {app.experience_years || 0} yrs • {app.email}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {renderStatusBadge(app.verification_status)}
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(app.id)}
                          className="px-3 py-1.5 rounded-lg bg-brand-navy dark:bg-brand-sky text-white dark:text-brand-navy text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review</span>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* VIEW 2 & 3: APPLICATIONS LIST & VERIFIED FLEET */}
      {(activeView === 'applications' || activeView === 'verified') && (
        <section className="dm-card p-6 bg-white dark:bg-brand-navy-dark border border-slate-200 dark:border-brand-navy-border shadow-soft space-y-6">
          {/* Filters & Search Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-brand-dark dark:text-white">
                {activeView === 'verified' ? 'Verified Platform Pilots' : 'Driver Partner Applications'}
              </h2>
              <p className="text-xs text-brand-muted dark:text-slate-400">
                {activeView === 'verified'
                  ? 'Active background-checked pilots authorized to accept booking dispatches.'
                  : 'Review submitted IDs, driving licenses, and background certificates.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Status Filter (Applications view only) */}
              {activeView === 'applications' && (
                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-brand-navy p-1 border border-slate-200 dark:border-brand-navy-border">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'pending_verification', label: 'Pending' },
                    { id: 'verified', label: 'Verified' },
                    { id: 'rejected', label: 'Rejected' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setStatusFilter(f.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        statusFilter === f.id
                          ? 'bg-white dark:bg-brand-navy-surface text-brand-dark dark:text-white shadow-xs'
                          : 'text-brand-muted dark:text-slate-400 hover:text-brand-dark dark:hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, email, license..."
                  className="pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-brand-navy border border-slate-200 dark:border-brand-navy-border text-brand-dark dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-sky w-full sm:w-64"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {appsError && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{appsError}</span>
            </div>
          )}

          {/* Loading State */}
          {appsLoading && (
            <div className="py-12 text-center text-xs text-brand-muted dark:text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-brand-navy dark:text-brand-sky" />
              <span>Loading applications from secure backend...</span>
            </div>
          )}

          {/* Empty State */}
          {!appsLoading && !appsError && applications.length === 0 && (
            <div className="py-12 text-center text-xs text-brand-muted dark:text-slate-400 border border-dashed border-slate-200 dark:border-brand-navy-border rounded-xl space-y-2">
              <Users className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
              <p className="font-bold text-brand-dark dark:text-white">No driver records found</p>
              <p className="max-w-sm mx-auto">
                {searchQuery
                  ? `No applications matched the query "${searchQuery}". Try clearing search.`
                  : 'There are currently no driver profiles in this category.'}
              </p>
            </div>
          )}

          {/* Applications Grid / Cards */}
          {!appsLoading && !appsError && applications.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="p-5 rounded-2xl bg-brand-grey-subtle/50 dark:bg-brand-navy/40 border border-slate-200 dark:border-brand-navy-border hover:border-brand-sky/60 dark:hover:border-brand-sky/60 transition-all shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-extrabold text-brand-dark dark:text-white">
                          {app.name || app.full_name || 'Driver Pilot'}
                        </h4>
                        <span className="text-[11px] text-brand-muted dark:text-slate-400 block">
                          ID: {app.id}
                        </span>
                      </div>
                      {renderStatusBadge(app.verification_status)}
                    </div>

                    <div className="space-y-1.5 text-xs text-brand-muted dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{app.email || 'No email provided'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{app.phone || 'No phone provided'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>License: <strong className="text-brand-dark dark:text-white">{app.license_number || 'N/A'}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Award className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Experience: {app.experience_years || 0} years • Rating: {app.rating || 5.0}★</span>
                      </div>
                    </div>

                    {/* Rejection Reason Notice if rejected */}
                    {app.verification_status === 'rejected' && app.rejection_reason && (
                      <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-[11px] text-rose-800 dark:text-rose-300">
                        <span className="font-bold block">Rejection Reason:</span>
                        <p className="mt-0.5 line-clamp-2">{app.rejection_reason}</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-200/60 dark:border-brand-navy-border/60 flex items-center justify-between">
                    <span className="text-[11px] text-brand-muted dark:text-slate-400">
                      Badge: <strong className="text-brand-dark dark:text-slate-200">{app.badge || 'Applicant'}</strong>
                    </span>

                    <button
                      type="button"
                      onClick={() => handleOpenDetail(app.id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-brand-navy dark:bg-brand-sky text-white dark:text-brand-navy hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Review Dossier</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* MODAL: DRIVER APPLICATION REVIEW & DOCUMENT INSPECTION */}
      {selectedDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-brand-navy-dark border border-slate-200 dark:border-brand-navy-border rounded-3xl shadow-elevated w-full max-w-3xl max-h-[90vh] overflow-y-auto space-y-6 p-6 sm:p-8 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-brand-navy-border">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-extrabold text-brand-dark dark:text-white">
                    {selectedDriver.name || selectedDriver.full_name || 'Driver Application Dossier'}
                  </h3>
                  {renderStatusBadge(selectedDriver.verification_status)}
                </div>
                <p className="text-xs text-brand-muted dark:text-slate-400 mt-1">
                  Driver ID: <code className="font-mono text-brand-navy dark:text-brand-sky">{selectedDriver.id}</code> • Registered: {selectedDriver.created_at ? new Date(selectedDriver.created_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseDetail}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-brand-navy-surface cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Applicant Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-brand-grey-subtle/60 dark:bg-brand-navy/60 border border-slate-200 dark:border-brand-navy-border space-y-2">
                <span className="font-extrabold uppercase tracking-wider text-brand-muted dark:text-slate-400 block text-[10px]">
                  Contact & Identity
                </span>
                <div className="space-y-1 text-brand-dark dark:text-slate-200">
                  <p><strong>Email:</strong> {selectedDriver.email || 'N/A'}</p>
                  <p><strong>Phone:</strong> {selectedDriver.phone || 'N/A'}</p>
                  <p><strong>Duty Status:</strong> {selectedDriver.is_online ? 'Online (Available)' : 'Offline'}</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-brand-grey-subtle/60 dark:bg-brand-navy/60 border border-slate-200 dark:border-brand-navy-border space-y-2">
                <span className="font-extrabold uppercase tracking-wider text-brand-muted dark:text-slate-400 block text-[10px]">
                  Professional Credentials
                </span>
                <div className="space-y-1 text-brand-dark dark:text-slate-200">
                  <p><strong>Driving License:</strong> {selectedDriver.license_number || 'N/A'}</p>
                  <p><strong>Experience:</strong> {selectedDriver.experience_years || 0} Years</p>
                  <p><strong>Specializations:</strong> {(selectedDriver.specializations || []).join(', ') || 'Standard Transmission, Automatic'}</p>
                  <p><strong>Languages:</strong> {(selectedDriver.languages || []).join(', ') || 'English, Hindi, Kannada'}</p>
                </div>
              </div>
            </div>

            {/* Review Audit Info (if already reviewed) */}
            {(selectedDriver.reviewed_by || selectedDriver.rejection_reason) && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-brand-navy/70 border border-slate-200 dark:border-brand-navy-border text-xs space-y-1">
                <span className="font-extrabold uppercase tracking-wider text-brand-muted dark:text-slate-400 block text-[10px]">
                  Review Audit Trail
                </span>
                {selectedDriver.reviewed_by && (
                  <p className="text-brand-dark dark:text-slate-300">
                    <strong>Last Reviewed By:</strong> {selectedDriver.reviewed_by} on {selectedDriver.reviewed_at ? new Date(selectedDriver.reviewed_at).toLocaleString() : 'N/A'}
                  </p>
                )}
                {selectedDriver.rejection_reason && (
                  <p className="text-rose-700 dark:text-rose-300">
                    <strong>Recorded Reason:</strong> {selectedDriver.rejection_reason}
                  </p>
                )}
              </div>
            )}

            {/* SUBMITTED DOCUMENTS SECTION (Uses secure short-lived signed URLs) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-extrabold text-brand-dark dark:text-white flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-brand-navy dark:text-brand-sky" />
                    <span>Uploaded Verification Documents</span>
                  </h4>
                  <p className="text-[11px] text-brand-muted dark:text-slate-400">
                    Documents are securely accessed via short-lived authorized signed URLs (5 min expiry).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'license_front', title: 'Driving License (Front)' },
                  { key: 'license_back', title: 'Driving License (Back)' },
                  { key: 'id_proof', title: 'National Identity Proof (Aadhaar / Passport)' },
                  { key: 'police_clearance', title: 'Police Clearance Certificate' },
                ].map((doc) => {
                  const docPath = (selectedDriver.documents || {})[doc.key];
                  const signedUrl = (selectedDriver.signed_document_urls || {})[doc.key];

                  return (
                    <div
                      key={doc.key}
                      className="p-4 rounded-xl border border-slate-200 dark:border-brand-navy-border bg-slate-50 dark:bg-brand-navy/40 space-y-2 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-brand-dark dark:text-white">
                            {doc.title}
                          </span>
                          {docPath ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              Uploaded
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400">
                              Missing
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-brand-muted dark:text-slate-400 font-mono mt-1 truncate">
                          {docPath || 'No document file submitted'}
                        </p>
                      </div>

                      {signedUrl ? (
                        <div className="pt-2">
                          <a
                            href={signedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-brand-navy-surface border border-slate-300 dark:border-brand-navy-border text-brand-navy dark:text-brand-sky hover:bg-slate-100 dark:hover:bg-brand-navy-subtle transition-colors shadow-2xs"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Inspect Document (Signed Link)</span>
                          </a>
                        </div>
                      ) : (
                        <div className="pt-2 text-[11px] text-slate-400 italic">
                          Document preview unavailable
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ACTION MODES: CONFIRM APPROVAL / CONFIRM REJECTION */}
            {actionConfirm === 'approve' && (
              <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>Confirm Application Approval</span>
                </div>
                <p className="text-xs text-emerald-800 dark:text-emerald-400">
                  Are you sure you want to approve <strong>{selectedDriver.name || selectedDriver.full_name}</strong>?
                  This sets their status to <strong>Police & Background Verified</strong> and authorizes them to go online and receive customer trip dispatches.
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={actionSubmitting}
                    onClick={handleConfirmApprove}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    {actionSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Confirm & Authorize Pilot</span>
                  </button>
                  <button
                    type="button"
                    disabled={actionSubmitting}
                    onClick={() => setActionConfirm(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-brand-navy-surface text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-brand-navy-border hover:bg-slate-100 dark:hover:bg-brand-navy-subtle transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {actionConfirm === 'reject' && (
              <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-sm">
                  <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  <span>Reject Application — Mandatory Reason</span>
                </div>
                <p className="text-xs text-rose-800 dark:text-rose-400">
                  Please provide a clear reason for rejecting this application. The driver will see this reason in their portal and will be prompted to resubmit updated credentials.
                </p>

                <div className="space-y-1.5">
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => {
                      setRejectionReason(e.target.value);
                      if (rejectionError) setRejectionError('');
                    }}
                    placeholder="E.g., Driving license photo is blurry and illegible; expired police verification certificate..."
                    className="w-full p-3 rounded-xl text-xs bg-white dark:bg-brand-navy border border-rose-300 dark:border-rose-800 text-brand-dark dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  {rejectionError && (
                    <span className="text-xs text-rose-600 dark:text-rose-400 font-bold block">
                      {rejectionError}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={actionSubmitting}
                    onClick={handleConfirmReject}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    {actionSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    <span>Confirm Rejection</span>
                  </button>
                  <button
                    type="button"
                    disabled={actionSubmitting}
                    onClick={() => {
                      setActionConfirm(null);
                      setRejectionError('');
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-brand-navy-surface text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-brand-navy-border hover:bg-slate-100 dark:hover:bg-brand-navy-subtle transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Modal Bottom Footer Actions */}
            {!actionConfirm && (
              <div className="pt-4 border-t border-slate-200 dark:border-brand-navy-border flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-brand-muted dark:text-slate-400">
                  Current Status: <strong className="text-brand-dark dark:text-white">{selectedDriver.verification_status}</strong>
                </span>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {selectedDriver.verification_status !== 'Police & Background Verified' && selectedDriver.verification_status !== 'verified' && (
                    <button
                      type="button"
                      onClick={() => setActionConfirm('approve')}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve Application</span>
                    </button>
                  )}

                  {selectedDriver.verification_status !== 'rejected' && (
                    <button
                      type="button"
                      onClick={() => setActionConfirm('reject')}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject Application</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleCloseDetail}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-brand-navy dark:hover:bg-brand-navy-subtle text-brand-dark dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

