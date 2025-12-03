import { NextRequest, NextResponse } from 'next/server';
import { sendReaction, serializeRoomForPlayer } from '@/lib/gameStore';

const ALLOWED_EMOJIS = [
  '😂',
  '🤣',
  '😱',
  '😎',
  '🤔',
  '😜',
  '🥳',
  '😈',
  '🌹',
  '😍',
  '😘',
  '❤️',
  '🤩',
  '😭',
  '😇',
];

const responseError = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const { playerId, emoji } = await req.json();

    if (!playerId || !emoji) {
      return responseError('playerId and emoji are required');
    }

    if (!ALLOWED_EMOJIS.includes(emoji)) {
      return responseError('Unsupported reaction emoji');
    }

    const room = await sendReaction(roomId, playerId, emoji);
    const payload = serializeRoomForPlayer(room, playerId);
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send reaction';
    return responseError(message);
  }
}
