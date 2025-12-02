'use client';

import React from 'react';
import type { DigitFeedback } from '@/lib/gameTypes';

interface DigitFeedbackRowProps {
  feedback: DigitFeedback[];
  value: string;
}

export default function DigitFeedbackRow({ feedback, value }: DigitFeedbackRowProps) {
  return (
    <div className="flex justify-center gap-3">
      {feedback.map((status, idx) => {
        const digit = value[idx] ?? '';
        let colorClasses = '';

        if (status === 'correct') {
          // green glow
          colorClasses =
            'border-emerald-400 bg-emerald-500/10 text-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.9)]';
        } else if (status === 'misplaced') {
          // yellow glow
          colorClasses =
            'border-amber-400 bg-amber-500/10 text-amber-200 shadow-[0_0_18px_rgba(245,158,11,0.9)]';
        } else {
          // red glow for wrong digit
          colorClasses =
            'border-rose-500 bg-rose-500/15 text-rose-100 shadow-[0_0_18px_rgba(244,63,94,0.9)]';
        }

        return (
          <div
            key={idx}
            className={
              'flex h-12 w-12 items-center justify-center rounded-xl border text-xl font-semibold transition ' +
              colorClasses
            }
          >
            {digit || '•'}
          </div>
        );
      })}
    </div>
  );
}
