// ============================================================
// Offline Game Engine - Self-contained client-side simulation
// ============================================================
// Mirrors server logic for offline play with bots.
// No server imports — fully standalone for browser bundling.

import {
  WorldSnapshot, SnakeState, SnakeSegment, PelletState,
  DeathEvent, LeaderboardUpdate, PlayerInput, BotPersonality,
} from '@shared/types.js';
import {
  WORLD_WIDTH, WORLD_HEIGHT,
  SNAKE_INITIAL_LENGTH, SNAKE_SEGMENT_SPACING, SNAKE_BASE_RADIUS,
  SNAKE_MAX_RADIUS, SNAKE_BASE_SPEED, SNAKE_MIN_SPEED,
  SNAKE_TURN_RATE, SNAKE_TURN_RATE_MIN, SNAKE_INITIAL_SCORE,
  SNAKE_MAX_SEGMENTS, BOOST_SPEED_MULTIPLIER, BOOST_MASS_DRAIN_RATE,
  BOOST_MIN_SCORE, BOOST_PELLET_INTERVAL, BOOST_PELLET_VALUE,
  SCORE_TO_LENGTH_RATIO, GROWTH_SMOOTHING_RATE,
  SURGE_CHARGE_MAX, SURGE_PASSIVE_CHARGE_RATE, SURGE_PELLET_CHARGE_MULTIPLIER,
  SURGE_DURATION, SURGE_SPEED_MULTIPLIER, SURGE_PELLET_MAGNET_RADIUS,
  PELLET_BASE_COUNT, PELLET_RADIUS, PELLET_SPAWN_MARGIN,
  PELLET_PICKUP_RADIUS_BONUS, DEATH_PELLET_RADIUS,
  DEATH_PELLET_LIFETIME, GROWTH_PER_PELLET, GROWTH_PER_DEATH_PELLET,
  SELF_COLLISION_ENABLED, HEAD_TO_HEAD_BOTH_DIE, BOUNDARY_KILLS,
  COLLISION_GRACE_SEGMENTS,
  BOT_COUNT_DEFAULT, BOT_NAMES, SKIN_COUNT,
  SPAWN_MARGIN, SPAWN_SAFETY_RADIUS, SPAWN_MAX_ATTEMPTS,
  LEADERBOARD_SIZE, LEADERBOARD_UPDATE_INTERVAL,
  SPATIAL_CELL_SIZE,
} from '@shared/constants.js';
import {
  normalizeAngle, angleDiff, clamp, lerp, distance,
  circlesOverlap, randomInRange, randomInt,
} from '@shared/math.js';

// ---- Inline Snake class ----
class OSnake {
  id: string;
  name: string;
  skinId: number;
  segments: SnakeSegment[] = [];
  angle = 0;
  targetAngle = 0;
  score = SNAKE_INITIAL_SCORE;
  boosting = false;
  alive = true;
  isBot = false;
  private targetSegCount = SNAKE_INITIAL_LENGTH;
  private boostDistAccum = 0;
  surgeCharge = 0;
  surgeActiveTimer = 0;
  pendingBoostPellets: { x: number; y: number }[] = [];

