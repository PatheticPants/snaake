// ============================================================
// SERPENT ARENA - Client Entry Point
// ============================================================

import { Renderer } from './render/Renderer.js';
import { MinimapRenderer } from './render/MinimapRenderer.js';
import { Camera } from './game/Camera.js';
import { GameState } from './game/GameState.js';
import { InputManager } from './input/InputManager.js';
import { NetworkManager } from './network/NetworkManager.js';
import { AudioManager } from './audio/AudioManager.js';
import { UIManager } from './ui/UIManager.js';
import { OfflineEngine } from './game/OfflineEngine.js';
import { getSkin } from './config/skins.js';
import { WorldSnapshot, DeathEvent, LeaderboardUpdate } from '@shared/types.js';
import { BOOST_MIN_SCORE } from '@shared/constants.js';

// --- Initialization ---
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ui = new UIManager();
const camera = new Camera();
const renderer = new Renderer(canvas, camera, ui.settings);
const minimap = new MinimapRenderer();
const input = new InputManager(canvas);
const audio = new AudioManager(ui.settings);
const network = new NetworkManager();
const gameState = new GameState();

let offlineEngine: OfflineEngine | null = null;
let isOffline = false;
let running = false;
let inputSeq = 0;
let killCount = 0;
let lastFpsTime = 0;
let frameCount = 0;
let fps = 0;

// --- Window resize ---
window.addEventListener('resize', () => {
  renderer.resize();
});

// --- Visibility change: pause/resume ---
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Tab hidden — we keep running but skip rendering
  } else {
    audio.resume();
  }
});

// --- Network callbacks ---
network.onConnect = () => {
  ui.showConnectionStatus(null);
};

network.onDisconnect = () => {
  if (running && !isOffline) {
    ui.showConnectionStatus('Disconnected. Reconnecting...');
  }
};

network.onSnapshot = (data: WorldSnapshot) => {
  gameState.applySnapshot(data);
};

network.onDeath = (data: DeathEvent) => {
  if (data.playerId === gameState.playerId) {
    handleLocalDeath(data);
  } else {
    // Another player died — check if we killed them
    const localSnake = gameState.getLocalSnake();
    if (localSnake && data.killerName === localSnake.name) {
      killCount++;
      ui.updateKills(killCount);
    }
  }
  // Spawn death particles
  if (data.pellets.length > 0) {
    const p = data.pellets[0];
    const skin = getSkin(0);
    renderer.spawnDeathParticles(p.x, p.y, skin.headColor);
  }
};

network.onLeaderboard = (data: LeaderboardUpdate) => {
  gameState.leaderboard = data;
  ui.updateLeaderboard(data, gameState.playerId);
};

network.onPelletEaten = (data) => {
  const pellet = gameState.pellets.get(data.pelletId);
  if (pellet) {
    renderer.spawnPickupParticle(pellet.x, pellet.y, pellet.color);
    audio.playPelletPickup();
  }
  gameState.removePellet(data.pelletId);
};

// --- UI callbacks ---
ui.onPlay = async (name: string, skinId: number, offline: boolean) => {
  audio.playClick();
  audio.resume();
  killCount = 0;
  ui.updateKills(0);

  if (offline) {
    startOffline(name, skinId);
  } else {
    await startOnline(name, skinId);
  }
};

ui.onRespawn = async (name: string, skinId: number) => {
  audio.playClick();
  killCount = 0;
  ui.updateKills(0);

  if (isOffline && offlineEngine) {
    const id = offlineEngine.respawn(name, skinId);
    gameState.playerId = id;
    gameState.alive = true;
    ui.showScreen('game');
    input.showMobileControls(true);
  } else {
    const response = await network.respawn({ name, skinId });
    if (response.success) {
      gameState.playerId = response.playerId;
      gameState.alive = true;
      ui.showScreen('game');
      input.showMobileControls(true);
    }
  }
};

ui.onSettingsChange = (settings) => {
  renderer.updateSettings(settings);
  audio.updateSettings(settings);
  minimap.show(settings.showMinimap);
};

