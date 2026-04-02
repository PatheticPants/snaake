// ============================================================
// Collision System - Server Authoritative
// ============================================================

import { Snake } from '../entities/Snake.js';
import { Pellet } from '../entities/Pellet.js';
import { SpatialHash, SpatialEntity } from '../spatial/SpatialHash.js';
import {
  SELF_COLLISION_ENABLED, HEAD_TO_HEAD_BOTH_DIE,
  BOUNDARY_KILLS, COLLISION_GRACE_SEGMENTS,
  PELLET_PICKUP_RADIUS_BONUS, WORLD_WIDTH, WORLD_HEIGHT,
  SNAKE_SEGMENT_SPACING,
} from '../../../shared/src/constants.js';
import { circlesOverlap } from '../../../shared/src/math.js';

interface SegmentEntity extends SpatialEntity {
  snakeId: string;
  segmentIndex: number;
}

export interface CollisionResult {
  deadSnakeIds: Set<string>;
  eatenPellets: Map<string, number[]>; // playerId -> pelletIds
  killerMap: Map<string, string | null>; // deadId -> killerId
}

export class CollisionSystem {
  private segmentHash: SpatialHash<SegmentEntity> = new SpatialHash();
  private pelletHash: SpatialHash<SpatialEntity & { pelletId: number }> = new SpatialHash();

  update(snakes: Map<string, Snake>, pellets: Map<number, Pellet>): CollisionResult {
    const result: CollisionResult = {
      deadSnakeIds: new Set(),
      eatenPellets: new Map(),
      killerMap: new Map(),
    };

    // Build spatial hashes
    this.segmentHash.clear();
    this.pelletHash.clear();

    // Insert all snake segments
    for (const snake of snakes.values()) {
      if (!snake.alive) continue;
      for (let i = 0; i < snake.segments.length; i++) {
        const seg = snake.segments[i];
        this.segmentHash.insert({
          id: `${snake.id}:${i}`,
          x: seg.x,
          y: seg.y,
          radius: snake.radius,
          snakeId: snake.id,
          segmentIndex: i,
        });
      }
    }

    // Insert all pellets
    for (const pellet of pellets.values()) {
      this.pelletHash.insert({
        id: pellet.id,
        x: pellet.x,
        y: pellet.y,
        radius: pellet.radius,
        pelletId: pellet.id,
      });
    }

    // Check each alive snake's head
    for (const snake of snakes.values()) {
      if (!snake.alive) continue;

      const head = snake.head;
      const headRadius = snake.radius;

      // --- Boundary collision ---
      if (BOUNDARY_KILLS) {
        if (head.x - headRadius < 0 || head.x + headRadius > WORLD_WIDTH ||
            head.y - headRadius < 0 || head.y + headRadius > WORLD_HEIGHT) {
          result.deadSnakeIds.add(snake.id);
          result.killerMap.set(snake.id, null);
          continue;
        }
      }

      // --- Snake-to-snake collision ---
      const nearby = this.segmentHash.query(head.x, head.y, headRadius + 50);
      for (const seg of nearby) {
        if (seg.snakeId === snake.id) {
          // Self collision
          if (!SELF_COLLISION_ENABLED) continue;
          if (seg.segmentIndex < COLLISION_GRACE_SEGMENTS) continue;
        }

        // Skip head-to-head check for segment 0 of other snakes here;
        // we handle it separately
        if (seg.snakeId !== snake.id && seg.segmentIndex === 0) continue;

        const otherSnake = snakes.get(seg.snakeId);
        if (!otherSnake || !otherSnake.alive) continue;

        if (circlesOverlap(
          head.x, head.y, headRadius * 0.7, // slightly forgiving
          seg.x, seg.y, otherSnake.radius * 0.7
        )) {
          result.deadSnakeIds.add(snake.id);
          result.killerMap.set(snake.id, seg.snakeId);
          break;
        }
      }

      // --- Head-to-head collision ---
      if (HEAD_TO_HEAD_BOTH_DIE && !result.deadSnakeIds.has(snake.id)) {
        for (const other of snakes.values()) {
          if (other.id === snake.id || !other.alive) continue;
          if (result.deadSnakeIds.has(other.id)) continue;
          if (circlesOverlap(
            head.x, head.y, headRadius * 0.6,
            other.head.x, other.head.y, other.radius * 0.6
          )) {
            result.deadSnakeIds.add(snake.id);
            result.deadSnakeIds.add(other.id);
            result.killerMap.set(snake.id, other.id);
            result.killerMap.set(other.id, snake.id);
          }
        }
      }

      // --- Pellet collision ---
      if (!result.deadSnakeIds.has(snake.id)) {
        const pelletQueryRadius = snake.surgeActive
          ? headRadius + 160
          : headRadius + PELLET_PICKUP_RADIUS_BONUS + 10;
        const nearbyPellets = this.pelletHash.query(
          head.x, head.y, pelletQueryRadius
        );
        for (const p of nearbyPellets) {
          const dx = p.x - head.x;
          const dy = p.y - head.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (circlesOverlap(
            head.x, head.y, headRadius + PELLET_PICKUP_RADIUS_BONUS,
            p.x, p.y, p.radius
          ) || snake.tryCollectMagnetPellet(dist + p.radius)) {
            if (!result.eatenPellets.has(snake.id)) {
              result.eatenPellets.set(snake.id, []);
            }
            result.eatenPellets.get(snake.id)!.push(p.pelletId);
          }
        }
      }
    }

    return result;
  }
}
