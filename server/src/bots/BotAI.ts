// ============================================================
// Bot AI System
// ============================================================

import { Snake } from '../entities/Snake.js';
import { Pellet } from '../entities/Pellet.js';
import { BotPersonality, Vec2 } from '../../../shared/src/types.js';
import {
  BOT_NAMES, WORLD_WIDTH, WORLD_HEIGHT, SKIN_COUNT,
  SPAWN_MARGIN, BOOST_MIN_SCORE,
} from '../../../shared/src/constants.js';
import { distance, normalizeAngle, randomInRange, randomInt } from '../../../shared/src/math.js';

const PERSONALITIES: BotPersonality[] = ['timid', 'greedy', 'aggressive', 'balanced'];

interface BotState {
  personality: BotPersonality;
  targetX: number;
  targetY: number;
  decisionTimer: number;
  boostTimer: number;
  wanderAngle: number;
}

export class BotAI {
  private states: Map<string, BotState> = new Map();
  private usedNames: Set<string> = new Set();

  generateBotName(): string {
    const available = BOT_NAMES.filter(n => !this.usedNames.has(n));
    if (available.length === 0) {
      const name = `Bot${randomInt(100, 999)}`;
      this.usedNames.add(name);
      return name;
    }
    const name = available[randomInt(0, available.length - 1)];
    this.usedNames.add(name);
    return name;
  }

  generateBotSkin(): number {
    return randomInt(0, SKIN_COUNT - 1);
  }

  initBot(botId: string): void {
    this.states.set(botId, {
      personality: PERSONALITIES[randomInt(0, PERSONALITIES.length - 1)],
      targetX: randomInRange(SPAWN_MARGIN, WORLD_WIDTH - SPAWN_MARGIN),
      targetY: randomInRange(SPAWN_MARGIN, WORLD_HEIGHT - SPAWN_MARGIN),
      decisionTimer: 0,
      boostTimer: 0,
      wanderAngle: Math.random() * Math.PI * 2,
    });
  }

  removeBot(botId: string): void {
    const state = this.states.get(botId);
    if (state) {
      this.states.delete(botId);
    }
  }

  releaseName(name: string): void {
    this.usedNames.delete(name);
  }

  update(
    dt: number,
    bot: Snake,
    allSnakes: Map<string, Snake>,
    pellets: Map<number, Pellet>
  ): { angle: number; boosting: boolean } {
    let state = this.states.get(bot.id);
    if (!state) {
      this.initBot(bot.id);
      state = this.states.get(bot.id)!;
    }

    state.decisionTimer -= dt;
    state.boostTimer -= dt;

    const head = bot.head;
    let targetAngle = state.wanderAngle;
    let shouldBoost = false;

    // Find nearest pellet
    let nearestPellet: Pellet | null = null;
    let nearestPelletDist = Infinity;
    for (const pellet of pellets.values()) {
      const d = distance(head, pellet);
      if (d < nearestPelletDist) {
        nearestPelletDist = d;
        nearestPellet = pellet;
      }
    }

    // Find nearest other snake head
    let nearestSnake: Snake | null = null;
    let nearestSnakeDist = Infinity;
    for (const other of allSnakes.values()) {
      if (other.id === bot.id || !other.alive) continue;
      const d = distance(head, other.head);
      if (d < nearestSnakeDist) {
        nearestSnakeDist = d;
        nearestSnake = other;
      }
    }

    // Check boundary proximity
    const borderDist = Math.min(head.x, head.y, WORLD_WIDTH - head.x, WORLD_HEIGHT - head.y);
    const borderDanger = borderDist < 200;

    if (borderDanger) {
      // Steer toward center
      targetAngle = Math.atan2(WORLD_HEIGHT / 2 - head.y, WORLD_WIDTH / 2 - head.x);
    } else if (state.decisionTimer <= 0) {
      state.decisionTimer = randomInRange(0.3, 1.5);

      switch (state.personality) {
        case 'timid':
          // Avoid snakes, seek pellets cautiously
          if (nearestSnakeDist < 300 && nearestSnake) {
            targetAngle = Math.atan2(head.y - nearestSnake.head.y, head.x - nearestSnake.head.x);
            shouldBoost = nearestSnakeDist < 150 && bot.score > BOOST_MIN_SCORE;
          } else if (nearestPellet && nearestPelletDist < 500) {
            targetAngle = Math.atan2(nearestPellet.y - head.y, nearestPellet.x - head.x);
          } else {
            state.wanderAngle += randomInRange(-0.5, 0.5);
            targetAngle = state.wanderAngle;
          }
          break;

        case 'greedy':
          // Always seek pellets, ignore danger somewhat
          if (nearestPellet) {
            targetAngle = Math.atan2(nearestPellet.y - head.y, nearestPellet.x - head.x);
            shouldBoost = nearestPelletDist < 200 && bot.score > BOOST_MIN_SCORE * 2 && Math.random() < 0.3;
          }
          break;

        case 'aggressive':
          // Chase smaller snakes, avoid larger ones
          if (nearestSnake && nearestSnakeDist < 400) {
            if (bot.score > nearestSnake.score * 1.2) {
              // Chase
              targetAngle = Math.atan2(nearestSnake.head.y - head.y, nearestSnake.head.x - head.x);
              shouldBoost = nearestSnakeDist < 250 && bot.score > BOOST_MIN_SCORE * 2;
            } else if (bot.score < nearestSnake.score * 0.8) {
              // Flee
              targetAngle = Math.atan2(head.y - nearestSnake.head.y, head.x - nearestSnake.head.x);
              shouldBoost = nearestSnakeDist < 200 && bot.score > BOOST_MIN_SCORE;
            } else if (nearestPellet) {
              targetAngle = Math.atan2(nearestPellet.y - head.y, nearestPellet.x - head.x);
            }
          } else if (nearestPellet) {
            targetAngle = Math.atan2(nearestPellet.y - head.y, nearestPellet.x - head.x);
          }
          break;

        case 'balanced':
          // Mix of pellet seeking and avoidance
          if (nearestSnakeDist < 200 && nearestSnake) {
            targetAngle = Math.atan2(head.y - nearestSnake.head.y, head.x - nearestSnake.head.x);
          } else if (nearestPellet && nearestPelletDist < 400) {
            targetAngle = Math.atan2(nearestPellet.y - head.y, nearestPellet.x - head.x);
          } else {
            state.wanderAngle += randomInRange(-0.3, 0.3);
            targetAngle = state.wanderAngle;
          }
          break;
      }

      state.wanderAngle = targetAngle;
    } else {
      targetAngle = state.wanderAngle;
    }

    // Don't boost too frequently
    if (shouldBoost && state.boostTimer <= 0) {
      state.boostTimer = randomInRange(2, 5);
    } else {
      shouldBoost = false;
    }

    return {
      angle: normalizeAngle(targetAngle),
      boosting: shouldBoost,
    };
  }
}
