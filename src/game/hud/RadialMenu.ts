import Phaser from 'phaser';
import { Audio } from '../services/audio';
import { COLORS, GAME_H, GAME_W, SAFE, UI_SCALE, textStyle } from '../ui/theme';
import { TEX } from '../render/textures';
import { Hud } from './Hud';
import type { TipSpec } from './Tooltip';
import { DEPTH, darken, drawPanel, lighten, markHud } from './widgets';

export type ItemState = 'ok' | 'poor' | 'locked';

export interface RadialItem {
  icon: string;
  /** Icon height in px (default 40). */
  iconH?: number;
  /** Fill colour of the disc. */
  color?: number;
  /** Small text on the disc corner (e.g. "L2"). */
  badge?: string;
  cost?: () => number | null;
  state: () => ItemState;
  tip: () => TipSpec;
  onSelect: () => void;
  onHover?: (over: boolean) => void;
}

const BTN_R = 31;
const RING_R = 70;

interface Btn {
  item: RadialItem;
  c: Phaser.GameObjects.Container;
  disc: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image;
  lock: Phaser.GameObjects.Image;
  costBox: Phaser.GameObjects.Container;
  costText: Phaser.GameObjects.Text;
  coin: Phaser.GameObjects.Image;
  hovered: boolean;
  pressed: boolean;
  lastState: string;
  lastCost: number | null | undefined;
}

