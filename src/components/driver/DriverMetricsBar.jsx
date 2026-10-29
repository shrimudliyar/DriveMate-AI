import React from 'react';
import { IndianRupee, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { useBookings } from '../../context/BookingContext';
import { formatCurrency } from '../../utils/pricing';

export default function DriverMetricsBar() {
  const { driverEarnings, pendingRequestsCount, completedTripsCount, acceptedTripsCount } = useBookings();

  const metrics = [
    {
      label: "Today's Payout",
      value: formatCurrency(driverEarnings),
      icon: IndianRupee,
      detail: 'Direct pilot compensation',
      highlight: 'text-brand-navy dark:text-brand-sky',
    },
    {
      label: 'Incoming Requests',
      value: pendingRequestsCount,
      icon: Clock,
      detail: pendingRequestsCount > 0 ? 'Requires your acceptance' : 'No pending requests',
      highlight: pendingRequestsCount > 0 ? 'text-amber-500' : 'text-brand-dark dark:text-white',
    },
    {
      label: 'Active & Accepted',
      value: acceptedTripsCount,
      icon: TrendingUp,
      detail: 'Scheduled to drive',
      highlight: 'text-brand-navy dark:text-brand-sky',
    },
    {
      label: 'Completed Trips',
      value: completedTripsCount,
      icon: CheckCircle,
      detail: 'Successfully delivered',
      highlight: 'text-emerald-600 dark:text-emerald-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((m, idx) => {
        const Icon = m.icon;
        return (
          <div key={idx} className="dm-card p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase font-extrabold tracking-wider text-brand-muted dark:text-slate-400">
                {m.label}
              </span>
              <div className="w-8 h-8 rounded-lg bg-brand-sky-light dark:bg-brand-navy-dark flex items-center justify-center text-brand-navy dark:text-brand-sky">
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${m.highlight}`}>
              {m.value}
            </div>

            <p className="text-[11px] text-brand-muted dark:text-slate-400 mt-1">
              {m.detail}
            </p>
          </div>
        );
      })}
    </div>
  );
}
