import { Redis } from '@upstash/redis';
import { DigitFeedback, Guess, Player, Room, RoomStatus } from './gameTypes';

const ROOM_TTL_SECONDS = 60 * 60; // 1 hour
const ROOM_KEY_PREFIX = 'room:';

const hasRedisCredentials =
  typeof process !== 'undefined' &&
  Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

const redis = hasRedisCredentials
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Local fallback so devs without env vars can still play
const memoryRooms = new Map<string, Room>();

function roomKey(roomId: string) {
  return `${ROOM_KEY_PREFIX}${roomId}`;
}

function generateRoomId(): string {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

function generatePlayerId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

async function saveRoom(room: Room) {
  if (redis) {
    await redis.set(roomKey(room.id), room, { ex: ROOM_TTL_SECONDS });
  } else {
    memoryRooms.set(room.id, room);
  }
}

async function loadRoom(roomId: string): Promise<Room | null> {
  if (redis) {
    const room = await redis.get<Room>(roomKey(roomId));
    return room ?? null;
  }
  return memoryRooms.get(roomId) ?? null;
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
  while (await loadRoom(roomId)) {
    roomId = generateRoomId();
  }

  const player: Player = {
    id: generatePlayerId(),
    name,
    avatar,
    ready: false,
    guesses: [],
  };

  const room: Room = {
    id: roomId,
    players: [player],
    status: 'waitingForPlayers',
    createdAt: Date.now(),
  };

  await saveRoom(room);
  return { room, player };
}

export async function joinRoom(
  roomId: string,
  name: string,
  avatar: string
): Promise<{ room: Room; player: Player }> {
  const room = await loadRoom(roomId);

  if (!room) {
    throw new Error('Room not found');
  }

  if (room.players.length >= 2) {
    throw new Error('Room is full');
  }

  const player: Player = {
    id: generatePlayerId(),
    name,
    avatar,
    ready: false,
    guesses: [],
  };

  room.players.push(player);

  if (room.status === 'waitingForPlayers') {
    room.status = 'settingSecret';
  }

  await saveRoom(room);
  return { room, player };
}

export async function getRoom(roomId: string): Promise<Room | null> {
  return loadRoom(roomId);
}

export async function setSecret(roomId: string, playerId: string, secret: string): Promise<Room> {
  const room = await loadRoom(roomId);
  if (!room) throw new Error('Room not found');

  if (!/^[0-9]{4}$/.test(secret)) {
    throw new Error('Secret must be a 4 digit number');
  }

  const player = room.players.find((p) => p.id === playerId);
  if (!player) throw new Error('Player not found in room');

  player.secret = secret;
  player.ready = true;

  if (room.players.length === 2 && room.players.every((p) => p.ready && p.secret)) {
    room.status = 'inProgress';
  } else {
    room.status = 'settingSecret';
  }

  await saveRoom(room);
  return room;
}

export async function makeGuess(
  roomId: string,
  playerId: string,
  guess: string
): Promise<{ room: Room; result: Guess; isWin: boolean }> {
  const room = await loadRoom(roomId);
  if (!room) throw new Error('Room not found');

  if (room.status !== 'inProgress') {
    throw new Error('Game not in progress');
  }

  if (!/^[0-9]{4}$/.test(guess)) {
    throw new Error('Guess must be a 4 digit number');
  }

  const player = room.players.find((p) => p.id === playerId);
  const opponent = room.players.find((p) => p.id !== playerId);

  if (!player || !opponent) {
    throw new Error('Both players are required');
  }

  if (!opponent.secret) {
    throw new Error('Opponent has not set a secret yet');
  }

  const feedback = evaluateGuess(opponent.secret, guess);
  const createdAt = Date.now();

  const isWin = guess === opponent.secret;
  const guessObj: Guess = { value: guess, feedback, createdAt };

  player.guesses.push(guessObj);

  if (isWin) {
    room.status = 'finished';
    room.winnerId = player.id;
  }

  await saveRoom(room);
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
