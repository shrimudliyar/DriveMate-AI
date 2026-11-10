import React, { useState } from 'react';
import DriverProfileCard from './DriverProfileCard';
import DriverMetricsBar from './DriverMetricsBar';
import IncomingRequestCard from './IncomingRequestCard';
import DriverTripCard from './DriverTripCard';
import DriverTripsWorkspace from './DriverTripsWorkspace';
import SafetySection from '../safety/SafetySection';
import { useBookings } from '../../context/BookingContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { 
  Bell, 
  RotateCcw, 
  Car, 
  Clock, 
  CheckCircle, 
  XCircle, 
  ListFilter,
  Inbox,
  ShieldAlert,
  ArrowRight,
  AlertTriangle,
  Upload,
  FileText,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

export default function DriverPortal({ currentTab = 'driver-dashboard', onSelectTab }) {
  const { bookings, isDriverOnline } = useBookings();
  const { role, isVerifiedDriver, profile, user, refreshProfile, openAuthModal, switchRole } = useAuth();
  const [tripFilter, setTripFilter] = useState('active'); // 'active' | 'incoming' | 'completed' | 'all'

  // Resubmission state for rejected drivers
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitSuccess, setResubmitSuccess] = useState(null);
  const [resubmitError, setResubmitError] = useState(null);
  const [docsPayload, setDocsPayload] = useState({
    license_front: '',
    license_back: '',
    id_proof: '',
    police_clearance: '',
  });

  const isRejected = (profile?.verificationStatus === 'rejected');

  const handleResubmit = async (e) => {
    e.preventDefault();
    if (!docsPayload.license_front.trim() && !docsPayload.license_back.trim()) {
      setResubmitError('Please specify at least updated license front or back to resubmit.');
      return;
    }

    try {
      setResubmitting(true);
      setResubmitError(null);
      const driverId = profile?.id || user?.id;
      if (!driverId) {
        setResubmitError('User session not found. Please sign in again.');
        return;
      }
      await api.submitDriverDocuments(driverId, {
        license_front: docsPayload.license_front.trim() || undefined,
        license_back: docsPayload.license_back.trim() || undefined,
        id_proof: docsPayload.id_proof.trim() || undefined,
        police_clearance: docsPayload.police_clearance.trim() || undefined,
      });

      setResubmitSuccess('Documents resubmitted successfully! Your application is now under administrative review.');
      if (refreshProfile) {
        await refreshProfile();
      }
    } catch (err) {
      console.error('Failed to resubmit driver documents:', err);
      setResubmitError(err.message || 'Failed to submit updated documents.');
    } finally {
      setResubmitting(false);
    }
  };

  // Security Check: Unauthenticated or non-driver user — prompt sign-in
  if (role !== 'driver') {
    return (
      <div className="dm-card p-8 sm:p-12 text-center max-w-xl mx-auto space-y-5 animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-brand-navy border border-amber-300 dark:border-amber-700/60 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-extrabold text-brand-navy dark:text-white">
            Driver Access Required
          </h2>
          <p className="text-xs sm:text-sm text-brand-muted dark:text-slate-300 max-w-md mx-auto">
            This portal is for registered driver pilots only. Please sign in with a driver account.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => openAuthModal('signin', 'Please sign in with verified pilot credentials to access trip dispatches.')}
            className="w-full sm:w-auto py-2.5 px-6 rounded-xl font-bold text-xs text-white bg-brand-navy hover:bg-brand-navy-hover dark:bg-brand-sky dark:text-brand-navy dark:hover:bg-white transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Sign in as Driver Pilot</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // 1. Application Rejected: Display actual rejection reason and allow document resubmission
  if (!isVerifiedDriver && isRejected) {
    return (
      <div className="dm-card p-6 sm:p-10 max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200 bg-white dark:bg-brand-navy-dark border border-rose-200 dark:border-rose-900 shadow-soft">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 flex items-center justify-center shrink-0 text-rose-600 dark:text-rose-400">
            <XCircle className="w-8 h-8" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
              Action Required
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-brand-dark dark:text-white mt-1">
              Application Requires Correction
            </h2>
            <p className="text-xs text-brand-muted dark:text-slate-400">
              Your application was declined during operations review. Please resolve the issue below and resubmit.
            </p>
          </div>
        </div>

        {/* Actual Rejection Reason from backend */}
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 space-y-2">
          <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-xs uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>Reason for Rejection</span>
          </div>
          <p className="text-sm font-semibold text-rose-900 dark:text-rose-200">
            "{profile?.rejectionReason || 'Document clarity or compliance verification failed.'}"
          </p>
          {profile?.reviewedAt && (
            <span className="text-[10px] text-rose-700 dark:text-rose-400 block">
              Reviewed on: {new Date(profile.reviewedAt).toLocaleString()}
            </span>
          )}
        </div>

        {/* Resubmission Form */}
        <form onSubmit={handleResubmit} className="space-y-4 pt-2">
          <div className="border-t border-slate-200 dark:border-brand-navy-border pt-4">
            <h3 className="text-xs font-bold text-brand-dark dark:text-white uppercase tracking-wider mb-1">
              Resubmit Corrected Verification Documents
            </h3>
            <p className="text-xs text-brand-muted dark:text-slate-400 mb-4">
              Provide updated storage keys or paths for your driving documents. Upon submission, your status will reset to Pending Verification.
            </p>
          </div>

          {resubmitError && (
            <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-950 text-xs font-bold text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
              {resubmitError}
            </div>
          )}

          {resubmitSuccess && (
            <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{resubmitSuccess}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-brand-dark dark:text-slate-200 mb-1">
                Driving License (Front) Object Path / Key *
              </label>
              <input
                type="text"
                value={docsPayload.license_front}
                onChange={(e) => setDocsPayload(p => ({ ...p, license_front: e.target.value }))}
                placeholder="e.g. drivers/license_front_v2.jpg"
                className="w-full p-2.5 rounded-xl text-xs bg-slate-50 dark:bg-brand-navy border border-slate-300 dark:border-brand-navy-border text-brand-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-sky font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-dark dark:text-slate-200 mb-1">
                Driving License (Back) Object Path / Key *
              </label>
              <input
                type="text"
                value={docsPayload.license_back}
                onChange={(e) => setDocsPayload(p => ({ ...p, license_back: e.target.value }))}
                placeholder="e.g. drivers/license_back_v2.jpg"
                className="w-full p-2.5 rounded-xl text-xs bg-slate-50 dark:bg-brand-navy border border-slate-300 dark:border-brand-navy-border text-brand-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-sky font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-dark dark:text-slate-200 mb-1">
                Identity Proof (Optional update)
              </label>
              <input
                type="text"
                value={docsPayload.id_proof}
                onChange={(e) => setDocsPayload(p => ({ ...p, id_proof: e.target.value }))}
                placeholder="e.g. drivers/aadhaar_card_v2.pdf"
                className="w-full p-2.5 rounded-xl text-xs bg-slate-50 dark:bg-brand-navy border border-slate-300 dark:border-brand-navy-border text-brand-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-sky font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-dark dark:text-slate-200 mb-1">
                Police Clearance Certificate (Optional update)
              </label>
              <input
                type="text"
                value={docsPayload.police_clearance}
                onChange={(e) => setDocsPayload(p => ({ ...p, police_clearance: e.target.value }))}
                placeholder="e.g. drivers/police_verification_v2.pdf"
                className="w-full p-2.5 rounded-xl text-xs bg-slate-50 dark:bg-brand-navy border border-slate-300 dark:border-brand-navy-border text-brand-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-sky font-mono"
              />
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={resubmitting}
              className="w-full py-3 px-6 rounded-xl font-bold text-xs text-white bg-brand-navy hover:bg-brand-navy-hover dark:bg-brand-sky dark:text-brand-navy dark:hover:bg-white transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {resubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting Updated Credentials...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Resubmit Application for Administrative Review</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // 2. Verification Pending: Driver is registered but awaiting admin approval
  if (!isVerifiedDriver) {
    return (
      <div className="dm-card p-8 sm:p-12 text-center max-w-xl mx-auto space-y-5 animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-extrabold text-brand-navy dark:text-white">
            Verification In Progress
          </h2>
          <p className="text-xs sm:text-sm text-brand-muted dark:text-slate-300 max-w-md mx-auto">
            Your driver pilot application has been received and is currently under administrative review. Our operations team is evaluating your driving credentials and background verification documents.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-left space-y-2">
          <p className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
            Restricted Access Notice
          </p>
          <ul className="text-xs text-amber-800 dark:text-amber-400 space-y-1 list-disc list-inside">
            <li>Trip dispatches and customer booking requests are locked.</li>
            <li>Driver duty status (Going Online) is restricted by backend authorization.</li>
            <li>You will receive approval once your documents are cleared by an administrator.</li>
            <li>No action is required from you unless additional documents are requested.</li>
          </ul>
        </div>
      </div>
    );
  }

  // Incoming requests are bookings with status 'pending'
  const pendingRequests = bookings.filter(b => b.status === 'pending');
  
  // Active/Accepted trips: 'accepted' | 'in_progress'
  const activeTrips = bookings.filter(b => b.status === 'accepted' || b.status === 'in_progress');

  // Completed trips
  const completedTrips = bookings.filter(b => b.status === 'completed');

  // Filtered trips for list view
  const displayTrips = bookings.filter(b => {
    if (tripFilter === 'incoming') return b.status === 'pending';
    if (tripFilter === 'active') return b.status === 'accepted' || b.status === 'in_progress';
    if (tripFilter === 'completed') return b.status === 'completed';
    if (tripFilter === 'rejected') return b.status === 'rejected' || b.status === 'cancelled';
    return true; // 'all'
  });

  // Dedicated My Trips workspace
  if (currentTab === 'driver-trips') {
    return (
      <DriverTripsWorkspace onSelectTab={onSelectTab} />
    );
  }

  // Safety Protocols view
  if (currentTab === 'safety') {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <SafetySection />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Driver Profile & Availability Card */}
      <DriverProfileCard />

      {/* Metrics Bar */}
      <DriverMetricsBar />

      {/* SECTION 1: INCOMING REQUESTS QUEUE (Prominently highlighted if pending) */}
      <section aria-labelledby="incoming-requests-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Bell className="w-4 h-4 animate-swing" />
            </div>
            <div>
              <h3 id="incoming-requests-heading" className="text-lg font-extrabold text-brand-navy dark:text-white flex items-center gap-2">
                <span>Incoming Customer Dispatches</span>
                {pendingRequests.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-500 text-white">
                    {pendingRequests.length} Pending
                  </span>
                )}
              </h3>
              <p className="text-xs text-brand-muted dark:text-slate-400">
                Live customer ride requests broadcast for verified chauffeur assignment.
              </p>
            </div>
          </div>
        </div>

        {pendingRequests.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingRequests.map(request => (
              <IncomingRequestCard key={request.id} booking={request} />
            ))}
          </div>
        ) : (
          <div className="dm-card p-6 sm:p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-brand-sky-light dark:bg-brand-navy-dark flex items-center justify-center text-brand-navy dark:text-brand-sky mx-auto mb-3">
              <Clock className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-brand-dark dark:text-white">
              No Pending Requests Right Now
            </h4>
            <p className="text-xs text-brand-muted dark:text-slate-400 max-w-md mx-auto mt-1 mb-2">
              You are online and ready for dispatch. New customer ride requests will appear here automatically in real time.
            </p>
          </div>
        )}
      </section>

      {/* SECTION 2: ASSIGNED TRIPS & HISTORY MANAGEMENT */}
      <section aria-labelledby="trips-history-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 id="trips-history-heading" className="text-lg font-extrabold text-brand-navy dark:text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-brand-navy dark:text-brand-sky" />
              <span>Assigned Drives & Trip History</span>
            </h3>
            <p className="text-xs text-brand-muted dark:text-slate-400">
              Manage your accepted schedules, start live driving trips, and review historical earnings.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-brand-navy-subtle border border-slate-200 dark:border-brand-navy-border shadow-xs">
            <button
              type="button"
              onClick={() => setTripFilter('active')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                tripFilter === 'active'
                  ? 'bg-brand-navy text-white shadow-xs dark:bg-brand-sky dark:text-brand-navy'
                  : 'text-brand-muted hover:text-brand-dark dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Active / Ready ({activeTrips.length})
            </button>
            <button
              type="button"
              onClick={() => setTripFilter('completed')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                tripFilter === 'completed'
                  ? 'bg-brand-navy text-white shadow-xs dark:bg-brand-sky dark:text-brand-navy'
                  : 'text-brand-muted hover:text-brand-dark dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Completed ({completedTrips.length})
            </button>
            <button
              type="button"
              onClick={() => setTripFilter('rejected')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                tripFilter === 'rejected'
                  ? 'bg-brand-navy text-white shadow-xs dark:bg-brand-sky dark:text-brand-navy'
                  : 'text-brand-muted hover:text-brand-dark dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Declined ({bookings.filter(b => b.status === 'rejected' || b.status === 'cancelled').length})
            </button>
            <button
              type="button"
              onClick={() => setTripFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                tripFilter === 'all'
                  ? 'bg-brand-navy text-white shadow-xs dark:bg-brand-sky dark:text-brand-navy'
                  : 'text-brand-muted hover:text-brand-dark dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              All ({bookings.length})
            </button>
          </div>
        </div>

        {/* Trips grid */}
        {displayTrips.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayTrips.map(trip => (
              <DriverTripCard key={trip.id} booking={trip} />
            ))}
          </div>
        ) : (
          <div className="dm-card p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-brand-navy-dark flex items-center justify-center text-slate-400 mx-auto mb-3">
              <Inbox className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-brand-dark dark:text-white">No trips in this view</h4>
            <p className="text-xs text-brand-muted dark:text-slate-400 max-w-sm mx-auto mt-1">
              Select another filter or accept an incoming dispatch above to start a trip.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
