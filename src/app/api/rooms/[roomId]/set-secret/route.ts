import { NextRequest, NextResponse } from 'next/server';
import { setSecret, serializeRoomForPlayer, getRoom } from '@/lib/gameStore';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const { playerId, secret } = await req.json();

    if (!playerId || !secret) {
      return NextResponse.json(
        { error: 'playerId and secret are required' },
        { status: 400 }
      );
    }

    setSecret(roomId, playerId, secret);

    const room = getRoom(roomId)!;
    const payload = serializeRoomForPlayer(room, playerId);

    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to set secret';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
