import { NextRequest, NextResponse } from 'next/server';
import { makeGuess, getRoom, serializeRoomForPlayer } from '@/lib/gameStore';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const { playerId, guess } = await req.json();

    if (!playerId || !guess) {
      return NextResponse.json(
        { error: 'playerId and guess are required' },
        { status: 400 }
      );
    }

    await makeGuess(roomId, playerId, guess);

    const room = await getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }
    const payload = serializeRoomForPlayer(room, playerId);

    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to submit guess';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
