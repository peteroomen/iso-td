import Phaser from 'phaser';
import { FIXED_DT, Sim, getLevel, recordResult, type AbilityId, type LevelDef, type SimEvent } from '../../core';
import { AbilityBar } from '../hud/AbilityBar';
import { EnemyIntro } from '../hud/EnemyIntro';
import { Hud, barBottom } from '../hud/Hud';
import { InteractionController } from '../hud/InteractionController';
import { MapCamera } from '../hud/MapCamera';
import { Overlays } from '../hud/Overlays';
import { WaveCall } from '../hud/WaveCall';
import { Background } from '../render/Background';
import { Fx, type Layers } from '../render/Fx';
import { GroundMarkers } from '../render/GroundMarkers';
import { IsoView } from '../render/iso';
import { MapRenderer } from '../render/MapRenderer';
import { SimRenderer } from '../render/SimRenderer';
import { generateSpecTextures } from '../render/specVisuals';
import { generateTextures } from '../render/textures';
import { Audio } from '../services/audio';
import { getSave, updateSave } from '../services/save';
import { COLORS, GAME_H, GAME_W, SAFE, UI_SCALE } from '../ui/theme';
import { pauseReasons } from '../ui/pauseReasons';
import { applyViewCamera, fullscreenAvailable, toggleFullscreen, type ViewResizable } from '../ui/viewport';

const MAX_STEPS_PER_FRAME = 8;

/** The in-game scene: renders the deterministic Sim, feeds it commands and hosts the HUD. */
/** Everything needed to rebuild the display after a canvas resize without losing the run. */
interface ResumeState {
  sim: Sim;
  speed: number;
  acc: number;
  animTime: number;
  dismissedHints: Set<number>;
  ended: boolean;
  result?: ResultState;
  /** the run was started by this scene before the resize (skips the level-name banner) */
  hold: boolean;
}

type ResultState =
  | { kind: 'won'; lives: number; info: { stars: number; gained: number } }
  | { kind: 'lost'; wave: number };

export class GameScene extends Phaser.Scene implements ViewResizable {
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
  intro!: EnemyIntro;
  interaction!: InteractionController;
  mapCamera!: MapCamera;
  overlays!: Overlays;

  private acc = 0;
  private speed = 1;
  private unsubPause?: () => void;
  private ended = false;
  private animTime = 0;
  private shownHintWave = -1;
  private dismissedHints = new Set<number>();
  private resultTimer?: Phaser.Time.TimerEvent;
  private resumeFrom?: ResumeState;
  private result?: ResultState;
  /** the canvas was resized while this scene was paused behind the Settings overlay */
  private staleLayout = false;
  private onResumeEvt = (): void => {
    // back from the Settings overlay
    pauseReasons.remove('settings');
    if (this.staleLayout) this.relayout();
  };

  constructor() {
    super('Game');
  }

  init(data: { levelId?: string; resume?: ResumeState }): void {
    this.levelId = data?.levelId ?? 'level01';
    this.resumeFrom = data?.resume;
  }

