import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  Car, 
  User, 
  ShieldCheck, 
  ChevronDown, 
  ChevronUp, 
  XCircle, 
  AlertCircle,
  Radio,
  PhoneCall
} from 'lucide-react';
import Badge from '../common/Badge';
import { formatCurrency } from '../../utils/pricing';

export default function BookingCard({ booking, onCancel, onTrack }) {
  const [expanded, setExpanded] = useState(false);

  const getStatusBadge = () => {
    switch (booking.status) {
      case 'pending':
        return (
          <Badge variant="warning">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>Matching Pilot</span>
          </Badge>
        );
      case 'accepted':
        return <Badge variant="success">Pilot Assigned & Confirmed</Badge>;
      case 'in_progress':
        return (
          <Badge variant="navy" className="animate-pulse">
            <span className="w-2 h-2 rounded-full bg-brand-navy dark:bg-brand-sky animate-ping" />
            <span>Trip In Progress</span>
          </Badge>
        );
      case 'completed':
        return <Badge variant="neutral">Trip Completed</Badge>;
      case 'rejected':
        return <Badge variant="danger">Declined by Pilot</Badge>;
      case 'cancelled':
        return <Badge variant="warning">Cancelled</Badge>;
      default:
        return <Badge variant="info">{booking.status}</Badge>;
    }
  };

  const isCancellable = booking.status === 'pending' || booking.status === 'accepted';

  return (
    <div className="dm-card p-5 hover:border-brand-sky-border dark:hover:border-brand-sky/40">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-mono font-bold text-brand-navy dark:text-brand-sky bg-brand-sky-light dark:bg-brand-navy-dark border border-brand-sky dark:border-brand-navy-border px-2 py-0.5 rounded">
            {booking.id}
          </span>
          {getStatusBadge()}
        </div>

        <div className="text-right">
          <span className="text-xs text-brand-muted dark:text-slate-400 block">Est. Fare</span>
          <span className="text-base font-extrabold text-brand-navy dark:text-white">
            {formatCurrency(booking.estimatedFare)}
          </span>
        </div>
      </div>

      {/* Route */}
      <div className="space-y-2 mb-4 text-xs">
        <div className="flex items-start gap-2.5">
          <div className="w-2 h-2 rounded-full bg-brand-navy dark:bg-brand-sky mt-1.5 shrink-0" />
          <div className="text-brand-dark dark:text-slate-200 font-medium">
            <span className="text-brand-muted dark:text-slate-400 text-[11px] block">Pickup</span>
            {booking.pickup}
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <div className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400 mt-1.5 shrink-0" />
          <div className="text-brand-dark dark:text-slate-200 font-medium">
            <span className="text-brand-muted dark:text-slate-400 text-[11px] block">Destination</span>
            {booking.destination}
          </div>
        </div>
      </div>

      {/* Date & Car Info */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-3 border-y border-slate-200 dark:border-brand-navy-border/80 text-xs text-brand-dark dark:text-slate-300">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-brand-muted dark:text-slate-400" />
          <span>{booking.date}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-brand-muted dark:text-slate-400" />
          <span>{booking.time} ({booking.duration}h)</span>
        </div>
        <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1 truncate">
          <Car className="w-3.5 h-3.5 text-brand-navy dark:text-brand-sky shrink-0" />
          <span className="truncate">{booking.vehicleName}</span>
        </div>
      </div>

      {/* Driver status / preview */}
      <div className="flex items-center justify-between mt-3 text-xs">
        {booking.driver ? (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-brand-sky text-brand-navy flex items-center justify-center font-bold">
              <User className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-bold text-brand-dark dark:text-white block leading-tight">
                {booking.driver.name}
              </span>
              <span className="text-[10px] text-brand-muted dark:text-slate-400">
                ★ {booking.driver.rating} • {booking.driver.badge || 'Verified Pilot'}
              </span>
            </div>
          </div>
        ) : booking.status === 'pending' ? (
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span className="text-[11px] font-semibold">Broadcasting to certified pilots nearby...</span>
          </div>
        ) : booking.status === 'rejected' ? (
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold">Pilot declined: {booking.rejectionReason || 'Slot conflict'}</span>
          </div>
        ) : (
          <div className="text-[11px] text-brand-muted dark:text-slate-400">
            Trip recorded in history
          </div>
        )}

        <div className="flex items-center gap-2">
          {onTrack && (booking.status === 'pending' || booking.status === 'accepted' || booking.status === 'in_progress') && (
            <button
              type="button"
              onClick={() => onTrack(booking)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-brand-navy dark:bg-brand-sky text-white dark:text-brand-navy shadow-xs cursor-pointer hover:opacity-90"
            >
              <Radio className="w-3 h-3 animate-pulse" />
              <span>Live Status</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-brand-navy hover:text-brand-navy-hover dark:text-brand-sky text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>{expanded ? 'Less' : 'Details'}</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-brand-navy-border text-xs space-y-2.5 text-brand-dark dark:text-slate-300">
          {booking.tripNotes && (
            <div>
              <span className="text-brand-dark dark:text-white font-bold block mb-0.5">Trip Instructions:</span>
              <p className="italic bg-brand-grey-subtle dark:bg-brand-navy-dark/60 p-2.5 rounded-lg border border-slate-200 dark:border-brand-navy-border">{booking.tripNotes}</p>
            </div>
          )}

          {booking.driver?.phone && (
            <div className="flex items-center gap-2 text-brand-dark dark:text-slate-300">
              <PhoneCall className="w-3.5 h-3.5 text-brand-navy dark:text-brand-sky" />
              <span>Assigned Driver Direct Contact: <strong>{booking.driver.phone}</strong></span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Identity Verified & Vehicle Insured</span>
            </div>

            {isCancellable && onCancel && (
              <button
                type="button"
                onClick={() => onCancel(booking.id)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline transition-colors cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel booking</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
