'use client';

import React, { useEffect, useState } from 'react';

interface RoundTimerProps {
  seed: number; // change this to restart timer
  duration?: number;
}

export default function RoundTimer({ seed, duration = 15 }: RoundTimerProps) {
  const [remaining, setRemaining] = useState(duration);

  useEffect(() => {
    let active = true;
    const start = Date.now();

    const update = () => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const left = duration - elapsed;
      if (active) {
        setRemaining(left > 0 ? left : 0);
      }
    };

    update();
    const interval = setInterval(update, 250);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [seed, duration]);

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
