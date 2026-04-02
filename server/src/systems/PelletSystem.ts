// ============================================================
// Pellet Spawning & Management System
// ============================================================

import { Pellet } from '../entities/Pellet.js';
import {
  PELLET_BASE_COUNT, PELLET_SPAWN_MARGIN,
  WORLD_WIDTH, WORLD_HEIGHT, DEATH_PELLET_LIFETIME,
  BOOST_PELLET_VALUE,
} from '../../../shared/src/constants.js';
import { randomInRange } from '../../../shared/src/math.js';
import { Vec2 } from '../../../shared/src/types.js';

export class PelletSystem {
  pellets: Map<number, Pellet> = new Map();

  init(): void {
    // Spawn initial pellets
    while (this.pellets.size < PELLET_BASE_COUNT) {
      this.spawnRandomPellet();
    }
  }

  spawnRandomPellet(): Pellet {
    const x = randomInRange(PELLET_SPAWN_MARGIN, WORLD_WIDTH - PELLET_SPAWN_MARGIN);
    const y = randomInRange(PELLET_SPAWN_MARGIN, WORLD_HEIGHT - PELLET_SPAWN_MARGIN);
    const pellet = new Pellet(x, y, false);
    this.pellets.set(pellet.id, pellet);
    return pellet;
  }

  spawnDeathPellets(segments: Vec2[], score: number): Pellet[] {
    const spawned: Pellet[] = [];
    // Drop pellets along the body, roughly every 3rd segment
    const step = Math.max(1, Math.floor(segments.length / Math.min(segments.length, 40)));
    for (let i = 0; i < segments.length; i += step) {
      const seg = segments[i];
      const pellet = new Pellet(
        seg.x + (Math.random() - 0.5) * 20,
        seg.y + (Math.random() - 0.5) * 20,
        true
      );
      this.pellets.set(pellet.id, pellet);
      spawned.push(pellet);
    }
    return spawned;
  }

  spawnBoostPellet(pos: Vec2): Pellet {
    const pellet = new Pellet(pos.x, pos.y, false, BOOST_PELLET_VALUE);
    this.pellets.set(pellet.id, pellet);
    return pellet;
  }

  removePellet(id: number): void {
    this.pellets.delete(id);
  }

  update(): void {
    const now = Date.now();

    // Remove expired death pellets
    for (const pellet of this.pellets.values()) {
      if (pellet.isDeathPellet && now - pellet.createdAt > DEATH_PELLET_LIFETIME) {
        this.pellets.delete(pellet.id);
      }
    }

    // Replenish normal pellets
    let normalCount = 0;
    for (const p of this.pellets.values()) {
      if (!p.isDeathPellet) normalCount++;
    }
    while (normalCount < PELLET_BASE_COUNT) {
      this.spawnRandomPellet();
      normalCount++;
    }
  }
}
