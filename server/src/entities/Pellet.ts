// ============================================================
// Server-side Pellet Entity
// ============================================================

import { PelletState } from '../../../shared/src/types.js';
import { PELLET_RADIUS, DEATH_PELLET_RADIUS, GROWTH_PER_PELLET, GROWTH_PER_DEATH_PELLET } from '../../../shared/src/constants.js';

let nextPelletId = 1;

export class Pellet {
  id: number;
  x: number;
  y: number;
  radius: number;
  color: number; // hue
  value: number;
  isDeathPellet: boolean;
  createdAt: number;

  constructor(x: number, y: number, isDeathPellet: boolean = false, value?: number) {
    this.id = nextPelletId++;
    this.x = x;
    this.y = y;
    this.isDeathPellet = isDeathPellet;
    this.radius = isDeathPellet ? DEATH_PELLET_RADIUS : PELLET_RADIUS;
    this.value = value ?? (isDeathPellet ? GROWTH_PER_DEATH_PELLET : GROWTH_PER_PELLET);
    this.color = Math.random() * 360;
    this.createdAt = Date.now();
  }

  toState(): PelletState {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      radius: this.radius,
      color: this.color,
      value: this.value,
      isDeathPellet: this.isDeathPellet,
    };
  }
}

export function resetPelletIdCounter(): void {
  nextPelletId = 1;
}
