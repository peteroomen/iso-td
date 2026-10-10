import Phaser from 'phaser';
import { applyViewCamera } from '../ui/viewport';
import { getLevel, hasFlag, isLevelUnlocked, starsAvailable, starsEarned, withFlag, type Biome, type SaveData } from '../../core';
import { Audio } from '../services/audio';
import { getSave, updateSave } from '../services/save';
import { COLORS, SAFE, UI_SCALE, textStyle, viewH, viewW } from '../ui/theme';
import { addSky } from '../ui/background';
import { buildIsland, type Island, type IslandSpec } from '../ui/isoScenery';
import {
  Button,
  IconButton,
  StarRow,
  Tooltip,
  addHeaderBar,
  starChip,
  drawOutlinedRect,
  ensureUi,
  fadeIn,
  fadeTo,
  openModal,
  ringPulse,
  sparkBurst,
  speechBubble,
  type SpeechBubble,
} from '../ui/widgets';
import { unlockBanner, unlockToast } from '../ui/unlockUi';
import {
  BIOME_COLORS,
  BIOME_NAMES,
  KINDS,
  fitImage,
  levelNodes,
  levelOrder,
  metaSave,
  pendingUnlocks,
  towerName,
  towerSprite,
  unlockFlag,
  type LevelNode,
  type TowerIconKind,
  type TowerUnlock,
} from './metaData';

export interface LevelSelectData {
  /** Level id that was just won (triggers the star / unlock animations). */
  completed?: string;
  /** Stars gained over the previous best for that level. */
  starsGained?: number;
}

interface IslandDef {
  name: string;
  biome: Biome | 'mixed';
  cx: number;
  cy: number;
  scale: number;
  rows: string[];
  biomeMap?: string[];
  seed: number;
  /** level index -> [col,row] */
  nodes: Record<number, [number, number]>;
  labelY: number;
}

const SCALE = 0.4;
const ISLANDS: IslandDef[] = [
  {
    name: BIOME_NAMES.spring, biome: 'spring', cx: 214, cy: 478, scale: SCALE, seed: 3, labelY: 662,
    rows: [' .T. ', '.d..T', '..r..', 'T...d', ' .d. '],
    nodes: { 0: [1, 4], 1: [3, 3], 2: [3, 1] },
  },
  {
    name: BIOME_NAMES.desert, biome: 'desert', cx: 640, cy: 340, scale: SCALE, seed: 5, labelY: 520,
    rows: [' .T. ', '.dr..', 'T...r', '.r..T', ' .d. '],
    nodes: { 3: [1, 4], 4: [2, 2], 5: [3, 0] },
  },
  {
    name: BIOME_NAMES.winter, biome: 'winter', cx: 1066, cy: 478, scale: SCALE, seed: 9, labelY: 662,
    rows: [' .T. ', '.T...', '..r..', '.d..T', ' .T. '],
    nodes: { 6: [0, 3], 7: [3, 3], 8: [4, 1] },
  },
  {
    name: BIOME_NAMES.mixed, biome: 'spring', cx: 1076, cy: 228, scale: 0.46, seed: 13, labelY: 352,
    rows: ['.c.', '...', '.c.'],
    biomeMap: ['sdd', 'sdw', 'dww'],
    nodes: { 9: [1, 1] },
  },
];

interface NodeView {
  node: LevelNode;
  root: Phaser.GameObjects.Container;
  badge: Phaser.GameObjects.Graphics;
  face: Phaser.GameObjects.Container;
  number: Phaser.GameObjects.Text;
  lock: Phaser.GameObjects.Image;
  stars: StarRow;
  marker: Phaser.GameObjects.Container;
  glow: Phaser.GameObjects.Image;
  mothership?: Phaser.GameObjects.Image;
  wrapIndex: number;
  local: { x: number; y: number };
  state: 'locked' | 'open' | 'done';
}

