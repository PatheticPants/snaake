// ============================================================
// Network Manager - Socket.IO client connection
// ============================================================

import { io, Socket } from 'socket.io-client';
import {
  ClientToServerEvents, ServerToClientEvents,
  JoinRequest, JoinResponse, PlayerInput,
  WorldSnapshot, DeathEvent, LeaderboardUpdate,
} from '@shared/types.js';
import { INPUT_SEND_RATE } from '@shared/constants.js';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export class NetworkManager {
  private socket: GameSocket | null = null;
  private connected = false;
  private lastInputTime = 0;
  private inputInterval = 1000 / INPUT_SEND_RATE;
  private pingMs = 0;
  private lastPingTime = 0;

  // Event callbacks
  onSnapshot: ((data: WorldSnapshot) => void) | null = null;
  onDeath: ((data: DeathEvent) => void) | null = null;
  onLeaderboard: ((data: LeaderboardUpdate) => void) | null = null;
  onPelletEaten: ((data: { pelletId: number; playerId: string }) => void) | null = null;
  onPlayerJoined: ((data: { name: string }) => void) | null = null;
  onPlayerLeft: ((data: { name: string }) => void) | null = null;
  onConnect: (() => void) | null = null;
  onDisconnect: (() => void) | null = null;
  onServerFull: (() => void) | null = null;

  connect(url?: string): void {
    if (this.socket) return;

    this.socket = io(url || window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('[Network] Connected');
      this.onConnect?.();
      this.startPingLoop();
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      console.log('[Network] Disconnected');
      this.onDisconnect?.();
    });

    this.socket.on('snapshot', (data) => {
      this.onSnapshot?.(data);
    });

    this.socket.on('death', (data) => {
      this.onDeath?.(data);
    });

    this.socket.on('leaderboard', (data) => {
      this.onLeaderboard?.(data);
    });

    this.socket.on('pelletEaten', (data) => {
      this.onPelletEaten?.(data);
    });

    this.socket.on('playerJoined', (data) => {
      this.onPlayerJoined?.(data);
    });

    this.socket.on('playerLeft', (data) => {
      this.onPlayerLeft?.(data);
    });

    this.socket.on('serverFull', () => {
      this.onServerFull?.();
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connected = false;
  }

  join(data: JoinRequest): Promise<JoinResponse> {
    return new Promise((resolve) => {
      if (!this.socket || !this.connected) {
        resolve({ success: false, playerId: '', worldWidth: 0, worldHeight: 0, error: 'Not connected' });
        return;
      }
      this.socket.emit('join', data, (response) => {
        resolve(response);
      });
    });
  }

  respawn(data: JoinRequest): Promise<JoinResponse> {
    return new Promise((resolve) => {
      if (!this.socket || !this.connected) {
        resolve({ success: false, playerId: '', worldWidth: 0, worldHeight: 0, error: 'Not connected' });
        return;
      }
      this.socket.emit('respawn', data, (response) => {
        resolve(response);
      });
    });
  }

  sendInput(input: PlayerInput): void {
    const now = Date.now();
    if (now - this.lastInputTime < this.inputInterval) return;
    this.lastInputTime = now;
    this.socket?.volatile.emit('input', input);
  }

  private startPingLoop(): void {
    setInterval(() => {
      if (!this.socket || !this.connected) return;
      this.lastPingTime = Date.now();
      this.socket.emit('ping', (serverTime) => {
        this.pingMs = Date.now() - this.lastPingTime;
      });
    }, 2000);
  }

  getPing(): number {
    return this.pingMs;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getSocketId(): string {
    return this.socket?.id ?? '';
  }
}
