import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin,
  Calendar,
  Clock,
  Car,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  User,
  Phone,
  Star,
  ArrowRight,
  ShieldCheck,
  Radio,
  Timer
} from 'lucide-react';
import { api } from '../../api/client';
import { useBookings } from '../../context/BookingContext';
import { formatCurrency } from '../../utils/pricing';

/**
 * BookingStatusScreen — Phase 2 customer matching experience.
 *
 * Dedicated live matching experience replacing the old BookingConfirmationModal.
 * Polls GET /api/bookings/{id} every 4 s and updates the UI from real backend state.
 * Displays actual driver details ONLY after backend-confirmed acceptance.
 * Never invents driver names, ratings, photos, vehicle info, or acceptance status.
 * Cancellation calls POST /api/bookings/{id}/cancel (supported for pending + accepted).
 */

const POLL_INTERVAL_MS = 4000;
const TIMEOUT_NOTICE_THRESHOLD_SECONDS = 120; // 2 minutes

// Radar animation with pulses
function RadarAnimation() {
  return (
    <div className="relative flex items-center justify-center w-28 h-28 mx-auto mb-5">
      {/* Concentric pulse rings */}
      <span className="absolute w-24 h-24 rounded-full border border-brand-sky/40 animate-ping opacity-30" />
      <span className="absolute w-20 h-20 rounded-full border border-brand-sky/60 animate-pulse opacity-40" />
      <span className="absolute w-16 h-16 rounded-full bg-brand-sky-light/40 dark:bg-brand-navy-dark/60" />

      {/* Center vehicle badge */}
      <div className="relative z-10 w-14 h-14 rounded-full bg-brand-navy dark:bg-brand-sky text-white dark:text-brand-navy flex items-center justify-center shadow-elevated">
        <Car className="w-7 h-7" />
      </div>
    </div>
  );
}

