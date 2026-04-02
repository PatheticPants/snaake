// ============================================================
// Spatial Hash Grid for efficient collision queries
// ============================================================

import { SPATIAL_CELL_SIZE } from '../../../shared/src/constants.js';

export interface SpatialEntity {
  id: string | number;
  x: number;
  y: number;
  radius: number;
}

export class SpatialHash<T extends SpatialEntity> {
  private cellSize: number;
  private cells: Map<string, T[]> = new Map();

  constructor(cellSize: number = SPATIAL_CELL_SIZE) {
    this.cellSize = cellSize;
  }

  clear(): void {
    this.cells.clear();
  }

  private key(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  private cellCoord(value: number): number {
    return Math.floor(value / this.cellSize);
  }

  insert(entity: T): void {
    const minCx = this.cellCoord(entity.x - entity.radius);
    const maxCx = this.cellCoord(entity.x + entity.radius);
    const minCy = this.cellCoord(entity.y - entity.radius);
    const maxCy = this.cellCoord(entity.y + entity.radius);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const k = this.key(cx, cy);
        let cell = this.cells.get(k);
        if (!cell) {
          cell = [];
          this.cells.set(k, cell);
        }
        cell.push(entity);
      }
    }
  }

  query(x: number, y: number, radius: number): T[] {
    const minCx = this.cellCoord(x - radius);
    const maxCx = this.cellCoord(x + radius);
    const minCy = this.cellCoord(y - radius);
    const maxCy = this.cellCoord(y + radius);

    const seen = new Set<string | number>();
    const results: T[] = [];

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const cell = this.cells.get(this.key(cx, cy));
        if (!cell) continue;
        for (const entity of cell) {
          if (!seen.has(entity.id)) {
            seen.add(entity.id);
            results.push(entity);
          }
        }
      }
    }

    return results;
  }

  queryRect(x: number, y: number, w: number, h: number): T[] {
    const minCx = this.cellCoord(x);
    const maxCx = this.cellCoord(x + w);
    const minCy = this.cellCoord(y);
    const maxCy = this.cellCoord(y + h);

    const seen = new Set<string | number>();
    const results: T[] = [];

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const cell = this.cells.get(this.key(cx, cy));
        if (!cell) continue;
        for (const entity of cell) {
          if (!seen.has(entity.id)) {
            seen.add(entity.id);
            results.push(entity);
          }
        }
      }
    }

    return results;
  }
}
