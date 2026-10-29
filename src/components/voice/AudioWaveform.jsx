import React from 'react';

export default function AudioWaveform({ isListening }) {
  // 16 responsive bars
  const bars = [
    { base: 'h-2', active: 'h-6' },
    { base: 'h-3', active: 'h-9' },
    { base: 'h-4', active: 'h-12' },
    { base: 'h-3', active: 'h-8' },
    { base: 'h-5', active: 'h-14' },
    { base: 'h-6', active: 'h-16' },
    { base: 'h-4', active: 'h-10' },
    { base: 'h-3', active: 'h-7' },
    { base: 'h-4', active: 'h-11' },
    { base: 'h-6', active: 'h-16' },
    { base: 'h-5', active: 'h-13' },
    { base: 'h-4', active: 'h-9' },
    { base: 'h-3', active: 'h-11' },
    { base: 'h-4', active: 'h-8' },
    { base: 'h-3', active: 'h-6' },
    { base: 'h-2', active: 'h-4' },
  ];

  return (
    <div className="flex items-center justify-center gap-1.5 h-16 px-4" aria-label="Voice waveform visualizer">
      {bars.map((bar, idx) => (
        <span
          key={idx}
          className={`w-1 rounded-full transition-all duration-300 ${
            isListening
              ? `${bar.active} bg-brand-navy dark:bg-brand-sky animate-pulse`
              : `${bar.base} bg-slate-200 dark:bg-brand-navy-subtle`
          }`}
          style={{
            animationDelay: isListening ? `${(idx % 5) * 120}ms` : '0ms',
            animationDuration: isListening ? '800ms' : '0ms',
          }}
        />
      ))}
    </div>
  );
}
