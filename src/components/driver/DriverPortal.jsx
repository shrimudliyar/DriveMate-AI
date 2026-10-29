import React, { useState } from 'react';
import DriverProfileCard from './DriverProfileCard';
import DriverMetricsBar from './DriverMetricsBar';
import IncomingRequestCard from './IncomingRequestCard';
import DriverTripCard from './DriverTripCard';
import { useBookings } from '../../context/BookingContext';
import { useAuth } from '../../context/AuthContext';
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
  ArrowRight
} from 'lucide-react';

export default function DriverPortal() {
  const { bookings, isDriverOnline, resetDemoState } = useBookings();
  const { role, isVerifiedDriver, openAuthModal, switchRole } = useAuth();
  const [tripFilter, setTripFilter] = useState('active'); // 'active' | 'incoming' | 'completed' | 'all'

  // Security Check: If user does not possess verified driver privileges
  if (role !== 'driver' || !isVerifiedDriver) {
    return (
      <div className="dm-card p-8 sm:p-12 text-center max-w-xl mx-auto space-y-5 animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-brand-navy border border-amber-300 dark:border-amber-700/60 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-extrabold text-brand-navy dark:text-white">
            Verified Pilot Credentials Required
          </h2>
          <p className="text-xs sm:text-sm text-brand-muted dark:text-slate-300 max-w-md mx-auto">
            The Driver Portal contains live dispatch telemetry, customer personal vehicle requests, and trip operational controls. Access is restricted to verified chauffeur pilots.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => openAuthModal('signin', 'Please sign in with verified pilot credentials to access trip dispatches.')}
            className="w-full sm:w-auto py-2.5 px-6 rounded-xl font-bold text-xs text-white bg-brand-navy hover:bg-brand-navy-hover dark:bg-brand-sky dark:text-brand-navy dark:hover:bg-white transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Sign in as Verified Pilot</span>
            <ArrowRight className="w-4 h-4" />
          </button>
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetDemoState}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-brand-navy-border bg-white dark:bg-brand-navy hover:bg-brand-grey-subtle dark:hover:bg-brand-navy-subtle text-xs font-semibold text-brand-dark dark:text-slate-300 transition-colors shadow-xs cursor-pointer"
              title="Reset demo data to default test scenario"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Demo State</span>
            </button>
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
            <p className="text-xs text-brand-muted dark:text-slate-400 max-w-md mx-auto mt-1 mb-4">
              Switch to the <strong>Customer Portal</strong> using the switcher above and book a driver to instantly test incoming dispatches here.
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
