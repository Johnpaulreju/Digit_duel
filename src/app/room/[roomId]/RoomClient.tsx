'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DigitFeedback } from '@/lib/gameTypes';
import DigitInput from '@/components/DigitInput';
import DigitFeedbackRow from '@/components/DigitFeedbackRow';
import RoundTimer from '@/components/RoundTimer';
import AvatarPicker from '@/components/AvatarPicker';
import confetti from 'canvas-confetti';
import useSound from 'use-sound';

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
  const [soundsReady, setSoundsReady] = useState(false);
  useEffect(() => {
    setSoundsReady(true);
  }, []);
  const [playClick] = useSound('/sounds/click.wav', { volume: 0.5, soundEnabled: soundsReady });
  const [playWin] = useSound('/sounds/won.wav', { volume: 0.6, soundEnabled: soundsReady });
  const [playLose] = useSound('/sounds/loss.mp3', { volume: 0.5, soundEnabled: soundsReady });
  const [playerId, setPlayerId] = useState(initialPlayerId ?? '');
  const [state, setState] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(!!initialPlayerId);
  const [error, setError] = useState<string | null>(null);

  const [secretDigits, setSecretDigits] = useState<string[]>(['', '', '', '']);
  const [guessDigits, setGuessDigits] = useState<string[]>(['', '', '', '']);
  const [copied, setCopied] = useState(false);

  const [joinName, setJoinName] = useState('');
  const [joinAvatar, setJoinAvatar] = useState('🤖');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (!playerId) {
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
          if (res.status === 404) throw new Error('Room not found or expired');
          throw new Error(data?.error ?? 'Failed to load game state');
        }

        if (!cancelled) {
          setState(data);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load game';
          if (!state) setError(message);
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
  }, [roomId, playerId, state]);

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    playClick();
    if (!joinName.trim()) return;

    try {
      setIsJoining(true);
      setError(null);

      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          name: joinName.trim(),
          avatar: joinAvatar,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? 'Failed to join room');
      }

      const newPlayerId = data.player.id;
      setPlayerId(newPlayerId);

      const newUrl = `/room/${roomId}?playerId=${newPlayerId}`;
      window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to join room';
      setError(message);
    } finally {
      setIsJoining(false);
    }
  };

  const handleLockSecret = async () => {
    playClick();
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
      if (!res.ok) throw new Error(data?.error ?? 'Failed to lock secret');

      setState(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to lock secret';
      setError(message);
    }
  };

  const handleSubmitGuess = async () => {
    playClick();
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
      if (!res.ok) throw new Error(data?.error ?? 'Failed to submit guess');

      setGuessDigits(['', '', '', '']);
      setState(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit guess';
      setError(message);
    }
  };

  const handleCopyLink = () => {
    playClick();
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleBackHome = () => {
    playClick();
    router.push('/');
  };

  const youWon = Boolean(
    state && state.status === 'finished' && state.winnerId === state.you.id
  );
  const youLost = Boolean(
    state && state.status === 'finished' && state.winnerId && state.winnerId !== state.you.id
  );

  useEffect(() => {
    if (!youWon && !youLost) return;
    if (youWon) {
      playWin();
      const duration = 3000;
      const end = Date.now() + duration;
      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#10b981', '#34d399', '#fbbf24'],
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#10b981', '#34d399', '#fbbf24'],
        });
        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    } else if (youLost) {
      playLose();
    }
  }, [youWon, youLost, playWin, playLose]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex items-center gap-2 text-slate-300">
          <span className="h-3 w-3 animate-ping rounded-full bg-indigo-400" />
          <span>Connecting to room...</span>
        </div>
      </main>
    );
  }

  if (!playerId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur">
          <h1 className="mb-2 text-center text-2xl font-bold text-slate-50">
            Join Room {roomId}
          </h1>
          <p className="mb-6 text-center text-sm text-slate-400">
            Enter your details to challenge your friend.
          </p>

          <form onSubmit={handleJoinRoom} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-200">Nickname</label>
              <input
                type="text"
                required
                autoFocus
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                className="w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/50"
                placeholder="e.g. Maverick"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-200">Avatar</label>
              <AvatarPicker value={joinAvatar} onChange={setJoinAvatar} />
            </div>

            {error && (
              <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isJoining}
              className="w-full rounded-xl bg-indigo-500 px-4 py-3 font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 disabled:opacity-50"
            >
              {isJoining ? 'Joining...' : 'Enter Arena'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-4 text-center">
        <h2 className="text-xl font-bold text-rose-400">Unable to load game</h2>
        <p className="text-slate-400">{error || 'Room may have expired or does not exist.'}</p>
        <button
          onClick={handleBackHome}
          className="rounded-lg bg-slate-800 px-6 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Back to Home
        </button>
      </main>
    );
  }

  const { you, opponent, status } = state;
  const lastGuess = you.guesses[you.guesses.length - 1];
  const everyoneReady =
    opponent && you.ready && opponent.ready && status !== 'waitingForPlayers';
  const gameFinished = status === 'finished';
  const timerSeed = you.guesses.length + (status === 'inProgress' ? 1 : 0);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Room Code
            </p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-bold text-white tracking-wider">
                {state.roomId}
              </span>
              <button
                onClick={handleCopyLink}
                className="group relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 transition hover:border-indigo-500 hover:text-indigo-400"
                title="Copy invite link"
              >
                {copied ? (
                  <span className="text-emerald-400">✓</span>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
                {copied && (
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-emerald-500 px-2 py-1 text-[10px] font-bold text-slate-900 shadow-lg">
                    Copied!
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/50 pl-1 pr-3 py-1">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-sm">
                {you.avatar}
              </span>
              <span className="text-xs font-bold text-indigo-100">{you.name} (You)</span>
            </div>

            {opponent ? (
              <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/50 pl-1 pr-3 py-1">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-sm">
                  {opponent.avatar}
                </span>
                <span className="text-xs font-bold text-rose-100">{opponent.name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-500 animate-pulse">
                <span>Waiting for opponent...</span>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6 rounded-xl bg-slate-950/50 p-3 text-center text-sm">
          {status === 'waitingForPlayers' && (
            <span className="text-slate-400">Share the Room Code above to invite a friend!</span>
          )}
          {status === 'settingSecret' && !everyoneReady && (
            <span className="text-indigo-300">Phase 1: Set your secret 4-digit code.</span>
          )}
          {status === 'inProgress' && (
            <span className="font-semibold text-emerald-300">Phase 2: Crack the code!</span>
          )}
          {status === 'finished' && youWon && (
            <span className="font-bold text-emerald-400">🎉 VICTORY! You guessed it correctly!</span>
          )}
          {status === 'finished' && youLost && (
            <span className="font-bold text-rose-400">💀 DEFEAT! Your code was cracked.</span>
          )}
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}

        {status !== 'inProgress' && !gameFinished && (
          <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/50 p-6 text-center">
            {you.ready && (!opponent || !opponent.ready) && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm">
                <p className="mb-2 font-semibold text-emerald-400">Secret Locked!</p>
                <p className="text-xs text-slate-400 animate-pulse">
                  Waiting for opponent to choose...
                </p>
              </div>
            )}

            <h3 className="mb-4 text-sm font-semibold text-slate-300">Create your Secret Code</h3>
            <DigitInput value={secretDigits} onChange={setSecretDigits} disabled={you.ready} />
            <button
              onClick={handleLockSecret}
              disabled={you.ready}
              className="mt-6 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:opacity-50"
            >
              Lock Secret
            </button>
          </div>
        )}

        {status === 'inProgress' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <RoundTimer seed={timerSeed} />
              <span className="text-xs font-medium text-slate-500">
                TURN {you.guesses.length + 1}
              </span>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-4">
              <p className="mb-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                Result
              </p>
              {lastGuess ? (
                <div className="flex flex-col items-center gap-2">
                  <DigitFeedbackRow feedback={lastGuess.feedback} value={lastGuess.value} />
                </div>
              ) : (
                <p className="py-2 text-center text-sm text-slate-500">
                  Waiting for your first guess...
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
              <p className="mb-3 text-center text-xs font-bold uppercase tracking-wider text-indigo-300">
                Enter Guess
              </p>
              <DigitInput value={guessDigits} onChange={setGuessDigits} />
              <button
                onClick={handleSubmitGuess}
                className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
              >
                Submit Guess
              </button>
            </div>

            <div className="mt-4 border-t border-slate-800 pt-4">
              <p className="mb-3 text-xs font-semibold text-slate-500">HISTORY</p>
              <div className="custom-scrollbar flex max-h-32 flex-col-reverse gap-2 overflow-y-auto pr-2">
                {you.guesses.map((g, i) => (
                  <div
                    key={`${g.createdAt}-${i}`}
                    className="flex items-center justify-between rounded bg-slate-900 px-3 py-2 text-xs"
                  >
                    <span className="font-mono tracking-widest text-slate-300">
                      {g.value}
                    </span>
                    <div className="flex gap-1">
                      {g.feedback.map((f, fi) => (
                        <div
                          key={fi}
                          className={`h-2 w-2 rounded-full ${
                            f === 'correct'
                              ? 'bg-emerald-500'
                              : f === 'misplaced'
                              ? 'bg-amber-500'
                              : 'bg-rose-900'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {gameFinished && (
          <div className="mt-6">
            <button
              onClick={handleBackHome}
              className="w-full rounded-xl bg-slate-800 py-3 font-semibold text-white transition hover:bg-slate-700"
            >
              Back to Home
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