  constructor(id: string, name: string, skinId: number, x: number, y: number) {
    this.id = id; this.name = name; this.skinId = skinId;
    this.angle = Math.random() * Math.PI * 2;
    this.targetAngle = this.angle;
    for (let i = 0; i < SNAKE_INITIAL_LENGTH; i++) {
      this.segments.push({
        x: x - Math.cos(this.angle) * i * SNAKE_SEGMENT_SPACING,
        y: y - Math.sin(this.angle) * i * SNAKE_SEGMENT_SPACING,
      });
    }
  }
  get head() { return this.segments[0]; }
  get radius() {
    const r = clamp((this.score - SNAKE_INITIAL_SCORE) / 500, 0, 1);
    return lerp(SNAKE_BASE_RADIUS, SNAKE_MAX_RADIUS, r);
  }
  get speed() {
    const r = clamp((this.score - SNAKE_INITIAL_SCORE) / 500, 0, 1);
    const base = lerp(SNAKE_BASE_SPEED, SNAKE_MIN_SPEED, r);
    if (this.surgeActive) return base * SURGE_SPEED_MULTIPLIER;
    return this.boosting ? base * BOOST_SPEED_MULTIPLIER : base;
  }
  get surgeActive() { return this.surgeActiveTimer > 0; }
  get turnRate() {
    const r = clamp((this.score - SNAKE_INITIAL_SCORE) / 500, 0, 1);
    return lerp(SNAKE_TURN_RATE, SNAKE_TURN_RATE_MIN, r);
  }
  update(dt: number) {
    if (!this.alive) return;
    const diff = angleDiff(this.angle, this.targetAngle);
    const maxTurn = this.turnRate * dt;
    this.angle = Math.abs(diff) < maxTurn
      ? this.targetAngle
      : normalizeAngle(this.angle + Math.sign(diff) * maxTurn);

    if (this.boosting && this.score <= BOOST_MIN_SCORE) this.boosting = false;
    if (this.boosting) this.score = Math.max(BOOST_MIN_SCORE, this.score - BOOST_MASS_DRAIN_RATE * dt);
    else this.surgeCharge = Math.min(SURGE_CHARGE_MAX, this.surgeCharge + SURGE_PASSIVE_CHARGE_RATE * dt);
    if (this.surgeActiveTimer > 0) this.surgeActiveTimer = Math.max(0, this.surgeActiveTimer - dt);

    const spd = this.speed * dt;
    this.segments.unshift({
      x: this.head.x + Math.cos(this.angle) * spd,
      y: this.head.y + Math.sin(this.angle) * spd,
    });

    if (this.boosting) {
      this.boostDistAccum += spd;
      while (this.boostDistAccum >= BOOST_PELLET_INTERVAL) {
        this.boostDistAccum -= BOOST_PELLET_INTERVAL;
        const tail = this.segments[this.segments.length - 1];
        this.pendingBoostPellets.push({ x: tail.x, y: tail.y });
      }
    }

    for (let i = 1; i < this.segments.length; i++) {
      const prev = this.segments[i - 1], curr = this.segments[i];
      const dx = curr.x - prev.x, dy = curr.y - prev.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > SNAKE_SEGMENT_SPACING) {
        const ratio = SNAKE_SEGMENT_SPACING / d;
        curr.x = prev.x + dx * ratio;
        curr.y = prev.y + dy * ratio;
      }
    }

    this.targetSegCount = Math.min(SNAKE_MAX_SEGMENTS, SNAKE_INITIAL_LENGTH + Math.floor(this.score * SCORE_TO_LENGTH_RATIO));
    const diff2 = this.targetSegCount - this.segments.length;
    if (diff2 > 0) {
      const grow = Math.min(diff2, Math.ceil(GROWTH_SMOOTHING_RATE * 60 * dt));
      for (let i = 0; i < grow; i++) {
        const t = this.segments[this.segments.length - 1];
        this.segments.push({ x: t.x, y: t.y });
      }
    } else if (diff2 < -1) {
      this.segments.splice(this.segments.length - Math.min(-diff2, Math.ceil(GROWTH_SMOOTHING_RATE * 60 * dt)));
    }
  }
  setInput(angle: number, boosting: boolean) {
    this.targetAngle = normalizeAngle(angle);
    if (boosting && this.surgeCharge >= SURGE_CHARGE_MAX && !this.surgeActive) {
      this.surgeActiveTimer = SURGE_DURATION;
      this.surgeCharge = 0;
    }
    this.boosting = boosting && this.score > BOOST_MIN_SCORE && !this.surgeActive;
  }
  addScore(amount: number) {
    this.score += amount;
    this.surgeCharge = Math.min(SURGE_CHARGE_MAX, this.surgeCharge + amount * SURGE_PELLET_CHARGE_MULTIPLIER);
  }
  canMagnetCollect(dist: number) {
    return this.surgeActive && dist <= this.radius + SURGE_PELLET_MAGNET_RADIUS;
  }
  toState(): SnakeState {
    return {
      id: this.id, name: this.name, skinId: this.skinId,
      segments: this.segments, angle: this.angle,
      score: Math.floor(this.score), boosting: this.boosting,
      alive: this.alive, radius: this.radius, speed: this.speed,
      surgeCharge: this.surgeCharge, surgeActive: this.surgeActive,
    };
  }
}

