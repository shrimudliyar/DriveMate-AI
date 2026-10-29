import React from 'react';
import { 
  MapPin, 
  Calendar, 
  Clock, 
  Car, 
  User, 
  Play, 
  CheckCircle, 
  AlertCircle, 
  PhoneCall, 
  CheckCheck,
  XCircle
} from 'lucide-react';
import { formatCurrency } from '../../utils/pricing';
import { useBookings } from '../../context/BookingContext';
import Badge from '../common/Badge';

export default function DriverTripCard({ booking }) {
  const { startTrip, completeTrip } = useBookings();

  const getStatusBadge = () => {
    switch (booking.status) {
      case 'accepted':
        return <Badge variant="success">Accepted • Ready to Drive</Badge>;
      case 'in_progress':
        return (
          <Badge variant="navy" className="animate-pulse">
            <span className="w-2 h-2 rounded-full bg-brand-navy dark:bg-brand-sky animate-ping" />
            <span>Trip In Progress</span>
          </Badge>
        );
      case 'completed':
        return <Badge variant="neutral">Completed</Badge>;
      case 'rejected':
        return <Badge variant="danger">Declined by Pilot</Badge>;
      case 'cancelled':
        return <Badge variant="warning">Cancelled by Customer</Badge>;
      default:
        return <Badge variant="info">{booking.status}</Badge>;
    }
  };

  return (
    <div className="dm-card p-5 hover:border-brand-sky-border transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-mono font-bold text-brand-navy dark:text-brand-sky bg-brand-sky-light dark:bg-brand-navy-dark border border-brand-sky dark:border-brand-navy-border px-2.5 py-0.5 rounded">
            {booking.id}
          </span>
          {getStatusBadge()}
        </div>

        <div className="text-right">
          <span className="text-xs text-brand-muted dark:text-slate-400 block">Pilot Payout</span>
          <span className="text-base font-extrabold text-brand-navy dark:text-brand-sky">
            {formatCurrency(booking.driverPayout || Math.round(booking.estimatedFare * 0.82))}
          </span>
        </div>
      </div>

      {/* Customer and Car */}
      <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-brand-grey-subtle dark:bg-brand-navy-dark/60 border border-slate-200 dark:border-brand-navy-border text-xs mb-3">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-brand-navy dark:text-brand-sky" />
          <span className="font-bold text-brand-dark dark:text-white">
            {booking.customerName || 'Customer'}
          </span>
          <span className="text-brand-muted dark:text-slate-400 font-mono">({booking.customerPhone || '+91 98765 43210'})</span>
        </div>

        <div className="flex items-center gap-1.5 text-brand-dark dark:text-slate-200 truncate">
          <Car className="w-4 h-4 text-brand-navy dark:text-brand-sky shrink-0" />
          <span className="font-semibold truncate">{booking.vehicleName}</span>
        </div>
      </div>

      {/* Route */}
      <div className="space-y-1.5 mb-3 text-xs">
        <div className="flex items-start gap-2">
          <div className="w-2 h-2 rounded-full bg-brand-navy dark:bg-brand-sky mt-1 shrink-0" />
          <span className="text-brand-dark dark:text-slate-200">
            <strong className="text-brand-muted dark:text-slate-400 font-semibold mr-1">From:</strong>
            {booking.pickup}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400 mt-1 shrink-0" />
          <span className="text-brand-dark dark:text-slate-200">
            <strong className="text-brand-muted dark:text-slate-400 font-semibold mr-1">To:</strong>
            {booking.destination}
          </span>
        </div>
      </div>

      {/* Date, Time, Duration */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2.5 border-y border-slate-200 dark:border-brand-navy-border/80 text-xs text-brand-dark dark:text-slate-300">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-brand-muted dark:text-slate-400" />
          <span>{booking.date}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-brand-muted dark:text-slate-400" />
          <span>{booking.time} ({booking.duration}h)</span>
        </div>
        <div className="col-span-2 sm:col-span-1 text-slate-500 text-right sm:text-left">
          {booking.completedAt ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Completed</span>
          ) : (
            <span>Est. Customer: {formatCurrency(booking.estimatedFare)}</span>
          )}
        </div>
      </div>

      {/* Rejection / Cancellation Notes */}
      {booking.rejectionReason && (
        <div className="mt-3 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
          <XCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>Decline reason: {booking.rejectionReason}</span>
        </div>
      )}

      {/* Workflow Action Controls */}
      <div className="mt-4 pt-1">
        {booking.status === 'accepted' && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => startTrip(booking.id)}
              className="flex-1 py-2.5 px-4 rounded-xl font-bold text-xs tracking-wider text-white bg-brand-navy hover:bg-brand-navy-hover dark:bg-brand-sky dark:text-brand-navy dark:hover:bg-white transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Trip (Take the Wheel)</span>
            </button>
          </div>
        )}

        {booking.status === 'in_progress' && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => completeTrip(booking.id)}
              className="flex-1 py-2.5 px-4 rounded-xl font-bold text-xs tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark Trip Completed</span>
            </button>
          </div>
        )}

        {booking.status === 'completed' && (
          <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-medium pt-1">
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Trip finished & customer vehicle returned safely
            </span>
            <span className="font-bold text-brand-dark dark:text-white">
              +{formatCurrency(booking.driverPayout || Math.round(booking.estimatedFare * 0.82))} Earned
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
