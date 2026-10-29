import React from 'react';
import { ShieldCheck, CarFront, RadioTower, ClipboardCheck, Lock, Award, CheckCircle } from 'lucide-react';
import { SAFETY_HIGHLIGHTS } from '../../data/mockData';

const ICON_MAP = {
  ShieldCheck: ShieldCheck,
  CarFront: CarFront,
  RadioTower: RadioTower,
  ClipboardCheck: ClipboardCheck,
};

export default function SafetySection({
  gridCols = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
  className = '',
}) {
  return (
    <section className={`dm-card p-6 sm:p-8 ${className}`}>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-sky text-brand-navy text-xs font-bold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-navy" />
            <span>DriveMate Safety Shield</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-navy dark:text-white tracking-tight">
            Trained Drivers for Your Personal Car
          </h2>
          <p className="text-sm text-brand-muted dark:text-slate-300 mt-1 max-w-xl">
            We treat your personal vehicle with white-glove care. Every pilot is stringently vetted, experienced in luxury and EV transmissions, and backed by comprehensive coverage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-semibold text-brand-dark dark:text-slate-300">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-brand-navy dark:text-brand-sky shrink-0" />
            <span>RTO Licensed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-brand-navy dark:text-brand-sky shrink-0" />
            <span>Zero-Tolerance Drug Tested</span>
          </div>
        </div>
      </div>

      {/* Grid of 4 pillars */}
      <div className={`grid ${gridCols}`}>
        {SAFETY_HIGHLIGHTS.map(item => {
          const Icon = ICON_MAP[item.icon] || ShieldCheck;
          return (
            <div
              key={item.id}
              className="rounded-xl p-4 bg-brand-grey-subtle dark:bg-brand-navy-dark/60 border border-slate-200 dark:border-brand-navy-border hover:border-brand-sky-border transition-all flex flex-col justify-between min-w-0"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-brand-sky text-brand-navy dark:bg-brand-navy dark:text-brand-sky flex items-center justify-center mb-3 shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-brand-dark dark:text-white mb-1.5 leading-snug break-words">
                  {item.title}
                </h3>
                <p className="text-xs text-brand-muted dark:text-slate-400 leading-relaxed break-words">
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Verification protocol callout */}
      <div className="mt-6 pt-5 border-t border-slate-200 dark:border-brand-navy-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-brand-muted dark:text-slate-400">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-500 shrink-0" />
          <span>Drivers maintain a mandatory minimum 4.8★ passenger rating and 5+ years of driving experience.</span>
        </div>
        <div className="flex items-center gap-1 text-brand-navy dark:text-brand-sky font-bold cursor-pointer hover:underline shrink-0">
          <Lock className="w-3.5 h-3.5" />
          <span>Learn more about our trust standards</span>
        </div>
      </div>
    </section>
  );
}
