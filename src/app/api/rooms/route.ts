import { NextRequest, NextResponse } from 'next/server';
import { createRoom } from '@/lib/gameStore';

export async function POST(req: NextRequest) {
  try {
    const { name, avatar } = await req.json();

    if (!name || !avatar) {
      return NextResponse.json(
        { error: 'Name and avatar are required' },
        { status: 400 }
      );
    }

    const { room, player } = createRoom(name.trim(), avatar);

    return NextResponse.json({
      roomId: room.id,
      player,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create room';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
