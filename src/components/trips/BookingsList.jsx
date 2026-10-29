import React, { useState } from 'react';
import { Calendar, Sparkles, Inbox } from 'lucide-react';
import BookingCard from './BookingCard';

export default function BookingsList({ bookings = [], onCancelBooking, onSwitchToBook, onTrackBooking }) {
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'completed' | 'declined'

  const filteredBookings = bookings.filter(b => {
    if (filter === 'active') return b.status === 'pending' || b.status === 'accepted' || b.status === 'in_progress';
    if (filter === 'completed') return b.status === 'completed';
    if (filter === 'declined') return b.status === 'rejected' || b.status === 'cancelled';
    return true;
  });

  const activeCount = bookings.filter(b => b.status === 'pending' || b.status === 'accepted' || b.status === 'in_progress').length;
  const completedCount = bookings.filter(b => b.status === 'completed').length;
  const declinedCount = bookings.filter(b => b.status === 'rejected' || b.status === 'cancelled').length;

  return (
    <div className="space-y-4">
      {/* Header and filter pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-brand-navy dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-navy dark:text-brand-sky" />
            <span>Driver Bookings & Trips</span>
          </h3>
          <p className="text-xs text-brand-muted dark:text-slate-400">
            Track active requests, assigned verified drivers, and past completed rides.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-brand-navy-subtle border border-slate-200 dark:border-brand-navy-border self-start sm:self-auto shadow-xs">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-brand-navy text-white shadow-xs dark:bg-brand-sky dark:text-brand-navy'
                : 'text-brand-muted hover:text-brand-dark dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            All ({bookings.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('active')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filter === 'active'
                ? 'bg-brand-navy text-white shadow-xs dark:bg-brand-sky dark:text-brand-navy'
                : 'text-brand-muted hover:text-brand-dark dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Active & Pending ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('completed')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filter === 'completed'
                ? 'bg-brand-navy text-white shadow-xs dark:bg-brand-sky dark:text-brand-navy'
                : 'text-brand-muted hover:text-brand-dark dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Completed ({completedCount})
          </button>
          {declinedCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter('declined')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filter === 'declined'
                  ? 'bg-brand-navy text-white shadow-xs dark:bg-brand-sky dark:text-brand-navy'
                  : 'text-brand-muted hover:text-brand-dark dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Declined ({declinedCount})
            </button>
          )}
        </div>
      </div>

      {/* Bookings cards or empty state */}
      {filteredBookings.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBookings.map(b => (
            <BookingCard
              key={b.id}
              booking={b}
              onCancel={onCancelBooking}
              onTrack={onTrackBooking}
            />
          ))}
        </div>
      ) : (
        <div className="dm-card p-8 text-center my-4">
          <div className="w-12 h-12 rounded-full bg-brand-sky-light dark:bg-brand-navy-dark flex items-center justify-center text-brand-navy dark:text-brand-sky mx-auto mb-3">
            <Inbox className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-brand-dark dark:text-white">No bookings found</h4>
          <p className="text-xs text-brand-muted dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            {filter === 'active'
              ? 'You do not have any active or pending driver dispatches. Request a pilot for your personal car anytime.'
              : 'There are no bookings matching your current filter.'}
          </p>
          {onSwitchToBook && (
            <button
              type="button"
              onClick={onSwitchToBook}
              className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-bold text-white bg-brand-navy hover:bg-brand-navy-hover dark:bg-brand-sky dark:text-brand-navy dark:hover:bg-white transition-colors cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Book a Driver Now</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
