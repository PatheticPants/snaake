// ============================================================
// SERPENT ARENA - Game Server
// ============================================================

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { GameEngine } from './core/GameEngine.js';
import {
  ClientToServerEvents, ServerToClientEvents,
  JoinRequest, JoinResponse, PlayerInput,
} from '../../shared/src/types.js';
import {
  MAX_PLAYERS, NAME_MAX_LENGTH, NAME_MIN_LENGTH,
  WORLD_WIDTH, WORLD_HEIGHT, SNAPSHOT_SEND_RATE,
} from '../../shared/src/constants.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
  },
  pingInterval: 5000,
  pingTimeout: 10000,
});

// Sanitize player name
function sanitizeName(name: string): string {
  // Strip HTML/script tags, trim, truncate
  const cleaned = name
    .replace(/<[^>]*>/g, '')
    .replace(/[^\w\s\-_.!?]/g, '')
    .trim()
    .slice(0, NAME_MAX_LENGTH);
  return cleaned.length >= NAME_MIN_LENGTH ? cleaned : 'Player';
}

// Rate limiting for inputs
const inputTimestamps: Map<string, number[]> = new Map();
const INPUT_RATE_LIMIT = 60; // max per second

function checkInputRate(socketId: string): boolean {
  const now = Date.now();
  let stamps = inputTimestamps.get(socketId);
  if (!stamps) {
    stamps = [];
    inputTimestamps.set(socketId, stamps);
  }
  // Remove stamps older than 1 second
  while (stamps.length > 0 && now - stamps[0] > 1000) {
    stamps.shift();
  }
  if (stamps.length >= INPUT_RATE_LIMIT) {
    return false;
  }
  stamps.push(now);
  return true;
}

// Create game engine
const engine = new GameEngine({
  onDeath(event) {
    io.emit('death', event);
  },
  onLeaderboard(playerId, update) {
    const socket = io.sockets.sockets.get(playerId);
    if (socket) {
      socket.emit('leaderboard', update);
    }
  },
  onPelletEaten(playerId, pelletId) {
    // We include pellet removals in snapshots, but also send explicit event
    // for the eating player for immediate feedback
    const socket = io.sockets.sockets.get(playerId);
    if (socket) {
      socket.emit('pelletEaten', { pelletId, playerId });
    }
  },
});

// Start game
engine.start();

// Send snapshots at fixed rate
setInterval(() => {
  const snapshot = engine.getSnapshot();
  io.volatile.emit('snapshot', snapshot);
}, 1000 / SNAPSHOT_SEND_RATE);

// Handle connections
io.on('connection', (socket) => {
  console.log(`[Server] Socket connected: ${socket.id}`);

  socket.on('join', (data: JoinRequest, callback) => {
    if (engine.getTotalPlayerCount() >= MAX_PLAYERS) {
      callback({ success: false, playerId: '', worldWidth: 0, worldHeight: 0, error: 'Server full' });
      socket.emit('serverFull');
      return;
    }

    const name = sanitizeName(data.name);
    const skinId = Math.max(0, Math.min(11, Math.floor(data.skinId)));
    const snake = engine.addPlayer(socket.id, name, skinId);

    io.emit('playerJoined', { name });

    callback({
      success: true,
      playerId: socket.id,
      worldWidth: WORLD_WIDTH,
      worldHeight: WORLD_HEIGHT,
    });
  });

  socket.on('input', (data: PlayerInput) => {
    if (!checkInputRate(socket.id)) return;

    // Validate input
    if (typeof data.angle !== 'number' || isNaN(data.angle)) return;
    if (typeof data.boosting !== 'boolean') return;

    engine.handleInput(socket.id, data);
  });

  socket.on('respawn', (data: JoinRequest, callback) => {
    // Remove old snake if any
    engine.removePlayer(socket.id);

    const name = sanitizeName(data.name);
    const skinId = Math.max(0, Math.min(11, Math.floor(data.skinId)));
    engine.addPlayer(socket.id, name, skinId);

    callback({
      success: true,
      playerId: socket.id,
      worldWidth: WORLD_WIDTH,
      worldHeight: WORLD_HEIGHT,
    });
  });

  socket.on('ping', (callback) => {
    callback(Date.now());
  });

  socket.on('disconnect', () => {
    console.log(`[Server] Socket disconnected: ${socket.id}`);
    engine.removePlayer(socket.id);
    inputTimestamps.delete(socket.id);
    io.emit('playerLeft', { name: socket.id });
  });
});

httpServer.listen(PORT, () => {
  console.log(`[Server] Serpent Arena server running on port ${PORT}`);
});
