// ============================================================
// Canvas Renderer
// ============================================================

import { SnakeState, PelletState, GameSettings } from '@shared/types.js';
import { WORLD_WIDTH, WORLD_HEIGHT, WORLD_BORDER_THICKNESS } from '@shared/constants.js';
import { Camera } from '../game/Camera.js';
import { getSkin, SkinDef } from '../config/skins.js';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;
  private settings: GameSettings;
  private particles: Particle[] = [];
  private gridPattern: CanvasPattern | null = null;

  constructor(canvas: HTMLCanvasElement, camera: Camera, settings: GameSettings) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.camera = camera;
    this.settings = settings;
    this.resize();
    this.createGridPattern();
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.scale(dpr, dpr);
    this.camera.updateScreenSize();
    this.createGridPattern();
  }

  private createGridPattern(): void {
    const patternCanvas = document.createElement('canvas');
    const size = 60;
    patternCanvas.width = size;
    patternCanvas.height = size;
    const pctx = patternCanvas.getContext('2d')!;
    pctx.fillStyle = '#0d0d22';
    pctx.fillRect(0, 0, size, size);
    pctx.strokeStyle = '#1a1a35';
    pctx.lineWidth = 1;
    pctx.beginPath();
    pctx.moveTo(size, 0);
    pctx.lineTo(size, size);
    pctx.moveTo(0, size);
    pctx.lineTo(size, size);
    pctx.stroke();
    this.gridPattern = this.ctx.createPattern(patternCanvas, 'repeat');
  }

  render(snakes: SnakeState[], pellets: Map<number, PelletState>, localPlayerId: string): void {
    const ctx = this.ctx;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Clear
    ctx.fillStyle = '#08081a';
    ctx.fillRect(0, 0, w, h);

    ctx.save();

    // Apply camera transform
    const zoom = this.camera.zoom;
    ctx.translate(w / 2, h / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    // Get view rect for culling
    const view = this.camera.getViewRect();
    const margin = 100;

    // Draw grid background
    this.drawGrid(ctx, view);

    // Draw world border
    this.drawBorder(ctx);

    // Draw pellets (only visible ones)
    for (const pellet of pellets.values()) {
      if (pellet.x < view.x - margin || pellet.x > view.x + view.w + margin ||
          pellet.y < view.y - margin || pellet.y > view.y + view.h + margin) {
        continue;
      }
      this.drawPellet(ctx, pellet);
    }

    // Draw snakes (remote first, local last for z-order)
    const localSnake = snakes.find(s => s.id === localPlayerId);
    for (const snake of snakes) {
      if (snake.id === localPlayerId) continue;
      if (!this.isSnakeVisible(snake, view, margin)) continue;
      this.drawSnake(ctx, snake, false);
    }
    if (localSnake) {
      this.drawSnake(ctx, localSnake, true);
    }

    // Draw particles
    this.updateAndDrawParticles(ctx);

    ctx.restore();
  }

  private drawGrid(ctx: CanvasRenderingContext2D, view: { x: number; y: number; w: number; h: number }): void {
    const gridSize = 60;
    const startX = Math.floor(Math.max(0, view.x) / gridSize) * gridSize;
    const startY = Math.floor(Math.max(0, view.y) / gridSize) * gridSize;
    const endX = Math.min(WORLD_WIDTH, view.x + view.w + gridSize);
    const endY = Math.min(WORLD_HEIGHT, view.y + view.h + gridSize);

    // Fill world area
    ctx.fillStyle = '#0d0d22';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    ctx.strokeStyle = '#1a1a35';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();
  }

  private drawBorder(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = '#ff2244';
    ctx.lineWidth = WORLD_BORDER_THICKNESS;
    ctx.shadowColor = '#ff2244';
    ctx.shadowBlur = 20;
    ctx.strokeRect(
      -WORLD_BORDER_THICKNESS / 2,
      -WORLD_BORDER_THICKNESS / 2,
      WORLD_WIDTH + WORLD_BORDER_THICKNESS,
      WORLD_HEIGHT + WORLD_BORDER_THICKNESS
    );
    ctx.shadowBlur = 0;

    // Dim area outside world
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-2000, -2000, WORLD_WIDTH + 4000, 2000); // top
    ctx.fillRect(-2000, WORLD_HEIGHT, WORLD_WIDTH + 4000, 2000); // bottom
    ctx.fillRect(-2000, 0, 2000, WORLD_HEIGHT); // left
    ctx.fillRect(WORLD_WIDTH, 0, 2000, WORLD_HEIGHT); // right
  }

  private drawPellet(ctx: CanvasRenderingContext2D, pellet: PelletState): void {
    const hue = pellet.color;
    const r = pellet.radius;
    const glow = pellet.isDeathPellet ? 12 : 6;

    ctx.beginPath();
    ctx.arc(pellet.x, pellet.y, r, 0, Math.PI * 2);

    if (!this.settings.reducedMotion) {
      ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
      ctx.shadowBlur = glow;
    }

    ctx.fillStyle = pellet.isDeathPellet
      ? `hsl(${hue}, 90%, 65%)`
      : `hsl(${hue}, 100%, 70%)`;
    ctx.fill();

    // Inner bright spot
    ctx.beginPath();
    ctx.arc(pellet.x, pellet.y, r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${hue}, 100%, 90%)`;
    ctx.fill();

    ctx.shadowBlur = 0;
  }

  private isSnakeVisible(snake: SnakeState, view: { x: number; y: number; w: number; h: number }, margin: number): boolean {
    // Quick check: is head in view?
    const head = snake.segments[0];
    if (head.x > view.x - margin && head.x < view.x + view.w + margin &&
        head.y > view.y - margin && head.y < view.y + view.h + margin) {
      return true;
    }
    // Check a few body segments
    for (let i = 0; i < snake.segments.length; i += 10) {
      const seg = snake.segments[i];
      if (seg.x > view.x - margin && seg.x < view.x + view.w + margin &&
          seg.y > view.y - margin && seg.y < view.y + view.h + margin) {
        return true;
      }
    }
    return false;
  }

  drawSnake(ctx: CanvasRenderingContext2D, snake: SnakeState, isLocal: boolean): void {
    const skin = getSkin(snake.skinId);
    const segs = snake.segments;
    if (segs.length === 0) return;

    const r = snake.radius;

    // Draw body glow (for local player or boosting snakes)
    if ((isLocal || snake.boosting) && !this.settings.reducedMotion) {
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = skin.glowColor;
      ctx.lineWidth = r * 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(segs[0].x, segs[0].y);
      for (let i = 1; i < segs.length; i++) {
        ctx.lineTo(segs[i].x, segs[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Draw body segments
    for (let i = segs.length - 1; i >= 1; i--) {
      const seg = segs[i];
      const colorIdx = i % skin.colors.length;
      const segRadius = r * (0.8 + 0.2 * (1 - i / segs.length)); // taper toward tail

      ctx.beginPath();
      ctx.arc(seg.x, seg.y, segRadius, 0, Math.PI * 2);
      ctx.fillStyle = skin.colors[colorIdx];
      ctx.fill();

      // Outline
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Draw head
    const head = segs[0];
    ctx.beginPath();
    ctx.arc(head.x, head.y, r, 0, Math.PI * 2);

    if (snake.boosting && !this.settings.reducedMotion) {
      ctx.shadowColor = skin.headColor;
      ctx.shadowBlur = 15;
    }

    ctx.fillStyle = skin.headColor;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Eyes
    const eyeOffset = r * 0.35;
    const eyeRadius = r * 0.22;
    const pupilRadius = r * 0.12;
    const eyeAngle1 = snake.angle - 0.45;
    const eyeAngle2 = snake.angle + 0.45;

    for (const eAngle of [eyeAngle1, eyeAngle2]) {
      const ex = head.x + Math.cos(eAngle) * eyeOffset;
      const ey = head.y + Math.sin(eAngle) * eyeOffset;

      // White
      ctx.beginPath();
      ctx.arc(ex, ey, eyeRadius, 0, Math.PI * 2);
      ctx.fillStyle = skin.eyeColor;
      ctx.fill();

      // Pupil
      const px = ex + Math.cos(snake.angle) * eyeRadius * 0.3;
      const py = ey + Math.sin(snake.angle) * eyeRadius * 0.3;
      ctx.beginPath();
      ctx.arc(px, py, pupilRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#111';
      ctx.fill();
    }

    // Name tag
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.max(12, r * 0.8)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(snake.name, head.x, head.y - r - 8);
    ctx.restore();

    // Score below name
    ctx.save();
    ctx.fillStyle = '#aaa';
    ctx.font = `${Math.max(10, r * 0.5)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText(`${snake.score}`, head.x, head.y - r - 8 - Math.max(12, r * 0.8) - 2);
    ctx.restore();
  }

  // --- Particles ---

  spawnDeathParticles(x: number, y: number, color: string): void {
    if (this.settings.reducedMotion) return;
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 200;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 0.5 + Math.random() * 0.5,
        color,
        size: 3 + Math.random() * 5,
      });
    }
  }

  spawnPickupParticle(x: number, y: number, hue: number): void {
    if (this.settings.reducedMotion) return;
    for (let i = 0; i < 4; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 60;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 0.3,
        color: `hsl(${hue}, 100%, 80%)`,
        size: 2 + Math.random() * 3,
      });
    }
  }

  private updateAndDrawParticles(ctx: CanvasRenderingContext2D): void {
    const dt = 1 / 60;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt / p.maxLife;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  updateSettings(settings: GameSettings): void {
    this.settings = settings;
  }
}
