'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PlayerSetupModal from '@/components/PlayerSetupModal';

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const joinParam = searchParams.get('join');
  const [mode, setMode] = useState<'host' | 'join' | null>(() => (joinParam ? 'join' : null));
  const [prefilledRoomId, setPrefilledRoomId] = useState<string | undefined>(() => joinParam ?? undefined);

  useEffect(() => {
    if (joinParam) {
      router.replace('/', { scroll: false });
    }
  }, [joinParam, router]);

  const handleCloseModal = () => {
    setMode(null);
    setPrefilledRoomId(undefined);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-8">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/85 p-10 shadow-2xl backdrop-blur">
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
            onClick={() => {
              setPrefilledRoomId(undefined);
              setMode('host');
            }}
          >
            Host game
          </button>

          <button
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm
                       font-semibold text-slate-100 transition hover:border-indigo-400 hover:bg-slate-800"
            onClick={() => {
              setPrefilledRoomId(undefined);
              setMode('join');
            }}
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
          initialRoomId={prefilledRoomId}
          onClose={handleCloseModal}
        />
      )}
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-slate-950"><span className="text-slate-400">Loading…</span></main>}>
      <HomePageContent />
    </Suspense>
  );
}
