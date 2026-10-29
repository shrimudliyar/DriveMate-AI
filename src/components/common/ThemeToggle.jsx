import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export default function ThemeToggle({ className = '', variant = 'button' }) {
  const { theme, toggleTheme, isDark } = useTheme();

  if (variant === 'segmented') {
    return (
      <div className={`inline-flex items-center p-1 rounded-xl bg-slate-200/80 dark:bg-brand-navy-subtle border border-slate-300/80 dark:border-brand-navy-border ${className}`}>
        <button
          type="button"
          onClick={() => isDark && toggleTheme()}
          aria-label="Switch to light mode"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
            !isDark
              ? 'bg-white text-brand-navy shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sun className="w-3.5 h-3.5 text-amber-500" />
          <span>Light</span>
        </button>
        <button
          type="button"
          onClick={() => !isDark && toggleTheme()}
          aria-label="Switch to dark mode"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
            isDark
              ? 'bg-brand-navy-surface text-brand-sky border border-brand-navy-border shadow-sm'
              : 'text-slate-500 hover:text-brand-dark'
          }`}
        >
          <Moon className="w-3.5 h-3.5 text-brand-sky" />
          <span>Dark</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`p-2 rounded-xl transition-all duration-200 flex items-center justify-center border ${
        isDark
          ? 'bg-brand-navy-subtle border-brand-navy-border text-brand-sky hover:bg-brand-navy hover:text-white'
          : 'bg-white border-slate-200 text-brand-dark hover:bg-brand-sky-light hover:text-brand-navy shadow-sm'
      } ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-300" />
      ) : (
        <Moon className="w-4 h-4 text-brand-navy" />
      )}
    </button>
  );
}
