import Phaser from 'phaser';
import { applyViewCamera } from '../ui/viewport';
import { hasFlag, starsEarned } from '../../core';
import { Audio } from '../services/audio';
import { getSave } from '../services/save';
import { COLORS, SAFE, textStyle, viewH, viewW } from '../ui/theme';
import { addSky } from '../ui/background';
import { buildIsland, PITCH_Y, type Island } from '../ui/isoScenery';
import {
  Button,
  IconButton,
  chunkyText,
  ensureUi,
  fadeIn,
  fadeTo,
  openModal,
  sparkBurst,
} from '../ui/widgets';

/** Decorative island: '#' road, 'B' build spot. The road enters at the NW-most cell and leaves at the SE-most one. */
const DIORAMA_ROWS = ['T.dB.T', '####d.', '.B.#B.', 'T..###', '.d.B.T'];
const ROAD_CELLS: [number, number][] = [
  [0, 1], [1, 1], [2, 1], [3, 1], [3, 2], [3, 3], [4, 3], [5, 3],
];

interface Flier {
  img: Phaser.GameObjects.Image;
  kind: 'walker' | 'circler';
  // walker
  dist: number;
  speed: number;
  // circler
  phase: number;
  rx: number;
  ry: number;
  cx: number;
  cy: number;
  rate: number;
  hover: number;
  lastSum: number;
  baseScale: number;
}

interface Turret {
  kind: 'archer' | 'wizard';
  x: number;
  y: number;
  cooldown: number;
  rate: number;
  range: number;
  sprite: Phaser.GameObjects.Image;
}

export class TitleScene extends Phaser.Scene {
  private island!: Island;
  private fliers: Flier[] = [];
  private turrets: Turret[] = [];
  private pathPts: { x: number; y: number }[] = [];
  private pathLen: number[] = [];
  private totalLen = 0;
  private modalOpen = false;
  private clickToStart = false;

  constructor() {
    super('Title');
  }

  create(): void {
    applyViewCamera(this);
    ensureUi(this);
    this.fliers = [];
    this.turrets = [];
    this.modalOpen = false;
    this.clickToStart = false;
    addSky(this, 'dusk', { clouds: 5 });
    fadeIn(this);
    Audio.music('music_menu');

    this.buildDiorama();
    this.buildLogo();
    this.buildButtons();
    this.buildStarChip();

    this.add.text(14 + SAFE.l, viewH(this) - 6 - SAFE.b, 'v0.1  |  CC0 art: Artyom Zagorskiy', textStyle(18, '#c9bbe4', { strokeThickness: 3 })).setOrigin(0, 1).setAlpha(0.85);

    this.input.keyboard?.on('keydown-ENTER', () => this.play());
    this.input.keyboard?.on('keydown-SPACE', () => this.play());

    if (this.sound.locked) this.showClickToStart();
  }

  // -------------------------------------------------------------------------------------------------------------
  // logo
  // -------------------------------------------------------------------------------------------------------------

