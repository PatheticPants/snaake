// ============================================================
// Minimap Renderer
// ============================================================

import { SnakeState } from '@shared/types.js';
import { WORLD_WIDTH, WORLD_HEIGHT, MINIMAP_SIZE } from '@shared/constants.js';
import { getSkin } from '../config/skins.js';

export class MinimapRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scale: number;

  constructor() {
    this.canvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.canvas.width = MINIMAP_SIZE;
    this.canvas.height = MINIMAP_SIZE;
    this.scale = MINIMAP_SIZE / Math.max(WORLD_WIDTH, WORLD_HEIGHT);
  }

  render(snakes: SnakeState[], localPlayerId: string): void {
    const ctx = this.ctx;
    const s = this.scale;

    // Background
    ctx.fillStyle = 'rgba(10, 10, 30, 0.8)';
    ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    // Border
    ctx.strokeStyle = 'rgba(255, 34, 68, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, WORLD_WIDTH * s, WORLD_HEIGHT * s);

    // Draw snakes as dots
    for (const snake of snakes) {
      const head = snake.segments[0];
      if (!head) continue;

      const mx = head.x * s;
      const my = head.y * s;
      const isLocal = snake.id === localPlayerId;

      const skin = getSkin(snake.skinId);
      ctx.beginPath();
      ctx.arc(mx, my, isLocal ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = isLocal ? '#fff' : skin.headColor;
      ctx.fill();

      if (isLocal) {
        // Draw view cone indicator
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(
          mx - 15, my - 10,
          30, 20
        );
      }
    }
  }

  show(visible: boolean): void {
    this.canvas.style.display = visible ? 'block' : 'none';
  }
}
