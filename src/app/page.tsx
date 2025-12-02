'use client';

import { useState } from 'react';
import PlayerSetupModal from '@/components/PlayerSetupModal';

export default function HomePage() {
  const [mode, setMode] = useState<'host' | 'join' | null>(null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl backdrop-blur">
        <h1 className="mb-2 text-center text-3xl font-extrabold tracking-tight text-slate-50">
          Digit Duel
        </h1>
        <p className="mb-8 text-center text-sm text-slate-400">
          Two players. One secret 4‑digit code each. First to guess the other wins.
        </p>

        <div className="space-y-4">
          <button
            className="w-full rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white
                       shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400"
            onClick={() => setMode('host')}
          >
            Host game
          </button>

          <button
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm
                       font-semibold text-slate-100 transition hover:border-indigo-400 hover:bg-slate-800"
            onClick={() => setMode('join')}
          >
            Join game
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Share your room ID with a friend, pick your avatar, choose a secret number,
          and race to crack each other&apos;s code.
        </p>
      </div>

      {mode && (
        <PlayerSetupModal
          mode={mode}
          open={true}
          onClose={() => setMode(null)}
        />
      )}
    </main>
  );
}
