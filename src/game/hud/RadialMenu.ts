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
  /** An owned (permanent) choice: drawn with a gold ring. */
  owned?: boolean;
  /** Small text on the disc corner (e.g. "L2"). */
  badge?: string;
  cost?: () => number | null;
  state: () => ItemState;
  tip: () => TipSpec;
  /** One-word role shown under the icon (touch screens have no hover tooltip). */
  role?: string;
  /** Destructive items: the first tap only arms the button and shows this text, a second tap runs `onSelect`. */
  confirmText?: () => string;
  onSelect: () => void;
  onHover?: (over: boolean) => void;
}

const BTN_R = 31;
const RING_R = 70;
/** 4+ buttons: a wider ring, so cost chips and role labels of neighbours never touch. */
const RING_R4 = 80;
/** Touch: holding an icon this long shows its stats (and range) instead of choosing it. */
const LONG_PRESS_MS = 350;
/** Presses landing this soon after the ring opened are the opening tap's own leftovers. */
const OPEN_GUARD_MS = 150;
/** An armed (confirm) button disarms itself after this long. */
const ARM_MS = 4000;

interface Btn {
  item: RadialItem;
  c: Phaser.GameObjects.Container;
  disc: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image;
  lock: Phaser.GameObjects.Image;
  costBox: Phaser.GameObjects.Container;
  costText: Phaser.GameObjects.Text;
  coin: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  longTimer?: number;
  longPressed: boolean;
  downStamp: number;
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
  private armed = -1;
  private armTimer?: Phaser.Time.TimerEvent;
  private openedAt = 0;
  open_ = false;
  private u = 1;
  private R = RING_R;

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
    const n = items.length;
    const R = n >= 4 ? RING_R4 : RING_R;
    this.R = R;
    // the backdrop is a slightly tall ellipse centred a bit below the anchor: the bottom button's cost chip + role label hang under it
    const rx = R + BTN_R + 14;
    const ry = rx + 20;
    const dy = 12;
    const mx = (rx + 8) * u;
    const my = (R + BTN_R + 12) * u;
    const x = Phaser.Math.Clamp(ax, mx + SAFE.l, GAME_W - mx - SAFE.r);
    const y = Phaser.Math.Clamp(ay, my + 40 + 20 * u + SAFE.t, GAME_H - (R + BTN_R + 56) * u - 4 - SAFE.b);
    this.anchor = { x, y };
    const s = this.scene;
    const root = s.add.container(x, y).setDepth(DEPTH.menu);
    this.root = root;
    this.open_ = true;
    this.armed = -1;
    this.openedAt = performance.now();

    const disc = s.add.graphics();
    disc.fillStyle(0x1b1226, 0.55).fillEllipse(0, dy, rx * 2, ry * 2);
    disc.lineStyle(4, COLORS.ink, 0.9).strokeEllipse(0, dy, rx * 2, ry * 2);
    disc.lineStyle(2, 0xffffff, 0.15).strokeEllipse(0, dy, rx * 2 - 8, ry * 2 - 8);
    root.add(disc);
    root.setScale(0.55 * u).setAlpha(0);
    s.tweens.add({ targets: root, scale: u, alpha: 1, duration: 220, ease: 'Back.easeOut' });

