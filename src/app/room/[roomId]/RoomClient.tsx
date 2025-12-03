'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DigitFeedback } from '@/lib/gameTypes';
import DigitInput from '@/components/DigitInput';
import DigitFeedbackRow from '@/components/DigitFeedbackRow';
import RoundTimer from '@/components/RoundTimer';
import AvatarPicker from '@/components/AvatarPicker';
import confetti from 'canvas-confetti';
import useSound from 'use-sound';

const REACTION_EMOJIS = ['😂', '😱', '🤔', '😎', '🌹', '😍', '🤣', '🥳', '😈'];

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
  lastReaction?: string | null;
  lastReactionAt?: number | null;
}

type RoomStatus = 'waitingForPlayers' | 'settingSecret' | 'inProgress' | 'finished';

interface ReactionPayload {
  emoji: string;
  playerId: string;
  createdAt: number;
}

interface RoomState {
  roomId: string;
  status: RoomStatus;
  winnerId: string | null;
  opponentSecret: string | null;
  digitCount: number;
  round: number;
  lastReaction: ReactionPayload | null;
  you: PublicPlayer;
  opponent: PublicPlayer | null;
}

const clampDigits = (count: number) => (count >= 4 && count <= 6 ? count : 4);

const buildEmptyDigits = (count: number) => Array(count).fill('');

