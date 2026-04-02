// ============================================================
// Game Engine - Core server simulation loop
// ============================================================

import { Snake } from '../entities/Snake.js';
import { Pellet } from '../entities/Pellet.js';
import { CollisionSystem, CollisionResult } from '../systems/CollisionSystem.js';
import { PelletSystem } from '../systems/PelletSystem.js';
import { LeaderboardSystem } from '../systems/LeaderboardSystem.js';
import { BotAI } from '../bots/BotAI.js';
import {
  SERVER_TICK_MS, WORLD_WIDTH, WORLD_HEIGHT,
  SPAWN_MARGIN, SPAWN_SAFETY_RADIUS, SPAWN_MAX_ATTEMPTS,
  BOT_COUNT_DEFAULT, LEADERBOARD_UPDATE_INTERVAL,
  SNAKE_SEGMENT_SPACING,
} from '../../../shared/src/constants.js';
import {
  WorldSnapshot, SnakeState, PelletState, DeathEvent,
  LeaderboardUpdate, PlayerInput,
} from '../../../shared/src/types.js';
import { distance, randomInRange } from '../../../shared/src/math.js';

export interface GameEvents {
  onDeath: (event: DeathEvent) => void;
  onLeaderboard: (playerId: string, update: LeaderboardUpdate) => void;
  onPelletEaten: (playerId: string, pelletId: number) => void;
}

export class GameEngine {
  snakes: Map<string, Snake> = new Map();
  private collisionSystem = new CollisionSystem();
  pelletSystem = new PelletSystem();
  private leaderboard = new LeaderboardSystem();
  private botAI = new BotAI();
  private events: GameEvents;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private lastLeaderboardUpdate = 0;
  private tick = 0;
  private botIds: Set<string> = new Set();
  private lastTickTime = Date.now();

  constructor(events: GameEvents) {
    this.events = events;
  }

