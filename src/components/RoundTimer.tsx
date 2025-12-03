'use client';

import React, { useEffect, useState } from 'react';

interface RoundTimerProps {
  seed: number;
  duration?: number;
  onExpire?: () => void;
  onWarningTick?: (remaining: number) => void;
}

export default function RoundTimer({
  seed,
  duration = 30,
  onExpire,
  onWarningTick,
}: RoundTimerProps) {
  const [remaining, setRemaining] = useState(duration);

  useEffect(() => {
    let cancelled = false;
    let warnedAt: number | null = null;
    let expired = false;
    const start = Date.now();
    setRemaining(duration);

    const update = () => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const left = Math.max(duration - elapsed, 0);
      if (!cancelled) {
        setRemaining(left);

        if (left <= 5 && left > 0 && warnedAt !== left) {
          warnedAt = left;
          onWarningTick?.(left);
        }

        if (left === 0 && !expired) {
          expired = true;
          onExpire?.();
        }
      }
    };

    update();
    const interval = setInterval(update, 250);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [seed, duration, onExpire, onWarningTick]);

  return (
    <div className="flex flex-col items-center gap-3 text-slate-100 sm:flex-row sm:justify-between">
      <div className="flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-slate-400">
        <span className="inline-block h-3 w-3 animate-ping rounded-full bg-emerald-400" />
        <span>Round Timer</span>
      </div>
      <div className="text-4xl font-bold text-slate-50">
        {remaining}
        <span className="ml-1 text-base font-medium text-slate-400">seconds</span>
      </div>
    </div>
  );
}
