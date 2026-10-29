import React from 'react';

export default function BrandLogo({ size = 'default', showTagline = false, className = '' }) {
  const isSmall = size === 'sm';
  const isLarge = size === 'lg';

  const logoDimension = isSmall ? 'h-7 w-7' : isLarge ? 'h-12 w-12' : 'h-10 w-10';
  const titleSize = isSmall ? 'text-base' : isLarge ? 'text-2xl' : 'text-xl';

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Logo container preserving the original PNG without alteration */}
      <div className={`relative flex items-center justify-center shrink-0 rounded-xl overflow-hidden bg-white border border-slate-200/90 dark:border-brand-navy-border shadow-sm p-0.5 ${logoDimension}`}>
        <img
          src="/images/drivemate-logo.png"
          alt="DriveMate AI Logo"
          className="w-full h-full object-contain"
        />
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`font-extrabold tracking-tight text-brand-navy dark:text-white ${titleSize}`}>
            DriveMate
          </span>
          <span className="font-extrabold text-brand-navy dark:text-brand-navy bg-brand-sky px-1.5 py-0.5 rounded-md text-xs tracking-wider uppercase shadow-xs">
            AI
          </span>
        </div>
        {showTagline && (
          <p className="text-[11px] font-medium tracking-wide text-brand-muted dark:text-brand-sky/80 mt-1">
            Your Car. Your Driver. Your AI.
          </p>
        )}
      </div>
    </div>
  );
}