  private buildLogo(): void {
    const logo = chunkyText(this, viewW(this) / 2, 106, 'UFO DEFENSE', 128);
    logo.setScale(0.2).setAlpha(0).setY(-80);
    this.tweens.add({ targets: logo, y: 106, scale: 1, alpha: 1, duration: 800, ease: 'Back.easeOut', delay: 150 });
    this.time.delayedCall(1100, () => {
      this.tweens.add({ targets: logo, y: 112, duration: 2100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: logo, angle: { from: -0.8, to: 0.8 }, duration: 3300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });

    const tag = this.add
      .text(viewW(this) / 2, 204, 'Stop the alien invasion. Hold the line!', textStyle(26, '#ffe9bf', { strokeThickness: 5 }))
      .setOrigin(0.5)
      .setDepth(20)
      .setAlpha(0);
    this.tweens.add({ targets: tag, alpha: 1, duration: 600, delay: 900 });

    // a saucer hovering over the logo with a flickering beam
    const ufo = this.add.image(viewW(this) / 2 + 430, 70, 'ufo/ufo_6').setScale(0.85).setDepth(10).setAngle(8);
    this.tweens.add({ targets: ufo, y: 82, angle: -6, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: ufo, x: ufo.x + 18, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const ufo2 = this.add.image(viewW(this) / 2 - 420, 96, 'ufo/ufo_2').setScale(0.7).setDepth(10).setAngle(-8);
    this.tweens.add({ targets: ufo2, y: 108, angle: 6, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // -------------------------------------------------------------------------------------------------------------
  // buttons
  // -------------------------------------------------------------------------------------------------------------

  private buildButtons(): void {
    const W = viewW(this);
    const y = viewH(this) - 60 - SAFE.b;
    const upgrades = new Button(this, W / 2 - 294, y, {
      width: 240, height: 70, label: 'Upgrades', icon: 'ui_upgrade', style: 'secondary', fontSize: 32,
      onClick: () => fadeTo(this, () => this.scene.start('Upgrades', { returnTo: 'Title' })),
    });
    const play = new Button(this, W / 2, y - 4, {
      width: 300, height: 92, label: 'PLAY', icon: 'ui_play', style: 'success', fontSize: 54, radius: 30,
      onClick: () => this.play(),
    });
    const settings = new Button(this, W / 2 + 294, y, {
      width: 240, height: 70, label: 'Settings', icon: 'ui_gear', style: 'secondary', fontSize: 32,
      onClick: () => this.openSettings(),
    });
    const credits = new IconButton(this, W - 52 - SAFE.r, viewH(this) - 52 - SAFE.b, 'ui_credits', () => this.openCredits(), { width: 62, height: 62, iconScale: 0.36, style: 'ghost' });
    [upgrades, play, settings, credits].forEach((b, i) => {
      const ty = b.y;
      b.setY(ty + 140).setAlpha(0);
      this.tweens.add({ targets: b, y: ty, alpha: 1, duration: 520, delay: 500 + i * 110, ease: 'Back.easeOut' });
    });
    this.tweens.add({ targets: play, scale: { from: 1, to: 1.035 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 1400 });
  }

  private buildStarChip(): void {
    const earned = starsEarned(getSave());
    if (earned <= 0) return;
    const c = this.add.container(118 + SAFE.l, 42 + SAFE.t);
    const g = this.add.graphics();
    g.fillStyle(COLORS.ink, 0.35);
    g.fillRoundedRect(-92, -24 + 4, 184, 48, 24);
    g.fillStyle(COLORS.ink, 1);
    g.fillRoundedRect(-92, -24, 184, 48, 24);
    g.fillStyle(0x3d3150, 1);
    g.fillRoundedRect(-88, -20, 176, 40, 20);
    const star = this.add.image(-60, 0, 'ui_star').setDisplaySize(36, 36);
    const t = this.add.text(8, 0, `${earned} / 30`, textStyle(28, COLORS.textGold)).setOrigin(0.5);
    c.add([g, star, t]).setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 500, delay: 900 });
  }

  private play(): void {
    if (this.modalOpen || this.scene.isActive('Settings') || this.clickToStart) return;
    fadeTo(this, () => this.scene.start('LevelSelect'));
  }

  private openSettings(): void {
    if (this.modalOpen) return;
    this.scene.launch('Settings', { returnTo: 'Title' });
  }

  private openCredits(): void {
    if (this.modalOpen) return;
    this.modalOpen = true;
    const lines: [string, string][] = [
      ['Art', 'Isometric Tower Defense Pack by Artyom Zagorskiy (CC0). The Mothership sprite was generated to match the pack.'],
      ['Sound effects', 'Kenney.nl (CC0): Interface Sounds, UI Audio, Impact Sounds, Digital Audio, RPG Audio, Sci-fi Sounds, Music Jingles.'],
      ['Music', 'The Old Tower Inn by RandomMind  |  Grasslands by Juhani Junkala (SubspaceAudio)  |  Adventure Time by Scribe  |  Boss Battle #2 by nene  (OpenGameArt, CC0).'],
      ['Font', 'Lilita One by Juan Montoreano (SIL Open Font License).'],
      ['Engine', 'Made with Phaser 3, TypeScript and Vite.'],
    ];
    openModal(this, {
      title: 'Credits',
      width: 980,
      height: 648,
      closeOnBackdrop: true,
      onClose: () => (this.modalOpen = false),
      build: (m) => {
        let y = m.top + 14;
        for (const [head, body] of lines) {
          const h = this.add.text(-m.width / 2 + 54, y, head, textStyle(26, COLORS.textGold)).setOrigin(0, 0);
          const b = this.add
            .text(-m.width / 2 + 54, y + 32, body, textStyle(23, COLORS.text, { strokeThickness: 0, wordWrap: { width: m.width - 108 }, lineSpacing: 2 }))
            .setOrigin(0, 0);
          m.root.add([h, b]);
          y += 32 + b.height + 10;
        }
      },
      buttons: [
        ...(hasFlag(getSave(), 'endingSeen')
          ? [{ label: 'Watch ending', icon: 'ui_play', style: 'success' as const, width: 280, onClick: () => fadeTo(this, () => this.scene.start('Ending', { returnTo: 'Title' })) }]
          : []),
        { label: 'Close', style: 'primary' as const, width: 220 },
      ],
    });
  }

  // -------------------------------------------------------------------------------------------------------------
  // "click to start" (browsers block audio until a gesture)
  // -------------------------------------------------------------------------------------------------------------

  private showClickToStart(): void {
    this.clickToStart = true;
    const root = this.add.container(0, 0).setDepth(2000);
    const cx = viewW(this) / 2;
    const cy = viewH(this) / 2;
    const dim = this.add.rectangle(cx, cy, viewW(this), viewH(this), 0x120c1c, 0.74).setInteractive();
    const t = this.add.text(cx, cy - 6, 'CLICK TO START', textStyle(84, COLORS.textGold, { strokeThickness: 14 })).setOrigin(0.5);
    const sub = this.add.text(cx, cy + 70, 'to enable sound', textStyle(26, '#ffe9bf')).setOrigin(0.5);
    const ufo = this.add.image(cx, cy - 130, 'ufo/ufo_1').setScale(1.1);
    root.add([dim, ufo, t, sub]);
    this.tweens.add({ targets: t, scale: 1.06, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: ufo, y: ufo.y - 12, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    let gone = false;
    const dismiss = (): void => {
      if (gone) return;
      gone = true;
      // the same key press must not also count as "Play"
      this.time.delayedCall(80, () => (this.clickToStart = false));
      this.tweens.add({ targets: root, alpha: 0, duration: 260, onComplete: () => root.destroy() });
    };
    dim.once('pointerdown', dismiss);
    this.sound.once(Phaser.Sound.Events.UNLOCKED, dismiss);
    this.input.keyboard?.once('keydown', dismiss);
  }

  // -------------------------------------------------------------------------------------------------------------
  // diorama
  // -------------------------------------------------------------------------------------------------------------

  private buildDiorama(): void {
    const scale = 0.44;
    const island = (this.island = buildIsland(this, viewW(this) / 2, viewH(this) / 2 + 48, { rows: DIORAMA_ROWS, biome: 'spring', scale, seed: 11 }));
    island.root.setDepth(1);
    island.root.setAlpha(0).setY(island.root.y + 40);
    this.tweens.add({ targets: island.root, alpha: 1, y: island.root.y - 40, duration: 700, ease: 'Back.easeOut', delay: 250 });

    // gentle floating bob of the whole island
    this.time.delayedCall(1000, () => {
      this.tweens.add({ targets: island.root, y: island.root.y - 7, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });

    // towers on build spots: [col,row,kind]
    const spots: [number, number, 'archer' | 'wizard' | 'bomb'][] = [
      [3, 0, 'archer'], [1, 2, 'wizard'], [4, 2, 'archer'], [3, 4, 'bomb'],
    ];
    for (const [col, row, kind] of spots) {
      const key = kind === 'archer' ? 'towers/archer_level_3' : kind === 'wizard' ? 'towers/wizard_level_3' : 'towers/bomb_level_3';
      const img = this.add.image(0, 0, key).setScale(scale * 0.95).setOrigin(0.5, kind === 'wizard' ? 0.82 : kind === 'bomb' ? 0.76 : 0.84);
      island.addProp(col, row, img, 5, 0, 4);
      const p = island.cellPos(col, row);
      if (kind !== 'bomb') {
        this.turrets.push({
          kind, x: p.x, y: p.y - 34, cooldown: Math.random() * 1.2, rate: kind === 'archer' ? 1.15 : 1.9,
          range: kind === 'archer' ? 230 : 210, sprite: img,
        });
      }
    }

    // enemy route in island-local coordinates (extended a bit past both ends so UFOs fly in/out)
    const pts = ROAD_CELLS.map(([c, r]) => island.cellPos(c, r));
    const first = pts[0], second = pts[1], last = pts[pts.length - 1], beforeLast = pts[pts.length - 2];
    this.pathPts = [
      // half a cell past each end (not a full one): UFOs fade in/out there and must not climb into the tagline above
      { x: first.x - (second.x - first.x) * 0.5, y: first.y - (second.y - first.y) * 0.5 },
      ...pts,
      { x: last.x + (last.x - beforeLast.x) * 0.5, y: last.y + (last.y - beforeLast.y) * 0.5 },
    ];
    this.pathLen = [0];
    for (let i = 1; i < this.pathPts.length; i++) {
      const a = this.pathPts[i - 1], b = this.pathPts[i];
      this.pathLen.push(this.pathLen[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    this.totalLen = this.pathLen[this.pathLen.length - 1];

    const walkerKinds = ['ufo/ufo_1', 'ufo/ufo_2', 'ufo/ufo_4', 'ufo/ufo_1', 'ufo/ufo_5'];
    walkerKinds.forEach((key, i) => this.addFlier(key, 'walker', { dist: -i * 95 - 30, speed: 34 + (key === 'ufo/ufo_2' ? 20 : 0), hover: 16 }));
    // high fliers circling above the island
    // (kept below the tagline: the highest point of an orbit must stay clear of the text above the island)
    this.addFlier('ufo/ufo_3', 'circler', { phase: 0, cx: -20, cy: -84, rx: 230, ry: 24, rate: 0.5, hover: 0 });
    this.addFlier('ufo/ufo_6', 'circler', { phase: 2.4, cx: 70, cy: -78, rx: 280, ry: 20, rate: -0.32, hover: 0, scale: 0.9 });
  }

  private addFlier(
    key: string,
    kind: 'walker' | 'circler',
    o: Partial<Flier> & { scale?: number },
  ): void {
    const baseScale = (o.scale ?? 0.58) * (kind === 'circler' ? 1 : 1);
    const img = this.add.image(0, 0, key).setScale(baseScale).setOrigin(0.5, kind === 'circler' ? 0.5 : 0.86);
    this.island.root.add(img);
    img.setDepth(9000);
    this.fliers.push({
      img, kind, dist: o.dist ?? 0, speed: o.speed ?? 0, phase: o.phase ?? 0, rx: o.rx ?? 0, ry: o.ry ?? 0,
      cx: o.cx ?? 0, cy: o.cy ?? 0, rate: o.rate ?? 0, hover: o.hover ?? 0, lastSum: -1, baseScale,
    });
    this.island.root.sort('depth');
  }

  private pathAt(d: number): { x: number; y: number } {
    const L = this.totalLen;
    const t = ((d % L) + L) % L;
    let i = 1;
    while (i < this.pathLen.length - 1 && this.pathLen[i] < t) i++;
    const a = this.pathPts[i - 1], b = this.pathPts[i];
    const seg = this.pathLen[i] - this.pathLen[i - 1] || 1;
    const f = (t - this.pathLen[i - 1]) / seg;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }

  update(time: number, delta: number): void {
    const dt = delta / 1000;
    const s = this.island?.scale ?? 0.4;
    let resort = false;
    for (const f of this.fliers) {
      let gx: number, gy: number;
      if (f.kind === 'walker') {
        f.dist += f.speed * dt;
        const p = this.pathAt(f.dist);
        gx = p.x;
        gy = p.y;
        if (f.dist > this.totalLen) f.dist -= this.totalLen + 120; // loop with a pause
        const visible = f.dist >= 0;
        f.img.setVisible(visible);
        f.img.setAlpha(Phaser.Math.Clamp(f.dist / 60, 0, 1) * Phaser.Math.Clamp((this.totalLen - f.dist) / 60, 0, 1));
      } else {
        const a = f.phase + (time / 1000) * f.rate;
        gx = f.cx + Math.cos(a) * f.rx;
        gy = f.cy + Math.sin(a) * f.ry;
      }
      const bob = Math.sin(time / 420 + f.phase * 3 + f.dist * 0.01) * 4;
      if (f.kind === 'walker') {
        f.img.setPosition(gx, gy - f.hover + bob);
        const sum = Math.round(gy / (PITCH_Y * s) + 4.5);
        if (sum !== f.lastSum) {
          f.lastSum = sum;
          f.img.setDepth(sum * 10 + 8);
          resort = true;
        }
      } else {
        f.img.setPosition(gx, gy + bob);
        f.img.setDepth(9000);
        f.img.setAngle(Math.cos(f.phase + (time / 1000) * f.rate) * -5 * Math.sign(f.rate));
      }
    }
    if (resort) this.island.root.sort('depth');

    for (const t of this.turrets) {
      t.cooldown -= dt;
      if (t.cooldown > 0) continue;
      const target = this.fliers
        .filter((f) => f.img.visible)
        .map((f) => ({ f, d: Math.hypot(f.img.x - t.x, f.img.y - t.y) }))
        .filter((e) => e.d < t.range)
        .sort((a, b) => a.d - b.d)[0];
      if (!target) {
        t.cooldown = 0.25;
        continue;
      }
      t.cooldown = t.rate * (0.85 + Math.random() * 0.3);
      this.shoot(t, target.f);
    }
  }

  private shoot(t: Turret, f: Flier): void {
    const root = this.island.root;
    const key = t.kind === 'archer' ? 'towers/arrow' : 'towers/wizard_bullet';
    const proj = this.add.image(t.x, t.y, key).setDepth(9500).setScale(t.kind === 'archer' ? 0.55 : 1.4);
    root.add(proj);
    const dur = 320;
    const tx = f.img.x, ty = f.img.y;
    if (t.kind === 'archer') proj.setRotation(Math.atan2(ty - t.y, tx - t.x) + Math.PI / 2);
    // little recoil on the tower
    this.tweens.add({ targets: t.sprite, scaleY: t.sprite.scaleY * 0.96, duration: 70, yoyo: true });
    const o = { k: 0 };
    this.tweens.add({
      targets: o,
      k: 1,
      duration: dur,
      ease: 'Sine.easeIn',
      onUpdate: () => {
        // follow the (moving) target
        proj.setPosition(t.x + (f.img.x - t.x) * o.k, t.y + (f.img.y - t.y) * o.k - Math.sin(o.k * Math.PI) * (t.kind === 'archer' ? 22 : 6));
      },
      onComplete: () => {
        proj.destroy();
        if (!f.img.scene) return;
        f.img.setTintFill(0xffffff);
        this.time.delayedCall(70, () => f.img.scene && f.img.clearTint());
        const p = root;
        sparkBurst(this, p.x + f.img.x, p.y + f.img.y, { count: 6, radius: 26, size: 16, colors: t.kind === 'wizard' ? [0x9be2ff, 0xffffff, 0xb08cff] : [0xffd34e, 0xfff4d6], depth: 120, duration: 400 });
        this.tweens.add({ targets: f.img, scale: f.baseScale * 1.1, duration: 70, yoyo: true });
      },
    });
  }
}