    const angles = n === 1 ? [-90] : n === 2 ? [-90, 90] : n === 3 ? [-90, 30, 150] : items.map((_, i) => -90 + (360 / n) * i);
    this.btns = items.map((item, i) => {
      const a = (angles[i] * Math.PI) / 180;
      const bx = Math.cos(a) * R;
      const by = Math.sin(a) * R;
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
      const label = s.add.text(0, BTN_R + 30, '', { ...textStyle(15, '#ffffff'), stroke: '#1b1226', strokeThickness: 4 }).setOrigin(0.5);
      c.add([dg, icon, lock, costBox, label]);
      if (item.badge) {
        const bt = s.add.text(BTN_R * 0.62, -BTN_R * 0.7, item.badge, textStyle(14)).setOrigin(0.5);
        c.add(bt);
      }
      c.setSize(BTN_R * 2, BTN_R * 2).setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Circle(BTN_R, BTN_R, BTN_R + 4), hitAreaCallback: Phaser.Geom.Circle.Contains });
      markHud(c);
      (c as { __keep?: boolean }).__keep = true;
      const btn: Btn = { item, c, disc: dg, icon, lock, costBox, costText, coin, label, longPressed: false, downStamp: 0, hovered: false, pressed: false, lastState: '', lastCost: undefined };
      c.setScale(0);
      s.tweens.add({ targets: c, scale: 1, delay: 40 + i * 55, duration: 260, ease: 'Back.easeOut' });
      c.on('pointerover', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch) this.hover(i, true);
      });
      c.on('pointerout', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch) this.hover(i, false);
        else this.cancelPress(i);
      });
      c.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (performance.now() - this.openedAt < OPEN_GUARD_MS) return;
        btn.pressed = true;
        btn.longPressed = false;
        btn.downStamp = p.event ? (p.event as Event).timeStamp : performance.now();
        s.tweens.add({ targets: c, scale: 0.92, duration: 60 });
        if (p.wasTouch) {
          btn.longTimer = window.setTimeout(() => {
            if (!btn.pressed) return;
            btn.longPressed = true;
            this.hover(i, true);
          }, LONG_PRESS_MS);
        }
      });
      c.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (!btn.pressed) return;
        // judge the hold by the input events' own timestamps: a busy frame must not turn a quick tap into a long-press
        const held = p.wasTouch && p.event ? (p.event as Event).timeStamp - btn.downStamp : 0;
        const wasLong = btn.longPressed && held >= LONG_PRESS_MS;
        this.cancelPress(i, true);
        if (wasLong) return; // a long-press only inspects
        this.choose(i);
      });
      root.add(c);
      this.refreshBtn(btn, 0, true);
      return btn;
    });
  }

  /** Aborts a press (finger slid off / released); a running long-press preview ends. */
  private cancelPress(i: number, released = false): void {
    const b = this.btns[i];
    if (!b) return;
    window.clearTimeout(b.longTimer);
    b.longTimer = undefined;
    const wasLong = b.longPressed;
    const wasPressed = b.pressed;
    b.pressed = false;
    b.longPressed = false;
    if (wasPressed) this.scene.tweens.add({ targets: b.c, scale: released && !wasLong ? 1.1 : 1, duration: 90, ease: 'Back.easeOut' });
    if (wasLong) this.hover(i, false);
  }

  private disarm(): void {
    this.armed = -1;
    this.armTimer?.remove();
    this.armTimer = undefined;
  }

  private choose(i: number): void {
    const b = this.btns[i];
    if (!b) return;
    const item = b.item;
    if (item.confirmText && this.armed !== i) {
      this.disarm();
      this.armed = i;
      this.armTimer = this.scene.time.delayedCall(ARM_MS, () => this.disarm());
      Audio.sfx('ui_click');
      return;
    }
    this.disarm();
    if (item.state() === 'ok') Audio.sfx('ui_click');
    item.onSelect();
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
    const off = (this.R + BTN_R + 24) * this.u;
    this.hud.tooltip.show(b.item.tip(), this.anchor.x + (side === 'right' ? off : -off), this.anchor.y, side);
  }

  private refreshBtn(b: Btn, _time: number, force = false): void {
    const st = b.item.state();
    const cost = b.item.cost ? b.item.cost() : null;
    const idx = this.btns.indexOf(b);
    const armed = idx === this.armed;
    const key = `${st}|${b.hovered}|${cost}|${armed}`;
    if (!force && key === b.lastState) return;
    b.lastState = key;
    const base = armed ? 0xc0392b : (b.item.color ?? 0x4b3b6b);
    const fill = st === 'ok' ? (b.hovered ? lighten(base, 30) : base) : darken(base, 38);
    const g = b.disc;
    g.clear();
    g.fillStyle(COLORS.ink, 1).fillCircle(0, 0, BTN_R + 3.5);
    g.fillStyle(st === 'ok' ? fill : 0x3a3347, 1).fillCircle(0, 0, BTN_R);
    g.fillStyle(0xffffff, st === 'ok' ? 0.16 : 0.05).fillEllipse(0, -BTN_R * 0.42, BTN_R * 1.5, BTN_R * 0.8);
    if (b.item.owned) g.lineStyle(4, 0xffd34e, 1).strokeCircle(0, 0, BTN_R + 4.5);
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
    if (armed && b.item.confirmText) b.label.setText(b.item.confirmText()).setColor('#ffd0c8');
    else b.label.setText(b.item.role ?? '').setColor('#ffffff');
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
    for (const b of this.btns) window.clearTimeout(b.longTimer);
    this.disarm();
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