export class LevelSelectScene extends Phaser.Scene {
  private save!: SaveData;
  private nodes: LevelNode[] = [];
  private views: NodeView[] = [];
  private wraps: Phaser.GameObjects.Container[] = [];
  private islands: Island[] = [];
  private routeGfx!: Phaser.GameObjects.Graphics;
  private tooltip!: Tooltip;
  private upgradesBtn!: Button;
  private starChipText!: Phaser.GameObjects.Text;
  private badgeText!: Phaser.GameObjects.Text;
  private badge!: Phaser.GameObjects.Container;
  private modalOpen = false;
  private intro: LevelSelectData = {};
  private routeDone: boolean[] = [];
  private upgradesTip?: SpeechBubble;
  /** Island layout for the live canvas size (the ISLANDS table is the 1280x720 design). */
  private defs: IslandDef[] = ISLANDS;
  /** Header / node scale on small screens (keeps touch targets near 44 CSS px). */
  private hs = 1;

  constructor() {
    super('LevelSelect');
  }

  init(data: LevelSelectData): void {
    this.intro = data ?? {};
  }

  create(): void {
    applyViewCamera(this);
    ensureUi(this);
    // beating the last level for the first time plays the ending before the map comes back
    const order = levelOrder();
    const real = getSave();
    if (this.intro.completed === order[order.length - 1] && real.levels[this.intro.completed]?.completed && !hasFlag(real, 'endingSeen')) {
      updateSave((sv) => withFlag(sv, 'endingSeen'));
      this.scene.start('Ending', { returnTo: 'LevelSelect' });
      return;
    }
    this.upgradesTip = undefined;
    this.hs = Math.min(1.3, UI_SCALE);
    this.defs = this.layoutDefs();
    this.views = [];
    this.wraps = [];
    this.islands = [];
    this.modalOpen = false;
    this.save = metaSave();
    this.nodes = levelNodes();
    Audio.music('music_menu');
    addSky(this, 'day', { clouds: 6 });
    fadeIn(this);

    this.buildIslands();
    this.routeGfx = this.add.graphics().setDepth(5);
    this.buildNodes();
    this.buildHeader();
    this.tooltip = new Tooltip(this);

    this.input.keyboard?.on('keydown-ESC', () => {
      if (!this.modalOpen && !this.scene.isActive('Settings')) this.backToTitle();
    });
    this.applyIntro();
  }

  // -------------------------------------------------------------------------------------------------------------
  // world
  // -------------------------------------------------------------------------------------------------------------

  /** Spreads the design-space islands over the live canvas: wider phones push them apart, taller screens space them out. */
  private layoutDefs(): IslandDef[] {
    const W = viewW(this);
    const H = viewH(this);
    const kx = Math.min(1.5, Math.max(1, W / 1280));
    const ky = Math.min(1.35, Math.max(1, H / 720));
    const grow = Math.min(1.25, Math.max(1, Math.min(kx, ky)));
    const headerExtra = 92 * (this.hs - 1);
    const mapX = (x: number): number => W / 2 + (x - 640) * kx;
    const mapY = (y: number): number => H / 2 + (y - 360) * ky + headerExtra + 12;
    return ISLANDS.map((d) => ({ ...d, cx: mapX(d.cx), cy: mapY(d.cy), labelY: mapY(d.labelY), scale: d.scale * grow }));
  }