/** Kingdom-Rush style ring of round buttons around a build spot / tower. */
export class RadialMenu {
  private root?: Phaser.GameObjects.Container;
  private btns: Btn[] = [];
  private anchor = { x: 0, y: 0 };
  private selected = -1;
  open_ = false;
  private u = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly hud: Hud,
  ) {}

  get isOpen(): boolean {
    return this.open_;
  }

  get center(): { x: number; y: number } {
    return this.anchor;
  }

  open(ax: number, ay: number, items: RadialItem[]): void {
    this.close(true);
    const u = Math.min(UI_SCALE, 1.6);
    this.u = u;
    const margin = (RING_R + BTN_R + 26) * u;
    const x = Phaser.Math.Clamp(ax, margin + SAFE.l, GAME_W - margin - SAFE.r);
    const y = Phaser.Math.Clamp(ay, margin + 40 + 20 * u + SAFE.t, GAME_H - margin - 8 - SAFE.b);
    this.anchor = { x, y };
    const s = this.scene;
    const root = s.add.container(x, y).setDepth(DEPTH.menu);
    this.root = root;
    this.open_ = true;
    this.selected = -1;

    const disc = s.add.graphics();
    disc.fillStyle(0x1b1226, 0.5).fillCircle(0, 0, RING_R + BTN_R + 12);
    disc.lineStyle(4, COLORS.ink, 0.9).strokeCircle(0, 0, RING_R + BTN_R + 12);
    disc.lineStyle(2, 0xffffff, 0.15).strokeCircle(0, 0, RING_R + BTN_R + 8);
    root.add(disc);
    root.setScale(0.55 * u).setAlpha(0);
    s.tweens.add({ targets: root, scale: u, alpha: 1, duration: 220, ease: 'Back.easeOut' });

    const n = items.length;
    const angles = n === 1 ? [-90] : n === 2 ? [-90, 90] : n === 3 ? [-90, 30, 150] : items.map((_, i) => -90 + (360 / n) * i);
    this.btns = items.map((item, i) => {
      const a = (angles[i] * Math.PI) / 180;
      const bx = Math.cos(a) * RING_R;
      const by = Math.sin(a) * RING_R;
      const c = s.add.container(bx, by);
      const dg = s.add.graphics();
      const icon = s.add.image(0, -2, item.icon);
      icon.setScale((item.iconH ?? 40) / icon.height);
      const lock = s.add.image(0, 0, TEX.lock).setDisplaySize(30, 30).setVisible(false);
      const costBox = s.add.container(0, BTN_R + 4);
      const cg = s.add.graphics();
      const coin = s.add.image(-14, 0, TEX.coin).setScale(0.3);
      const costText = s.add.text(2, 0, '', textStyle(18, COLORS.textGold)).setOrigin(0, 0.5);
      costBox.add([cg, coin, costText]);
      c.add([dg, icon, lock, costBox]);
      if (item.badge) {
        const bt = s.add.text(BTN_R * 0.62, -BTN_R * 0.7, item.badge, textStyle(14)).setOrigin(0.5);
        c.add(bt);
      }
      c.setSize(BTN_R * 2, BTN_R * 2).setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Circle(BTN_R, BTN_R, BTN_R + 4), hitAreaCallback: Phaser.Geom.Circle.Contains });
      markHud(c);
      (c as { __keep?: boolean }).__keep = true;
      const btn: Btn = { item, c, disc: dg, icon, lock, costBox, costText, coin, hovered: false, pressed: false, lastState: '', lastCost: undefined };
      c.setScale(0);
      s.tweens.add({ targets: c, scale: 1, delay: 40 + i * 55, duration: 260, ease: 'Back.easeOut' });
      c.on('pointerover', () => this.hover(i, true));
      c.on('pointerout', () => this.hover(i, false));
      c.on('pointerdown', () => {
        btn.pressed = true;
        s.tweens.add({ targets: c, scale: 0.92, duration: 60 });
      });
      c.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (!btn.pressed) return;
        btn.pressed = false;
        s.tweens.add({ targets: c, scale: 1.1, duration: 90, ease: 'Back.easeOut' });
        // touch: first tap previews (tooltip + range), second tap confirms
        if (p.wasTouch && this.selected !== i) {
          this.selected = i;
          this.hover(i, true);
          return;
        }
        const st = item.state();
        if (st === 'ok') Audio.sfx('ui_click');
        item.onSelect();
      });
      root.add(c);
      this.refreshBtn(btn, 0, true);
      return btn;
    });
  }

  private hover(i: number, over: boolean): void {
    const b = this.btns[i];
    if (!b) return;
    b.hovered = over;
    this.scene.tweens.add({ targets: b.c, scale: over ? 1.12 : 1, duration: 100, ease: 'Quad.easeOut' });
    if (over) {
      Audio.sfx('ui_hover', { volume: 0.35, throttleMs: 90 });
      this.showTip(b);
    } else {
      this.hud.tooltip.hide();
    }
    b.item.onHover?.(over);
  }

  private showTip(b: Btn): void {
    const side = this.anchor.x < GAME_W / 2 ? 'right' : 'left';
    const off = (RING_R + BTN_R + 16) * this.u;
    this.hud.tooltip.show(b.item.tip(), this.anchor.x + (side === 'right' ? off : -off), this.anchor.y, side);
  }

  private refreshBtn(b: Btn, _time: number, force = false): void {
    const st = b.item.state();
    const cost = b.item.cost ? b.item.cost() : null;
    const key = `${st}|${b.hovered}|${cost}`;
    if (!force && key === b.lastState) return;
    b.lastState = key;
    const base = b.item.color ?? 0x4b3b6b;
    const fill = st === 'ok' ? (b.hovered ? lighten(base, 30) : base) : darken(base, 38);
    const g = b.disc;
    g.clear();
    g.fillStyle(COLORS.ink, 1).fillCircle(0, 0, BTN_R + 3.5);
    g.fillStyle(st === 'ok' ? fill : 0x3a3347, 1).fillCircle(0, 0, BTN_R);
    g.fillStyle(0xffffff, st === 'ok' ? 0.16 : 0.05).fillEllipse(0, -BTN_R * 0.42, BTN_R * 1.5, BTN_R * 0.8);
    if (b.hovered && st === 'ok') g.lineStyle(3, 0xffe27a, 1).strokeCircle(0, 0, BTN_R + 5);
    b.icon.setAlpha(st === 'ok' ? 1 : st === 'poor' ? 0.55 : 0.28);
    if (st === 'ok') b.icon.clearTint();
    else b.icon.setTint(0x9a93a8);
    b.lock.setVisible(st === 'locked');
    if (cost === null || cost === undefined || st === 'locked') {
      b.costBox.setVisible(false);
    } else {
      b.costBox.setVisible(true);
      b.costText.setText(String(cost)).setColor(st === 'poor' ? COLORS.textRed : COLORS.textGold);
      const w = 14 + 8 + b.costText.width + 10;
      const cg = b.costBox.list[0] as Phaser.GameObjects.Graphics;
      cg.clear();
      drawPanel(cg, -w / 2 - 6, -12, w + 12, 24, { r: 9, fill: 0x2c2240, bw: 3, gloss: false });
      b.coin.x = -w / 2 + 8;
      b.costText.x = -w / 2 + 20;
    }
    if (b.hovered) this.showTip(b);
  }

  update(time: number): void {
    if (!this.open_) return;
    for (const b of this.btns) this.refreshBtn(b, time);
  }

  close(instant = false): void {
    const root = this.root;
    if (!root) return;
    this.root = undefined;
    this.open_ = false;
    this.hud.tooltip.hide();
    // the scene may already be shutting down (resize restart): the objects are then destroyed and must not be touched
    const alive = !!root.scene;
    for (const b of this.btns) {
      if (alive && b.c.scene) b.c.disableInteractive();
      if (b.hovered) b.item.onHover?.(false);
    }
    this.btns = [];
    if (!alive) return;
    this.scene.tweens.killTweensOf(root);
    if (instant) {
      root.destroy();
      return;
    }
    this.scene.tweens.add({ targets: root, scale: 0.5 * this.u, alpha: 0, duration: 130, ease: 'Quad.easeIn', onComplete: () => root.destroy() });
  }
}
