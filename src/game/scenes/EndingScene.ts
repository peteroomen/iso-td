import Phaser from 'phaser';
import { starsEarned } from '../../core';
import { Audio } from '../services/audio';
import { getSave } from '../services/save';
import { COLORS, GAME_H, GAME_W, SAFE, designOffsetY, textStyle, viewH, viewW } from '../ui/theme';
import { addSky } from '../ui/background';
import { buildIsland, type Island } from '../ui/isoScenery';
import { Button, Panel, chunkyText, ensureUi, fadeIn, fadeTo, ringPulse, sparkBurst, starChip, tweenNumber } from '../ui/widgets';

export interface EndingData {
  /** Scene to go to on "Continue" (default 'LevelSelect'). */
  returnTo?: string;
}

/** Decorative island: 'B' build spot. A calm little base that has just saved the day. */
const ROWS = ['T.dB.T', '####d.', '.B.#B.', 'T..###', '.d.B.T'];
const TOWERS: [number, number, 'archer' | 'wizard' | 'barracks'][] = [
  [3, 0, 'archer'], [1, 2, 'wizard'], [4, 2, 'archer'], [3, 4, 'barracks'],
];
const KNIGHTS: [number, number][] = [[3, 2], [3, 3], [4, 3]];

/** Layout (recomputed in create() from the live canvas size; the 1280x720 design is centred in it). */
let SHIP_X = 640;
let SHIP_Y = 214;
const SHIP_SCALE = 0.95;
let ISLAND_Y = 478;
const ISLAND_SCALE = 0.42;
let ISLAND_END_X = 346;
const PANEL = { x: 962, y: 474, w: 500, h: 288 };

const CREDIT_LINES: { head: string; body: string[] }[] = [
  { head: 'ART', body: ['Isometric Tower Defense Pack', 'Artyom Zagorskiy (CC0)'] },
  { head: 'SOUND EFFECTS', body: ['Kenney (CC0)', 'Interface, UI, Impact, Digital, RPG and Sci-fi Sounds, Music Jingles'] },
  { head: 'MUSIC', body: ['The Old Tower Inn - RandomMind', 'Grasslands - Juhani Junkala (SubspaceAudio)', 'Adventure Time - Scribe', 'Boss Battle #2 - nene', '(OpenGameArt, CC0)'] },
  { head: 'FONT', body: ['Lilita One - Juan Montoreano (OFL)'] },
  { head: 'MADE WITH', body: ['Phaser 3, TypeScript and Vite'] },
];

interface Debris {
  obj: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  vr: number;
  age: number;
  smoke: number;
}

/** Campaign ending: the Mothership breaks apart over a calm diorama, "EARTH IS SAFE!", total stars, a credits roll. */
export class EndingScene extends Phaser.Scene {
  private returnTo = 'LevelSelect';
  private island!: Island;
  private ship?: Phaser.GameObjects.Image;
  private escorts: Phaser.GameObjects.Image[] = [];
  private debris: Debris[] = [];
  private smokeTimer?: Phaser.Time.TimerEvent;
  private celebrate?: Phaser.Time.TimerEvent;
  private leaving = false;
  private ready = false;
  private daySky: { obj: Phaser.GameObjects.GameObject & { setAlpha(a: number): unknown }; alpha: number }[] = [];

  constructor() {
    super('Ending');
  }

  init(data: EndingData): void {
    this.returnTo = data?.returnTo ?? 'LevelSelect';
    this.leaving = false;
    this.ready = false;
    this.debris = [];
    this.escorts = [];
    this.daySky = [];
    this.ship = undefined;
  }