// ---- Inline Pellet ----
let _nextPelletId = 1;
interface OPellet {
  id: number; x: number; y: number; radius: number;
  color: number; value: number; isDeathPellet: boolean; createdAt: number;
}
function makePellet(x: number, y: number, isDeath: boolean, value?: number): OPellet {
  return {
    id: _nextPelletId++, x, y,
    radius: isDeath ? DEATH_PELLET_RADIUS : PELLET_RADIUS,
    color: Math.random() * 360,
    value: value ?? (isDeath ? GROWTH_PER_DEATH_PELLET : GROWTH_PER_PELLET),
    isDeathPellet: isDeath,
    createdAt: Date.now(),
  };
}

// ---- Inline SpatialHash ----
class SHash<T extends { id: string | number; x: number; y: number; radius: number }> {
  private cells = new Map<string, T[]>();
  private cs: number;
  constructor(cs = SPATIAL_CELL_SIZE) { this.cs = cs; }
  clear() { this.cells.clear(); }
  private k(cx: number, cy: number) { return `${cx},${cy}`; }
  private cc(v: number) { return Math.floor(v / this.cs); }
  insert(e: T) {
    const x0 = this.cc(e.x - e.radius), x1 = this.cc(e.x + e.radius);
    const y0 = this.cc(e.y - e.radius), y1 = this.cc(e.y + e.radius);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const k = this.k(cx, cy);
      let c = this.cells.get(k);
      if (!c) { c = []; this.cells.set(k, c); }
      c.push(e);
    }
  }
  query(x: number, y: number, r: number): T[] {
    const x0 = this.cc(x - r), x1 = this.cc(x + r);
    const y0 = this.cc(y - r), y1 = this.cc(y + r);
    const seen = new Set<string | number>(); const res: T[] = [];
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const c = this.cells.get(this.k(cx, cy));
      if (!c) continue;
      for (const e of c) if (!seen.has(e.id)) { seen.add(e.id); res.push(e); }
    }
    return res;
  }
}

// ---- Bot AI ----
const PERSONALITIES: BotPersonality[] = ['timid', 'greedy', 'aggressive', 'balanced'];
interface BotState {
  personality: BotPersonality;
  wanderAngle: number;
  decisionTimer: number;
  boostTimer: number;
}

// ---- Main Engine ----
export class OfflineEngine {
  private snakes = new Map<string, OSnake>();
  private pellets = new Map<number, OPellet>();
  private botIds = new Set<string>();
  private botStates = new Map<string, BotState>();
  private usedNames = new Set<string>();
  private tick = 0;
  private localPlayerId = 'local-player';
  private lastUpdate = 0;
  private lastLbUpdate = 0;
  private segHash = new SHash<{ id: string; x: number; y: number; radius: number; snakeId: string; segIdx: number }>();
  private pelletHash = new SHash<{ id: number; x: number; y: number; radius: number }>();

  onDeath: ((event: DeathEvent) => void) | null = null;
  onLeaderboard: ((update: LeaderboardUpdate) => void) | null = null;
  onPelletEaten: ((pelletId: number) => void) | null = null;

  start(playerName: string, skinId: number): string {
    _nextPelletId = 1;
    this.initPellets();
    this.spawnBots(BOT_COUNT_DEFAULT);
    const spawn = this.findSpawn();
    const player = new OSnake(this.localPlayerId, playerName, skinId, spawn.x, spawn.y);
    this.snakes.set(this.localPlayerId, player);
    this.lastUpdate = performance.now();
    return this.localPlayerId;
  }

