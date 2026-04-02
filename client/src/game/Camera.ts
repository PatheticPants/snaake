// ============================================================
// Camera System
// ============================================================

import {
  CAMERA_ZOOM_BASE, CAMERA_ZOOM_MIN, CAMERA_ZOOM_SCORE_FACTOR,
  CAMERA_SMOOTHING, SNAKE_INITIAL_SCORE,
} from '@shared/constants.js';
import { lerp, clamp } from '@shared/math.js';

export class Camera {
  x: number = 0;
  y: number = 0;
  zoom: number = CAMERA_ZOOM_BASE;
  private targetX: number = 0;
  private targetY: number = 0;
  private targetZoom: number = CAMERA_ZOOM_BASE;
  screenWidth: number = 0;
  screenHeight: number = 0;

  constructor() {
    this.updateScreenSize();
  }

  updateScreenSize(): void {
    this.screenWidth = window.innerWidth;
    this.screenHeight = window.innerHeight;
  }

  setTarget(x: number, y: number, score: number): void {
    this.targetX = x;
    this.targetY = y;
    this.targetZoom = clamp(
      CAMERA_ZOOM_BASE - (score - SNAKE_INITIAL_SCORE) * CAMERA_ZOOM_SCORE_FACTOR,
      CAMERA_ZOOM_MIN,
      CAMERA_ZOOM_BASE
    );
  }

  update(): void {
    this.x = lerp(this.x, this.targetX, CAMERA_SMOOTHING);
    this.y = lerp(this.y, this.targetY, CAMERA_SMOOTHING);
    this.zoom = lerp(this.zoom, this.targetZoom, CAMERA_SMOOTHING);
  }

  snapTo(x: number, y: number): void {
    this.x = this.targetX = x;
    this.y = this.targetY = y;
  }

  /** Convert world coordinates to screen coordinates */
  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: (wx - this.x) * this.zoom + this.screenWidth / 2,
      y: (wy - this.y) * this.zoom + this.screenHeight / 2,
    };
  }

  /** Get the visible world rect */
  getViewRect(): { x: number; y: number; w: number; h: number } {
    const halfW = (this.screenWidth / 2) / this.zoom;
    const halfH = (this.screenHeight / 2) / this.zoom;
    return {
      x: this.x - halfW,
      y: this.y - halfH,
      w: halfW * 2,
      h: halfH * 2,
    };
  }
}
