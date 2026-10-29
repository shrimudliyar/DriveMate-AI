import React from 'react';

const VARIANT_STYLES = {
  navy: 'bg-brand-sky text-brand-navy border-brand-sky-border dark:bg-brand-navy-surface dark:text-brand-sky dark:border-brand-navy-border',
  info: 'bg-brand-sky-light text-brand-navy border-brand-sky dark:bg-brand-navy-subtle dark:text-brand-sky dark:border-brand-sky/30',
  success: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  warning: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  danger: 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  neutral: 'bg-slate-100 text-brand-dark border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

export default function Badge({ children, variant = 'info', size = 'sm', className = '' }) {
  const sizeStyle = size === 'xs' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold rounded-full border ${VARIANT_STYLES[variant] || VARIANT_STYLES.info} ${sizeStyle} ${className}`}
    >
      {children}
    </span>
  );
}
