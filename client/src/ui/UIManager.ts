// ============================================================
// UI Manager - Handles all screen/HUD state
// ============================================================

import { GameSettings, DEFAULT_SETTINGS, LeaderboardUpdate } from '@shared/types.js';
import { SKINS } from '../config/skins.js';
import { SURGE_CHARGE_MAX } from '@shared/constants.js';

export type Screen = 'menu' | 'settings' | 'game' | 'death';

export class UIManager {
  settings: GameSettings;
  private currentScreen: Screen = 'menu';
  private selectedSkin: number = 0;
  private personalBest: number = 0;
  private killCount: number = 0;

  // DOM references
  private screens = {
    menu: document.getElementById('menu-screen')!,
    settings: document.getElementById('settings-screen')!,
    death: document.getElementById('death-screen')!,
  };
  private hud = document.getElementById('hud')!;
  private hudScore = document.getElementById('hud-score')!;
  private hudRank = document.getElementById('hud-rank')!;
  private hudBoostBar = document.getElementById('hud-boost-bar')!;
  private hudBoostLabel = document.getElementById('hud-boost-label')!;
  private hudLeaderboard = document.getElementById('hud-leaderboard')!;
  private leaderboardList = document.getElementById('leaderboard-list')!;
  private hudDebug = document.getElementById('hud-debug')!;
  private hudKills = document.getElementById('hud-kills')!;
  private deathScore = document.getElementById('death-score')!;
  private deathKiller = document.getElementById('death-killer')!;
  private deathBest = document.getElementById('death-best')!;
  private connectionStatus = document.getElementById('connection-status')!;
  private nameInput = document.getElementById('name-input') as HTMLInputElement;
  private skinSelector = document.getElementById('skin-selector')!;

  // Callbacks
  onPlay: ((name: string, skinId: number, offline: boolean) => void) | null = null;
  onRespawn: ((name: string, skinId: number) => void) | null = null;
  onSettingsChange: ((settings: GameSettings) => void) | null = null;

  constructor() {
    // Load settings from localStorage
    const saved = localStorage.getItem('serpent-arena-settings');
    this.settings = saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS };

    const savedName = localStorage.getItem('serpent-arena-name');
    if (savedName) this.nameInput.value = savedName;

    const savedSkin = localStorage.getItem('serpent-arena-skin');
    if (savedSkin) this.selectedSkin = parseInt(savedSkin, 10);

    const savedBest = localStorage.getItem('serpent-arena-best');
    if (savedBest) this.personalBest = parseInt(savedBest, 10);

