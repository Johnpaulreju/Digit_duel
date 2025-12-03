import { Redis } from '@upstash/redis';
import { DigitFeedback, Guess, Player, Reaction, Room, RoomStatus } from './gameTypes';

const ROOM_TTL_SECONDS = 60 * 60;
const ROOM_KEY_PREFIX = 'room:';
const ALLOWED_DIGIT_COUNTS = [4, 5, 6];

const redis = new Redis({
  url:
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.UPSTASH_REDIS_REST_KV_REST_API_URL ||
    process.env.KV_REST_API_URL ||
    '',
  token:
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    '',
});

function roomKey(roomId: string) {
  return `${ROOM_KEY_PREFIX}${roomId}`;
}

function normalizeDigitCount(count?: number) {
  return ALLOWED_DIGIT_COUNTS.includes(Number(count)) ? Number(count) : 4;
}

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
  const length = secret.length;
  const result: DigitFeedback[] = Array(length).fill('wrong');
  const usedSecret = Array(length).fill(false);

  for (let i = 0; i < length; i++) {
    if (guess[i] === secret[i]) {
      result[i] = 'correct';
      usedSecret[i] = true;
    }
  }

  for (let i = 0; i < length; i++) {
    if (result[i] === 'correct') continue;
    const digit = guess[i];

    let foundIndex = -1;
    for (let j = 0; j < length; j++) {
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

async function saveRoom(room: Room) {
  await redis.set(roomKey(room.id), room, { ex: ROOM_TTL_SECONDS });
}

async function loadRoom(roomId: string): Promise<Room | null> {
  const room = await redis.get<Room>(roomKey(roomId));
  return room ?? null;
}

export async function createRoom(
  name: string,
  avatar: string,
  requestedDigitCount = 4
): Promise<{ room: Room; player: Player }> {
  let roomId = generateRoomId();
  let attempts = 0;

  while ((await redis.exists(roomKey(roomId))) > 0 && attempts < 5) {
    roomId = generateRoomId();
    attempts++;
  }

  if (attempts >= 5) {
    throw new Error('Server busy, please try again.');
  }

  const digitCount = normalizeDigitCount(requestedDigitCount);
  const playerId = generatePlayerId();
  const player: Player = { id: playerId, name, avatar, ready: false, guesses: [] };

  const room: Room = {
    id: roomId,
    players: [player],
    status: 'waitingForPlayers',
    createdAt: Date.now(),
    digitCount,
    round: 1,
    lastReaction: null,
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
  if (!room) throw new Error('Room not found');
  if (room.players.length >= 2) throw new Error('Room is full');

  const playerId = generatePlayerId();
  const player: Player = { id: playerId, name, avatar, ready: false, guesses: [] };
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

  const digitCount = room.digitCount;
  const pattern = new RegExp(`^\\d{${digitCount}}$`);
  if (!pattern.test(secret)) {
    throw new Error(`Secret must be ${digitCount} digits`);
  }

  const player = room.players.find((p) => p.id === playerId);
  if (!player) throw new Error('Player not found');

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

  const pattern = new RegExp(`^\\d{${room.digitCount}}$`);
  if (!pattern.test(guess)) {
    throw new Error(`Guess must be ${room.digitCount} digits`);
  }

  const player = room.players.find((p) => p.id === playerId);
  const opponent = room.players.find((p) => p.id !== playerId);

  if (!player || !opponent?.secret) {
    throw new Error('Invalid game state');
  }

  const feedback = evaluateGuess(opponent.secret, guess);
  const guessObj: Guess = { value: guess, feedback, createdAt: Date.now() };
  const isWin = guess === opponent.secret;

  player.guesses.push(guessObj);

  if (isWin) {
    room.status = 'finished';
    room.winnerId = player.id;
  }

  await saveRoom(room);
  return { room, result: guessObj, isWin };
}

export async function rematchRoom(roomId: string, playerId: string): Promise<Room> {
  const room = await loadRoom(roomId);
  if (!room) throw new Error('Room not found');

  const participant = room.players.find((p) => p.id === playerId);
  if (!participant) throw new Error('Player not found');

  room.players = room.players.map((player) => ({
    ...player,
    secret: undefined,
    ready: false,
    guesses: [],
  }));

  room.status = room.players.length === 2 ? 'settingSecret' : 'waitingForPlayers';
  room.winnerId = undefined;
  room.lastReaction = null;
  room.round = (room.round ?? 1) + 1;

  await saveRoom(room);
  return room;
}

export async function sendReaction(
  roomId: string,
  playerId: string,
  emoji: string
): Promise<Room> {
  const room = await loadRoom(roomId);
  if (!room) throw new Error('Room not found');

  const participant = room.players.find((p) => p.id === playerId);
  if (!participant) throw new Error('Player not found');

  const reaction: Reaction = {
    emoji,
    playerId,
    createdAt: Date.now(),
  };

  room.lastReaction = reaction;
  participant.lastReaction = emoji;
  participant.lastReactionAt = reaction.createdAt;
  await saveRoom(room);
  return room;
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
    digitCount: room.digitCount,
    round: room.round ?? 1,
    lastReaction: room.lastReaction ?? null,
    you: {
      id: you.id,
      name: you.name,
      avatar: you.avatar,
      ready: you.ready,
      guesses: you.guesses,
      lastReaction: you.lastReaction ?? null,
      lastReactionAt: you.lastReactionAt ?? null,
    },
    opponent: opponent
      ? {
          id: opponent.id,
          name: opponent.name,
          avatar: opponent.avatar,
          ready: opponent.ready,
          guesses: opponent.guesses,
          lastReaction: opponent.lastReaction ?? null,
          lastReactionAt: opponent.lastReactionAt ?? null,
        }
      : null,
  };
}