export default function RoomClient({
  roomId,
  initialPlayerId,
}: {
  roomId: string;
  initialPlayerId?: string;
}) {
  const router = useRouter();
  const [playClick] = useSound('/sounds/click.mp3', { volume: 0.5 });
  const [playWin] = useSound('/sounds/win.mp3', { volume: 0.6 });
  const [playLose] = useSound('/sounds/lose.mp3', { volume: 0.5 });
  const [playPop] = useSound('/sounds/click.mp3', { volume: 0.3, playbackRate: 1.8 });

  const [playerId, setPlayerId] = useState(initialPlayerId ?? '');
  const [state, setState] = useState<RoomState | null>(null);
  const [loading, setLoading] = useState(!!initialPlayerId);
  const [error, setError] = useState<string | null>(null);

  const [secretDigits, setSecretDigits] = useState<string[]>(buildEmptyDigits(4));
  const [guessDigits, setGuessDigits] = useState<string[]>(buildEmptyDigits(4));
  const [copied, setCopied] = useState(false);
  const [joinName, setJoinName] = useState('');
  const [joinAvatar, setJoinAvatar] = useState('🤖');
  const [isJoining, setIsJoining] = useState(false);
  const [shakeSecret, setShakeSecret] = useState(false);
  const [shakeGuess, setShakeGuess] = useState(false);
  const [rematchMessage, setRematchMessage] = useState<string | null>(null);
  const [reactionMessage, setReactionMessage] = useState<string | null>(null);
  const [isRematching, setIsRematching] = useState(false);
  const [visibleReaction, setVisibleReaction] = useState<string | null>(null);
  const hasStateRef = useRef(false);
  const reactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const digitCount = clampDigits(state?.digitCount ?? 4);

  useEffect(() => {
    hasStateRef.current = Boolean(state);
  }, [state]);

  useEffect(() => {
    setSecretDigits((prev) => (prev.length === digitCount ? prev : buildEmptyDigits(digitCount)));
    setGuessDigits((prev) => (prev.length === digitCount ? prev : buildEmptyDigits(digitCount)));
  }, [digitCount]);

  useEffect(() => {
    if (!playerId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const intervalRef: { current: ReturnType<typeof setInterval> | null } = { current: null };

    const fetchState = async () => {
      try {
        const res = await fetch(
          `/api/rooms/${roomId}/state?playerId=${encodeURIComponent(playerId)}`,
          { cache: 'no-store' }
        );

        if (res.status === 404) {
          if (!cancelled) {
            setState(null);
            setError('This room does not exist anymore or has expired.');
            setLoading(false);
          }
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          return;
        }

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? 'Failed to load game state');
        }

        if (!cancelled) {
          setState(data);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          if (!hasStateRef.current) {
            setError(err instanceof Error ? err.message : 'Failed to load game');
          }
          setLoading(false);
        }
      }
    };

    fetchState();
    intervalRef.current = setInterval(fetchState, 1500);

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [roomId, playerId]);

  const winnerId = state?.winnerId ?? null;
  const myId = state?.you.id ?? null;

  useEffect(() => {
    if (!state || state.status !== 'finished') return;

    if (winnerId && myId && winnerId === myId) {
      playWin();
      const duration = 3000;
      const end = Date.now() + duration;

      (function frame() {
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
      })();
    } else if (winnerId && myId && winnerId !== myId) {
      playLose();
    }
  }, [state, winnerId, myId, playWin, playLose]);

  useEffect(() => {
    if (!state?.lastReaction || !playerId) return;
    if (state.lastReaction.playerId === playerId) return;

    setVisibleReaction(state.lastReaction.emoji);
    playPop();
    if (reactionTimeoutRef.current) {
      clearTimeout(reactionTimeoutRef.current);
    }
    reactionTimeoutRef.current = setTimeout(() => {
      setVisibleReaction(null);
    }, 2000);
  }, [state?.lastReaction, playerId, playPop]);

  useEffect(() => {
    return () => {
      if (reactionTimeoutRef.current) {
        clearTimeout(reactionTimeoutRef.current);
      }
    };
  }, []);

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
      setError(err instanceof Error ? err.message : 'Failed to join room');
    } finally {
      setIsJoining(false);
    }
  };

  const triggerShake = (setter: (value: boolean) => void) => {
    setter(true);
    setTimeout(() => setter(false), 500);
  };

  const handleLockSecret = async () => {
    playClick();
    if (!state) return;

    const value = secretDigits.join('');
    if (value.length !== digitCount) {
      setError(`Your secret must be exactly ${digitCount} digits.`);
      triggerShake(setShakeSecret);
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
      setError(err instanceof Error ? err.message : 'Failed to lock secret');
    }
  };

  const handleSubmitGuess = async () => {
    playClick();
    if (!state || state.status !== 'inProgress') return;

    const value = guessDigits.join('');
    if (value.length !== digitCount) {
      setError(`Your guess must be exactly ${digitCount} digits.`);
      triggerShake(setShakeGuess);
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

      setGuessDigits(buildEmptyDigits(digitCount));
      setState(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit guess');
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

  const handleRematch = async () => {
    if (!playerId) return;
    playClick();
    try {
      setIsRematching(true);
      setRematchMessage(null);
      const res = await fetch(`/api/rooms/${roomId}/rematch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Failed to start rematch');
      setState(data);
      setSecretDigits(buildEmptyDigits(clampDigits(data.digitCount ?? digitCount)));
      setGuessDigits(buildEmptyDigits(clampDigits(data.digitCount ?? digitCount)));
      setRematchMessage('New round starting!');
    } catch (err: unknown) {
      setRematchMessage(err instanceof Error ? err.message : 'Failed to reset room');
    } finally {
      setIsRematching(false);
      setTimeout(() => setRematchMessage(null), 2000);
    }
  };

  const handleReaction = async (emoji: string) => {
    if (!playerId) return;
    playClick();
    try {
      setReactionMessage(null);
      const res = await fetch(`/api/rooms/${roomId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, emoji }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Failed to send reaction');
      setState(data);
      setReactionMessage('Taunt sent!');
    } catch (err: unknown) {
      setReactionMessage(err instanceof Error ? err.message : 'Unable to send reaction');
    } finally {
      setTimeout(() => setReactionMessage(null), 1500);
    }
  };

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
          <h1 className="mb-2 text-center text-2xl font-bold text-slate-50">Join Room {roomId}</h1>
          <p className="mb-6 text-center text-sm text-slate-400">Enter your details to challenge your friend.</p>

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
              <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>
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
  const everyoneReady = opponent && you.ready && opponent.ready && status !== 'waitingForPlayers';
  const gameFinished = status === 'finished';
  const youWon = gameFinished && state.winnerId === you.id;
  const youLost = gameFinished && state.winnerId && state.winnerId !== you.id;
  const timerSeed = you.guesses.length + (status === 'inProgress' ? 1 : 0);

  const statusMessage = (() => {
    if (status === 'waitingForPlayers') return 'Share the Room Code above to invite a friend!';
    if (status === 'settingSecret' && !everyoneReady) {
      return `Phase 1: Set your secret ${digitCount}-digit code.`;
    }
    if (status === 'inProgress') return 'Phase 2: Crack the code!';
    if (status === 'finished' && youWon) return '🎉 VICTORY! You guessed it correctly!';
    if (status === 'finished' && youLost) return '💀 DEFEAT! Your code was cracked.';
    return null;
  })();

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-3 sm:p-4">
      <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900/90 px-5 py-6 shadow-2xl backdrop-blur sm:max-w-2xl lg:max-w-4xl sm:px-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Room Code</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-bold text-white tracking-wider">{state.roomId}</span>
              <button
                onClick={handleCopyLink}
                className="group relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 transition hover:border-indigo-500 hover:text-indigo-400"
                title="Copy invite link"
              >
                {copied ? (
                  <span className="text-emerald-400">✓</span>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <p className="mt-2 text-xs text-slate-500">Round {state.round} · {digitCount}-digit codes</p>
          </div>

          <div className="flex flex-col items-start gap-2 text-xs sm:items-end">
            <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/50 pl-2 pr-3 py-1">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-sm">{you.avatar}</span>
              <span className="font-bold text-indigo-100">{you.name} (You)</span>
            </div>
            {opponent ? (
              <div className="relative flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/50 pl-2 pr-3 py-1">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-sm">{opponent.avatar}</span>
                <span className="font-bold text-rose-100">{opponent.name}</span>
                {visibleReaction && (
                  <span className="pointer-events-none absolute -top-10 right-0 text-5xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.7)] animate-float">
                    {visibleReaction}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-500">
                <span className="animate-pulse">Waiting for opponent...</span>
              </div>
            )}
          </div>
        </div>

        {statusMessage && (
          <div className="mb-4 rounded-xl bg-slate-950/50 p-3 text-center text-sm">
            {statusMessage}
          </div>
        )}

        {error && (
          <p className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>
        )}

        {opponent && (
          <div className="mb-4 space-y-2">
            <p className="text-xs font-semibold text-slate-500">Send a reaction</p>
            <div className="flex flex-wrap gap-2">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleReaction(emoji)}
                  className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-lg shadow-sm transition hover:border-indigo-400 hover:text-white"
                >
                  {emoji}
                </button>
              ))}
            </div>
            {reactionMessage && <p className="text-xs text-slate-400">{reactionMessage}</p>}
          </div>
        )}

        {status !== 'inProgress' && !gameFinished && (
          <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/50 p-5 text-center">
            {you.ready && (!opponent || !opponent.ready) && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm">
                <p className="mb-2 text-emerald-400 font-semibold">Secret Locked!</p>
                <p className="text-xs text-slate-400 animate-pulse">Waiting for opponent to choose...</p>
              </div>
            )}

            <h3 className="mb-3 text-sm font-semibold text-slate-300">Create your secret {digitCount}-digit code</h3>
            <DigitInput
              value={secretDigits}
              onChange={setSecretDigits}
              disabled={you.ready}
              className={shakeSecret ? 'animate-shake' : ''}
            />
            <button
              onClick={handleLockSecret}
              disabled={you.ready}
              className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:opacity-50"
            >
              Lock Secret
            </button>
          </div>
        )}

        {status === 'inProgress' && (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-2 px-1 text-center text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:text-left">
              <RoundTimer seed={timerSeed} />
              <span>TURN {you.guesses.length + 1}</span>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-4">
              <p className="mb-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Result</p>
              {lastGuess ? (
                <div className="flex flex-col items-center gap-2">
                  <DigitFeedbackRow feedback={lastGuess.feedback} value={lastGuess.value} />
                </div>
              ) : (
                <p className="py-2 text-center text-sm text-slate-500">Waiting for your first guess...</p>
              )}
            </div>

            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
              <p className="mb-3 text-center text-xs font-bold uppercase tracking-wider text-indigo-300">Enter Guess</p>
              <DigitInput
                value={guessDigits}
                onChange={setGuessDigits}
                className={shakeGuess ? 'animate-shake' : ''}
              />
              <button
                onClick={handleSubmitGuess}
                className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
              >
                Submit Guess
              </button>
            </div>

            <div className="mt-4 border-t border-slate-800 pt-4">
              <p className="mb-3 text-xs font-semibold text-slate-500">History</p>
              <div className="custom-scrollbar flex max-h-48 flex-col-reverse gap-2 overflow-y-auto pr-2">
                {you.guesses.map((g, i) => (
                  <div key={`${g.createdAt}-${i}`} className="flex items-center justify-between rounded bg-slate-900 px-3 py-2 text-xs">
                    <span className="font-mono tracking-widest text-slate-300">{g.value}</span>
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
          <div className="mt-6 space-y-4">
            {state.opponentSecret && (
              <div className="rounded-2xl border border-indigo-500/40 bg-indigo-500/10 p-5 text-center text-slate-100">
                <p className="text-xs uppercase tracking-[0.4em] text-indigo-300">Opponent Code</p>
                <p className="mt-3 font-mono text-3xl font-bold tracking-[0.5em] text-slate-50">
                  {state.opponentSecret.split('').join(' ')}
                </p>
              </div>
            )}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleRematch}
                disabled={isRematching}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {isRematching ? 'Resetting…' : 'Play Again'}
              </button>
              <button
                onClick={handleBackHome}
                className="w-full rounded-xl bg-slate-800 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Back to Home
              </button>
            </div>
            {rematchMessage && <p className="text-center text-xs text-slate-400">{rematchMessage}</p>}
          </div>
        )}
      </div>
    </main>
  );
}
