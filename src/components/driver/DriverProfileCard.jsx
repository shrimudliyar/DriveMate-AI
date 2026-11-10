import React from 'react';
import {
  ShieldCheck,
  Award,
  Calendar,
  Car,
  PhoneCall,
  CheckCircle2,
  Power
} from 'lucide-react';
import { useBookings } from '../../context/BookingContext';

export default function DriverProfileCard() {
  const { driverProfile, isDriverOnline, toggleDriverOnline } = useBookings();

  // If driverProfile is not yet available, render a clean loading placeholder rather than crashing
  if (!driverProfile) {
    return (
      <div className="dm-card p-6 sm:p-8 relative overflow-hidden animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-200 dark:bg-brand-navy-surface shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-5 bg-slate-200 dark:bg-brand-navy-surface rounded w-48" />
            <div className="h-3 bg-slate-200 dark:bg-brand-navy-surface rounded w-32" />
          </div>
        </div>
      </div>
    );
  }

  // Defensive extractions with safe defaults
  const name = driverProfile.name || driverProfile.full_name || 'Driver Pilot';
  const initials = name
    .split(' ')
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'DP';

  const verificationStatus = driverProfile.verificationStatus || driverProfile.verification_status || 'Police & Background Verified';
  const pilotId = driverProfile.id || 'DRV-PILOT';
  const joinedDate = driverProfile.joinedDate || 'Recently';
  const rating = typeof driverProfile.rating === 'number' ? driverProfile.rating.toFixed(2) : (driverProfile.rating || '5.00');
  const totalTrips = driverProfile.totalTrips ?? driverProfile.total_trips ?? 0;
  const phone = driverProfile.phone || '';
  const licenseNumber = driverProfile.licenseNumber || driverProfile.license_number || 'Pending Submission';
  const experienceYears = driverProfile.experienceYears ?? driverProfile.experience_years ?? 0;

  // Defensive array handling: normalize languages to a valid Array of strings
  const languagesList = Array.isArray(driverProfile.languages) && driverProfile.languages.length > 0
    ? driverProfile.languages
    : (typeof driverProfile.languages === 'string' && driverProfile.languages.trim()
      ? driverProfile.languages.split(',').map(s => s.trim())
      : ['English']);

  return (
    <div className="dm-card p-6 sm:p-8 relative overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">

        {/* Driver identity */}
        <div className="flex items-start sm:items-center gap-4">
          <div className="relative shrink-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-brand-navy text-white dark:bg-brand-sky dark:text-brand-navy flex items-center justify-center font-extrabold text-xl sm:text-2xl shadow-sm">
              {initials}
            </div>
            <span
              className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white dark:border-brand-navy-surface flex items-center justify-center ${isDriverOnline ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              title={isDriverOnline ? 'Online' : 'Offline'}
            >
              <span className={`w-2 h-2 rounded-full ${isDriverOnline ? 'bg-white animate-ping' : 'bg-white'}`} />
            </span>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-extrabold text-brand-navy dark:text-white tracking-tight">
                {name}
              </h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>{verificationStatus}</span>
              </span>
            </div>

            <p className="text-xs text-brand-muted dark:text-slate-400 mt-0.5">
              Pilot ID: <span className="font-mono font-bold text-brand-dark dark:text-slate-200">{pilotId}</span> • Member since {joinedDate}
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
              <span className="font-bold text-amber-500 flex items-center gap-1">
                ★ {rating} <span className="text-brand-muted dark:text-slate-400 font-normal">({totalTrips} drives)</span>
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-brand-dark dark:text-slate-300 font-semibold flex items-center gap-1">
                <PhoneCall className="w-3 h-3 text-brand-navy dark:text-brand-sky" />
                {phone}
              </span>
            </div>
          </div>
        </div>

        {/* Online / Offline status toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <div className="p-3 rounded-xl bg-brand-grey-subtle dark:bg-brand-navy-dark/60 border border-slate-200 dark:border-brand-navy-border text-center sm:text-right">
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-brand-muted dark:text-slate-400 block">
              Dispatch Duty
            </span>
            <span className={`text-xs font-bold ${isDriverOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
              {isDriverOnline ? 'Online • Accepting Trips' : 'Offline • Paused'}
            </span>
          </div>

          <button
            type="button"
            onClick={toggleDriverOnline}
            className={`flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-bold text-xs tracking-wider transition-all cursor-pointer shadow-xs ${isDriverOnline
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-600 hover:bg-slate-700 text-white'
              }`}
          >
            <Power className="w-4 h-4" />
            <span>{isDriverOnline ? 'Go Offline' : 'Go Online'}</span>
          </button>
        </div>
      </div>

      {/* Vehicle-independent credentials badge strip */}
      <div className="mt-6 pt-5 border-t border-slate-200 dark:border-brand-navy-border/80">
        <div className="text-[11px] uppercase tracking-wider font-extrabold text-brand-muted dark:text-slate-400 mb-2.5 flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5 text-brand-navy dark:text-brand-sky" />
          <span>Professional Vehicle-Independent Pilot Credentials</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
          <div className="p-2.5 rounded-lg bg-brand-grey-subtle dark:bg-brand-navy-dark/50 border border-slate-200 dark:border-brand-navy-border">
            <span className="text-[10px] text-brand-muted dark:text-slate-400 block">License Class</span>
            <span className="font-bold text-brand-dark dark:text-slate-200">{licenseNumber} (LMV)</span>
          </div>

          <div className="p-2.5 rounded-lg bg-brand-grey-subtle dark:bg-brand-navy-dark/50 border border-slate-200 dark:border-brand-navy-border">
            <span className="text-[10px] text-brand-muted dark:text-slate-400 block">Experience</span>
            <span className="font-bold text-brand-dark dark:text-slate-200">{experienceYears}+ Years Vetted Driving</span>
          </div>

          <div className="p-2.5 rounded-lg bg-brand-grey-subtle dark:bg-brand-navy-dark/50 border border-slate-200 dark:border-brand-navy-border">
            <span className="text-[10px] text-brand-muted dark:text-slate-400 block">Transmissions</span>
            <span className="font-bold text-brand-dark dark:text-slate-200">Manual, Auto & Electric</span>
          </div>

          <div className="p-2.5 rounded-lg bg-brand-grey-subtle dark:bg-brand-navy-dark/50 border border-slate-200 dark:border-brand-navy-border">
            <span className="text-[10px] text-brand-muted dark:text-slate-400 block">Languages Spoken</span>
            <span className="font-bold text-brand-dark dark:text-slate-200">{languagesList.join(', ')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
