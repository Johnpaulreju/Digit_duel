'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from './Modal';
import AvatarPicker from './AvatarPicker';

interface PlayerSetupModalProps {
  mode: 'host' | 'join';
  open: boolean;
  onClose: () => void;
  initialRoomId?: string;
}

export default function PlayerSetupModal({ mode, open, onClose, initialRoomId }: PlayerSetupModalProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🤖');
  const [roomId, setRoomId] = useState(initialRoomId ?? '');
  const [digitCount, setDigitCount] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isHost = mode === 'host';

  useEffect(() => {
    if (initialRoomId && open) {
      setRoomId(initialRoomId);
    }
  }, [initialRoomId, open]);

  useEffect(() => {
    if (!isHost) {
      setDigitCount(4);
    }
  }, [isHost]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter a nickname');
      return;
    }

    if (!isHost && !roomId.trim()) {
      setError('Please enter the room ID');
      return;
    }

    try {
      setLoading(true);

      const endpoint = isHost ? '/api/rooms' : '/api/rooms/join';
      const body: Record<string, string | number> = { name: name.trim(), avatar };

      if (!isHost) body.roomId = roomId.trim();
      if (isHost) body.digitCount = digitCount;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? 'Something went wrong');
      }

      const roomIdFromServer = data.roomId;
      const playerId = data.player.id;

      router.push(`/room/${roomIdFromServer}?playerId=${playerId}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to start game';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!loading) onClose();
      }}
      title={isHost ? 'Host a new game' : 'Join an existing game'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-200">
            Nickname
          </label>
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm
                       text-slate-100 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/60"
            placeholder="Player name"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-200">
            Avatar
          </label>
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </div>

        {isHost && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              Digits
            </label>
            <div className="flex gap-2">
              {[4, 5, 6].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setDigitCount(count)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    digitCount === count
                      ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100'
                      : 'border-slate-600 bg-slate-900 text-slate-200 hover:border-indigo-400'
                  }`}
                >
                  {count} digits
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Both players create and guess {digitCount} digits.
            </p>
          </div>
        )}

        {!isHost && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              Room ID
            </label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm
                         text-slate-100 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/60"
              placeholder="e.g. 12345"
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-rose-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold
                     text-white shadow-md transition hover:bg-indigo-400 disabled:cursor-not-allowed
                     disabled:bg-indigo-500/60"
        >
          {loading ? (isHost ? 'Creating room…' : 'Joining…') : isHost ? 'Create & Start' : 'Join game'}
        </button>
      </form>
    </Modal>
  );
}