  stop() { this.snakes.clear(); this.pellets.clear(); this.botIds.clear(); }

  update(): WorldSnapshot {
    const now = performance.now();
    const dt = Math.min((now - this.lastUpdate) / 1000, 0.1);
    this.lastUpdate = now;
    this.tick++;

    // Bot AI
    for (const botId of this.botIds) {
      const bot = this.snakes.get(botId);
      if (!bot || !bot.alive) continue;
      const input = this.botUpdate(dt, bot);
      bot.setInput(input.angle, input.boosting);
    }

    // Update snakes
    for (const snake of this.snakes.values()) {
      if (!snake.alive) continue;
      snake.update(dt);
      for (const pos of snake.pendingBoostPellets) {
        const p = makePellet(pos.x, pos.y, false, BOOST_PELLET_VALUE);
        this.pellets.set(p.id, p);
      }
      snake.pendingBoostPellets = [];
    }

    // Collisions
    this.runCollisions();

    // Replenish pellets
    this.replenishPellets();

    // Leaderboard
    if (now - this.lastLbUpdate > LEADERBOARD_UPDATE_INTERVAL) {
      this.lastLbUpdate = now;
      this.emitLeaderboard();
    }

    return this.getSnapshot();
  }

  handleInput(input: PlayerInput) {
    const s = this.snakes.get(this.localPlayerId);
    if (s && s.alive) s.setInput(input.angle, input.boosting);
  }

  respawn(name: string, skinId: number): string {
    this.snakes.delete(this.localPlayerId);
    const spawn = this.findSpawn();
    const player = new OSnake(this.localPlayerId, name, skinId, spawn.x, spawn.y);
    this.snakes.set(this.localPlayerId, player);
    return this.localPlayerId;
  }

  getPlayerId() { return this.localPlayerId; }

  // ---- Internals ----

