// ============================================================
// Client Game State - Manages interpolated world state
// ============================================================

import { WorldSnapshot, SnakeState, PelletState, LeaderboardUpdate } from '@shared/types.js';

export class GameState {
  snakes: Map<string, SnakeState> = new Map();
  pellets: Map<number, PelletState> = new Map();
  leaderboard: LeaderboardUpdate | null = null;
  playerId: string = '';
  alive: boolean = false;
  tick: number = 0;

  // Interpolation buffers
  private prevSnapshot: WorldSnapshot | null = null;
  private currSnapshot: WorldSnapshot | null = null;
  private snapshotTime: number = 0;
  private snapshotInterval: number = 50; // ms between snapshots

  applySnapshot(snapshot: WorldSnapshot): void {
    this.prevSnapshot = this.currSnapshot;
    this.currSnapshot = snapshot;
    this.snapshotTime = performance.now();
    this.tick = snapshot.tick;

    // Update pellets immediately (they don't need interpolation)
    this.pellets.clear();
    for (const p of snapshot.pellets) {
      this.pellets.set(p.id, p);
    }

    // Check if local player is alive
    if (this.playerId) {
      const localSnake = snapshot.snakes.find(s => s.id === this.playerId);
      this.alive = !!localSnake?.alive;
    }
  }

  removePellet(pelletId: number): void {
    this.pellets.delete(pelletId);
  }

  /** Get interpolated snakes for rendering */
  getInterpolatedSnakes(): SnakeState[] {
    if (!this.currSnapshot) return [];

    const now = performance.now();
    const elapsed = now - this.snapshotTime;
    const t = Math.min(elapsed / this.snapshotInterval, 1);

    if (!this.prevSnapshot) {
      return this.currSnapshot.snakes;
    }

    // Build a map of previous snake positions
    const prevMap = new Map<string, SnakeState>();
    for (const s of this.prevSnapshot.snakes) {
      prevMap.set(s.id, s);
    }

    return this.currSnapshot.snakes.map(curr => {
      const prev = prevMap.get(curr.id);
      if (!prev || curr.id === this.playerId) {
        // Don't interpolate local player (we show latest server state)
        return curr;
      }

      // Interpolate segments
      const segments = curr.segments.map((seg, i) => {
        if (i < prev.segments.length) {
          return {
            x: prev.segments[i].x + (seg.x - prev.segments[i].x) * t,
            y: prev.segments[i].y + (seg.y - prev.segments[i].y) * t,
          };
        }
        return seg;
      });

      return { ...curr, segments };
    });
  }

  getLocalSnake(): SnakeState | undefined {
    if (!this.currSnapshot) return undefined;
    return this.currSnapshot.snakes.find(s => s.id === this.playerId);
  }
}
