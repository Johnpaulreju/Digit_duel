import { NextRequest, NextResponse } from 'next/server';
import { joinRoom } from '@/lib/gameStore';

export async function POST(req: NextRequest) {
  try {
    const { roomId, name, avatar } = await req.json();

    if (!roomId || !name || !avatar) {
      return NextResponse.json(
        { error: 'Room ID, name, and avatar are required' },
        { status: 400 }
      );
    }

    const { room, player } = joinRoom(roomId.trim(), name.trim(), avatar);

    return NextResponse.json({
      roomId: room.id,
      player,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to join room';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