    this.buildSkinSelector();
    this.bindEvents();
    this.applySettings();
  }

  private buildSkinSelector(): void {
    this.skinSelector.innerHTML = '';
    for (const skin of SKINS) {
      const el = document.createElement('div');
      el.className = `skin-option${skin.id === this.selectedSkin ? ' selected' : ''}`;
      el.style.background = `linear-gradient(135deg, ${skin.colors[0]}, ${skin.colors[1] || skin.colors[0]})`;
      el.dataset.skinId = String(skin.id);
      el.title = skin.name;
      el.addEventListener('click', () => {
        this.selectedSkin = skin.id;
        localStorage.setItem('serpent-arena-skin', String(skin.id));
        this.skinSelector.querySelectorAll('.skin-option').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
      });
      this.skinSelector.appendChild(el);
    }
  }

  private bindEvents(): void {
    document.getElementById('play-btn')!.addEventListener('click', () => {
      const name = this.nameInput.value.trim() || 'Player';
      localStorage.setItem('serpent-arena-name', name);
      this.onPlay?.(name, this.selectedSkin, false);
    });

    document.getElementById('play-offline-btn')!.addEventListener('click', () => {
      const name = this.nameInput.value.trim() || 'Player';
      localStorage.setItem('serpent-arena-name', name);
      this.onPlay?.(name, this.selectedSkin, true);
    });

    document.getElementById('settings-btn')!.addEventListener('click', () => {
      this.showScreen('settings');
    });

    document.getElementById('settings-back-btn')!.addEventListener('click', () => {
      this.showScreen('menu');
    });

    document.getElementById('respawn-btn')!.addEventListener('click', () => {
      const name = this.nameInput.value.trim() || 'Player';
      this.onRespawn?.(name, this.selectedSkin);
    });

    document.getElementById('menu-btn')!.addEventListener('click', () => {
      this.showScreen('menu');
    });

    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('play-btn')!.click();
      }
    });

    // Settings bindings
    const sfxVolume = document.getElementById('sfx-volume') as HTMLInputElement;
    const musicVolume = document.getElementById('music-volume') as HTMLInputElement;
    const muteToggle = document.getElementById('mute-toggle') as HTMLInputElement;
    const minimapToggle = document.getElementById('minimap-toggle') as HTMLInputElement;
    const leaderboardToggle = document.getElementById('leaderboard-toggle') as HTMLInputElement;
    const debugToggle = document.getElementById('debug-toggle') as HTMLInputElement;
    const reducedMotionToggle = document.getElementById('reduced-motion-toggle') as HTMLInputElement;
    const highContrastToggle = document.getElementById('high-contrast-toggle') as HTMLInputElement;

    // Set initial values
    sfxVolume.value = String(this.settings.sfxVolume * 100);
    musicVolume.value = String(this.settings.musicVolume * 100);
    muteToggle.checked = this.settings.muted;
    minimapToggle.checked = this.settings.showMinimap;
    leaderboardToggle.checked = this.settings.showLeaderboard;
    debugToggle.checked = this.settings.showDebug;
    reducedMotionToggle.checked = this.settings.reducedMotion;
    highContrastToggle.checked = this.settings.highContrast;

    const save = () => {
      this.settings.sfxVolume = parseInt(sfxVolume.value, 10) / 100;
      this.settings.musicVolume = parseInt(musicVolume.value, 10) / 100;
      this.settings.muted = muteToggle.checked;
      this.settings.showMinimap = minimapToggle.checked;
      this.settings.showLeaderboard = leaderboardToggle.checked;
      this.settings.showDebug = debugToggle.checked;
      this.settings.reducedMotion = reducedMotionToggle.checked;
      this.settings.highContrast = highContrastToggle.checked;
      localStorage.setItem('serpent-arena-settings', JSON.stringify(this.settings));
      this.applySettings();
      this.onSettingsChange?.(this.settings);
    };

    [sfxVolume, musicVolume].forEach(el => el.addEventListener('input', save));
    [muteToggle, minimapToggle, leaderboardToggle, debugToggle, reducedMotionToggle, highContrastToggle]
      .forEach(el => el.addEventListener('change', save));
  }

  private applySettings(): void {
    document.body.classList.toggle('high-contrast', this.settings.highContrast);
    document.body.classList.toggle('reduced-motion', this.settings.reducedMotion);
    this.hudDebug.classList.toggle('hidden', !this.settings.showDebug);
    this.hudLeaderboard.style.display = this.settings.showLeaderboard ? 'block' : 'none';
  }

  showScreen(screen: Screen): void {
    this.currentScreen = screen;
    // Hide all
    Object.values(this.screens).forEach(el => el.classList.remove('active'));
    this.hud.classList.add('hidden');

    if (screen === 'game') {
      this.hud.classList.remove('hidden');
    } else if (screen === 'death') {
      this.screens.death.classList.add('active');
    } else if (screen === 'settings') {
      this.screens.settings.classList.add('active');
    } else {
      this.screens.menu.classList.add('active');
    }
  }

  updateHUD(score: number, rank: number, surgeCharge: number, surgeActive: boolean): void {
    this.hudScore.textContent = `Score: ${score}`;
    this.hudRank.textContent = `Rank: #${rank}`;

    // Surge bar
    const surgePercent = Math.min(100, (surgeCharge / SURGE_CHARGE_MAX) * 100);
    this.hudBoostBar.style.width = `${surgePercent}%`;
    this.hudBoostBar.classList.toggle('ready', surgePercent >= 100);
    this.hudBoostBar.classList.toggle('active', surgeActive);
    this.hudBoostLabel.textContent = surgeActive
      ? 'SURGE ACTIVE!'
      : surgePercent >= 100
        ? 'SURGE READY — HOLD BOOST'
        : 'SURGE CHARGING';
  }

  updateLeaderboard(update: LeaderboardUpdate, localPlayerId: string): void {
    this.leaderboardList.innerHTML = '';
    for (let i = 0; i < update.entries.length; i++) {
      const entry = update.entries[i];
      const li = document.createElement('li');
      li.className = entry.id === localPlayerId ? 'self' : '';
      li.innerHTML = `<span class="lb-name">${i + 1}. ${this.escapeHtml(entry.name)}</span><span class="lb-score">${entry.score}</span>`;
      this.leaderboardList.appendChild(li);
    }
  }

  updateKills(kills: number): void {
    this.killCount = kills;
    this.hudKills.textContent = `Kills: ${kills}`;
  }

  updateDebug(fps: number, ping: number, snakeCount: number, pelletCount: number): void {
    if (!this.settings.showDebug) return;
    this.hudDebug.textContent =
      `FPS: ${fps}\nPing: ${ping}ms\nSnakes: ${snakeCount}\nPellets: ${pelletCount}`;
  }

  showDeath(score: number, killerName: string | null): void {
    if (score > this.personalBest) {
      this.personalBest = score;
      localStorage.setItem('serpent-arena-best', String(score));
    }

    this.deathScore.textContent = `Score: ${score}`;
    this.deathKiller.textContent = killerName
      ? `Eliminated by ${this.escapeHtml(killerName)}`
      : 'Hit the boundary!';
    this.deathBest.textContent = `Personal Best: ${this.personalBest}`;
    this.showScreen('death');
  }

  showConnectionStatus(msg: string | null): void {
    if (msg) {
      this.connectionStatus.textContent = msg;
      this.connectionStatus.classList.remove('hidden');
    } else {
      this.connectionStatus.classList.add('hidden');
    }
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  getScreen(): Screen {
    return this.currentScreen;
  }
}
