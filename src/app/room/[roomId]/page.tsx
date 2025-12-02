import RoomClient from './RoomClient';

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ playerId?: string }>;
}) {
  const { roomId } = await params;
  const resolvedSearch = await searchParams;
  const playerId = resolvedSearch?.playerId ?? '';

  return <RoomClient roomId={roomId} initialPlayerId={playerId} />;
}
