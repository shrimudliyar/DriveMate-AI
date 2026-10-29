import React from 'react';
import { Radio, Calendar, Clock, MapPin, Car, ArrowRight, X } from 'lucide-react';
import { formatCurrency } from '../../utils/pricing';
import { useBookings } from '../../context/BookingContext';
import { useAuth } from '../../context/AuthContext';
import Badge from '../common/Badge';

export default function BookingConfirmationModal({ booking, onClose, onViewTrips }) {
  const { switchRole } = useBookings();
  const { role, isVerifiedDriver, openAuthModal } = useAuth();
  if (!booking) return null;

  const handleGoToDriverPortal = () => {
    if (role === 'driver' && isVerifiedDriver) {
      switchRole('driver');
      onClose();
    } else {
      openAuthModal(
        'signin',
        'Verified pilot credentials required. Sign in as a verified pilot to test dispatch acceptance.'
      );
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/50 dark:bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-brand-navy-surface p-6 sm:p-8 border border-slate-200 dark:border-brand-navy-border shadow-elevated">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-brand-dark dark:hover:text-white hover:bg-slate-100 dark:hover:bg-brand-navy transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Status icon & heading */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-brand-sky-light dark:bg-brand-navy border border-brand-sky flex items-center justify-center text-brand-navy dark:text-brand-sky mb-3 shadow-xs">
            <Radio className="w-8 h-8 animate-pulse" />
          </div>
          <Badge variant="warning" className="mb-2">
            Pending Pilot Acceptance
          </Badge>
          <h3 className="text-xl sm:text-2xl font-extrabold text-brand-navy dark:text-white">
            Booking Request Broadcasted!
          </h3>
          <p className="text-xs text-brand-muted dark:text-slate-400 mt-1">
            Trip Reference: <span className="font-mono font-bold text-brand-navy dark:text-brand-sky">{booking.id}</span>
          </p>
        </div>

        {/* Trip summary card */}
        <div className="rounded-xl bg-brand-grey-subtle dark:bg-brand-navy-dark/70 border border-slate-200 dark:border-brand-navy-border p-4 space-y-3 text-xs mb-5">
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
              <span className="font-medium text-brand-dark dark:text-slate-200">{booking.time} ({booking.duration}h)</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-brand-navy-border/80">
            <div className="flex items-center gap-2 text-brand-dark dark:text-slate-300">
              <Car className="w-4 h-4 text-brand-navy dark:text-brand-sky" />
              <span className="font-semibold">{booking.vehicleName}</span>
            </div>
            <div className="font-extrabold text-sm text-brand-navy dark:text-brand-sky">
              {formatCurrency(booking.estimatedFare)}
            </div>
          </div>
        </div>

        {/* Phase 2 End-to-End prompt box */}
        <div className="p-3 rounded-xl bg-brand-sky-light/80 dark:bg-brand-navy-dark border border-brand-sky text-xs text-brand-dark dark:text-slate-200 mb-6">
          <p className="font-bold text-brand-navy dark:text-brand-sky mb-1">
            ⚡ Workflow Demo Ready:
          </p>
          <p className="text-[11px] text-brand-muted dark:text-slate-300">
            This request is now visible inside the <strong>Driver Portal</strong>. You can switch to the Driver Portal now to accept the request, start the trip, and complete it.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={handleGoToDriverPortal}
            className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-brand-navy hover:bg-brand-navy-hover dark:bg-brand-sky dark:text-brand-navy dark:hover:bg-white transition-all text-center flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span>Switch to Driver Portal (Accept)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onViewTrips}
            className="py-3 px-4 rounded-xl text-xs font-bold text-brand-dark dark:text-slate-200 bg-brand-grey dark:bg-brand-navy hover:bg-slate-200 dark:hover:bg-brand-navy-subtle border border-slate-300 dark:border-brand-navy-border transition-colors text-center cursor-pointer"
          >
            View in My Trips
          </button>
        </div>
      </div>
    </div>
  );
}