// --- Start functions ---
async function startOnline(name: string, skinId: number): Promise<void> {
  isOffline = false;
  offlineEngine = null;

  ui.showConnectionStatus('Connecting...');
  network.connect('http://localhost:3001');

  // Wait for connection
  await new Promise<void>((resolve) => {
    const check = () => {
      if (network.isConnected()) {
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    // Timeout after 5 seconds — fall back to offline
    setTimeout(() => resolve(), 5000);
    check();
  });

  if (!network.isConnected()) {
    ui.showConnectionStatus('Server unavailable. Starting offline mode...');
    setTimeout(() => {
      ui.showConnectionStatus(null);
      startOffline(name, skinId);
    }, 1500);
    return;
  }

  const response = await network.join({ name, skinId });
  if (!response.success) {
    ui.showConnectionStatus(response.error || 'Failed to join');
    setTimeout(() => ui.showConnectionStatus(null), 3000);
    return;
  }

  gameState.playerId = response.playerId;
  gameState.alive = true;
  ui.showConnectionStatus(null);
  ui.showScreen('game');
  input.showMobileControls(true);

  if (!running) {
    running = true;
    requestAnimationFrame(gameLoop);
  }
}

function startOffline(name: string, skinId: number): void {
  isOffline = true;
  network.disconnect();

  offlineEngine = new OfflineEngine();
  const id = offlineEngine.start(name, skinId);
  gameState.playerId = id;
  gameState.alive = true;

  offlineEngine.onDeath = (event) => {
    if (event.playerId === gameState.playerId) {
      handleLocalDeath(event);
    }
    if (event.pellets.length > 0) {
      renderer.spawnDeathParticles(event.pellets[0].x, event.pellets[0].y, '#ff4466');
    }
  };

  offlineEngine.onLeaderboard = (update) => {
    gameState.leaderboard = update;
    ui.updateLeaderboard(update, gameState.playerId);
  };

  offlineEngine.onPelletEaten = (pelletId) => {
    const pellet = gameState.pellets.get(pelletId);
    if (pellet) {
      renderer.spawnPickupParticle(pellet.x, pellet.y, pellet.color);
      audio.playPelletPickup();
    }
  };

  ui.showConnectionStatus(null);
  ui.showScreen('game');
  input.showMobileControls(true);

  if (!running) {
    running = true;
    requestAnimationFrame(gameLoop);
  }
}

function handleLocalDeath(event: DeathEvent): void {
  audio.playDeath();
  gameState.alive = false;
  input.showMobileControls(false);
  ui.showDeath(event.score, event.killerName);
}

// --- Game Loop ---
function gameLoop(timestamp: number): void {
  requestAnimationFrame(gameLoop);

  // FPS counter
  frameCount++;
  if (timestamp - lastFpsTime >= 1000) {
    fps = frameCount;
    frameCount = 0;
    lastFpsTime = timestamp;
  }

  // Send input
  if (gameState.alive) {
    const inputData = {
      angle: input.targetAngle,
      boosting: input.boosting,
      seq: inputSeq++,
    };

    if (isOffline && offlineEngine) {
      offlineEngine.handleInput(inputData);
    } else {
      network.sendInput(inputData);
    }
  }

  // Update offline engine
  if (isOffline && offlineEngine) {
    const snapshot = offlineEngine.update();
    gameState.applySnapshot(snapshot);
  }

  // Update camera
  const localSnake = gameState.getLocalSnake();
  if (localSnake) {
    camera.setTarget(localSnake.segments[0].x, localSnake.segments[0].y, localSnake.score);

    // Update HUD
    const rank = gameState.leaderboard?.playerRank ?? 0;
    ui.updateHUD(localSnake.score, rank, localSnake.score > BOOST_MIN_SCORE);

    // Boost audio
    if (localSnake.boosting && input.boosting) {
      // Continuous boost handled by visual only
    }
  }
  camera.update();

  // Render
  if (!document.hidden) {
    const snakes = gameState.getInterpolatedSnakes();
    renderer.render(snakes, gameState.pellets, gameState.playerId);

    // Minimap
    if (ui.settings.showMinimap) {
      minimap.render(snakes, gameState.playerId);
    }

    // Debug
    if (ui.settings.showDebug) {
      ui.updateDebug(
        fps,
        isOffline ? 0 : network.getPing(),
        snakes.length,
        gameState.pellets.size
      );
    }
  }
}

// --- Initial setup ---
ui.showScreen('menu');
minimap.show(ui.settings.showMinimap);
