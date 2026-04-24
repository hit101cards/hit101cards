export interface Card {
  id: string;
  suit: string;
  rank: string;
}

export interface Player {
  id: string;
  name: string;
  handCount: number;
  hand: Card[] | null;
  lost: boolean;
  disconnected: boolean;
  isBot?: boolean;
}

export interface LastPlayedCard extends Card {
  addedValue: number;
  playerName: string;
  fromDeck: boolean;
  scenario: '101' | '102' | 'joker101' | null;
}

export interface PointChange {
  playerName: string;
  change: number;
}

export interface RoundResult {
  scenario: '101' | '102' | 'joker101';
  description: string;
  pointChanges: PointChange[];
}

export interface CumulativeStat {
  totalPoints: number;
  gamesPlayed: number;
}

export interface LeaderboardEntry {
  uuid: string;
  name: string;
  totalPoints: number;
  gamesPlayed: number;
  rank?: number;
}

export interface LeaderboardResult {
  top: LeaderboardEntry[];
  entries?: LeaderboardEntry[];
  total?: number;
  limit?: number;
  offset?: number;
  myEntry: LeaderboardEntry | null;
}

export interface LeaderboardQuery {
  uuid?: string;
  limit?: number;
  offset?: number;
  minGames?: number;
  sinceDays?: number;
  sort?: 'points' | 'games';
}

export interface MatchmakingPlayer {
  name: string;
  stats: CumulativeStat | null;
}

export interface GameState {
  roomId: string;
  hostId: string;
  status: 'waiting' | 'playing' | 'roundEnd' | 'ended';
  currentTotal: number;
  currentPlayerIndex: number;
  direction: number;
  lastPlayedCard: LastPlayedCard | null;
  deckCount: number;
  points: Record<string, number>;
  votes: Record<string, 'continue' | 'quit' | null>;
  voteDeadline: number | null;
  turnDeadline: number | null;
  roundResult: RoundResult | null;
  roundCount: number;
  players: Player[];
  isMatchmaking: boolean;
  cumulativeStats: Record<string, CumulativeStat> | null;
}
