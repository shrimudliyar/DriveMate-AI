import React, { useState } from 'react';
import { 
  MapPin, 
  Calendar, 
  Clock, 
  Car, 
  User, 
  Check, 
  X, 
  FileText, 
  Shield, 
  IndianRupee 
} from 'lucide-react';
import { formatCurrency } from '../../utils/pricing';
import { useBookings } from '../../context/BookingContext';
import Badge from '../common/Badge';

export default function IncomingRequestCard({ booking }) {
  const { acceptBooking, rejectBooking, isDriverOnline, toggleDriverOnline } = useBookings();
  const [rejectPrompt, setRejectPrompt] = useState(false);
  const [rejectReason, setRejectReason] = useState('Slot schedule conflict');

  const handleAccept = () => {
    if (!isDriverOnline) {
      toggleDriverOnline();
    }
    acceptBooking(booking.id);
  };

  const handleConfirmReject = () => {
    rejectBooking(booking.id, rejectReason);
    setRejectPrompt(false);
  };

  return (
    <div className="dm-card p-5 sm:p-6 border-l-4 border-l-amber-500 hover:border-brand-sky-border transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-mono font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 px-2.5 py-0.5 rounded">
            {booking.id}
          </span>
          <Badge variant="warning">
            New Incoming Dispatch
          </Badge>
        </div>

        <div className="text-right">
          <span className="text-xs text-brand-muted dark:text-slate-400 block">Driver Payout</span>
          <span className="text-lg font-extrabold text-brand-navy dark:text-brand-sky">
            {formatCurrency(booking.driverPayout || Math.round(booking.estimatedFare * 0.82))}
          </span>
        </div>
      </div>

      {/* Customer and Vehicle Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-brand-grey-subtle dark:bg-brand-navy-dark/60 border border-slate-200 dark:border-brand-navy-border text-xs mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-brand-sky text-brand-navy flex items-center justify-center font-bold shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-brand-muted dark:text-slate-400 block">Customer</span>
            <span className="font-bold text-brand-dark dark:text-white">
              {booking.customerName || 'Alex Morgan'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-brand-sky-light dark:bg-brand-navy text-brand-navy dark:text-brand-sky flex items-center justify-center font-bold shrink-0">
            <Car className="w-4 h-4" />
          </div>
          <div className="truncate">
            <span className="text-[10px] text-brand-muted dark:text-slate-400 block">Vehicle to Drive</span>
            <span className="font-bold text-brand-dark dark:text-white truncate block">
              {booking.vehicleName}
            </span>
          </div>
        </div>
      </div>

      {/* Route */}
      <div className="space-y-2 mb-4 text-xs">
        <div className="flex items-start gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-brand-navy dark:bg-brand-sky mt-1 shrink-0" />
          <div className="text-brand-dark dark:text-slate-200 font-medium">
            <span className="text-brand-muted dark:text-slate-400 text-[10px] uppercase font-bold block">Pickup</span>
            {booking.pickup}
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 dark:bg-emerald-400 mt-1 shrink-0" />
          <div className="text-brand-dark dark:text-slate-200 font-medium">
            <span className="text-brand-muted dark:text-slate-400 text-[10px] uppercase font-bold block">Destination</span>
            {booking.destination}
          </div>
        </div>
      </div>

      {/* Date, Time, Duration */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-3 border-y border-slate-200 dark:border-brand-navy-border/80 text-xs text-brand-dark dark:text-slate-300">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-brand-muted dark:text-slate-400" />
          <span>{booking.date}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-brand-muted dark:text-slate-400" />
          <span>{booking.time}</span>
        </div>
        <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
          <span className="font-semibold text-brand-navy dark:text-brand-sky">{booking.duration} Hours Duration</span>
        </div>
      </div>

      {/* Special instructions */}
      {booking.tripNotes && (
        <div className="my-3 p-2.5 rounded-lg bg-brand-grey-subtle dark:bg-brand-navy-dark/40 border border-slate-200 dark:border-brand-navy-border text-xs text-brand-muted dark:text-slate-300 flex items-start gap-2">
          <FileText className="w-3.5 h-3.5 text-brand-navy dark:text-brand-sky shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-brand-dark dark:text-white">Customer Note: </span>
            <span>{booking.tripNotes}</span>
          </div>
        </div>
      )}

      {/* Offline warning if driver is currently offline */}
      {!isDriverOnline && (
        <div className="my-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
          You are currently <strong>Offline</strong>. Accepting this trip will switch your duty status to Online.
        </div>
      )}

      {/* Reject reason prompt */}
      {rejectPrompt ? (
        <div className="mt-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-2.5 animate-in fade-in duration-150">
          <label className="text-xs font-bold text-rose-800 dark:text-rose-300 block">
            Select Reason for Declining:
          </label>
          <select
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="w-full p-2 text-xs rounded-lg dm-input bg-white dark:bg-brand-navy text-brand-dark dark:text-white"
          >
            <option value="Slot schedule conflict">Slot schedule conflict</option>
            <option value="Pickup location too far from current area">Pickup location too far from current area</option>
            <option value="Vehicle transmission preference">Vehicle transmission preference</option>
            <option value="Taking a personal break">Taking a personal break</option>
          </select>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setRejectPrompt(false)}
              className="py-1.5 px-3 rounded-lg text-xs font-semibold text-brand-muted hover:text-brand-dark dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmReject}
              className="py-1.5 px-3 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-xs cursor-pointer"
            >
              Confirm Decline
            </button>
          </div>
        </div>
      ) : (
        /* Action buttons */
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={handleAccept}
            className="flex-1 py-3 px-4 rounded-xl font-bold text-xs tracking-wide text-white bg-emerald-600 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Accept Request</span>
          </button>

          <button
            type="button"
            onClick={() => setRejectPrompt(true)}
            className="py-3 px-4 rounded-xl font-bold text-xs text-rose-700 dark:text-rose-300 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 border border-rose-300 dark:border-rose-900 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Decline</span>
          </button>
        </div>
      )}
    </div>
  );
}