function TripSummaryCard({ booking }) {
  return (
    <div className="rounded-xl bg-brand-grey-subtle dark:bg-brand-navy-dark/70 border border-slate-200 dark:border-brand-navy-border p-4 space-y-3 text-xs w-full text-left">
      <div className="flex items-start gap-2.5">
        <MapPin className="w-4 h-4 text-brand-navy dark:text-brand-sky shrink-0 mt-0.5" />
        <div>
          <span className="text-brand-muted dark:text-slate-400 block text-[10px] uppercase font-bold">Pickup</span>
          <span className="font-semibold text-brand-dark dark:text-white">{booking.pickup}</span>
        </div>
      </div>

      <div className="flex items-start gap-2.5">
        <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="text-brand-muted dark:text-slate-400 block text-[10px] uppercase font-bold">Destination</span>
          <span className="font-semibold text-brand-dark dark:text-white">{booking.destination}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-brand-navy-border/80">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand-muted dark:text-slate-400" />
          <span className="font-medium text-brand-dark dark:text-slate-200">{booking.date}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-brand-muted dark:text-slate-400" />
          <span className="font-medium text-brand-dark dark:text-slate-200">
            {booking.time} ({booking.duration}h)
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-brand-navy-border/80">
        <div className="flex items-center gap-2 text-brand-dark dark:text-slate-300">
          <Car className="w-4 h-4 text-brand-navy dark:text-brand-sky" />
          <span className="font-semibold">{booking.vehicleName}</span>
        </div>
        {booking.estimatedFare != null && (
          <div className="font-extrabold text-sm text-brand-navy dark:text-brand-sky">
            {formatCurrency(booking.estimatedFare)}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-1 text-[10px] text-brand-muted dark:text-slate-400 font-mono">
        <span>Booking Ref: {booking.id}</span>
        {booking.createdAt && (
          <span>Booked: {new Date(booking.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        )}
      </div>
    </div>
  );
}

function DriverCard({ driver }) {
  // Only display if driver details are returned by backend
  if (!driver || typeof driver !== 'object') return null;

  return (
    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 p-4 space-y-3 text-xs w-full text-left animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Assigned Verified Chauffeur Pilot</span>
        </span>
        {driver.badge && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
            {driver.badge}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-brand-navy dark:bg-brand-sky text-white dark:text-brand-navy flex items-center justify-center font-bold text-base shrink-0">
          {driver.name ? driver.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-sm text-brand-dark dark:text-white truncate">
            {driver.name || 'Verified Pilot'}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {driver.rating != null && (
              <span className="flex items-center gap-1 text-amber-500 font-bold text-xs">
                <Star className="w-3.5 h-3.5 fill-amber-500" />
                <span>{typeof driver.rating === 'number' ? driver.rating.toFixed(2) : driver.rating}</span>
              </span>
            )}
            {driver.totalTrips != null && (
              <span className="text-brand-muted dark:text-slate-400 text-[11px]">
                • {driver.totalTrips} completed trips
              </span>
            )}
          </div>
        </div>
      </div>

      {driver.phone && (
        <div className="flex items-center gap-2 pt-2 border-t border-emerald-200 dark:border-emerald-800/80 text-brand-dark dark:text-slate-200">
          <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-semibold text-xs">Pilot Contact: </span>
          <span className="font-mono text-xs">{driver.phone}</span>
        </div>
      )}
    </div>
  );
}

export default function BookingStatusScreen({
  booking: initialBooking,
  onDismiss,
  onRetry,
  onViewTrips
}) {
  const { cancelBooking, refreshFromBackend } = useBookings();

  // Authoritative live booking state seeded from props
  const [booking, setBooking] = useState(initialBooking);
  const [pollError, setPollError] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  // Search duration tracking
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Guards against race conditions and stale async updates
  const cancelledRef = useRef(false);
  const pollTimerRef = useRef(null);
  const elapsedTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  const currentStatus = booking?.status;
  const shouldPoll = currentStatus === 'pending' || currentStatus === 'accepted';

  // Synchronize with backend booking endpoint
  const pollOnce = useCallback(async () => {
    if (!initialBooking?.id || cancelledRef.current) return;
    try {
      const fresh = await api.getBookingById(initialBooking.id);
      if (!isMountedRef.current || cancelledRef.current) return;

      if (fresh) {
        // If status transitioned, update local state & refresh bookings context
        if (fresh.status !== booking?.status) {
          setBooking(fresh);
          refreshFromBackend();
        } else {
          setBooking(fresh);
        }
        setPollError(null);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      // Network hiccup: keep showing current state, don't crash UI
      setPollError(`Live status sync paused (${err.message || 'connection issue'}). Retrying automatically...`);
    }
  }, [initialBooking?.id, booking?.status, refreshFromBackend]);

  // Setup periodic polling
  useEffect(() => {
    isMountedRef.current = true;

    if (!shouldPoll) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      return;
    }

    pollTimerRef.current = setInterval(pollOnce, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [shouldPoll, pollOnce]);

  // Elapsed timer for pending search
  useEffect(() => {
    if (currentStatus === 'pending') {
      elapsedTimerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    }

    return () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, [currentStatus]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

  // Customer cancellation handler
  const handleCancel = async () => {
    if (isCancelling || !booking?.id) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      const cancelled = await cancelBooking(booking.id, 'Cancelled by customer');
      cancelledRef.current = true;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);

      if (isMountedRef.current) {
        setBooking(cancelled || { ...booking, status: 'cancelled' });
      }
    } catch (err) {
      if (isMountedRef.current) {
        setCancelError(err.message || 'Cancellation could not be completed.');
      }
    } finally {
      if (isMountedRef.current) setIsCancelling(false);
    }
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry({
        pickup: booking.pickup,
        destination: booking.destination,
        date: booking.date,
        time: booking.time,
        duration: booking.duration,
        vehicleTier: booking.vehicleTier,
        vehicleName: booking.vehicleName,
      });
    } else if (onDismiss) {
      onDismiss();
    }
  };

  if (!booking) return null;

  const formatElapsed = (sec) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  // =========================================================================
  // VIEW 1: PENDING — FINDING YOUR DRIVER
  // =========================================================================
  if (currentStatus === 'pending') {
    const isLongWait = elapsedSeconds >= TIMEOUT_NOTICE_THRESHOLD_SECONDS;

    return (
      <div className="flex flex-col items-center py-8 px-4 max-w-lg mx-auto text-center animate-in fade-in duration-300">
        <RadarAnimation />

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold mb-2">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>Searching Nearby Pilots • {formatElapsed(elapsedSeconds)}</span>
        </div>

        <h2 className="text-2xl font-extrabold text-brand-navy dark:text-white tracking-tight mb-1">
          Finding your driver...
        </h2>
        <p className="text-xs sm:text-sm text-brand-muted dark:text-slate-300 mb-6 max-w-md">
          Your ride dispatch has been broadcast to verified chauffeur pilots near your pickup location. This screen synchronizes directly with our dispatch server.
        </p>

        {/* High demand / long wait notice */}
        {isLongWait && (
          <div className="w-full mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-xs text-amber-900 dark:text-amber-200 text-left flex items-start gap-2.5 animate-in fade-in">
            <Timer className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">High Chauffeur Demand</span>
              <span>
                Matching is taking longer than usual. You can continue waiting or cancel your request without fee.
              </span>
            </div>
          </div>
        )}

        {/* Network or polling warning banner */}
        {pollError && (
          <div className="w-full mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 text-left flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>{pollError}</span>
          </div>
        )}

        {/* Booking trip details summary */}
        <div className="w-full mb-6">
          <TripSummaryCard booking={booking} />
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isCancelling}
            className="flex-1 py-3 px-4 rounded-xl text-xs font-bold border border-rose-400 dark:border-rose-600 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {isCancelling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Cancelling Request...</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4" />
                <span>Cancel Request</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onViewTrips}
            className="py-3 px-5 rounded-xl text-xs font-bold text-brand-dark dark:text-slate-300 bg-brand-grey dark:bg-brand-navy hover:bg-slate-200 dark:hover:bg-brand-navy-subtle border border-slate-300 dark:border-brand-navy-border transition-colors cursor-pointer"
          >
            View in My Trips
          </button>
        </div>

        {cancelError && (
          <p className="mt-3 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {cancelError}
          </p>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: ACCEPTED / IN_PROGRESS — DRIVER FOUND!
  // =========================================================================
  if (currentStatus === 'accepted' || currentStatus === 'in_progress') {
    return (
      <div className="flex flex-col items-center py-8 px-4 max-w-lg mx-auto text-center animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border-2 border-emerald-500 flex items-center justify-center mb-4 text-emerald-600 dark:text-emerald-400 shadow-md">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold mb-2">
          <span>{currentStatus === 'in_progress' ? 'Trip In Progress' : 'Pilot Assigned & Confirmed'}</span>
        </div>

        <h2 className="text-2xl font-extrabold text-brand-navy dark:text-white tracking-tight mb-1">
          {currentStatus === 'in_progress' ? 'Trip in progress!' : 'Driver found!'}
        </h2>
        <p className="text-xs sm:text-sm text-brand-muted dark:text-slate-300 mb-6 max-w-md">
          {currentStatus === 'in_progress'
            ? 'Your chauffeur pilot has started your trip. Enjoy your safe journey in your car!'
            : 'A background-verified chauffeur pilot has accepted your request. Please be at your pickup location with your car keys ready.'}
        </p>

        {/* Real Driver Card - Only rendered if driver data exists */}
        {booking.driver && (
          <div className="w-full mb-5">
            <DriverCard driver={booking.driver} />
          </div>
        )}

        {/* Trip Summary */}
        <div className="w-full mb-6">
          <TripSummaryCard booking={booking} />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          {currentStatus === 'accepted' && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={isCancelling}
              className="py-3 px-4 rounded-xl text-xs font-bold border border-rose-400 dark:border-rose-600 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cancelling...</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  <span>Cancel Trip</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onViewTrips}
            className="flex-1 py-3 px-5 rounded-xl text-xs font-bold text-white bg-brand-navy hover:bg-brand-navy-hover dark:bg-brand-sky dark:text-brand-navy dark:hover:bg-white transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span>View in My Trips</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {cancelError && (
          <p className="mt-3 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {cancelError}
          </p>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: CANCELLED
  // =========================================================================
  if (currentStatus === 'cancelled') {
    return (
      <div className="flex flex-col items-center py-8 px-4 max-w-lg mx-auto text-center animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 flex items-center justify-center mb-4 text-slate-500">
          <XCircle className="w-9 h-9" />
        </div>

        <h2 className="text-2xl font-extrabold text-brand-navy dark:text-white tracking-tight mb-1">
          Booking Cancelled
        </h2>
        <p className="text-xs sm:text-sm text-brand-muted dark:text-slate-300 mb-6 max-w-md">
          Your request <span className="font-mono font-bold text-brand-navy dark:text-brand-sky">{booking.id}</span> was cancelled.
          {booking.cancelledReason ? ` (${booking.cancelledReason})` : ''}
        </p>

        <div className="w-full mb-6">
          <TripSummaryCard booking={booking} />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            type="button"
            onClick={handleRetry}
            className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-brand-navy hover:bg-brand-navy-hover dark:bg-brand-sky dark:text-brand-navy transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Book Another Ride</span>
          </button>

          <button
            type="button"
            onClick={onViewTrips}
            className="py-3 px-5 rounded-xl text-xs font-bold text-brand-dark dark:text-slate-300 bg-brand-grey dark:bg-brand-navy hover:bg-slate-200 dark:hover:bg-brand-navy-subtle border border-slate-300 dark:border-brand-navy-border transition-colors cursor-pointer"
          >
            View My Trips
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 4: REJECTED / NO DRIVER AVAILABLE / COMPLETED
  // =========================================================================
  const isRejected = currentStatus === 'rejected';
  const isCompleted = currentStatus === 'completed';

  return (
    <div className="flex flex-col items-center py-8 px-4 max-w-lg mx-auto text-center animate-in fade-in duration-300">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 border-2 shadow-sm ${
        isCompleted
          ? 'bg-brand-sky-light dark:bg-brand-navy border-brand-sky text-brand-navy dark:text-brand-sky'
          : 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 text-rose-600 dark:text-rose-400'
      }`}>
        {isCompleted ? <CheckCircle2 className="w-9 h-9" /> : <AlertCircle className="w-9 h-9" />}
      </div>

      <h2 className="text-2xl font-extrabold text-brand-navy dark:text-white tracking-tight mb-1">
        {isCompleted ? 'Trip Completed!' : isRejected ? 'No Driver Available' : `Status: ${currentStatus}`}
      </h2>

      <p className="text-xs sm:text-sm text-brand-muted dark:text-slate-300 mb-6 max-w-md">
        {isCompleted
          ? 'Your trip has been completed safely. Thank you for choosing DriveMate AI!'
          : isRejected
          ? (booking.rejectionReason
              ? `Nearby pilots were unavailable: ${booking.rejectionReason}. You can retry or change your pickup schedule.`
              : 'All nearby verified pilots are currently on trips or offline. Please retry in a few moments or schedule for later.')
          : `Booking reference ${booking.id} is in status ${currentStatus}.`}
      </p>

      <div className="w-full mb-6">
        <TripSummaryCard booking={booking} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full">
        <button
          type="button"
          onClick={handleRetry}
          className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-brand-navy hover:bg-brand-navy-hover dark:bg-brand-sky dark:text-brand-navy transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{isCompleted ? 'Book New Ride' : 'Retry Request'}</span>
        </button>

        <button
          type="button"
          onClick={onViewTrips}
          className="py-3 px-5 rounded-xl text-xs font-bold text-brand-dark dark:text-slate-300 bg-brand-grey dark:bg-brand-navy hover:bg-slate-200 dark:hover:bg-brand-navy-subtle border border-slate-300 dark:border-brand-navy-border transition-colors cursor-pointer"
        >
          View in My Trips
        </button>
      </div>
    </div>
  );
}