  start(): void {
    this.pelletSystem.init();
    this.spawnBots(BOT_COUNT_DEFAULT);
    this.lastTickTime = Date.now();

    this.tickInterval = setInterval(() => {
      this.update();
    }, SERVER_TICK_MS);

    console.log(`[Engine] Game started. Tick rate: ${1000 / SERVER_TICK_MS}Hz`);
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private update(): void {
    const now = Date.now();
    const dt = Math.min((now - this.lastTickTime) / 1000, 0.1); // cap dt
    this.lastTickTime = now;
    this.tick++;

    // Update bot inputs
    for (const botId of this.botIds) {
      const bot = this.snakes.get(botId);
      if (!bot || !bot.alive) continue;
      const input = this.botAI.update(dt, bot, this.snakes, this.pelletSystem.pellets);
      bot.setInput(input.angle, input.boosting);
    }

    // Update all snakes
    for (const snake of this.snakes.values()) {
      if (!snake.alive) continue;
      snake.update(dt);

      // Process boost pellets
      for (const pos of snake.pendingBoostPellets) {
        this.pelletSystem.spawnBoostPellet(pos);
      }
      snake.pendingBoostPellets = [];
    }

    // Run collision detection
    const collisionResult = this.collisionSystem.update(this.snakes, this.pelletSystem.pellets);

    // Process deaths
    for (const deadId of collisionResult.deadSnakeIds) {
      const snake = this.snakes.get(deadId);
      if (!snake || !snake.alive) continue;

      snake.alive = false;
      const killerId = collisionResult.killerMap.get(deadId) ?? null;
      const killerSnake = killerId ? this.snakes.get(killerId) : null;

      // Spawn death pellets
      const deathPellets = this.pelletSystem.spawnDeathPellets(snake.segments, snake.score);

      this.events.onDeath({
        playerId: deadId,
        killerName: killerSnake?.name ?? null,
        score: Math.floor(snake.score),
        pellets: deathPellets.map(p => p.toState()),
      });

      // Respawn bots after a delay
      if (this.botIds.has(deadId)) {
        setTimeout(() => {
          this.respawnBot(deadId, snake.name, snake.skinId);
        }, 3000);
      }
    }

    // Process eaten pellets
    for (const [playerId, pelletIds] of collisionResult.eatenPellets) {
      const snake = this.snakes.get(playerId);
      if (!snake) continue;
      for (const pelletId of pelletIds) {
        const pellet = this.pelletSystem.pellets.get(pelletId);
        if (!pellet) continue;
        snake.addScore(pellet.value);
        this.pelletSystem.removePellet(pelletId);
        this.events.onPelletEaten(playerId, pelletId);
      }
    }

    // Update pellet system (respawn, cleanup)
    this.pelletSystem.update();

    // Leaderboard
    if (now - this.lastLeaderboardUpdate > LEADERBOARD_UPDATE_INTERVAL) {
      this.lastLeaderboardUpdate = now;
      this.leaderboard.update(this.snakes);
      for (const snake of this.snakes.values()) {
        if (!snake.alive || snake.isBot) continue;
        this.events.onLeaderboard(snake.id, this.leaderboard.getUpdateForPlayer(snake.id));
      }
    }
  }

  findSpawnPoint(): { x: number; y: number } {
    for (let i = 0; i < SPAWN_MAX_ATTEMPTS; i++) {
      const x = randomInRange(SPAWN_MARGIN, WORLD_WIDTH - SPAWN_MARGIN);
      const y = randomInRange(SPAWN_MARGIN, WORLD_HEIGHT - SPAWN_MARGIN);

      let safe = true;
      for (const snake of this.snakes.values()) {
        if (!snake.alive) continue;
        if (distance(snake.head, { x, y }) < SPAWN_SAFETY_RADIUS) {
          safe = false;
          break;
        }
      }
      if (safe) return { x, y };
    }
    // Fallback
    return {
      x: randomInRange(SPAWN_MARGIN, WORLD_WIDTH - SPAWN_MARGIN),
      y: randomInRange(SPAWN_MARGIN, WORLD_HEIGHT - SPAWN_MARGIN),
    };
  }

  addPlayer(id: string, name: string, skinId: number): Snake {
    const spawn = this.findSpawnPoint();
    const snake = new Snake(id, name, skinId, spawn.x, spawn.y);
    this.snakes.set(id, snake);
    console.log(`[Engine] Player joined: ${name} (${id})`);
    return snake;
  }

  removePlayer(id: string): void {
    const snake = this.snakes.get(id);
    if (snake) {
      console.log(`[Engine] Player left: ${snake.name} (${id})`);
      if (snake.alive) {
        snake.alive = false;
        this.pelletSystem.spawnDeathPellets(snake.segments, snake.score);
      }
    }
    this.snakes.delete(id);
    this.botIds.delete(id);
  }

  handleInput(id: string, input: PlayerInput): void {
    const snake = this.snakes.get(id);
    if (!snake || !snake.alive) return;
    snake.setInput(input.angle, input.boosting);
  }

  private spawnBots(count: number): void {
    for (let i = 0; i < count; i++) {
      const id = `bot_${Date.now()}_${i}`;
      const name = this.botAI.generateBotName();
      const skinId = this.botAI.generateBotSkin();
      this.botAI.initBot(id);
      const snake = this.addPlayer(id, name, skinId);
      snake.isBot = true;
      this.botIds.add(id);
    }
  }

  private respawnBot(oldId: string, name: string, skinId: number): void {
    this.snakes.delete(oldId);
    this.botIds.delete(oldId);

    const id = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.botAI.initBot(id);
    const snake = this.addPlayer(id, name, skinId);
    snake.isBot = true;
    this.botIds.add(id);
  }

  getSnapshot(forPlayerId?: string): WorldSnapshot {
    const snakes: SnakeState[] = [];
    for (const snake of this.snakes.values()) {
      if (!snake.alive) continue;
      snakes.push(snake.toState());
    }

    const pellets: PelletState[] = [];
    for (const pellet of this.pelletSystem.pellets.values()) {
      pellets.push(pellet.toState());
    }

    return {
      snakes,
      pellets,
      tick: this.tick,
      timestamp: Date.now(),
    };
  }

  getAlivePlayerCount(): number {
    let count = 0;
    for (const snake of this.snakes.values()) {
      if (snake.alive && !snake.isBot) count++;
    }
    return count;
  }

  getTotalPlayerCount(): number {
    let count = 0;
    for (const snake of this.snakes.values()) {
      if (!snake.isBot) count++;
    }
    return count;
  }
}
