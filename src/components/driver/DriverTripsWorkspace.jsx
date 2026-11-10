import React, { useState } from 'react';
import { 
  CarFront, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Inbox, 
  TrendingUp, 
  ArrowRight,
  ShieldCheck,
  CalendarCheck
} from 'lucide-react';
import { useBookings } from '../../context/BookingContext';
import { formatCurrency } from '../../utils/pricing';
import DriverTripCard from './DriverTripCard';

export default function DriverTripsWorkspace({ onSelectTab }) {
  const { bookings, driverEarnings } = useBookings();
  const [tripFilter, setTripFilter] = useState('active'); // 'active' | 'completed' | 'rejected' | 'all'

  // Filtered categories
  const activeTrips = bookings.filter(b => b.status === 'accepted' || b.status === 'in_progress');
  const completedTrips = bookings.filter(b => b.status === 'completed');
  const declinedTrips = bookings.filter(b => b.status === 'rejected' || b.status === 'cancelled');
  const allAssignedTrips = bookings.filter(b => b.status !== 'pending');

  const displayTrips = tripFilter === 'active' 
    ? activeTrips 
    : tripFilter === 'completed'
    ? completedTrips
    : tripFilter === 'rejected'
    ? declinedTrips
    : allAssignedTrips;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-brand-navy-border">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-sky-light text-brand-navy dark:bg-brand-navy-surface dark:text-brand-sky text-xs font-bold uppercase tracking-wider mb-2">
            <CarFront className="w-3.5 h-3.5" />
            <span>Dedicated Pilot Workspace</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-navy dark:text-white tracking-tight flex items-center gap-3">
            <span>My Trips</span>
            {activeTrips.length > 0 && (
              <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-brand-navy text-white dark:bg-brand-sky dark:text-brand-navy">
                {activeTrips.length} Active
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-brand-muted dark:text-slate-400 mt-1 max-w-2xl">
            Quickly take the wheel on accepted trips, mark active rides complete, and review historical earnings without scrolling past dispatch queues.
          </p>
        </div>

        {/* Quick summary stats */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-3 rounded-xl bg-white dark:bg-brand-navy-surface border border-slate-200 dark:border-brand-navy-border shadow-xs text-center min-w-[90px]">
            <span className="text-[10px] text-brand-muted dark:text-slate-400 font-semibold block uppercase">Active</span>
            <span className="text-base font-extrabold text-brand-navy dark:text-brand-sky">
              {activeTrips.length}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-brand-navy-surface border border-slate-200 dark:border-brand-navy-border shadow-xs text-center min-w-[90px]">
            <span className="text-[10px] text-brand-muted dark:text-slate-400 font-semibold block uppercase">Completed</span>
            <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
              {completedTrips.length}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-brand-navy-surface border border-slate-200 dark:border-brand-navy-border shadow-xs text-center min-w-[100px]">
            <span className="text-[10px] text-brand-muted dark:text-slate-400 font-semibold block uppercase">Earnings</span>
            <span className="text-base font-extrabold text-brand-navy dark:text-brand-sky">
              {formatCurrency(driverEarnings)}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-brand-navy dark:text-brand-sky" />
          <h2 className="text-sm font-extrabold text-brand-navy dark:text-white uppercase tracking-wider">
            Assigned Trip Records
          </h2>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-brand-navy-subtle border border-slate-200 dark:border-brand-navy-border shadow-xs">
          <button
            type="button"
            onClick={() => setTripFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tripFilter === 'rejected'
                ? 'bg-brand-navy text-white shadow-xs dark:bg-brand-sky dark:text-brand-navy'
                : 'text-brand-muted hover:text-brand-dark dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Declined ({declinedTrips.length})
          </button>
          <button
            type="button"
            onClick={() => setTripFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tripFilter === 'all'
                ? 'bg-brand-navy text-white shadow-xs dark:bg-brand-sky dark:text-brand-navy'
                : 'text-brand-muted hover:text-brand-dark dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            All ({allAssignedTrips.length})
          </button>
        </div>
      </div>

      {/* Trips Grid */}
      {displayTrips.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayTrips.map(trip => (
            <DriverTripCard key={trip.id} booking={trip} />
          ))}
        </div>
      ) : (
        <div className="dm-card p-10 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-brand-navy-dark flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto">
            {tripFilter === 'active' ? (
              <CarFront className="w-7 h-7 text-brand-navy dark:text-brand-sky" />
            ) : tripFilter === 'completed' ? (
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            ) : tripFilter === 'rejected' ? (
              <XCircle className="w-7 h-7 text-rose-500" />
            ) : (
              <Inbox className="w-7 h-7" />
            )}
          </div>
          
          <h3 className="text-base font-bold text-brand-dark dark:text-white">
            {tripFilter === 'active'
              ? 'No Active Trips Right Now'
              : tripFilter === 'completed'
              ? 'No Completed Drives Yet'
              : tripFilter === 'rejected'
              ? 'No Declined Trip Requests'
              : 'No Trips In This View'}
          </h3>

          <p className="text-xs text-brand-muted dark:text-slate-400 max-w-md mx-auto">
            {tripFilter === 'active'
              ? 'You do not have any accepted dispatches ready to drive. Head over to the Driver Dashboard to accept incoming customer ride requests.'
              : tripFilter === 'completed'
              ? 'Once you complete your assigned drives, your completed trip history and earnings will appear here.'
              : tripFilter === 'rejected'
              ? 'Customer dispatch requests you decline will be tracked here.'
              : 'Select another filter or accept an incoming dispatch from the Driver Dashboard.'}
          </p>

          {tripFilter === 'active' && typeof onSelectTab === 'function' && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onSelectTab('driver-dashboard')}
                className="inline-flex items-center gap-2 py-2 px-4 rounded-xl font-bold text-xs text-white bg-brand-navy hover:bg-brand-navy-hover dark:bg-brand-sky dark:text-brand-navy dark:hover:bg-white transition-all shadow-xs cursor-pointer"
              >
                <span>Go to Driver Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

