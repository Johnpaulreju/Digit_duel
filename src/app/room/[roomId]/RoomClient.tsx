'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DigitFeedback } from '@/lib/gameTypes';
import DigitInput from '@/components/DigitInput';
import DigitFeedbackRow from '@/components/DigitFeedbackRow';
import RoundTimer from '@/components/RoundTimer';
import CelebrationConfetti from '@/components/CelebrationConfetti';

interface Guess {
  value: string;
  feedback: DigitFeedback[];
  createdAt: number;
}

interface PublicPlayer {
  id: string;
  name: string;
  avatar: string;
  ready: boolean;
  guesses: Guess[];
}

type RoomStatus =
  | 'waitingForPlayers'
  | 'settingSecret'
  | 'inProgress'
  | 'finished';

interface RoomState {
  roomId: string;
  status: RoomStatus;
  winnerId: string | null;
  opponentSecret: string | null;
  you: PublicPlayer;
  opponent: PublicPlayer | null;
}

export default function RoomClient({
  roomId,
  initialPlayerId,
}: {
  roomId: string;
  initialPlayerId?: string;
}) {
  const router = useRouter();
  const [playerId] = useState(initialPlayerId ?? '');
  const [state, setState] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(true);
  const [secretDigits, setSecretDigits] = useState<string[]>(['', '', '', '']);
  const [guessDigits, setGuessDigits] = useState<string[]>(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId) {
      setError('Missing player ID. Go back and re-join the game.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchState = async () => {
      try {
        const res = await fetch(
          `/api/rooms/${roomId}/state?playerId=${encodeURIComponent(playerId)}`,
          { cache: 'no-store' }
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error ?? 'Failed to load game state');
        }

        if (!cancelled) {
          setState(data);
          setLoading(false);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Failed to load game';
          setError(message);
          setLoading(false);
        }
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [roomId, playerId]);

  const handleLockSecret = async () => {
    if (!state) return;

    const value = secretDigits.join('');
    if (!/^\d{4}$/.test(value)) {
      setError('Your secret must be exactly 4 digits.');
      return;
    }

    try {
      setError(null);
      const res = await fetch(`/api/rooms/${roomId}/set-secret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, secret: value }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? 'Failed to lock secret');
      }

      setState(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to lock secret';
      setError(message);
    }
  };

  const handleSubmitGuess = async () => {
    if (!state || state.status !== 'inProgress') return;

    const value = guessDigits.join('');
    if (!/^\d{4}$/.test(value)) {
      setError('Your guess must be exactly 4 digits.');
      return;
    }

    try {
      setError(null);
      const res = await fetch(`/api/rooms/${roomId}/guess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, guess: value }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? 'Failed to submit guess');
      }

      setGuessDigits(['', '', '', '']);
      setState(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to submit guess';
      setError(message);
    }
  };

  const handleBackHome = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-slate-300">
          <span className="h-3 w-3 animate-ping rounded-full bg-indigo-400" />
          <span>Loading room…</span>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-slate-200">Game state not available.</p>
        <button
          onClick={handleBackHome}
          className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white"
        >
          Back home
        </button>
      </main>
    );
  }

  const { you, opponent, status, winnerId, opponentSecret } = state;

  const lastGuess = you.guesses[you.guesses.length - 1];

  const everyoneReady =
    opponent && you.ready && opponent.ready && status !== 'waitingForPlayers';

  const gameFinished = status === 'finished';

  const youWon = gameFinished && winnerId === you.id;
  const youLost = gameFinished && winnerId && winnerId !== you.id;

  const timerSeed = you.guesses.length + (status === 'inProgress' ? 1 : 0);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      {youWon && <CelebrationConfetti run={true} />}
      <div className="w-full max-w-5xl rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Room
            </p>
            <p className="text-lg font-semibold text-slate-50">{state.roomId}</p>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-300">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-lg">
                {you.avatar}
              </span>
              <span className="font-medium">{you.name}</span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                You
              </span>
            </div>
            {opponent && (
              <>
                <span className="text-xs text-slate-600">vs</span>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-lg">
                    {opponent.avatar}
                  </span>
                  <span className="font-medium text-slate-200">
                    {opponent.name}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mb-4 text-sm text-slate-300">
          {status === 'waitingForPlayers' && (
            <p>
              Waiting for the second player to join… Share this room ID with your friend.
            </p>
          )}

          {status === 'settingSecret' && !everyoneReady && (
            <p>
              Choose your secret 4‑digit number. Once you lock it in, you can&apos;t change it.
              You&apos;ll see a blur while waiting for your opponent.
            </p>
          )}

          {status === 'inProgress' && (
            <p>
              Game on! Try to crack your opponent&apos;s 4‑digit code before they guess yours.
            </p>
          )}

          {status === 'finished' && youWon && (
            <p className="font-semibold text-emerald-400">
              You cracked the code first. You win! 🎉
            </p>
          )}

          {status === 'finished' && youLost && (
            <p className="font-semibold text-rose-400">
              Your opponent cracked your code first. You lose. 😅
            </p>
          )}
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}

        {status !== 'inProgress' && !gameFinished && (
          <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
            {you.ready && (!opponent || !opponent.ready) && (
              <div className="pointer-events-none absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
            )}

            <h3 className="mb-2 text-sm font-semibold text-slate-100">
              Your secret code
            </h3>
            <p className="mb-4 text-xs text-slate-400">
              Enter a random 4‑digit number. This is what your opponent will be trying to guess.
            </p>

            <DigitInput
              value={secretDigits}
              onChange={setSecretDigits}
              disabled={you.ready}
            />

            <button
              onClick={handleLockSecret}
              disabled={you.ready}
              className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold
                         text-emerald-950 shadow-md shadow-emerald-500/30 transition
                         hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/60"
            >
              {you.ready ? 'Secret locked' : 'Lock secret'}
            </button>

            {opponent && (
              <p className="mt-3 text-xs text-slate-400">
                Opponent status:{' '}
                <span
                  className={
                    opponent.ready
                      ? 'font-semibold text-emerald-300'
                      : 'font-semibold text-amber-300'
                  }
                >
                  {opponent.ready ? 'Ready' : 'Choosing…'}
                </span>
              </p>
            )}
          </div>
        )}

        {status === 'inProgress' && (
          <div className="mt-6 flex flex-col gap-5 lg:flex-row">
            <aside className="order-2 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 lg:order-1 lg:w-72">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Your attempts
              </h3>
              {you.guesses.length === 0 ? (
                <p className="text-xs text-slate-500">
                  You don&apos;t have any guesses yet.
                </p>
              ) : (
                <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
                  {you.guesses
                    .slice()
                    .sort((a, b) => a.createdAt - b.createdAt)
                    .map((g, idx) => (
                      <div
                        key={g.createdAt}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-700/70 bg-slate-900/90 px-3 py-2"
                      >
                        <span className="text-xs text-slate-500">
                          #{idx + 1}
                        </span>
                        <div className="flex-1">
                          <DigitFeedbackRow feedback={g.feedback} value={g.value} />
                        </div>
                        <span className="font-mono text-sm text-slate-200">
                          {g.value}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </aside>

            <div className="order-1 flex-1 space-y-5 lg:order-2">
              <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
                <RoundTimer seed={timerSeed} />
                <p className="mt-3 text-xs text-slate-400">
                  First to guess all 4 digits in the right order wins.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
                <h3 className="mb-2 text-sm font-semibold text-slate-100">
                  Last attempt
                </h3>
                {lastGuess ? (
                  <div className="space-y-3">
                    <DigitFeedbackRow
                      feedback={lastGuess.feedback}
                      value={lastGuess.value}
                    />
                    <p className="text-xs text-slate-400">
                      Your guess:{' '}
                      <span className="font-mono text-slate-100">
                        {lastGuess.value}
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    No guesses yet. Take your first shot!
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
                <h3 className="mb-2 text-sm font-semibold text-slate-100">
                  Your next guess
                </h3>
                <p className="mb-4 text-xs text-slate-400">
                  Type a 4‑digit number. We&apos;ll color the digits:
                  <span className="ml-1 text-emerald-300">green</span> = correct digit &amp; spot,
                  <span className="ml-1 text-amber-300">yellow</span> = digit exists but wrong spot,
                  <span className="ml-1 text-rose-300">red</span> = digit not in the code.
                </p>

                <DigitInput value={guessDigits} onChange={setGuessDigits} />

                <button
                  onClick={handleSubmitGuess}
                  className="mt-4 w-full rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold
                             text-white shadow-md shadow-indigo-500/30 transition
                             hover:bg-indigo-400"
                >
                  Submit guess
                </button>
              </div>
            </div>
          </div>
        )}

        {gameFinished && (
          <div className="mt-6 flex flex-col items-center gap-3">
            {opponentSecret && (
              <div className="w-full rounded-2xl border border-indigo-500/40 bg-indigo-500/10 p-5 text-center text-slate-100">
                <p className="text-xs uppercase tracking-[0.4em] text-indigo-300">
                  Opponent&apos;s secret code
                </p>
                <p className="mt-3 font-mono text-4xl font-bold tracking-[0.5em] text-slate-50">
                  {opponentSecret.split('').join(' ')}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  That&apos;s the number {opponent?.name} locked in.
                </p>
              </div>
            )}
            <button
              onClick={handleBackHome}
              className="w-full rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-100
                         transition hover:bg-slate-700"
            >
              Back to home
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
