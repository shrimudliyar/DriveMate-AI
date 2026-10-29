import React from 'react';
import BrandLogo from '../common/BrandLogo';
import { ShieldCheck, PhoneCall, Sparkles } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 dark:border-brand-navy-border bg-white dark:bg-brand-navy-dark py-10 px-4 sm:px-8 text-xs text-brand-muted dark:text-slate-400 transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center md:items-start gap-2">
          <BrandLogo size="sm" showTagline={true} />
          <p className="text-[11px] text-brand-muted dark:text-slate-400 max-w-sm text-center md:text-left mt-1">
            Voice-first on-demand chauffeur platform for your personal automobile. Verified drivers, instant dispatch, zero vehicle wear compromises.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 text-brand-dark dark:text-slate-300 font-semibold">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-brand-navy dark:text-brand-sky" />
            <span>₹10L Vehicle Guarantee</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-navy dark:text-brand-sky" />
            <span>Phase 1 Design Foundation</span>
          </div>
          <div className="flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-brand-navy dark:text-brand-sky" />
            <span>24x7 Customer Helpline</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-slate-200 dark:border-brand-navy-border/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-brand-muted dark:text-slate-400">
        <p>© {new Date().getFullYear()} DriveMate AI Technologies Inc. All rights reserved.</p>
        <div className="flex gap-4 font-medium">
          <span className="hover:text-brand-navy dark:hover:text-white cursor-pointer">Terms of Service</span>
          <span className="hover:text-brand-navy dark:hover:text-white cursor-pointer">Privacy Policy</span>
          <span className="hover:text-brand-navy dark:hover:text-white cursor-pointer">Safety Guidelines</span>
        </div>
      </div>
    </footer>
  );
}