  create(): void {
    applyViewCamera(this);
    const rs = this.resumeFrom;
    this.resumeFrom = undefined;
    // a fresh run starts un-paused; a rebuild keeps every pause reason (user / portrait / hidden) as it was
    if (!rs) pauseReasons.resetRun();
    pauseReasons.set('settings', this.scene.manager.isActive('Settings'));
    this.acc = rs?.acc ?? 0;
    this.speed = rs?.speed ?? 1;
    this.ended = false;
    this.result = undefined;
    this.staleLayout = false;
    this.animTime = rs?.animTime ?? 0;
    this.shownHintWave = -1;
    this.dismissedHints = rs?.dismissedHints ?? new Set();

    const level = getLevel(this.levelId) ?? getLevel('level01')!;
    this.level = level;
    generateTextures(this);
    generateSpecTextures(this);
    this.sim = rs?.sim ?? new Sim(level, { seed: (Date.now() & 0x7fffffff) >>> 0, upgrades: getSave().upgrades, towerCap: level.towerCap });
    // play area: the whole canvas minus the safe-area insets; the top bar overlaps the (empty) upper corners of the iso diamond
    const top = Math.max(SAFE.t + 6, barBottom() - 14 * UI_SCALE);
    this.view = new IsoView(level, { x: 12 + SAFE.l, y: top, w: GAME_W - 24 - SAFE.l - SAFE.r, h: GAME_H - top - 6 - SAFE.b });

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
    this.markers.setExits(this.sim.paths, this.mapView.width, this.mapView.height);
    this.simView = new SimRenderer(this, this.view, this.layers, this.sim, this.fx);

    this.overlays = new Overlays(this);
    this.hud = new Hud(this, this.sim, { onPause: () => this.openPause(), onSpeed: () => this.toggleSpeed() });
    this.abilityBar = new AbilityBar(this, this.sim, this.hud, (id) => this.interaction.armAbility(id));
    this.waveCall = new WaveCall(this, this.sim, this.view, this.hud, () => this.callWave());
    this.hud.hintAvoid = () => this.waveCall.avoidRects();
    this.intro = new EnemyIntro(this, this.sim, () => [...this.waveCall.avoidRects(), this.mapCamera.buttonRect()]);
    this.mapCamera = new MapCamera({
      scene: this,
      view: this.view,
      world,
      hud: this.hud,
      isBlocked: () => this.overlays.active || this.ended,
      onMove: () => this.interaction?.viewMoved(),
    });
    this.hud.hintAvoid = () => [...this.waveCall.avoidRects(), this.mapCamera.buttonRect()];
    this.interaction = new InteractionController({
      camera: this.mapCamera,
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

    this.events.on(Phaser.Scenes.Events.RESUME, this.onResumeEvt);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    if (import.meta.env.DEV) {
      const w = window as unknown as { __gameScene?: unknown };
      w.__gameScene = this;
    }
    this.simView.update(this.time.now, 0, []);
    if (this.hud) this.hud.setSpeed(this.speed);
    if (!rs) this.hud.banner(level.name, { sub: `Level ${n}`, hold: 1.4 });
    if (rs) this.restoreAfterResize(rs);
    this.unsubPause?.();
    this.unsubPause = pauseReasons.subscribe(() => {
      if (this.sys.isActive()) this.syncPauseMenu();
    });
    this.syncPauseMenu();
  }

  // ----------------------------------------------------------------------------------- resize / orientation

  /** Canvas size changed (rotation, window resize, fullscreen): rebuild the display, keep the run. */
  onViewResize(): void {
    if (this.sys.isPaused() || !this.sys.isActive()) {
      // behind the Settings overlay: rebuild once it closes
      this.staleLayout = true;
      return;
    }
    this.relayout();
  }

  /** App went to the background: the player returns to the pause menu rather than into a running game. */
  onAppHidden(): void {
    if (!this.ended) pauseReasons.add('user');
  }

  private relayout(): void {
    this.staleLayout = false;
    const resume: ResumeState = {
      sim: this.sim,
      speed: this.speed,
      acc: this.acc,
      animTime: this.animTime,
      dismissedHints: this.dismissedHints,
      ended: this.ended,
      result: this.result,
      hold: true,
    };
    this.scene.restart({ levelId: this.levelId, resume });
  }

  private restoreAfterResize(rs: ResumeState): void {
    if (rs.ended && rs.result) {
      this.result = rs.result;
      this.ended = true;
      this.intro.disable();
      this.showResult(rs.result, 60);
    }
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
    on('keydown-P', () => (pauseReasons.has('user') ? this.closePause() : this.openPause()));
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
    if (pauseReasons.has('user')) {
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

  /** Player pause (button / Esc / P / backgrounded). The menu itself is derived from the reason, see syncPauseMenu. */
  private openPause(): void {
    if (this.ended) return;
    pauseReasons.add('user');
  }

  /** Resume only drops the player's own reason: the sim keeps waiting while the rotate overlay / Settings still hold it. */
  private closePause(): void {
    pauseReasons.remove('user');
  }

  /** The pause menu is visible exactly while the 'user' reason is held (and the run is not over). */
  private syncPauseMenu(): void {
    const want = pauseReasons.has('user') && !this.ended;
    if (want && !this.overlays.active) {
      this.interaction.cancelAll();
      this.hud.tooltip.hide();
      this.overlays.showPause({
        onResume: () => this.closePause(),
        onRestart: () => this.restart(),
        onSettings: () => this.openSettings(),
        onQuit: () => this.quit(),
        onFullscreen: fullscreenAvailable(this.scale) ? () => toggleFullscreen(this.scale) : undefined,
        fullscreenLabel: () => (this.scale.isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'),
      });
    } else if (!want && this.overlays.pauseOpen) {
      this.overlays.hidePause();
    }
  }

  private openSettings(): void {
    if (!this.scene.get('Settings')) {
      this.hud.toast('Settings unavailable', GAME_W / 2, GAME_H / 2 + 220);
      return;
    }
    pauseReasons.add('settings');
    this.scene.pause();
    this.scene.launch('Settings', { returnTo: 'Game' });
    this.scene.bringToTop('Settings');
  }

  private restart(): void {
    pauseReasons.resetRun();
    this.scene.restart({ levelId: this.levelId });
  }

  private quit(): void {
    this.gotoLevelSelect();
  }

  private gotoLevelSelect(data?: object): void {
    pauseReasons.resetRun();
    if (this.scene.get('LevelSelect')) this.scene.start('LevelSelect', data);
    else this.hud.toast('Level select unavailable', GAME_W / 2, GAME_H / 2 + 220);
  }

  private cleanup(): void {
    this.input.setDefaultCursor('default');
    this.input.keyboard?.removeAllListeners();
    this.events.off(Phaser.Scenes.Events.RESUME, this.onResumeEvt);
    this.unsubPause?.();
    this.unsubPause = undefined;
    this.interaction?.destroy();
    this.overlays?.destroy();
    this.intro?.destroy();
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
          if (e.bonus > 0) this.hud.toast(`Early call bonus  +${e.bonus}`, GAME_W / 2, 290, COLORS.textGold);
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
    this.intro.disable();
    this.interaction.cancelAll();
    Audio.music(null);
    Audio.sfx('level_victory');
    const info = recordResult(getSave(), this.levelId, lives);
    updateSave(() => info.save);
    this.result = { kind: 'won', lives, info: { stars: info.stars, gained: info.gained } };
    this.showResult(this.result, 1400);
  }

  private onLost(wave: number): void {
    this.ended = true;
    this.intro.disable();
    this.interaction.cancelAll();
    Audio.music(null);
    Audio.sfx('level_defeat');
    this.result = { kind: 'lost', wave };
    this.showResult(this.result, 1200);
  }

  private showResult(r: ResultState, delay: number): void {
    this.resultTimer = this.time.delayedCall(delay, () => {
      this.hud.hideHint(true);
      if (r.kind === 'won') {
        const info = r.info;
        this.overlays.showVictory({
          levelName: this.level.name,
          stars: info.stars,
          lives: r.lives,
          maxLives: this.sim.state.maxLives,
          gained: info.gained,
          onContinue: () => this.gotoLevelSelect({ completed: this.levelId, starsGained: info.gained }),
          onRetry: () => this.restart(),
        });
      } else {
        this.overlays.showDefeat({
          levelName: this.level.name,
          wave: r.wave,
          total: this.sim.state.wave.total,
          onRetry: () => this.restart(),
          onQuit: () => this.gotoLevelSelect(),
        });
      }
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
    const stepping = !pauseReasons.any;
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
    this.mapView.syncOccupied(this.sim.state.towers.map((t) => this.sim.spots[t.spotId]));
    this.mapCamera.update(dt);
    this.interaction.update(time);
    this.markers.update(time);
    this.fx.update(dt);
    this.bg.update(dt);
    this.hud.update(time, dt);
    this.abilityBar.update(time);
    this.waveCall.update(time);
    this.intro.update(time);
    this.updateHints();
  }
}
