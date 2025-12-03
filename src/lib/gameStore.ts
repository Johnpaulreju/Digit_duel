import { Redis } from '@upstash/redis';
import { DigitFeedback, Guess, Player, Room, RoomStatus } from './gameTypes';

const redis = Redis.fromEnv();

function generateRoomId(): string {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

function generatePlayerId(): string {
  const cryptoGlobal =
    typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;
  if (cryptoGlobal?.randomUUID) {
    return cryptoGlobal.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export function evaluateGuess(secret: string, guess: string): DigitFeedback[] {
  const result: DigitFeedback[] = Array(4).fill('wrong');
  const usedSecret = [false, false, false, false];

  for (let i = 0; i < 4; i++) {
    if (guess[i] === secret[i]) {
      result[i] = 'correct';
      usedSecret[i] = true;
    }
  }

  for (let i = 0; i < 4; i++) {
    if (result[i] === 'correct') continue;
    const digit = guess[i];

    let foundIndex = -1;
    for (let j = 0; j < 4; j++) {
      if (!usedSecret[j] && secret[j] === digit) {
        foundIndex = j;
        break;
      }
    }

    if (foundIndex !== -1) {
      result[i] = 'misplaced';
      usedSecret[foundIndex] = true;
    }
  }

  return result;
}

export async function createRoom(name: string, avatar: string): Promise<{ room: Room; player: Player }> {
  let roomId = generateRoomId();
  let attempts = 0;

  while ((await redis.exists(`room:${roomId}`)) > 0 && attempts < 5) {
    roomId = generateRoomId();
    attempts++;
  }

  if (attempts >= 5) {
    throw new Error('Server busy, please try again.');
  }

  const playerId = generatePlayerId();

  const player: Player = { id: playerId, name, avatar, ready: false, guesses: [] };
  const room: Room = {
    id: roomId,
    players: [player],
    status: 'waitingForPlayers',
    createdAt: Date.now(),
  };

  await redis.set(`room:${roomId}`, room, { ex: 3600 });
  return { room, player };
}

export async function joinRoom(
  roomId: string,
  name: string,
  avatar: string
): Promise<{ room: Room; player: Player }> {
  const room = await redis.get<Room>(`room:${roomId}`);
  if (!room) throw new Error('Room not found');
  if (room.players.length >= 2) throw new Error('Room is full');

  const playerId = generatePlayerId();
  const player: Player = { id: playerId, name, avatar, ready: false, guesses: [] };

  room.players.push(player);
  if (room.status === 'waitingForPlayers') room.status = 'settingSecret';

  await redis.set(`room:${roomId}`, room, { ex: 3600 });
  return { room, player };
}

export async function getRoom(roomId: string): Promise<Room | null> {
  return (await redis.get<Room>(`room:${roomId}`)) ?? null;
}

export async function setSecret(roomId: string, playerId: string, secret: string): Promise<Room> {
  const room = await redis.get<Room>(`room:${roomId}`);
  if (!room) throw new Error('Room not found');
  if (!/^\d{4}$/.test(secret)) throw new Error('Secret must be 4 digits');

  const player = room.players.find((p) => p.id === playerId);
  if (!player) throw new Error('Player not found');

  player.secret = secret;
  player.ready = true;

  if (room.players.length === 2 && room.players.every((p) => p.ready && p.secret)) {
    room.status = 'inProgress';
  }

  await redis.set(`room:${roomId}`, room, { ex: 3600 });
  return room;
}

export async function makeGuess(
  roomId: string,
  playerId: string,
  guess: string
): Promise<{ room: Room; result: Guess; isWin: boolean }> {
  const room = await redis.get<Room>(`room:${roomId}`);
  if (!room) throw new Error('Room not found');
  if (room.status !== 'inProgress') throw new Error('Game not in progress');
  if (!/^\d{4}$/.test(guess)) throw new Error('Guess must be 4 digits');

  const player = room.players.find((p) => p.id === playerId);
  const opponent = room.players.find((p) => p.id !== playerId);
  if (!player || !opponent?.secret) throw new Error('Invalid game state');

  const feedback = evaluateGuess(opponent.secret, guess);
  const guessObj: Guess = { value: guess, feedback, createdAt: Date.now() };
  const isWin = guess === opponent.secret;

  player.guesses.push(guessObj);
  if (isWin) {
    room.status = 'finished';
    room.winnerId = player.id;
  }

  await redis.set(`room:${roomId}`, room, { ex: 3600 });
  return { room, result: guessObj, isWin };
}

export function serializeRoomForPlayer(room: Room, playerId: string) {
  const you = room.players.find((p) => p.id === playerId);
  if (!you) throw new Error('You are not in this room');
  const opponent = room.players.find((p) => p.id !== playerId) || null;
  const opponentSecret =
    room.status === 'finished' && opponent && opponent.secret ? opponent.secret : null;

  return {
    roomId: room.id,
    status: room.status as RoomStatus,
    winnerId: room.winnerId ?? null,
    opponentSecret,
    you: {
      id: you.id,
      name: you.name,
      avatar: you.avatar,
      ready: you.ready,
      guesses: you.guesses,
    },
    opponent: opponent
      ? {
          id: opponent.id,
          name: opponent.name,
          avatar: opponent.avatar,
          ready: opponent.ready,
          guesses: opponent.guesses,
        }
      : null,
  };
}