  create(): void {
    ensureUi(this);
    {
      const oy = Math.round(designOffsetY(this) * 0.8);
      SHIP_X = viewW(this) / 2;
      SHIP_Y = 214 + oy;
      ISLAND_Y = 478 + oy;
      ISLAND_END_X = viewW(this) / 2 - 294;
      PANEL.x = viewW(this) / 2 + 322;
      PANEL.y = 474 + oy;
    }
    fadeIn(this, 500);
    Audio.music(null);

    // night sky first; the day sky waits behind a zero alpha and takes over after the blast
    addSky(this, 'night', { clouds: 3, depth: -1000 });
    const before = this.children.length;
    addSky(this, 'day', { clouds: 6, depth: -900 });
    for (const o of this.children.list.slice(before)) {
      const a = (o as unknown as { alpha: number }).alpha;
      this.daySky.push({ obj: o as never, alpha: a });
      (o as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0);
    }

    this.buildIsland();
    this.buildMothership();
    this.input.keyboard?.on('keydown-ENTER', () => this.onConfirm());
    this.input.keyboard?.on('keydown-SPACE', () => this.onConfirm());
    this.input.keyboard?.on('keydown-ESC', () => this.onConfirm());
    // tap anywhere during the intro to fast-forward it
    this.input.on('pointerdown', () => {
      if (this.ready) return;
      this.tweens.timeScale = 3;
      this.time.timeScale = 3;
    });

    this.runSequence();
  }

  // -------------------------------------------------------------------------------------------------------------
  // set pieces
  // -------------------------------------------------------------------------------------------------------------