  private runCollisions() {
    this.segHash.clear();
    this.pelletHash.clear();

    for (const snake of this.snakes.values()) {
      if (!snake.alive) continue;
      for (let i = 0; i < snake.segments.length; i++) {
        const seg = snake.segments[i];
        this.segHash.insert({ id: `${snake.id}:${i}`, x: seg.x, y: seg.y, radius: snake.radius, snakeId: snake.id, segIdx: i });
      }
    }
    for (const p of this.pellets.values()) {
      this.pelletHash.insert({ id: p.id, x: p.x, y: p.y, radius: p.radius });
    }

    const dead = new Set<string>();
    const killerMap = new Map<string, string | null>();
    const eaten = new Map<string, number[]>();

    for (const snake of this.snakes.values()) {
      if (!snake.alive) continue;
      const head = snake.head;
      const hr = snake.radius;

      // Boundary
      if (BOUNDARY_KILLS && (head.x - hr < 0 || head.x + hr > WORLD_WIDTH || head.y - hr < 0 || head.y + hr > WORLD_HEIGHT)) {
        dead.add(snake.id); killerMap.set(snake.id, null); continue;
      }

      // Body collisions
      const nearby = this.segHash.query(head.x, head.y, hr + 50);
      for (const seg of nearby) {
        if (seg.snakeId === snake.id) {
          if (!SELF_COLLISION_ENABLED || seg.segIdx < COLLISION_GRACE_SEGMENTS) continue;
        }
        if (seg.snakeId !== snake.id && seg.segIdx === 0) continue;
        const other = this.snakes.get(seg.snakeId);
        if (!other || !other.alive) continue;
        if (circlesOverlap(head.x, head.y, hr * 0.7, seg.x, seg.y, other.radius * 0.7)) {
          dead.add(snake.id); killerMap.set(snake.id, seg.snakeId); break;
        }
      }

      // Head-to-head
      if (HEAD_TO_HEAD_BOTH_DIE && !dead.has(snake.id)) {
        for (const other of this.snakes.values()) {
          if (other.id === snake.id || !other.alive || dead.has(other.id)) continue;
          if (circlesOverlap(head.x, head.y, hr * 0.6, other.head.x, other.head.y, other.radius * 0.6)) {
            dead.add(snake.id); dead.add(other.id);
            killerMap.set(snake.id, other.id); killerMap.set(other.id, snake.id);
          }
        }
      }

      // Pellets
      if (!dead.has(snake.id)) {
        const queryRadius = snake.surgeActive ? hr + SURGE_PELLET_MAGNET_RADIUS + 30 : hr + PELLET_PICKUP_RADIUS_BONUS + 10;
        const np = this.pelletHash.query(head.x, head.y, queryRadius);
        for (const p of np) {
          const d = distance(head, p) + p.radius;
          if (circlesOverlap(head.x, head.y, hr + PELLET_PICKUP_RADIUS_BONUS, p.x, p.y, p.radius) || snake.canMagnetCollect(d)) {
            if (!eaten.has(snake.id)) eaten.set(snake.id, []);
            eaten.get(snake.id)!.push(p.id);
          }
        }
      }
    }

    // Process deaths
    for (const deadId of dead) {
      const snake = this.snakes.get(deadId);
      if (!snake || !snake.alive) continue;
      snake.alive = false;
      const killerId = killerMap.get(deadId) ?? null;
      const killer = killerId ? this.snakes.get(killerId) : null;
      const deathPellets = this.spawnDeathPellets(snake);

      this.onDeath?.({
        playerId: deadId,
        killerName: killer?.name ?? null,
        score: Math.floor(snake.score),
        pellets: deathPellets,
      });

      if (this.botIds.has(deadId)) {
        setTimeout(() => this.respawnBot(deadId, snake.name, snake.skinId), 3000);
      }
    }

    // Process eaten
    for (const [pid, pelletIds] of eaten) {
      const snake = this.snakes.get(pid);
      if (!snake) continue;
      for (const pelletId of pelletIds) {
        const p = this.pellets.get(pelletId);
        if (!p) continue;
        snake.addScore(p.value);
        this.pellets.delete(pelletId);
        if (pid === this.localPlayerId) this.onPelletEaten?.(pelletId);
      }
    }
  }

  private spawnDeathPellets(snake: OSnake): PelletState[] {
    const result: PelletState[] = [];
    const step = Math.max(1, Math.floor(snake.segments.length / Math.min(snake.segments.length, 40)));
    for (let i = 0; i < snake.segments.length; i += step) {
      const seg = snake.segments[i];
      const p = makePellet(seg.x + (Math.random() - 0.5) * 20, seg.y + (Math.random() - 0.5) * 20, true);
      this.pellets.set(p.id, p);
      result.push({
        id: p.id, x: p.x, y: p.y, radius: p.radius,
        color: p.color, value: p.value, isDeathPellet: true,
      });
    }
    return result;
  }

  private initPellets() {
    for (let i = 0; i < PELLET_BASE_COUNT; i++) {
      const p = makePellet(
        randomInRange(PELLET_SPAWN_MARGIN, WORLD_WIDTH - PELLET_SPAWN_MARGIN),
        randomInRange(PELLET_SPAWN_MARGIN, WORLD_HEIGHT - PELLET_SPAWN_MARGIN),
        false
      );
      this.pellets.set(p.id, p);
    }
  }

  private replenishPellets() {
    const now = Date.now();
    // Remove expired death pellets
    for (const p of this.pellets.values()) {
      if (p.isDeathPellet && now - p.createdAt > DEATH_PELLET_LIFETIME) {
        this.pellets.delete(p.id);
      }
    }
    let normal = 0;
    for (const p of this.pellets.values()) if (!p.isDeathPellet) normal++;
    while (normal < PELLET_BASE_COUNT) {
      const p = makePellet(
        randomInRange(PELLET_SPAWN_MARGIN, WORLD_WIDTH - PELLET_SPAWN_MARGIN),
        randomInRange(PELLET_SPAWN_MARGIN, WORLD_HEIGHT - PELLET_SPAWN_MARGIN),
        false
      );
      this.pellets.set(p.id, p);
      normal++;
    }
  }

