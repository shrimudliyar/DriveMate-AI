import React, { useState } from 'react';
import SafetySection from '../../components/safety/SafetySection';
import BrandLogo from '../../components/common/BrandLogo';
import GetStartedModal from '../auth/GetStartedModal';
import { Car, User, ArrowRight } from 'lucide-react';

export default function PublicHome() {
  const [getStartedOpen, setGetStartedOpen] = useState(false);

  return (
    /*
     * Desktop: fixed two-panel layout filling the viewport.
     *   - Left panel scrolls independently (overflow-y-auto).
     *   - Right panel stays centred and stationary.
     *   - The outer container is h-dvh overflow-hidden on lg+, so the
     *     document itself does not scroll.
     * Mobile: normal document flow, stacked vertically, full scroll.
     */
    <div className="
      bg-brand-grey dark:bg-brand-navy-dark text-brand-dark dark:text-white
      flex flex-col
      min-h-screen
      lg:h-[100dvh] lg:overflow-hidden
    ">
      {/* ── Get Started Modal (two-step auth entry) ── */}
      <GetStartedModal
        isOpen={getStartedOpen}
        onClose={() => setGetStartedOpen(false)}
      />

      {/*
       * Two-panel wrapper.
       * lg+: side-by-side flex row filling the remaining height.
       * <lg: normal stacking.
       */}
      <div className="flex flex-col lg:flex-row flex-1 lg:overflow-hidden">

        {/* ── LEFT PANEL — scrollable ── */}
        <div className="
          lg:flex-1
          lg:overflow-y-auto
          scrollbar-none
          px-6 sm:px-10 lg:px-12 xl:px-16
          py-10 lg:py-12
          space-y-8
          lg:border-r border-slate-200 dark:border-brand-navy-border
        ">
          {/* Brand & Hero text */}
          <div className="space-y-4 max-w-2xl">
            <BrandLogo size="large" showTagline={false} />
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-brand-navy dark:text-white tracking-tight leading-tight">
              Your Car. Your Driver. Your AI.
            </h1>
            <p className="text-base sm:text-lg text-brand-muted dark:text-slate-300 leading-relaxed">
              DriveMate AI connects personal car owners with verified professional
              drivers through a trusted AI‑powered platform. Schedule a driver,
              enjoy safety‑first vetting, and let AI handle the logistics.
            </p>
          </div>

          {/* How It Works card */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-brand-navy-surface border border-slate-200 dark:border-brand-navy-border shadow-soft max-w-2xl">
            <h2 className="text-base sm:text-lg font-bold text-brand-navy dark:text-white mb-3">
              How It Works
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-brand-muted dark:text-slate-300">
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-navy dark:bg-brand-sky mt-2 shrink-0" />
                <span>Sign in as Customer or Driver.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-navy dark:bg-brand-sky mt-2 shrink-0" />
                <span>Customers post a booking; AI matches verified pilots.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-navy dark:bg-brand-sky mt-2 shrink-0" />
                <span>Drivers accept trips, get paid, and manage earnings.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-navy dark:bg-brand-sky mt-2 shrink-0" />
                <span>All interactions are logged and visible in your portal.</span>
              </li>
            </ul>
          </div>

          {/* Safety & Trust Section */}
          <div className="min-w-0">
            <SafetySection gridCols="grid-cols-1 sm:grid-cols-2 gap-4" />
          </div>
        </div>

        {/* ── RIGHT PANEL — stationary, vertically centred ── */}
        <div className="
          lg:w-[420px] xl:w-[460px] shrink-0
          flex items-center justify-center
          px-6 sm:px-10 lg:px-12 xl:px-14
          py-10 lg:py-12
          lg:overflow-hidden
        ">
          <div className="w-full max-w-sm bg-white dark:bg-brand-navy-surface p-6 sm:p-8 rounded-2xl shadow-elevated border border-slate-200 dark:border-brand-navy-border">
            <div className="flex flex-col items-center gap-5 text-center">
              <div>
                <h2 className="text-xl font-extrabold text-brand-navy dark:text-white">
                  Get started today
                </h2>
                <p className="text-xs sm:text-sm text-brand-muted dark:text-slate-400 mt-1">
                  Join DriveMate AI as a customer or a driver pilot.
                </p>
              </div>

              {/* Primary CTA → opens the two-step modal */}
              <button
                type="button"
                onClick={() => setGetStartedOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-full bg-brand-navy dark:bg-brand-sky text-white dark:text-brand-navy font-bold text-sm hover:opacity-90 transition-opacity shadow-sm"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Role hint buttons (decorative — both open the same modal) */}
              <div className="w-full grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setGetStartedOpen(true)}
                  className="flex flex-col items-center gap-2 p-3.5 rounded-xl border border-slate-200 dark:border-brand-navy-border hover:border-brand-sky dark:hover:border-brand-sky text-xs text-brand-muted dark:text-slate-400 hover:text-brand-navy dark:hover:text-brand-sky transition-colors bg-brand-grey-subtle/50 dark:bg-brand-navy-dark/40"
                >
                  <User className="w-5 h-5 text-brand-navy dark:text-brand-sky" />
                  <span className="font-semibold text-brand-dark dark:text-slate-200">Customer</span>
                  <span className="text-[11px] text-brand-muted dark:text-slate-400">Book a driver</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGetStartedOpen(true)}
                  className="flex flex-col items-center gap-2 p-3.5 rounded-xl border border-slate-200 dark:border-brand-navy-border hover:border-brand-sky dark:hover:border-brand-sky text-xs text-brand-muted dark:text-slate-400 hover:text-brand-navy dark:hover:text-brand-sky transition-colors bg-brand-grey-subtle/50 dark:bg-brand-navy-dark/40"
                >
                  <Car className="w-5 h-5 text-brand-navy dark:text-brand-sky" />
                  <span className="font-semibold text-brand-dark dark:text-slate-200">Driver</span>
                  <span className="text-[11px] text-brand-muted dark:text-slate-400">Drive &amp; earn</span>
                </button>
              </div>

              <p className="text-xs text-brand-muted dark:text-slate-500">
                Booking a driver · Driving with DriveMate
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
