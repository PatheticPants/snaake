// ============================================================
// Server-side Snake Entity
// ============================================================

import {
  SNAKE_INITIAL_LENGTH, SNAKE_SEGMENT_SPACING, SNAKE_BASE_RADIUS,
  SNAKE_MAX_RADIUS, SNAKE_BASE_SPEED, SNAKE_MIN_SPEED,
  SNAKE_TURN_RATE, SNAKE_TURN_RATE_MIN, SNAKE_INITIAL_SCORE,
  SNAKE_MAX_SEGMENTS, BOOST_SPEED_MULTIPLIER, BOOST_MASS_DRAIN_RATE,
  BOOST_MIN_SCORE, BOOST_PELLET_INTERVAL, SCORE_TO_LENGTH_RATIO,
  GROWTH_SMOOTHING_RATE, WORLD_WIDTH, WORLD_HEIGHT,
} from '../../../shared/src/constants.js';
import { SnakeState, SnakeSegment, Vec2 } from '../../../shared/src/types.js';
import { normalizeAngle, angleDiff, clamp, lerp } from '../../../shared/src/math.js';

export class Snake {
  id: string;
  name: string;
  skinId: number;
  segments: SnakeSegment[] = [];
  angle: number = 0;
  targetAngle: number = 0;
  score: number = SNAKE_INITIAL_SCORE;
  boosting: boolean = false;
  alive: boolean = true;
  isBot: boolean = false;

  // Internal
  private targetSegmentCount: number = SNAKE_INITIAL_LENGTH;
  private boostDistAccum: number = 0;
  pendingBoostPellets: Vec2[] = [];

  constructor(id: string, name: string, skinId: number, x: number, y: number) {
    this.id = id;
    this.name = name;
    this.skinId = skinId;
    this.angle = Math.random() * Math.PI * 2;
    this.targetAngle = this.angle;

    // Create initial segments behind the head
    for (let i = 0; i < SNAKE_INITIAL_LENGTH; i++) {
      this.segments.push({
        x: x - Math.cos(this.angle) * i * SNAKE_SEGMENT_SPACING,
        y: y - Math.sin(this.angle) * i * SNAKE_SEGMENT_SPACING,
      });
    }
  }

  get head(): SnakeSegment {
    return this.segments[0];
  }

  get radius(): number {
    const sizeRatio = clamp((this.score - SNAKE_INITIAL_SCORE) / 500, 0, 1);
    return lerp(SNAKE_BASE_RADIUS, SNAKE_MAX_RADIUS, sizeRatio);
  }

  get speed(): number {
    const sizeRatio = clamp((this.score - SNAKE_INITIAL_SCORE) / 500, 0, 1);
    const base = lerp(SNAKE_BASE_SPEED, SNAKE_MIN_SPEED, sizeRatio);
    return this.boosting ? base * BOOST_SPEED_MULTIPLIER : base;
  }

  get turnRate(): number {
    const sizeRatio = clamp((this.score - SNAKE_INITIAL_SCORE) / 500, 0, 1);
    return lerp(SNAKE_TURN_RATE, SNAKE_TURN_RATE_MIN, sizeRatio);
  }

  update(dt: number): void {
    if (!this.alive) return;

    // Steering
    const diff = angleDiff(this.angle, this.targetAngle);
    const maxTurn = this.turnRate * dt;
    if (Math.abs(diff) < maxTurn) {
      this.angle = this.targetAngle;
    } else {
      this.angle = normalizeAngle(this.angle + Math.sign(diff) * maxTurn);
    }

    // Boost logic
    if (this.boosting && this.score <= BOOST_MIN_SCORE) {
      this.boosting = false;
    }

    if (this.boosting) {
      const drain = BOOST_MASS_DRAIN_RATE * dt;
      this.score = Math.max(BOOST_MIN_SCORE, this.score - drain);
    }

    // Move head
    const spd = this.speed * dt;
    const newX = this.head.x + Math.cos(this.angle) * spd;
    const newY = this.head.y + Math.sin(this.angle) * spd;

    // Unshift new head position
    this.segments.unshift({ x: newX, y: newY });

    // Drop boost pellets
    if (this.boosting) {
      this.boostDistAccum += spd;
      while (this.boostDistAccum >= BOOST_PELLET_INTERVAL) {
        this.boostDistAccum -= BOOST_PELLET_INTERVAL;
        // Drop pellet at tail area
        const tail = this.segments[this.segments.length - 1];
        this.pendingBoostPellets.push({ x: tail.x, y: tail.y });
      }
    }

    // Smooth body follow - maintain spacing
    for (let i = 1; i < this.segments.length; i++) {
      const prev = this.segments[i - 1];
      const curr = this.segments[i];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > SNAKE_SEGMENT_SPACING) {
        const ratio = SNAKE_SEGMENT_SPACING / dist;
        curr.x = prev.x + dx * ratio;
        curr.y = prev.y + dy * ratio;
      }
    }

    // Adjust segment count toward target
    this.targetSegmentCount = Math.min(
      SNAKE_MAX_SEGMENTS,
      SNAKE_INITIAL_LENGTH + Math.floor(this.score * SCORE_TO_LENGTH_RATIO)
    );

    const diff2 = this.targetSegmentCount - this.segments.length;
    if (diff2 > 0) {
      // Grow: add segments at tail
      const growCount = Math.min(diff2, Math.ceil(GROWTH_SMOOTHING_RATE * 60 * dt));
      for (let i = 0; i < growCount; i++) {
        const tail = this.segments[this.segments.length - 1];
        this.segments.push({ x: tail.x, y: tail.y });
      }
    } else if (diff2 < -1) {
      // Shrink: remove from tail
      const shrinkCount = Math.min(-diff2, Math.ceil(GROWTH_SMOOTHING_RATE * 60 * dt));
      this.segments.splice(this.segments.length - shrinkCount, shrinkCount);
    }
  }

  addScore(amount: number): void {
    this.score += amount;
  }

  setInput(angle: number, boosting: boolean): void {
    this.targetAngle = normalizeAngle(angle);
    this.boosting = boosting && this.score > BOOST_MIN_SCORE;
  }

  isInBounds(): boolean {
    return (
      this.head.x >= 0 && this.head.x <= WORLD_WIDTH &&
      this.head.y >= 0 && this.head.y <= WORLD_HEIGHT
    );
  }

  toState(): SnakeState {
    return {
      id: this.id,
      name: this.name,
      skinId: this.skinId,
      segments: this.segments,
      angle: this.angle,
      score: Math.floor(this.score),
      boosting: this.boosting,
      alive: this.alive,
      radius: this.radius,
      speed: this.speed,
    };
  }
}
