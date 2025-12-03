import { NextRequest, NextResponse } from 'next/server';
import { createRoom } from '@/lib/gameStore';

const ALLOWED_DIGIT_COUNTS = [4, 5, 6];

export async function POST(req: NextRequest) {
  try {
    const { name, avatar, digitCount } = await req.json();

    if (!name || !avatar) {
      return NextResponse.json(
        { error: 'Name and avatar are required' },
        { status: 400 }
      );
    }

    const parsedDigits = Number(digitCount);
    const safeDigits = ALLOWED_DIGIT_COUNTS.includes(parsedDigits) ? parsedDigits : 4;

    const { room, player } = await createRoom(name.trim(), avatar, safeDigits);

    return NextResponse.json({
      roomId: room.id,
      player,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create room';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
