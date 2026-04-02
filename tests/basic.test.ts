// ============================================================
// Basic Tests - Collision, Leaderboard, Spatial, Growth
// ============================================================

import { describe, it, expect } from 'vitest';
import { circlesOverlap, distance, normalizeAngle, angleDiff, clamp, lerp } from '../shared/src/math.js';
import { SpatialHash } from '../server/src/spatial/SpatialHash.js';

describe('Math utilities', () => {
  it('circlesOverlap detects overlapping circles', () => {
    expect(circlesOverlap(0, 0, 10, 5, 0, 10)).toBe(true);
    expect(circlesOverlap(0, 0, 10, 25, 0, 10)).toBe(false);
  });

  it('distance calculates correctly', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distance({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
  });

  it('normalizeAngle keeps angle in [-PI, PI]', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(-Math.PI, 5);
    expect(normalizeAngle(-Math.PI * 3)).toBeCloseTo(Math.PI, 5);
  });

  it('angleDiff returns shortest path', () => {
    expect(angleDiff(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2, 5);
    expect(angleDiff(0, -Math.PI / 2)).toBeCloseTo(-Math.PI / 2, 5);
  });

  it('clamp restricts value', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('lerp interpolates', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
  });
});

describe('SpatialHash', () => {
  it('inserts and queries entities', () => {
    const hash = new SpatialHash(100);
    hash.insert({ id: 'a', x: 50, y: 50, radius: 10 });
    hash.insert({ id: 'b', x: 500, y: 500, radius: 10 });

    const near = hash.query(60, 60, 50);
    expect(near.length).toBe(1);
    expect(near[0].id).toBe('a');
  });

  it('returns multiple nearby entities', () => {
    const hash = new SpatialHash(100);
    hash.insert({ id: 'a', x: 50, y: 50, radius: 10 });
    hash.insert({ id: 'b', x: 80, y: 80, radius: 10 });
    hash.insert({ id: 'c', x: 1000, y: 1000, radius: 10 });

    const near = hash.query(60, 60, 100);
    expect(near.length).toBe(2);
  });

  it('clear empties the hash', () => {
    const hash = new SpatialHash(100);
    hash.insert({ id: 'a', x: 50, y: 50, radius: 10 });
    hash.clear();
    const near = hash.query(50, 50, 100);
    expect(near.length).toBe(0);
  });
});

describe('Growth calculations', () => {
  it('score to length ratio produces expected segment counts', () => {
    const SNAKE_INITIAL_LENGTH = 10;
    const SCORE_TO_LENGTH_RATIO = 0.8;
    const SNAKE_MAX_SEGMENTS = 500;

    function targetSegments(score: number): number {
      return Math.min(
        SNAKE_MAX_SEGMENTS,
        SNAKE_INITIAL_LENGTH + Math.floor(score * SCORE_TO_LENGTH_RATIO)
      );
    }

    expect(targetSegments(10)).toBe(18); // 10 + 8
    expect(targetSegments(100)).toBe(90); // 10 + 80
    expect(targetSegments(1000)).toBe(500); // capped
  });
});

describe('Leaderboard sorting', () => {
  it('sorts entries by score descending', () => {
    const entries = [
      { id: 'a', name: 'A', score: 50, skinId: 0 },
      { id: 'b', name: 'B', score: 100, skinId: 1 },
      { id: 'c', name: 'C', score: 75, skinId: 2 },
    ];
    entries.sort((a, b) => b.score - a.score);
    expect(entries[0].name).toBe('B');
    expect(entries[1].name).toBe('C');
    expect(entries[2].name).toBe('A');
  });
});
