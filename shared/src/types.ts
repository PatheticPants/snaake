// ============================================================
// SERPENT ARENA - Shared Types
// ============================================================

export interface Vec2 {
  x: number;
  y: number;
}

export interface SnakeSegment {
  x: number;
  y: number;
}

export interface SnakeState {
  id: string;
  name: string;
  skinId: number;
  segments: SnakeSegment[];
  angle: number;
  score: number;
  boosting: boolean;
  alive: boolean;
  radius: number;
  speed: number;
  surgeCharge: number;
  surgeActive: boolean;
}

export interface PelletState {
  id: number;
  x: number;
  y: number;
  radius: number;
  color: number; // hue 0-360
  value: number;
  isDeathPellet: boolean;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  skinId: number;
}

export interface WorldSnapshot {
  snakes: SnakeState[];
  pellets: PelletState[];
  tick: number;
  timestamp: number;
}

export interface PlayerInput {
  angle: number; // target angle
  boosting: boolean;
  seq: number; // sequence number for reconciliation
}

export interface JoinRequest {
  name: string;
  skinId: number;
}

export interface JoinResponse {
  success: boolean;
  playerId: string;
  worldWidth: number;
  worldHeight: number;
  error?: string;
}

export interface DeathEvent {
  playerId: string;
  killerName: string | null;
  score: number;
  pellets: PelletState[];
}

export interface SpawnEvent {
  snake: SnakeState;
}

export interface LeaderboardUpdate {
  entries: LeaderboardEntry[];
  playerRank: number;
  playerScore: number;
}

export interface ServerConfig {
  worldWidth: number;
  worldHeight: number;
  tickRate: number;
}

// Socket.IO event types
export interface ClientToServerEvents {
  'join': (data: JoinRequest, callback: (response: JoinResponse) => void) => void;
  'input': (data: PlayerInput) => void;
  'respawn': (data: JoinRequest, callback: (response: JoinResponse) => void) => void;
  'ping': (callback: (timestamp: number) => void) => void;
}

export interface ServerToClientEvents {
  'snapshot': (data: WorldSnapshot) => void;
  'death': (data: DeathEvent) => void;
  'spawn': (data: SpawnEvent) => void;
  'leaderboard': (data: LeaderboardUpdate) => void;
  'pelletEaten': (data: { pelletId: number; playerId: string }) => void;
  'playerJoined': (data: { name: string }) => void;
  'playerLeft': (data: { name: string }) => void;
  'serverFull': () => void;
}

export type BotPersonality = 'timid' | 'greedy' | 'aggressive' | 'balanced';

export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  showMinimap: boolean;
  showLeaderboard: boolean;
  showDebug: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  musicVolume: 0.5,
  sfxVolume: 0.7,
  muted: false,
  showMinimap: true,
  showLeaderboard: true,
  showDebug: false,
  reducedMotion: false,
  highContrast: false,
};