  private findSpawn() {
    for (let i = 0; i < SPAWN_MAX_ATTEMPTS; i++) {
      const x = randomInRange(SPAWN_MARGIN, WORLD_WIDTH - SPAWN_MARGIN);
      const y = randomInRange(SPAWN_MARGIN, WORLD_HEIGHT - SPAWN_MARGIN);
      let safe = true;
      for (const s of this.snakes.values()) {
        if (!s.alive) continue;
        if (distance(s.head, { x, y }) < SPAWN_SAFETY_RADIUS) { safe = false; break; }
      }
      if (safe) return { x, y };
    }
    return { x: randomInRange(SPAWN_MARGIN, WORLD_WIDTH - SPAWN_MARGIN), y: randomInRange(SPAWN_MARGIN, WORLD_HEIGHT - SPAWN_MARGIN) };
  }

  private spawnBots(count: number) {
    for (let i = 0; i < count; i++) {
      const id = `bot_${i}_${Date.now()}`;
      const available = BOT_NAMES.filter(n => !this.usedNames.has(n));
      const name = available.length > 0 ? available[randomInt(0, available.length - 1)] : `Bot${randomInt(100, 999)}`;
      this.usedNames.add(name);
      const skinId = randomInt(0, SKIN_COUNT - 1);
      const spawn = this.findSpawn();
      const snake = new OSnake(id, name, skinId, spawn.x, spawn.y);
      snake.isBot = true;
      this.snakes.set(id, snake);
      this.botIds.add(id);
      this.botStates.set(id, {
        personality: PERSONALITIES[randomInt(0, 3)],
        wanderAngle: Math.random() * Math.PI * 2,
        decisionTimer: 0,
        boostTimer: 0,
      });
    }
  }

  private respawnBot(oldId: string, name: string, skinId: number) {
    this.snakes.delete(oldId); this.botIds.delete(oldId); this.botStates.delete(oldId);
    const id = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const spawn = this.findSpawn();
    const snake = new OSnake(id, name, skinId, spawn.x, spawn.y);
    snake.isBot = true;
    this.snakes.set(id, snake);
    this.botIds.add(id);
    this.botStates.set(id, {
      personality: PERSONALITIES[randomInt(0, 3)],
      wanderAngle: Math.random() * Math.PI * 2,
      decisionTimer: 0,
      boostTimer: 0,
    });
  }