  private buildIslands(): void {
    this.defs.forEach((def, i) => {
      const wrap = this.add.container(def.cx, def.cy).setDepth(2);
      // soft shadow far below the floating island
      const sh = this.add.ellipse(def.cx + 6, def.cy + 118 * (def.scale / SCALE) + 20, 330 * (def.scale / SCALE), 54, 0x2a3a66, 0.2).setDepth(1);
      this.tweens.add({ targets: sh, scaleX: 0.92, alpha: 0.14, duration: 2400 + i * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const spec: IslandSpec = { rows: def.rows, biome: def.biome === 'mixed' ? 'spring' : def.biome, scale: def.scale, seed: def.seed, biomeMap: def.biomeMap };
      const island = buildIsland(this, 0, 0, spec);
      wrap.add(island.root);
      this.wraps.push(wrap);
      this.islands.push(island);
      // entrance: islands rise in one after the other
      wrap.setAlpha(0).setY(def.cy + 60);
      this.tweens.add({ targets: wrap, alpha: 1, y: def.cy, duration: 650, ease: 'Back.easeOut', delay: 120 + i * 140 });
      this.time.delayedCall(900 + i * 140, () => {
        this.tweens.add({ targets: wrap, y: def.cy - 5, duration: 2300 + i * 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      });
      if (def.biome === 'spring' && def.rows.length === 3) return; // boss island has no banner (the mothership says it all)
      // name banner
      const banner = this.add.container(def.cx, def.labelY).setDepth(3);
      const w = def.name.length * 15 + 56;
      const g = this.add.graphics();
      drawOutlinedRect(g, -w / 2, -19, w, 38, 19, 0x3d3150, 4);
      g.fillStyle(BIOME_COLORS[def.biome === 'mixed' ? 'mixed' : def.biome], 1);
      g.fillCircle(-w / 2 + 22, 0, 7);
      const t = this.add.text(8, 0, def.name.toUpperCase(), textStyle(20, COLORS.text, { strokeThickness: 4 })).setOrigin(0.5);
      banner.add([g, t]);
      banner.setAlpha(0);
      this.tweens.add({ targets: banner, alpha: 1, duration: 500, delay: 600 + i * 140 });
    });
  }

  private islandOfNode(index: number): number {
    return this.defs.findIndex((d) => index in d.nodes);
  }

  private nodeState(n: LevelNode, save: SaveData = this.save): 'locked' | 'open' | 'done' {
    if (save.levels[n.id]?.completed) return 'done';
    return isLevelUnlocked(save, n.id, levelOrder()) ? 'open' : 'locked';
  }

  private buildNodes(): void {
    // when arriving with a fresh result, first draw the "before" state, then animate to the new one
    const before = this.beforeSave();
    for (const n of this.nodes) {
      const wi = this.islandOfNode(n.index);
      const def = this.defs[wi];
      const [c, r] = def.nodes[n.index];
      const p = this.islands[wi].cellPos(c, r);
      const local = { x: p.x, y: p.y - 3 };
      const root = this.add.container(local.x, local.y);
      this.wraps[wi].add(root);
      root.setDepth(100);

      const glow = this.add.image(0, 2, 'ui_glow').setDisplaySize(130, 130).setTint(0xfff2a0).setAlpha(0);
      const marker = this.add.container(0, -54);
      const arrow = this.add.graphics();
      arrow.fillStyle(COLORS.ink, 1);
      arrow.fillTriangle(-15, -12, 15, -12, 0, 12);
      arrow.fillRoundedRect(-15, -22, 30, 14, 4);
      arrow.fillStyle(0xffd34e, 1);
      arrow.fillTriangle(-10, -9, 10, -9, 0, 7);
      arrow.fillRoundedRect(-10, -17, 20, 10, 3);
      marker.add(arrow).setVisible(false);

      const face = this.add.container(0, 0);
      const badge = this.add.graphics();
      const number = this.add.text(0, -1, String(n.number), textStyle(n.boss ? 30 : 32, COLORS.text, { strokeThickness: 6 })).setOrigin(0.5);
      const lock = this.add.image(0, 0, 'ui_lock').setDisplaySize(36, 36);
      face.add([badge, number, lock]);
      const stars = new StarRow(this, 0, 42, 20, 0, 3, 2);

      let mothership: Phaser.GameObjects.Image | undefined;
      if (n.boss) {
        mothership = this.add.image(0, -44, 'ufo/mothership').setScale(0.4);
        this.tweens.add({ targets: mothership, y: mothership.y - 7, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        root.add([glow, mothership, face, stars, marker]);
        marker.setY(-92);
        number.setPosition(0, -1);
        // the mothership sits above the badge
      } else {
        root.add([glow, face, stars, marker]);
      }

      const view: NodeView = {
        node: n, root, badge, face, number, lock, stars, marker, glow, mothership, wrapIndex: wi, local,
        state: this.nodeState(n, before),
      };
      this.views.push(view);
      this.paintNode(view, view.state, Math.max(0, (this.save.levels[n.id]?.stars ?? 0) - (n.id === this.intro.completed ? this.intro.starsGained ?? 0 : 0)));
      this.wireNode(view);

      // pop-in
      root.setScale(0);
      this.tweens.add({ targets: root, scale: Math.min(1.2, this.hs), duration: 420, ease: 'Back.easeOut', delay: 500 + n.index * 70 });
    }
    this.routeDone = this.nodes.map((n) => this.nodeState(n, before) === 'done');
  }

  /** The save as it was before the level that was just completed (for the unlock animation). */
  private beforeSave(): SaveData {
    const id = this.intro.completed;
    if (!id) return this.save;
    const res = this.save.levels[id];
    if (!res) return this.save;
    const prevStars = res.stars - (this.intro.starsGained ?? 0);
    if (prevStars > 0) return this.save; // not a first clear: nothing newly unlocked
    const levels = { ...this.save.levels };
    delete levels[id];
    return { ...this.save, levels };
  }

  private paintNode(v: NodeView, state: 'locked' | 'open' | 'done', stars: number): void {
    v.state = state;
    const g = v.badge;
    g.clear();
    const R = v.node.boss ? 30 : 28;
    const palette = {
      locked: { ring: 0x6b6280, top: 0x8c83a1, bottom: 0x5d5470 },
      open: { ring: 0xffffff, top: 0x9be06a, bottom: 0x3f9b34 },
      done: { ring: 0xffe58a, top: 0xffd34e, bottom: 0xe48a14 },
    }[state];
    g.fillStyle(COLORS.ink, 0.35);
    g.fillCircle(2, 6, R + 5);
    g.fillStyle(COLORS.ink, 1);
    g.fillCircle(0, 0, R + 5);
    g.fillStyle(palette.bottom, 1);
    g.fillCircle(0, 0, R);
    g.fillStyle(palette.top, 1);
    g.fillCircle(0, -2.5, R - 3.5);
    g.fillStyle(0xffffff, state === 'locked' ? 0.12 : 0.3);
    g.fillEllipse(-5, -R + 11, R * 0.9, 8);
    v.number.setVisible(state !== 'locked');
    v.lock.setVisible(state === 'locked');
    if (v.node.boss) v.number.setPosition(0, -1);
    v.stars.setStars(state === 'done' ? stars : 0);
    v.stars.setVisible(state !== 'locked');
    v.marker.setVisible(state === 'open');
    v.glow.setAlpha(state === 'open' ? 0.85 : 0);
    if (v.mothership) {
      v.mothership.setTint(state === 'locked' ? 0x7a7090 : 0xffffff);
    }
    v.root.setData('pulse', state === 'open');
    this.updateMarkerTween(v);
  }

  private updateMarkerTween(v: NodeView): void {
    this.tweens.killTweensOf(v.marker);
    this.tweens.killTweensOf(v.glow);
    if (v.state !== 'open') return;
    const y0 = v.node.boss ? -92 : -54;
    v.marker.setY(y0);
    this.tweens.add({ targets: v.marker, y: y0 - 9, duration: 560, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: v.glow, alpha: 0.35, scale: v.glow.scale * 1.12, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private wireNode(v: NodeView): void {
    const r = v.node.boss ? 50 : 44;
    v.face.setSize(r * 2, r * 2);
    v.face.setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains);
    if (v.face.input) v.face.input.cursor = 'pointer';
    v.face.on('pointerover', () => {
      this.tweens.add({ targets: v.face, scale: 1.14, duration: 120, ease: 'Back.easeOut' });
      if (v.state !== 'locked') Audio.sfx('ui_hover', { volume: 0.5, throttleMs: 60 });
      const m = v.root.getWorldTransformMatrix();
      const stars = this.save.levels[v.node.id]?.stars ?? 0;
      const body =
        v.state === 'locked' ? `Win level ${v.node.number - 1} to unlock` : v.state === 'done' ? `Best: ${stars} / 3 stars` : v.node.def ? 'Click to play' : 'Coming soon';
      this.tooltip.show(`${v.node.number}. ${v.node.name}`, body, m.tx, m.ty - (v.node.boss ? 90 : 50));
    });
    v.face.on('pointerout', () => {
      this.tweens.add({ targets: v.face, scale: 1, duration: 120 });
      this.tooltip.hide();
    });
    v.face.on('pointerdown', () => {
      if (this.modalOpen) return;
      this.tweens.add({ targets: v.face, scale: 0.94, duration: 70, yoyo: true });
      if (v.state === 'locked') {
        Audio.sfx('ui_error', { volume: 0.6 });
        this.tweens.add({ targets: v.face, x: { from: -6, to: 0 }, duration: 260, ease: 'Elastic.easeOut' });
        return;
      }
      Audio.sfx('ui_click');
      this.tooltip.hide();
      this.openInfo(v.node);
    });
  }

  // -------------------------------------------------------------------------------------------------------------
  // route (dotted path through the nodes, redrawn every frame because the islands bob)
  // -------------------------------------------------------------------------------------------------------------

  private worldPos(v: NodeView): { x: number; y: number } {
    const w = this.wraps[v.wrapIndex];
    return { x: w.x + v.local.x, y: w.y + v.local.y + 2 };
  }

  update(): void {
    if (!this.routeGfx || this.views.length === 0) return;
    const g = this.routeGfx;
    g.clear();
    for (let i = 0; i < this.views.length - 1; i++) {
      const a = this.worldPos(this.views[i]);
      const b = this.worldPos(this.views[i + 1]);
      const cross = this.views[i].wrapIndex !== this.views[i + 1].wrapIndex;
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      // gentle arc; stronger between islands
      const bend = (cross ? 0.22 : 0.12) * (i % 2 === 0 ? -1 : 1);
      const cp = new Phaser.Math.Vector2((a.x + b.x) / 2 - dy * bend, (a.y + b.y) / 2 + dx * bend);
      const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(a.x, a.y), cp, new Phaser.Math.Vector2(b.x, b.y));
      const count = Math.max(3, Math.round(len / 17));
      const done = this.routeDone[i] === true;
      const pts = curve.getSpacedPoints(count);
      const skipEnds = 1.4;
      pts.forEach((p, k) => {
        if (k < skipEnds || k > count - skipEnds) return;
        const r = done ? 5.2 : 4.4;
        g.fillStyle(COLORS.ink, done ? 1 : 0.7);
        g.fillCircle(p.x, p.y + 1, r + 2);
        g.fillStyle(done ? 0xffd34e : 0xe9e0cc, done ? 1 : 0.85);
        g.fillCircle(p.x, p.y, r);
      });
    }
  }

  // -------------------------------------------------------------------------------------------------------------
  // header
  // -------------------------------------------------------------------------------------------------------------

  private buildHeader(): void {
    const hs = this.hs;
    const W = viewW(this);
    addHeaderBar(this, Math.round(92 * hs));

    const items: Phaser.GameObjects.GameObject[] = [];
    const hy = Math.round(44 * hs);
    const back = new Button(this, 104 * hs + SAFE.l, hy, { width: 170, height: 60, label: 'Menu', icon: 'ui_home', style: 'secondary', fontSize: 30, onClick: () => this.backToTitle() }).setScale(hs);
    const title = this.add.text(214 * hs + SAFE.l - 14 * (hs - 1), Math.round(46 * hs), 'WORLD MAP', textStyle(42, COLORS.textGold, { strokeThickness: 8 })).setOrigin(0, 0.5).setScale(hs);

    // star counter chip
    const earned = starsEarned(this.save) - (this.intro.completed ? this.intro.starsGained ?? 0 : 0);
    const { root: chip, label } = starChip(this, Math.max(W / 2 + 40, W - 444 * hs - SAFE.r), hy, `${earned} / 30`);
    chip.setScale(hs);
    this.starChipText = label;

    const gearX = W - 54 * hs - SAFE.r;
    const upX = gearX - (30 + 110 + 20) * hs;
    this.upgradesBtn = new Button(this, upX, hy, { width: 220, height: 60, label: 'Upgrades', icon: 'ui_upgrade', style: 'primary', fontSize: 30, onClick: () => this.openUpgrades() }).setScale(hs);
    const gear = new IconButton(this, gearX, hy, 'ui_gear', () => this.openSettings(), { width: 60, height: 60, iconScale: 0.4 }).setScale(hs);

    // unspent-stars badge on the Upgrades button
    this.badge = this.add.container(upX + 104 * hs, hy - 28 * hs).setScale(hs);
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.ink, 1);
    bg.fillCircle(0, 0, 18);
    bg.fillStyle(0xe5484d, 1);
    bg.fillCircle(0, 0, 14);
    this.badgeText = this.add.text(0, 0, '0', textStyle(20, COLORS.text, { strokeThickness: 3 })).setOrigin(0.5);
    this.badge.add([bg, this.badgeText]);
    this.refreshAvailable(false);

    items.push(back, title, chip, this.upgradesBtn, gear, this.badge);
    for (const it of items) {
      const o = it as unknown as Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Depth & Phaser.GameObjects.Components.Alpha;
      o.setDepth(60);
    }
    [back, title, chip, this.upgradesBtn, gear, this.badge].forEach((o, i) => {
      const t = o as unknown as Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Alpha;
      t.setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, duration: 400, delay: 200 + i * 60 });
    });
  }

  private refreshAvailable(pulse: boolean): void {
    const avail = starsAvailable(this.save);
    this.badge.setVisible(avail > 0);
    this.badgeText.setText(String(avail));
    this.upgradesBtn.pulse(pulse && avail > 0);
  }

  private backToTitle(): void {
    fadeTo(this, () => this.scene.start('Title'));
  }

  private openUpgrades(): void {
    if (this.modalOpen) return;
    this.hideUpgradesTip();
    fadeTo(this, () => this.scene.start('Upgrades', { returnTo: 'LevelSelect' }));
  }

  private openSettings(): void {
    if (this.modalOpen) return;
    this.scene.launch('Settings', { returnTo: 'LevelSelect' });
  }

  // -------------------------------------------------------------------------------------------------------------
  // level info
  // -------------------------------------------------------------------------------------------------------------

  private openInfo(n: LevelNode): void {
    this.modalOpen = true;
    this.hideUpgradesTip();
    const def = n.def ? getLevel(n.def.id) : undefined;
    const stars = this.save.levels[n.id]?.stars ?? 0;
    const biome = def?.biome ?? n.biome;
    const color = BIOME_COLORS[biome];
    // a tower tier that no earlier level offered: highlighted once, until Play is pressed
    const unlocks: TowerUnlock[] = def ? pendingUnlocks(getSave(), n.id) : [];
    const hasNew = unlocks.length > 0;
    const shift = hasNew ? 100 : 0;
    const isNew = (kind: string): boolean => unlocks.some((u) => u.kind === 'all' || u.kind === kind);
    openModal(this, {
      title: `${n.number}. ${n.name}`,
      width: 680,
      height: 548 + shift,
      closeOnBackdrop: true,
      onClose: () => (this.modalOpen = false),
      build: (m) => {
        const root = m.root;
        const top = m.top;
        // biome chip
        const chipW = BIOME_NAMES[biome].length * 13 + 56;
        const chip = this.add.graphics();
        drawOutlinedRect(chip, -chipW / 2, top + 4, chipW, 38, 19, mixTo(color), 4);
        const chipT = this.add.text(0, top + 23, BIOME_NAMES[biome], textStyle(22, COLORS.text, { strokeThickness: 4 })).setOrigin(0.5);
        root.add([chip, chipT]);

        // best stars
        const lbl = this.add.text(0, top + 64, 'BEST RESULT', textStyle(20, '#b9a9d6', { strokeThickness: 0 })).setOrigin(0.5);
        const row = new StarRow(this, 0, top + 104, 52, stars, 3, 10);
        root.add([lbl, row]);

        const waves = def?.waves.length;
        const info = this.add
          .text(0, top + 152, def ? `${waves} waves   |   ${def.lives} lives` : 'Coming soon', textStyle(26, COLORS.text, { strokeThickness: 4 }))
          .setOrigin(0.5);
        root.add(info);

        if (hasNew) {
          const banner = unlockBanner(this, 0, top + 226, 600, unlocks);
          banner.setScale(0.6).setAlpha(0);
          root.add(banner);
          this.tweens.add({ targets: banner, scale: 1, alpha: 1, duration: 420, delay: 260, ease: 'Back.easeOut' });
          this.time.delayedCall(260, () => Audio.sfx('upgrade_tower', { volume: 0.55 }));
        }

        if (def) {
          const label = this.add.text(0, top + 196 + shift, def.specsUnlocked ? 'TOWERS AVAILABLE  -  Lv3 towers can specialize' : 'TOWERS AVAILABLE', textStyle(20, '#b9a9d6', { strokeThickness: 0 })).setOrigin(0.5);
          root.add(label);
          const cap = def.towerCap;
          const cards: [TowerIconKind, number, string][] = KINDS.map((k) => [k, cap[k], towerName(k)]);
          const CW = 144;
          const step = CW + 12;
          cards.forEach(([kind, lv, name], i) => {
            const x = (i - (cards.length - 1) / 2) * step;
            const y = top + 306 + shift;
            const fresh = isNew(kind);
            const g = this.add.graphics();
            drawOutlinedRect(g, x - CW / 2, y - 78, CW, 156, 18, fresh ? 0x4b3a2a : 0x2a2038, 4);
            if (fresh) {
              g.lineStyle(3, COLORS.gold, 1);
              g.strokeRoundedRect(x - CW / 2 + 4, y - 74, CW - 8, 148, 15);
            }
            const img = fitImage(this.add.image(x, y - 16, towerSprite(kind, lv)), 88, 88);
            const nameT = this.add.text(x, y + 44, `${name} Lv${lv}`, textStyle(19, COLORS.textGold, { strokeThickness: 4 })).setOrigin(0.5);
            if (nameT.width > CW - 14) nameT.setScale((CW - 14) / nameT.width);
            // little pips for the level
            const pips = this.add.graphics();
            for (let k = 0; k < 3; k++) {
              pips.fillStyle(COLORS.ink, 1);
              pips.fillCircle(x - 18 + k * 18, y + 66, 6);
              pips.fillStyle(k < lv ? 0xffd34e : 0x5a4d68, 1);
              pips.fillCircle(x - 18 + k * 18, y + 66, 4);
            }
            root.add([g, img, nameT, pips]);
            if (fresh) {
              const tag = this.add.container(x + CW / 2 - 20, y - 70);
              const tg = this.add.graphics();
              drawOutlinedRect(tg, -27, -13, 54, 26, 13, 0xe5484d, 3);
              tag.add([tg, this.add.text(0, 0, 'NEW', textStyle(16, COLORS.text, { strokeThickness: 3 })).setOrigin(0.5)]);
              tag.setAngle(8);
              root.add(tag);
              this.tweens.add({ targets: tag, scale: 1.12, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            }
            img.setScale(0);
            this.tweens.add({ targets: img, scale: Math.min(88 / img.width, 88 / img.height), duration: 350, delay: 200 + i * 90, ease: 'Back.easeOut' });
          });
        }
      },
      buttons: [
        { label: 'Back', style: 'secondary', width: 190 },
        {
          label: def ? 'Play' : 'Soon',
          icon: def ? 'ui_play' : undefined,
          style: 'success',
          width: 260,
          keepOpen: true,
          onClick: () => {
            if (!def) return;
            if (hasNew) updateSave((sv) => withFlag(sv, unlockFlag(def.id)));
            fadeTo(this, () => this.scene.start('Game', { levelId: def.id }));
          },
        },
      ],
    }).buttons[1].setDisabled(!def);
  }

  // -------------------------------------------------------------------------------------------------------------
  // arrival animation after winning a level
  // -------------------------------------------------------------------------------------------------------------

  private applyIntro(): void {
    const id = this.intro.completed;
    // after any visit, make the Upgrades button hint at unspent stars
    if (!id) {
      this.refreshAvailable(true);
      this.maybeShowUpgradesTip(1400);
      return;
    }
    this.refreshAvailable(false);
    const v = this.views.find((x) => x.node.id === id);
    if (!v) {
      this.refreshAvailable(true);
      this.maybeShowUpgradesTip(1400);
      return;
    }
    const gained = this.intro.starsGained ?? 0;
    const total = this.save.levels[id]?.stars ?? 0;
    const prev = total - gained;
    let t = 900;
    this.time.delayedCall(t, () => {
      this.paintNode(v, 'done', prev);
      const p = this.worldPos(v);
      ringPulse(this, p.x, p.y, 0xffd34e, 60, 90);
      this.tweens.add({ targets: v.face, scale: { from: 0.8, to: 1 }, duration: 420, ease: 'Back.easeOut' });
    });
    for (let i = prev; i < total; i++) {
      v.stars.popStar(i, t + 250 + (i - prev) * 380);
    }
    t += 250 + Math.max(1, gained) * 380 + 200;
    // chip counter
    this.time.delayedCall(t - 300, () => {
      const earned = starsEarned(this.save);
      const o = { n: earned - gained };
      this.tweens.add({ targets: o, n: earned, duration: 500, onUpdate: () => this.starChipText.setText(`${Math.round(o.n)} / 30`) });
    });
    this.routeDone[v.node.index] = true;

    // unlock the next node
    const next = this.views[v.node.index + 1];
    let tipDelay = 600;
    if (next && next.state === 'locked') {
      this.time.delayedCall(t, () => {
        if (next.root.scene) this.unlockNode(next);
      });
      t += 900;
      // the next level brings a new tower tier: say so while the map is still celebrating
      const news = pendingUnlocks(getSave(), next.node.id);
      if (news.length) {
        this.time.delayedCall(t - 250, () => {
          if (!this.modalOpen) unlockToast(this, viewW(this) / 2, Math.round(134 * this.hs), news, 4200);
        });
        t += 1200;
        tipDelay = 4400;
      }
    }
    this.time.delayedCall(t, () => this.refreshAvailable(true));
    this.maybeShowUpgradesTip(t + tipDelay);
  }

  /** One-time speech bubble that points at the Upgrades button while there are unspent stars. */
  private maybeShowUpgradesTip(delay: number): void {
    this.time.delayedCall(delay, () => {
      const real = getSave();
      if (this.modalOpen || hasFlag(real, 'tip:upgrades') || starsAvailable(real) <= 0) return;
      updateSave((sv) => withFlag(sv, 'tip:upgrades'));
      const b = this.upgradesBtn;
      this.upgradesTip = speechBubble(this, b.x, b.y + b.btnHeight / 2 + 6, 'Spend stars on upgrades!', { tail: 'up', depth: 70, autoHideMs: 7000, tailX: -40 });
    });
  }

  private hideUpgradesTip(): void {
    this.upgradesTip?.hide();
    this.upgradesTip = undefined;
  }

  private unlockNode(v: NodeView): void {
    const pos = this.worldPos(v);
    Audio.sfx('upgrade_tower', { volume: 0.8 });
    // padlock shakes, then the badge pops into the open state
    this.tweens.add({
      targets: v.lock,
      angle: { from: -22, to: 22 },
      duration: 70,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.paintNode(v, 'open', 0);
        v.face.setScale(0.3);
        this.tweens.add({ targets: v.face, scale: 1, duration: 480, ease: 'Back.easeOut' });
        v.lock.setAngle(0);
        ringPulse(this, pos.x, pos.y, 0x9be06a, 64, 90);
        sparkBurst(this, pos.x, pos.y, { count: 12, radius: 54, size: 20, colors: [0x9be06a, 0xfff4d6, 0xffffff], depth: 95 });
      },
    });
  }
}

function mixTo(c: number): number {
  // slightly darkened chip fill so the cream label stays readable
  const r = ((c >> 16) & 255) * 0.78, g = ((c >> 8) & 255) * 0.78, b = (c & 255) * 0.78;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
