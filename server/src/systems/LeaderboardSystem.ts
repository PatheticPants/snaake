// ============================================================
// Leaderboard System
// ============================================================

import { Snake } from '../entities/Snake.js';
import { LeaderboardEntry, LeaderboardUpdate } from '../../../shared/src/types.js';
import { LEADERBOARD_SIZE } from '../../../shared/src/constants.js';

export class LeaderboardSystem {
  private entries: LeaderboardEntry[] = [];

  update(snakes: Map<string, Snake>): void {
    this.entries = [];
    for (const snake of snakes.values()) {
      if (!snake.alive) continue;
      this.entries.push({
        id: snake.id,
        name: snake.name,
        score: Math.floor(snake.score),
        skinId: snake.skinId,
      });
    }
    this.entries.sort((a, b) => b.score - a.score);
  }

  getTop(): LeaderboardEntry[] {
    return this.entries.slice(0, LEADERBOARD_SIZE);
  }

  getPlayerRank(playerId: string): number {
    const idx = this.entries.findIndex(e => e.id === playerId);
    return idx === -1 ? this.entries.length + 1 : idx + 1;
  }

  getPlayerScore(playerId: string): number {
    const entry = this.entries.find(e => e.id === playerId);
    return entry?.score ?? 0;
  }

  getUpdateForPlayer(playerId: string): LeaderboardUpdate {
    return {
      entries: this.getTop(),
      playerRank: this.getPlayerRank(playerId),
      playerScore: this.getPlayerScore(playerId),
    };
  }
}
