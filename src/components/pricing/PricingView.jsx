import React, { useState } from 'react';
import { Calculator, Sparkles } from 'lucide-react';
import { calculateFare, formatCurrency, HOURLY_RATES } from '../../utils/pricing';

export default function PricingView({ onBookWithDuration }) {
  const [duration, setDuration] = useState(4);
  const [vehicleTier, setVehicleTier] = useState('standard');
  const [isNight, setIsNight] = useState(false);

  const fare = calculateFare({ durationHours: duration, vehicleTier, isNight });

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-sky text-brand-navy text-xs font-bold uppercase tracking-wider mb-2">
          <Calculator className="w-3.5 h-3.5" />
          <span>Transparent Personal Driver Rates</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-navy dark:text-white tracking-tight">
          Fare Estimator & Rate Card
        </h2>
        <p className="text-sm text-brand-muted dark:text-slate-300 mt-1 max-w-2xl">
          Hire professional drivers charged by the hour to drive your personal car. No surge surprises, complete fuel economy control, and included insurance.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="lg:col-span-2 dm-card p-6 sm:p-8 space-y-6">
          {/* Duration slider */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-bold text-brand-dark dark:text-white">
                Trip Duration: <span className="text-brand-navy dark:text-brand-sky">{duration} {duration === 1 ? 'Hour' : 'Hours'}</span>
              </label>
              {duration >= 6 && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 font-bold">
                  {duration >= 8 ? '12% Multi-Hour Discount' : '8% Long Trip Discount'}
                </span>
              )}
            </div>
            <input
              type="range"
              min="1"
              max="16"
              step="1"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-brand-navy-dark rounded-lg appearance-none cursor-pointer accent-brand-navy dark:accent-brand-sky"
            />
            <div className="flex justify-between text-[11px] text-brand-muted dark:text-slate-400 font-mono mt-1.5">
              <span>1 hr</span>
              <span>4 hrs</span>
              <span>8 hrs (Full Day)</span>
              <span>12 hrs</span>
              <span>16 hrs</span>
            </div>
          </div>

          {/* Vehicle Tier Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-brand-dark dark:text-slate-300 block mb-3">
              Vehicle Category
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setVehicleTier('standard')}
                className={`p-4 rounded-xl text-left border transition-all cursor-pointer ${
                  vehicleTier === 'standard'
                    ? 'bg-brand-sky-light dark:bg-brand-navy border-brand-navy dark:border-brand-sky shadow-xs'
                    : 'bg-white dark:bg-brand-navy-dark border-slate-200 dark:border-brand-navy-border text-brand-muted hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-sm text-brand-dark dark:text-white">Standard Sedan / EV</div>
                <div className="text-xs text-brand-navy dark:text-brand-sky font-bold mt-1">₹{HOURLY_RATES.standard} / hr</div>
                <p className="text-[11px] text-brand-muted dark:text-slate-400 mt-2">Hatchbacks, compact sedans, mid SUVs (Honda City, Nexon, Creta)</p>
              </button>

              <button
                type="button"
                onClick={() => setVehicleTier('premium')}
                className={`p-4 rounded-xl text-left border transition-all cursor-pointer ${
                  vehicleTier === 'premium'
                    ? 'bg-brand-sky-light dark:bg-brand-navy border-brand-navy dark:border-brand-sky shadow-xs'
                    : 'bg-white dark:bg-brand-navy-dark border-slate-200 dark:border-brand-navy-border text-brand-muted hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-sm text-brand-dark dark:text-white">Luxury & High-End</div>
                <div className="text-xs text-brand-navy dark:text-brand-sky font-bold mt-1">₹{HOURLY_RATES.premium} / hr</div>
                <p className="text-[11px] text-brand-muted dark:text-slate-400 mt-2">Executive transmissions, BMW, Audi, Mercedes, Fortuner, Defender</p>
              </button>

              <button
                type="button"
                onClick={() => setVehicleTier('outstation')}
                className={`p-4 rounded-xl text-left border transition-all cursor-pointer ${
                  vehicleTier === 'outstation'
                    ? 'bg-brand-sky-light dark:bg-brand-navy border-brand-navy dark:border-brand-sky shadow-xs'
                    : 'bg-white dark:bg-brand-navy-dark border-slate-200 dark:border-brand-navy-border text-brand-muted hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-sm text-brand-dark dark:text-white">Inter-City Outstation</div>
                <div className="text-xs text-brand-navy dark:text-brand-sky font-bold mt-1">₹{HOURLY_RATES.outstation} / hr</div>
                <p className="text-[11px] text-brand-muted dark:text-slate-400 mt-2">Highway qualified pilots for Mysore, Coorg, Chennai, Goa road trips</p>
              </button>
            </div>
          </div>

          {/* Night time toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-brand-grey-subtle dark:bg-brand-navy-dark/60 border border-slate-200 dark:border-brand-navy-border">
            <div>
              <span className="text-sm font-bold text-brand-dark dark:text-white block">Late Night Drive (10:00 PM – 6:00 AM)</span>
              <span className="text-xs text-brand-muted dark:text-slate-400">Adds flat ₹150 night driver allowance for late night safety</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isNight}
                onChange={(e) => setIsNight(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 dark:bg-brand-navy-dark peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-navy dark:peer-checked:bg-brand-sky"></div>
            </label>
          </div>
        </div>

        {/* Calculated summary card */}
        <div className="dm-card p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-muted dark:text-slate-400 block mb-1">
              Estimated Total
            </span>
            <div className="text-4xl font-extrabold text-brand-navy dark:text-white tracking-tight mb-2">
              {formatCurrency(fare.total)}
            </div>
            <p className="text-xs text-brand-muted dark:text-slate-400 mb-6">
              Full {duration}-hour driver allocation for your vehicle.
            </p>

            <div className="space-y-2.5 text-xs border-t border-slate-200 dark:border-brand-navy-border pt-4 text-brand-dark dark:text-slate-300">
              <div className="flex justify-between">
                <span className="text-brand-muted dark:text-slate-400">Hourly pilot wages</span>
                <span className="font-semibold">{formatCurrency(fare.driverWages)}</span>
              </div>
              {fare.discount > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
                  <span>Package discount</span>
                  <span>-{formatCurrency(fare.discount)}</span>
                </div>
              )}
              {fare.nightSurge > 0 && (
                <div className="flex justify-between text-amber-700 dark:text-amber-400 font-semibold">
                  <span>Night allowance</span>
                  <span>+{formatCurrency(fare.nightSurge)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-brand-muted dark:text-slate-400">Vehicle insurance shield</span>
                <span className="font-semibold">{formatCurrency(fare.insuranceFee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-muted dark:text-slate-400">Platform dispatch</span>
                <span className="font-semibold">{formatCurrency(fare.platformFee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-muted dark:text-slate-400">GST (5%)</span>
                <span className="font-semibold">{formatCurrency(fare.taxes)}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-200 dark:border-brand-navy-border">
            <button
              type="button"
              onClick={() => onBookWithDuration && onBookWithDuration(duration)}
              className="w-full py-3.5 px-4 rounded-xl text-xs font-bold text-white bg-brand-navy hover:bg-brand-navy-hover dark:bg-brand-sky dark:text-brand-navy dark:hover:bg-white text-center transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Book with this Estimate</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
