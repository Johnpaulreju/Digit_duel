import { NextRequest, NextResponse } from 'next/server';
import { getRoom, serializeRoomForPlayer } from '@/lib/gameStore';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const url = new URL(req.url);
    const playerId = url.searchParams.get('playerId');

    if (!playerId) {
      return NextResponse.json(
        { error: 'playerId query param is required' },
        { status: 400 }
      );
    }

    const room = getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const payload = serializeRoomForPlayer(room, playerId);

    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get room state';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
