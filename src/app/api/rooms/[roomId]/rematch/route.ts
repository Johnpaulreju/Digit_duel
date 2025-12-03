import { NextRequest, NextResponse } from 'next/server';
import { rematchRoom, serializeRoomForPlayer } from '@/lib/gameStore';

const responseError = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const { playerId } = await req.json();

    if (!playerId) {
      return responseError('playerId is required');
    }

    const room = await rematchRoom(roomId, playerId);
    const payload = serializeRoomForPlayer(room, playerId);
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to start rematch';
    return responseError(message);
  }
}