  private buildIsland(): void {
    const island = (this.island = buildIsland(this, GAME_W / 2, ISLAND_Y, { rows: ROWS, biome: 'spring', scale: ISLAND_SCALE, seed: 11 }));
    island.root.setDepth(1);
    island.root.setAlpha(0).setY(ISLAND_Y + 40);
    this.tweens.add({ targets: island.root, alpha: 1, y: ISLAND_Y, duration: 700, ease: 'Back.easeOut', delay: 150 });
    this.time.delayedCall(900, () => {
      this.tweens.add({ targets: island.root, y: ISLAND_Y - 6, duration: 2500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    for (const [col, row, kind] of TOWERS) {
      const key = kind === 'archer' ? 'towers/archer_level_3' : kind === 'wizard' ? 'towers/wizard_level_3' : 'towers/barrack_level_3_1';
      const img = this.add.image(0, 0, key).setScale(ISLAND_SCALE * 0.95).setOrigin(0.5, kind === 'wizard' ? 0.82 : 0.84);
      island.addProp(col, row, img, 5, 0, 4);
    }
    // the knights are in a good mood: they hop once the danger is over
    KNIGHTS.forEach(([col, row], i) => {
      const k = this.add.image(0, 0, 'units/knight_level_3').setScale(ISLAND_SCALE * 1.5).setOrigin(0.5, 0.9);
      island.addProp(col, row, k, 6, (i - 1) * 8, 2);
      const baseY = k.y;
      this.time.delayedCall(3600 + i * 170, () => {
        this.tweens.add({ targets: k, y: baseY - 16, duration: 260, yoyo: true, repeat: -1, repeatDelay: 380, ease: 'Quad.easeOut' });
      });
    });
  }

  private buildMothership(): void {
    const ship = (this.ship = this.add.image(SHIP_X, SHIP_Y, 'ufo/mothership').setScale(SHIP_SCALE).setDepth(10));
    this.tweens.add({ targets: ship, y: SHIP_Y + 8, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // a few escorts that go down with the ship
    const spots: [string, number, number][] = [
      ['ufo/ufo_1', -250, 40], ['ufo/ufo_2', 245, 60], ['ufo/ufo_4', -190, -40], ['ufo/ufo_5', 200, -30], ['ufo/ufo_3', 0, -150],
    ];
    spots.forEach(([key, dx, dy], i) => {
      const e = this.add.image(SHIP_X + dx, SHIP_Y + dy, key).setScale(0.75).setDepth(10);
      this.escorts.push(e);
      this.tweens.add({ targets: e, y: e.y - 10, x: e.x + (i % 2 ? 12 : -12), duration: 900 + i * 170, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    // smoke curls out of the hull while it is being hit
    this.smokeTimer = this.time.addEvent({
      delay: 110,
      loop: true,
      paused: true,
      callback: () => this.puff(SHIP_X + Phaser.Math.Between(-120, 120), SHIP_Y + Phaser.Math.Between(-30, 50), 0x3a3048, 1.2),
    });
  }

  // -------------------------------------------------------------------------------------------------------------
  // sequence
  // -------------------------------------------------------------------------------------------------------------

  private runSequence(): void {
    const at = (ms: number, fn: () => void): void => {
      this.time.delayedCall(ms, () => {
        if (!this.leaving) fn();
      });
    };
    // 1. the Mothership takes hit after hit
    at(900, () => this.smokeTimer && (this.smokeTimer.paused = false));
    const hits = 11;
    for (let i = 0; i < hits; i++) {
      const t = 1000 + i * 175 - Math.round(i * i * 4);
      at(t, () => this.hit(i / (hits - 1)));
    }
    // 2. the end
    at(3150, () => this.blast());
    // 3. celebration
    at(4300, () => {
      Audio.sfx('level_victory', { volume: 0.9 });
      this.revealTitle();
    });
    at(5400, () => Audio.music('music_menu'));
    at(5100, () => this.revealStars());
    at(6200, () => this.revealCredits());
    at(6000, () => this.revealContinue());
  }

  private hit(k: number): void {
    const ship = this.ship;
    if (!ship) return;
    const x = SHIP_X + Phaser.Math.Between(-130, 130);
    const y = SHIP_Y + Phaser.Math.Between(-70, 60);
    this.fireball(x, y, 70 + k * 60 + Math.random() * 30);
    Audio.sfx(k > 0.6 ? 'ufo_explode_big' : 'ufo_explode_small', { detune: Phaser.Math.Between(-300, 200), volume: 0.7, throttleMs: 0 });
    this.cameras.main.shake(140, 0.002 + k * 0.004);
    // white flash, then a progressively scorched tint
    const scorch = Phaser.Display.Color.GetColor(255, Math.round(255 - 120 * k), Math.round(255 - 150 * k));
    ship.setTintFill(0xffffff);
    this.time.delayedCall(50, () => ship.scene && ship.setTint(scorch));
    // a little juddering
    this.tweens.add({ targets: ship, angle: Phaser.Math.Between(-4, 4), duration: 90, yoyo: true });
    // escorts get picked off, too
    if (k > 0.35 && this.escorts.length && Math.random() < 0.4) {
      const e = this.escorts.shift();
      if (e) this.popEscort(e);
    }
  }

  private popEscort(e: Phaser.GameObjects.Image): void {
    this.fireball(e.x, e.y, 80);
    Audio.sfx('ufo_explode_small', { detune: 300, volume: 0.6, throttleMs: 0 });
    e.destroy();
  }

  private blast(): void {
    const ship = this.ship;
    if (!ship) return;
    this.smokeTimer?.remove();
    const cam = this.cameras.main;
    cam.flash(520, 255, 244, 214);
    cam.shake(650, 0.012);
    Audio.sfx('ufo_explode_big', { volume: 1, throttleMs: 0 });
    Audio.sfx('orbital_blast', { volume: 0.7, throttleMs: 0 });
    ringPulse(this, SHIP_X, SHIP_Y, 0xfff4d6, 260, 60);
    ringPulse(this, SHIP_X, SHIP_Y, 0xffa030, 190, 60);
    for (let i = 0; i < 9; i++) {
      this.time.delayedCall(i * 55, () => this.fireball(SHIP_X + Phaser.Math.Between(-150, 150), SHIP_Y + Phaser.Math.Between(-80, 80), 120 + Math.random() * 70));
    }
    sparkBurst(this, SHIP_X, SHIP_Y, { count: 26, radius: 260, size: 30, colors: [0xffd34e, 0xff8a2a, 0xffffff, 0xff5a3c], depth: 70, duration: 900 });
    for (const e of this.escorts.splice(0)) this.time.delayedCall(Phaser.Math.Between(0, 260), () => e.scene && this.popEscort(e));

    // break the hull into chunks (crops of the same sprite, each spinning around its own centre)
    const tex = ship.texture.getSourceImage() as HTMLImageElement;
    const W = tex.width, H = tex.height;
    const cols = [0, Math.round(W * 0.34), Math.round(W * 0.66), W];
    const splits = [Math.round(H * 0.46), Math.round(H * 0.38), Math.round(H * 0.5)];
    const s = ship.scaleX;
    const sx = ship.x - (W / 2) * s;
    const sy = ship.y - (H / 2) * s;
    ship.destroy();
    this.ship = undefined;
    for (let c = 0; c < 3; c++) {
      const x0 = cols[c], x1 = cols[c + 1];
      const ranges: [number, number][] = [[0, splits[c]], [splits[c], H]];
      for (const [y0, y1] of ranges) {
        const w = x1 - x0, h = y1 - y0;
        const cx = x0 + w / 2, cy = y0 + h / 2;
        const px = sx + cx * s, py = sy + cy * s;
        const img = this.add.image(px, py, 'ufo/mothership').setScale(s).setDepth(11).setOrigin(cx / W, cy / H);
        img.setCrop(x0, y0, w, h);
        img.setTint(0xb0a0a0);
        const dx = px - SHIP_X, dy = py - SHIP_Y;
        const len = Math.max(30, Math.hypot(dx, dy));
        this.debris.push({
          obj: img,
          vx: (dx / len) * Phaser.Math.Between(150, 260) + Phaser.Math.Between(-30, 30),
          vy: (dy / len) * Phaser.Math.Between(120, 220) - Phaser.Math.Between(160, 280),
          vr: Phaser.Math.FloatBetween(-3.2, 3.2),
          age: 0,
          smoke: 0,
        });
      }
    }
    // the sky clears
    for (const d of this.daySky) {
      this.tweens.add({ targets: d.obj, alpha: d.alpha, duration: 1800, delay: 300, ease: 'Sine.easeInOut' });
    }
    this.startCelebration();
  }

  private fireball(x: number, y: number, size: number): void {
    const glow = this.add.image(x, y, 'ui_glow').setTint(0xff9a2e).setDepth(40).setAlpha(0.95).setDisplaySize(size * 0.4, size * 0.4);
    this.tweens.add({ targets: glow, displayWidth: size * 2, displayHeight: size * 2, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => glow.destroy() });
    const core = this.add.image(x, y, 'ui_glow').setTint(0xffffff).setDepth(41).setDisplaySize(size * 0.3, size * 0.3);
    this.tweens.add({ targets: core, displayWidth: size * 0.9, displayHeight: size * 0.9, alpha: 0, duration: 260, ease: 'Cubic.easeOut', onComplete: () => core.destroy() });
    sparkBurst(this, x, y, { count: 9, radius: size * 0.8, size: 22, colors: [0xffd34e, 0xff8a2a, 0xfff4d6, 0xff5a3c], depth: 42, duration: 640 });
    for (let i = 0; i < 2; i++) this.puff(x + Phaser.Math.Between(-20, 20), y + Phaser.Math.Between(-10, 10), 0x2e222f, 1.5);
  }

  private puff(x: number, y: number, tint: number, scale: number): void {
    const p = this.add.image(x, y, 'ui_dot').setTint(tint).setDepth(9).setAlpha(0.7).setDisplaySize(16 * scale, 16 * scale);
    this.tweens.add({
      targets: p,
      y: y - Phaser.Math.Between(40, 90),
      x: x + Phaser.Math.Between(-24, 24),
      displayWidth: 46 * scale,
      displayHeight: 46 * scale,
      alpha: 0,
      duration: Phaser.Math.Between(700, 1300),
      ease: 'Sine.easeOut',
      onComplete: () => p.destroy(),
    });
  }

  update(_time: number, delta: number): void {
    const dt = (delta / 1000) * this.time.timeScale;
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.age += dt;
      d.vy += 560 * dt;
      d.obj.x += d.vx * dt;
      d.obj.y += d.vy * dt;
      d.obj.rotation += d.vr * dt;
      d.smoke -= dt;
      if (d.smoke <= 0 && d.age < 1.8) {
        d.smoke = 0.07;
        this.puff(d.obj.x, d.obj.y, d.age < 0.5 ? 0xff8a2a : 0x3a3048, 0.9);
      }
      if (d.age > 1.4) d.obj.setAlpha(Math.max(0, 1 - (d.age - 1.4) / 0.6));
      if (d.age > 2) {
        this.fireball(d.obj.x, Math.min(d.obj.y, GAME_H - 80), 70);
        d.obj.destroy();
        this.debris.splice(i, 1);
      }
    }
  }

  private startCelebration(): void {
    this.celebrate?.remove();
    this.celebrate = this.time.addEvent({
      delay: 520,
      loop: true,
      callback: () => {
        if (this.leaving) return;
        const colors = [[0xffd34e, 0xfff4d6], [0x9be2ff, 0xffffff], [0xff9ec0, 0xffd34e], [0x9be06a, 0xfff4d6]];
        sparkBurst(this, Phaser.Math.Between(120, GAME_W - 120), Phaser.Math.Between(190, 330), {
          count: 10, radius: 70, size: 24, colors: colors[Phaser.Math.Between(0, colors.length - 1)], depth: 25, duration: 800,
        });
      },
    });
  }

  private confetti(n: number): void {
    const tints = [0xffd34e, 0xff6b6b, 0x7fd6ff, 0x9be06a, 0xd29bff, 0xffffff];
    for (let i = 0; i < n; i++) {
      const size = Phaser.Math.Between(16, 30);
      const x = Phaser.Math.Between(20, GAME_W - 20);
      const img = this.add.image(x, -30, 'ui_star').setDepth(20).setDisplaySize(size, size).setTint(tints[i % tints.length]).setAngle(Phaser.Math.Between(0, 360));
      this.tweens.add({
        targets: img,
        y: GAME_H + 40,
        x: x + Phaser.Math.Between(-90, 90),
        angle: img.angle + Phaser.Math.Between(-420, 420),
        duration: Phaser.Math.Between(2800, 4800),
        delay: Phaser.Math.Between(0, 900),
        ease: 'Sine.easeIn',
        onComplete: () => img.destroy(),
      });
    }
  }

  private revealTitle(): void {
    const title = chunkyText(this, GAME_W / 2, 100, 'EARTH IS SAFE!', 112).setDepth(30);
    title.setScale(3).setAlpha(0);
    this.tweens.add({
      targets: title,
      scale: 1,
      alpha: 1,
      duration: 650,
      ease: 'Bounce.easeOut',
      onComplete: () => {
        this.cameras.main.shake(160, 0.004);
        ringPulse(this, GAME_W / 2, 100, 0xffd34e, 360, 60);
        this.tweens.add({ targets: title, y: 106, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      },
    });
    this.confetti(34);
    this.time.addEvent({ delay: 650, loop: true, callback: () => !this.leaving && this.confetti(3) });
  }

  private revealStars(): void {
    const total = starsEarned(getSave());
    const { root, label } = starChip(this, GAME_W / 2, 206, '0 / 30', 232);
    root.setDepth(30).setScale(0.4).setAlpha(0);
    this.tweens.add({ targets: root, scale: 1.1, alpha: 1, duration: 420, ease: 'Back.easeOut' });
    this.time.delayedCall(250, () => tweenNumber(this, label, 0, total, (n) => `${n} / 30`, Math.min(1400, 200 + total * 45)));
    this.time.delayedCall(250 + Math.min(1400, 200 + total * 45), () => {
      Audio.sfx('star_earned', { volume: 0.8 });
      sparkBurst(this, GAME_W / 2 - 78, 206, { count: 10, radius: 56, size: 22, depth: 45 });
    });

    const perfect = total >= 30;
    const nudge = this.add
      .text(GAME_W / 2, 262, perfect ? 'PERFECT! Every star collected!' : 'Go for 30 stars!', textStyle(30, perfect ? COLORS.textGold : '#ffe9bf', { strokeThickness: 6 }))
      .setOrigin(0.5)
      .setDepth(30)
      .setAlpha(0);
    this.tweens.add({ targets: nudge, alpha: 1, duration: 500, delay: 900 });
    if (!perfect) {
      const sub = this.add.text(GAME_W / 2, 296, 'Replay levels to earn all 3 stars', textStyle(20, '#d8cbe8', { strokeThickness: 4 })).setOrigin(0.5).setDepth(30).setAlpha(0);
      this.tweens.add({ targets: sub, alpha: 1, duration: 500, delay: 1200 });
    }
  }

  private revealCredits(): void {
    // the island steps aside for the credits roll
    this.tweens.add({ targets: this.island.root, x: ISLAND_END_X, duration: 900, ease: 'Cubic.easeInOut' });

    const { x, y, w, h } = PANEL;
    const holder = this.add.container(0, 0).setDepth(30).setAlpha(0);
    const panel = new Panel(this, x, y, w, h, { fill: 0x2f2540, radius: 24 });
    const head = this.add.text(x, y - h / 2 + 30, 'CREDITS', textStyle(30, COLORS.textGold, { strokeThickness: 6 })).setOrigin(0.5);
    holder.add([panel, head]);

    const top = y - h / 2 + 60;
    const bottom = y + h / 2 - 16;
    const maskG = this.make.graphics({ x: 0, y: 0 }, false);
    maskG.fillStyle(0xffffff, 1);
    maskG.fillRect(x - w / 2 + 12, top, w - 24, bottom - top);
    const roll = this.add.container(0, 0);
    let cy = 0;
    for (const sec of CREDIT_LINES) {
      const hd = this.add.text(x, cy, sec.head, textStyle(24, COLORS.textGold, { strokeThickness: 5 })).setOrigin(0.5, 0);
      roll.add(hd);
      cy += hd.height + 6;
      for (const line of sec.body) {
        const t = this.add.text(x, cy, line, textStyle(22, COLORS.text, { strokeThickness: 0, align: 'center', wordWrap: { width: w - 70 } })).setOrigin(0.5, 0);
        roll.add(t);
        cy += t.height + 3;
      }
      cy += 26;
    }
    const thanks = this.add.text(x, cy, 'Thanks for playing!', textStyle(34, COLORS.text, { strokeThickness: 7 })).setOrigin(0.5, 0);
    roll.add(thanks);
    cy += thanks.height;
    roll.setMask(maskG.createGeometryMask());
    holder.add(roll);

    // scroll from just below the window until "Thanks for playing!" sits in the middle of it
    const startY = bottom - top + 4;
    const endY = -(cy - (bottom - top) / 2 - thanks.height / 2) - 0;
    roll.y = top + startY;
    holder.setAlpha(0);
    this.tweens.add({ targets: holder, alpha: 1, duration: 600 });
    this.tweens.add({ targets: roll, y: top + endY + 0, duration: Math.abs(startY - endY) * 36, delay: 500, ease: 'Linear' });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => maskG.destroy());
  }

  private revealContinue(): void {
    this.ready = true;
    this.tweens.timeScale = 1;
    this.time.timeScale = 1;
    const btn = (new Button(this, GAME_W / 2, viewH(this) - 56 - SAFE.b, {
      width: 320, height: 76, label: 'Continue', icon: 'ui_play', style: 'success', fontSize: 40, radius: 26, onClick: () => this.leave(),
    }));
    btn.setDepth(60).setScale(0).setAlpha(0);
    this.tweens.add({ targets: btn, scale: 1, alpha: 1, duration: 420, ease: 'Back.easeOut' });
    this.time.delayedCall(500, () => btn.scene && btn.pulse(true));
  }

  private onConfirm(): void {
    if (!this.ready) {
      // skip the intro
      this.tweens.timeScale = 3;
      this.time.timeScale = 3;
      return;
    }
    this.leave();
  }

  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.celebrate?.remove();
    fadeTo(this, () => {
      this.tweens.timeScale = 1;
      this.time.timeScale = 1;
      const key = this.scene.manager.keys[this.returnTo] ? this.returnTo : 'LevelSelect';
      this.scene.start(key);
    });
  }
}
