import { DigitFeedback, Guess, Player, Room, RoomStatus } from './gameTypes';

type GlobalStore = {
  digitDuelRooms?: Map<string, Room>;
};

const globalStore = globalThis as GlobalStore;
const rooms = globalStore.digitDuelRooms ?? new Map<string, Room>();
if (!globalStore.digitDuelRooms) {
  globalStore.digitDuelRooms = rooms;
}

function generateRoomId(): string {
  let id: string;
  do {
    id = Math.floor(10000 + Math.random() * 90000).toString(); // 5-digit room code
  } while (rooms.has(id));
  return id;
}

function generatePlayerId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export function evaluateGuess(secret: string, guess: string): DigitFeedback[] {
  const result: DigitFeedback[] = Array(4).fill('wrong');
  const usedSecret = [false, false, false, false];

  // Mark correct digits first (green)
  for (let i = 0; i < 4; i++) {
    if (guess[i] === secret[i]) {
      result[i] = 'correct';
      usedSecret[i] = true;
    }
  }

  // Mark misplaced digits (yellow)
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

export function createRoom(name: string, avatar: string): { room: Room; player: Player } {
  const roomId = generateRoomId();
  const playerId = generatePlayerId();

  const player: Player = {
    id: playerId,
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

  rooms.set(roomId, room);

  return { room, player };
}

export function joinRoom(
  roomId: string,
  name: string,
  avatar: string
): { room: Room; player: Player } {
  const room = rooms.get(roomId);

  if (!room) {
    throw new Error('Room not found');
  }

  if (room.players.length >= 2) {
    throw new Error('Room is full');
  }

  const playerId = generatePlayerId();
  const player: Player = {
    id: playerId,
    name,
    avatar,
    ready: false,
    guesses: [],
  };

  room.players.push(player);

  if (room.status === 'waitingForPlayers') {
    room.status = 'settingSecret';
  }

  return { room, player };
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function setSecret(roomId: string, playerId: string, secret: string): Room {
  const room = rooms.get(roomId);
  if (!room) throw new Error('Room not found');

  if (!/^\d{4}$/.test(secret)) {
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

  return room;
}

export function makeGuess(
  roomId: string,
  playerId: string,
  guess: string
): { room: Room; result: Guess; isWin: boolean } {
  const room = rooms.get(roomId);
  if (!room) throw new Error('Room not found');

  if (room.status !== 'inProgress') {
    throw new Error('Game not in progress');
  }

  if (!/^\d{4}$/.test(guess)) {
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

  return { room, result: guessObj, isWin };
}

// Filter out secrets so we don't leak them to the client
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
