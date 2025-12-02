'use client';

import React, { useRef } from 'react';

interface DigitInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

export default function DigitInput({ value, onChange, disabled }: DigitInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const handleChange = (index: number, raw: string) => {
    if (disabled) return;

    const digit = raw.slice(-1).replace(/\D/g, '');
    const next = [...value];
    next[index] = digit;
    onChange(next);

    if (digit && index < value.length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  return (
    <div className="flex justify-center gap-3">
      {value.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => {
            inputsRef.current[idx] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={digit}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          className="h-12 w-12 rounded-xl border border-slate-600 bg-slate-900 text-center text-xl font-semibold text-slate-100
                     outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/60 disabled:opacity-50"
        />
      ))}
    </div>
  );
}
