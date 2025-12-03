export type DigitFeedback = 'correct' | 'misplaced' | 'wrong';

export interface Guess {
  value: string; // "1234"
  feedback: DigitFeedback[];
  createdAt: number;
}

export interface Player {
  id: string;
  name: string;
  avatar: string; // emoji or URL
  secret?: string; // the 4-digit code this player chose
  ready: boolean; // true after secret is locked in
  guesses: Guess[]; // guesses this player made against the opponent
  lastReaction?: string;
  lastReactionAt?: number;
}

export type RoomStatus =
  | 'waitingForPlayers'
  | 'settingSecret'
  | 'inProgress'
  | 'finished';

export interface Reaction {
  emoji: string;
  playerId: string;
  createdAt: number;
}

export interface Room {
  id: string; // room code (e.g. "12345")
  players: Player[];
  status: RoomStatus;
  winnerId?: string;
  createdAt: number;
  digitCount: number;
  round: number;
  lastReaction: Reaction | null;
}
