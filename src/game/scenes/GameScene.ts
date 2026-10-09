import Phaser from 'phaser';
import { FIXED_DT, Sim, getLevel, recordResult, type AbilityId, type LevelDef, type SimEvent } from '../../core';
import { AbilityBar } from '../hud/AbilityBar';
import { Hud } from '../hud/Hud';
import { InteractionController } from '../hud/InteractionController';
import { Overlays } from '../hud/Overlays';
import { WaveCall } from '../hud/WaveCall';
import { Background } from '../render/Background';
import { Fx, type Layers } from '../render/Fx';
import { GroundMarkers } from '../render/GroundMarkers';
import { IsoView } from '../render/iso';
import { MapRenderer } from '../render/MapRenderer';
import { SimRenderer } from '../render/SimRenderer';
import { generateTextures } from '../render/textures';
import { Audio } from '../services/audio';
import { getSave, updateSave } from '../services/save';
import { COLORS, GAME_H, GAME_W } from '../ui/theme';

const MAX_STEPS_PER_FRAME = 8;

/** The in-game scene: renders the deterministic Sim, feeds it commands and hosts the HUD. */
export class GameScene extends Phaser.Scene {
  levelId = 'level01';
  level!: LevelDef;
  sim!: Sim;
  view!: IsoView;
  layers!: Layers;
  simView!: SimRenderer;
  fx!: Fx;
  mapView!: MapRenderer;
  markers!: GroundMarkers;
  bg!: Background;
  hud!: Hud;
  abilityBar!: AbilityBar;
  waveCall!: WaveCall;
  interaction!: InteractionController;
  overlays!: Overlays;

