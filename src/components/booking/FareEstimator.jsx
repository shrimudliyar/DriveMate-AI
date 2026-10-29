import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ShieldCheck, Zap } from 'lucide-react';
import { calculateFare, formatCurrency } from '../../utils/pricing';

export default function FareEstimator({ durationHours = 2, vehicleTier = 'standard', isNight = false }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const fare = calculateFare({ durationHours, vehicleTier, isNight });

  return (
    <div className="dm-card-subtle p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider font-bold text-brand-muted dark:text-slate-400 block">
            Estimated Fare ({durationHours} {durationHours === 1 ? 'Hour' : 'Hours'})
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-brand-navy dark:text-white">
              {formatCurrency(fare.total)}
            </span>
            <span className="text-xs text-brand-muted dark:text-brand-sky/80 font-medium">
              (~{formatCurrency(fare.baseRatePerHour)}/hr pilot rate)
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-brand-navy border border-slate-300 dark:border-brand-navy-border hover:border-brand-navy dark:hover:border-brand-sky text-xs font-semibold text-brand-dark dark:text-slate-200 transition-colors shadow-xs"
        >
          <span>{showBreakdown ? 'Hide details' : 'Fare breakdown'}</span>
          {showBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Accordion breakdown */}
      {showBreakdown && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-brand-navy-border/80 text-xs space-y-2 text-brand-dark dark:text-slate-300">
          <div className="flex justify-between items-center">
            <span className="text-brand-muted dark:text-slate-400">
              Driver Pilot Wages ({durationHours} hrs × {formatCurrency(fare.baseRatePerHour)})
            </span>
            <span className="font-semibold">{formatCurrency(fare.driverWages)}</span>
          </div>

          {fare.discount > 0 && (
            <div className="flex justify-between items-center text-emerald-700 dark:text-emerald-400 font-medium">
              <span>Extended Duration Savings (applied)</span>
              <span>-{formatCurrency(fare.discount)}</span>
            </div>
          )}

          {fare.nightSurge > 0 && (
            <div className="flex justify-between items-center text-amber-700 dark:text-amber-400 font-medium">
              <span>Late Night Pilot Allowance</span>
              <span>+{formatCurrency(fare.nightSurge)}</span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5 text-brand-muted dark:text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-navy dark:text-brand-sky" />
              Customer Vehicle Safety & Insurance Protection
            </span>
            <span className="font-semibold">{formatCurrency(fare.insuranceFee)}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5 text-brand-muted dark:text-slate-400">
              <Zap className="w-3.5 h-3.5 text-brand-navy dark:text-brand-sky" />
              Platform Dispatch & Support Fee
            </span>
            <span className="font-semibold">{formatCurrency(fare.platformFee)}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-brand-muted dark:text-slate-400">Taxes (GST 5%)</span>
            <span className="font-semibold">{formatCurrency(fare.taxes)}</span>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-brand-navy-border flex justify-between items-center font-bold text-sm text-brand-navy dark:text-white">
            <span>Total Estimated Fare</span>
            <span className="text-brand-navy dark:text-brand-sky font-extrabold">{formatCurrency(fare.total)}</span>
          </div>

          <p className="text-[11px] text-brand-muted dark:text-slate-400 italic pt-1">
            * Fuel and tolls remain customer responsibility as the driver operates your personal vehicle.
          </p>
        </div>
      )}
    </div>
  );
}