  private botUpdate(dt: number, bot: OSnake): { angle: number; boosting: boolean } {
    const st = this.botStates.get(bot.id);
    if (!st) return { angle: bot.angle, boosting: false };
    st.decisionTimer -= dt;
    st.boostTimer -= dt;

    let targetAngle = st.wanderAngle;
    let shouldBoost = false;
    const head = bot.head;

    // Find nearest pellet & snake
    let nearPellet: OPellet | null = null, npd = Infinity;
    for (const p of this.pellets.values()) {
      const d = distance(head, p);
      if (d < npd) { npd = d; nearPellet = p; }
    }
    let nearSnake: OSnake | null = null, nsd = Infinity;
    for (const s of this.snakes.values()) {
      if (s.id === bot.id || !s.alive) continue;
      const d = distance(head, s.head);
      if (d < nsd) { nsd = d; nearSnake = s; }
    }

    const borderDist = Math.min(head.x, head.y, WORLD_WIDTH - head.x, WORLD_HEIGHT - head.y);
    if (borderDist < 200) {
      targetAngle = Math.atan2(WORLD_HEIGHT / 2 - head.y, WORLD_WIDTH / 2 - head.x);
    } else if (st.decisionTimer <= 0) {
      st.decisionTimer = randomInRange(0.3, 1.5);
      switch (st.personality) {
        case 'timid':
          if (nsd < 300 && nearSnake) {
            targetAngle = Math.atan2(head.y - nearSnake.head.y, head.x - nearSnake.head.x);
            shouldBoost = nsd < 150 && bot.score > BOOST_MIN_SCORE;
          } else if (nearPellet && npd < 500) {
            targetAngle = Math.atan2(nearPellet.y - head.y, nearPellet.x - head.x);
          } else { st.wanderAngle += randomInRange(-0.5, 0.5); targetAngle = st.wanderAngle; }
          break;
        case 'greedy':
          if (nearPellet) {
            targetAngle = Math.atan2(nearPellet.y - head.y, nearPellet.x - head.x);
            shouldBoost = npd < 200 && bot.score > BOOST_MIN_SCORE * 2 && Math.random() < 0.3;
          }
          break;
        case 'aggressive':
          if (nearSnake && nsd < 400) {
            if (bot.score > nearSnake.score * 1.2) {
              targetAngle = Math.atan2(nearSnake.head.y - head.y, nearSnake.head.x - head.x);
              shouldBoost = nsd < 250 && (bot.score > BOOST_MIN_SCORE * 2 || bot.surgeCharge >= SURGE_CHARGE_MAX);
            } else if (bot.score < nearSnake.score * 0.8) {
              targetAngle = Math.atan2(head.y - nearSnake.head.y, head.x - nearSnake.head.x);
              shouldBoost = nsd < 200 && (bot.score > BOOST_MIN_SCORE || bot.surgeCharge >= SURGE_CHARGE_MAX);
            } else if (nearPellet) {
              targetAngle = Math.atan2(nearPellet.y - head.y, nearPellet.x - head.x);
            }
          } else if (nearPellet) {
            targetAngle = Math.atan2(nearPellet.y - head.y, nearPellet.x - head.x);
          }
          break;
        case 'balanced':
          if (nsd < 200 && nearSnake) {
            targetAngle = Math.atan2(head.y - nearSnake.head.y, head.x - nearSnake.head.x);
          } else if (nearPellet && npd < 400) {
            targetAngle = Math.atan2(nearPellet.y - head.y, nearPellet.x - head.x);
          } else { st.wanderAngle += randomInRange(-0.3, 0.3); targetAngle = st.wanderAngle; }
          break;
      }
      st.wanderAngle = targetAngle;
    } else {
      targetAngle = st.wanderAngle;
    }

    if (shouldBoost && st.boostTimer <= 0) {
      st.boostTimer = randomInRange(2, 5);
    } else { shouldBoost = false; }

    return { angle: normalizeAngle(targetAngle), boosting: shouldBoost };
  }

  private emitLeaderboard() {
    const entries: { id: string; name: string; score: number; skinId: number }[] = [];
    for (const s of this.snakes.values()) {
      if (!s.alive) continue;
      entries.push({ id: s.id, name: s.name, score: Math.floor(s.score), skinId: s.skinId });
    }
    entries.sort((a, b) => b.score - a.score);
    const rank = entries.findIndex(e => e.id === this.localPlayerId) + 1;
    const score = entries.find(e => e.id === this.localPlayerId)?.score ?? 0;
    this.onLeaderboard?.({
      entries: entries.slice(0, LEADERBOARD_SIZE),
      playerRank: rank || entries.length + 1,
      playerScore: score,
    });
  }

  private getSnapshot(): WorldSnapshot {
    const snakes: SnakeState[] = [];
    for (const s of this.snakes.values()) {
      if (!s.alive) continue;
      snakes.push(s.toState());
    }
    const pellets: PelletState[] = [];
    for (const p of this.pellets.values()) {
      pellets.push({
        id: p.id, x: p.x, y: p.y, radius: p.radius,
        color: p.color, value: p.value, isDeathPellet: p.isDeathPellet,
      });
    }
    return { snakes, pellets, tick: this.tick, timestamp: Date.now() };
  }
}