  private acc = 0;
  private speed = 1;
  private paused = false;
  private ended = false;
  private animTime = 0;
  private shownHintWave = -1;
  private dismissedHints = new Set<number>();
  private resultTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('Game');
  }

  init(data: { levelId?: string }): void {
    this.levelId = data?.levelId ?? 'level01';
  }

  create(): void {
    this.acc = 0;
    this.speed = 1;
    this.paused = false;
    this.ended = false;
    this.animTime = 0;
    this.shownHintWave = -1;
    this.dismissedHints = new Set();

    const level = getLevel(this.levelId) ?? getLevel('level01')!;
    this.level = level;
    generateTextures(this);
    this.sim = new Sim(level, { seed: (Date.now() & 0x7fffffff) >>> 0, upgrades: getSave().upgrades, towerCap: level.towerCap });
    this.view = new IsoView(level, { x: 16, y: 58, w: GAME_W - 32, h: GAME_H - 58 - 8 });

    const world = this.add.container(this.view.offX, this.view.offY).setScale(this.view.scale);
    const groundC = this.add.container(0, 0);
    const groundFxC = this.add.container(0, 0);
    const entityC = this.add.container(0, 0);
    const fxC = this.add.container(0, 0);
    world.add([groundC, groundFxC, entityC, fxC]);
    this.layers = { world, groundC, groundFxC, entityC, fxC };

    this.mapView = new MapRenderer(this, level, groundC, entityC);
    this.bg = new Background(this, this.mapView.mainBiome, level.biome === 'mixed');
    this.fx = new Fx(this, this.view, this.layers);
    this.markers = new GroundMarkers(this, this.view, this.layers, this.sim.spots);
    this.markers.setExits(this.sim.paths);
    this.simView = new SimRenderer(this, this.view, this.layers, this.sim, this.fx);

    this.overlays = new Overlays(this);
    this.hud = new Hud(this, this.sim, { onPause: () => this.openPause(), onSpeed: () => this.toggleSpeed() });
    this.abilityBar = new AbilityBar(this, this.sim, this.hud, (id) => this.interaction.armAbility(id));
    this.waveCall = new WaveCall(this, this.sim, this.view, this.hud, () => this.callWave());
    this.interaction = new InteractionController({
      scene: this,
      sim: this.sim,
      view: this.view,
      simView: this.simView,
      markers: this.markers,
      hud: this.hud,
      abilities: this.abilityBar,
      isBlocked: () => this.overlays.active || this.ended,
    });

    this.setupKeys();
    const n = parseInt(level.id.replace(/\D+/g, ''), 10) || 1;
    Audio.music(n % 2 === 1 ? 'music_battle_1' : 'music_battle_2');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    if (import.meta.env.DEV) {
      const w = window as unknown as { __gameScene?: unknown };
      w.__gameScene = this;
    }
    this.simView.update(this.time.now, 0, []);
    this.hud.banner(level.name, { sub: `Level ${n}`, hold: 1.4 });
  }

  // ----------------------------------------------------------------------------------- dev helpers

  /** Dev/testing only (exposed through window.__gameScene in DEV builds). */
  devAddGold(n: number): void {
    (this.sim.state as { gold: number }).gold += n;
  }

  devRun(seconds: number): void {
    this.sim.runFor(seconds);
  }

  // ----------------------------------------------------------------------------------- input

  private setupKeys(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    const on = (ev: string, fn: () => void) => {
      kb.on(ev, fn);
    };
    on('keydown-ESC', () => this.onEscape());
    on('keydown-P', () => (this.overlays.pauseOpen ? this.closePause() : this.openPause()));
    on('keydown-SPACE', () => this.toggleSpeed());
    on('keydown-ONE', () => this.hotkeyAbility('orbital'));
    on('keydown-TWO', () => this.hotkeyAbility('reinforce'));
    on('keydown-NUMPAD_ONE', () => this.hotkeyAbility('orbital'));
    on('keydown-NUMPAD_TWO', () => this.hotkeyAbility('reinforce'));
    on('keydown-N', () => this.callWave());
  }

  private hotkeyAbility(id: AbilityId): void {
    if (this.overlays.active || this.ended) return;
    this.interaction.armAbility(id);
  }

  private onEscape(): void {
    if (this.ended) return;
    if (this.overlays.pauseOpen) {
      this.closePause();
      return;
    }
    if (this.interaction.handleEscape()) return;
    this.openPause();
  }

  private callWave(): void {
    if (this.overlays.active || this.ended) return;
    const r = this.sim.callNextWave();
    if (!r.ok) {
      this.hud.toast('Wave already in progress', undefined, undefined, COLORS.textGold);
      Audio.sfx('ui_error', { throttleMs: 150 });
    }
  }

  private toggleSpeed(): void {
    this.speed = this.speed === 1 ? 2 : 1;
    this.hud.setSpeed(this.speed);
  }

  // ----------------------------------------------------------------------------------- pause / flow

  private openPause(): void {
    if (this.overlays.active || this.ended) return;
    this.paused = true;
    this.interaction.cancelAll();
    this.hud.tooltip.hide();
    this.overlays.showPause({
      onResume: () => this.closePause(),
      onRestart: () => this.restart(),
      onSettings: () => this.openSettings(),
      onQuit: () => this.quit(),
    });
  }

  private closePause(): void {
    this.overlays.hidePause();
    this.paused = false;
  }

  private openSettings(): void {
    if (!this.scene.get('Settings')) {
      this.hud.toast('Settings unavailable', GAME_W / 2, GAME_H / 2 + 220);
      return;
    }
    this.scene.pause();
    this.scene.launch('Settings', { returnTo: 'Game' });
    this.scene.bringToTop('Settings');
  }

  private restart(): void {
    this.scene.restart({ levelId: this.levelId });
  }

  private quit(): void {
    this.gotoLevelSelect();
  }

  private gotoLevelSelect(data?: object): void {
    if (this.scene.get('LevelSelect')) this.scene.start('LevelSelect', data);
    else this.hud.toast('Level select unavailable', GAME_W / 2, GAME_H / 2 + 220);
  }

  private cleanup(): void {
    this.input.setDefaultCursor('default');
    this.input.keyboard?.removeAllListeners();
    this.interaction?.destroy();
    this.overlays?.destroy();
    this.resultTimer?.remove();
  }

  // ----------------------------------------------------------------------------------- events -> HUD / flow

  private handleEvents(events: SimEvent[]): void {
    const bossIncoming = events.some((e) => e.type === 'bossSpawn');
    for (const e of events) {
      switch (e.type) {
        case 'waveStart':
          if (bossIncoming) break;
          this.hud.banner(e.number === e.total ? 'Final Wave!' : `Wave ${e.number}`, { color: e.number === e.total ? '#ff9a8a' : COLORS.text, hold: 1.1 });
          break;
        case 'waveCalledEarly':
          if (e.bonus > 0) this.hud.toast(`Early call bonus  +${e.bonus}`, GAME_W / 2, 110, COLORS.textGold);
          break;
        case 'bossSpawn':
          Audio.sfx('boss_warning');
          Audio.music('music_boss');
          this.hud.banner('MOTHERSHIP INBOUND', { color: '#ff6b6b', band: 0x5a1020, sub: 'Take it down before it reaches the exit!', hold: 2.6 });
          this.fx.shake(6, 0.6);
          this.fx.screenFlash(0xff3030, 0.25, 0.7);
          break;
        case 'won':
          this.onWon(e.lives);
          break;
        case 'lost':
          this.onLost(e.wave);
          break;
        default:
          break;
      }
    }
  }

  private onWon(lives: number): void {
    this.ended = true;
    this.interaction.cancelAll();
    Audio.music(null);
    Audio.sfx('level_victory');
    const info = recordResult(getSave(), this.levelId, lives);
    updateSave(() => info.save);
    this.resultTimer = this.time.delayedCall(1400, () => {
      this.hud.hideHint(true);
      this.overlays.showVictory({
        levelName: this.level.name,
        stars: info.stars,
        lives,
        maxLives: this.sim.state.maxLives,
        gained: info.gained,
        onContinue: () => this.gotoLevelSelect({ completed: this.levelId, starsGained: info.gained }),
        onRetry: () => this.restart(),
      });
    });
  }

  private onLost(wave: number): void {
    this.ended = true;
    this.interaction.cancelAll();
    Audio.music(null);
    Audio.sfx('level_defeat');
    this.resultTimer = this.time.delayedCall(1200, () => {
      this.hud.hideHint(true);
      this.overlays.showDefeat({
        levelName: this.level.name,
        wave,
        total: this.sim.state.wave.total,
        onRetry: () => this.restart(),
        onQuit: () => this.gotoLevelSelect(),
      });
    });
  }

  private updateHints(): void {
    const hints = this.level.hints;
    if (!hints || this.ended) return;
    const idx = this.sim.state.wave.index;
    if (idx !== this.shownHintWave) {
      this.shownHintWave = idx;
      this.hud.hideHint(true);
      const h = hints.find((x) => x.waveIndex === idx);
      if (h && !this.dismissedHints.has(idx)) this.hud.showHint(h.text);
    } else if (!this.hud.hintVisible) {
      // dismissed via the close button
      this.dismissedHints.add(idx);
    }
  }

  // ----------------------------------------------------------------------------------- frame

  update(time: number, delta: number): void {
    const dt = Math.min(delta, 100) / 1000;
    const stepping = !this.paused && !this.overlays.pauseOpen;
    if (stepping) {
      this.acc += dt * this.speed;
      let n = 0;
      while (this.acc >= FIXED_DT && n < MAX_STEPS_PER_FRAME) {
        this.sim.step(FIXED_DT);
        this.acc -= FIXED_DT;
        n++;
      }
      if (n === MAX_STEPS_PER_FRAME) this.acc = 0;
    }
    const events = this.sim.drainEvents();
    this.handleEvents(events);
    const animDt = stepping ? dt * this.speed : 0;
    this.animTime += animDt;
    this.simView.update(this.animTime * 1000, animDt, events);
    this.interaction.update(time);
    this.markers.update(time);
    this.fx.update(dt);
    this.bg.update(dt);
    this.hud.update(time, dt);
    this.abilityBar.update(time);
    this.waveCall.update(time);
    this.updateHints();
  }
}
