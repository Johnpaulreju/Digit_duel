'use client';

import React from 'react';

const AVATARS = ['🤖', '🦊', '🐼', '🐸', '🐙', '🐯'];

interface AvatarPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export default function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {AVATARS.map((avatar) => {
        const selected = avatar === value;
        return (
          <button
            key={avatar}
            type="button"
            onClick={() => onChange(avatar)}
            className={`flex h-10 w-10 items-center justify-center rounded-full border text-xl transition
            ${
              selected
                ? 'border-indigo-400 bg-indigo-500/20 shadow-[0_0_16px_rgba(129,140,248,0.8)]'
                : 'border-slate-600 hover:border-indigo-400 hover:bg-slate-800'
            }`}
          >
            {avatar}
          </button>
        );
      })}
    </div>
  );
}
