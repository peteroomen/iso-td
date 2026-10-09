import Phaser from 'phaser';
import { COLORS, FONT, textStyle } from '../ui/theme';
import { Audio } from '../services/audio';
import type { TipSpec } from './Tooltip';

export const DEPTH = { hud: 100, bar: 120, menu: 200, banner: 260, tooltip: 300, toast: 350, overlay: 400, overlayTop: 450 } as const;

type Corners = number | { tl?: number; tr?: number; bl?: number; br?: number };

export interface PanelOpts {
  r?: number;
  fill?: number;
  border?: number;
  bw?: number;
  alpha?: number;
  gloss?: boolean;
}

/** Rounded panel with a dark outline, soft gloss and bottom shade (matches the sprite pack's look). */
export function drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, o: PanelOpts = {}): void {
  const r = o.r ?? 12;
  const bw = o.bw ?? 4;
  g.fillStyle(o.border ?? COLORS.ink, 1).fillRoundedRect(x - bw, y - bw, w + 2 * bw, h + 2 * bw, r + bw);
  g.fillStyle(o.fill ?? COLORS.panel, o.alpha ?? 1).fillRoundedRect(x, y, w, h, r);
  if (o.gloss !== false) {
    const rr: Corners = { tl: Math.max(2, r - 2), tr: Math.max(2, r - 2), bl: 4, br: 4 };
    g.fillStyle(0xffffff, 0.11).fillRoundedRect(x + 3, y + 3, w - 6, Math.max(6, Math.min(h * 0.4, 46)), rr);
    const sh = Math.min(h * 0.28, 30);
    g.fillStyle(0x000000, 0.16).fillRoundedRect(x + 3, y + h - sh, w - 6, sh - 3, { tl: 3, tr: 3, bl: Math.max(2, r - 2), br: Math.max(2, r - 2) });
  }
}

export function lighten(color: number, amt: number): number {
  const r = Math.min(255, ((color >> 16) & 255) + amt);
  const g = Math.min(255, ((color >> 8) & 255) + amt);
  const b = Math.min(255, (color & 255) + amt);
  return (r << 16) | (g << 8) | b;
}
export function darken(color: number, amt: number): number {
  return lighten(color, -amt);
}

export function markHud<T extends object>(o: T): T {
  (o as { __hud?: boolean }).__hud = true;
  return o;
}
export function isHud(o: unknown): boolean {
  return !!o && !!(o as { __hud?: boolean }).__hud;
}

export interface ButtonOpts {
  w: number;
  h: number;
  label?: string;
  fontSize?: number;
  icon?: string;
  iconSize?: number;
  fill?: number;
  radius?: number;
  onClick: () => void;
  tooltip?: () => TipSpec | null;
  /** Show the tooltip near the button on hover. */
  hoverSfx?: boolean;
  keepMenu?: boolean;
}

/** Chunky rounded button with hover/press tweens, tooltip hook and sfx. */
export class UiButton extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private labelText?: Phaser.GameObjects.Text;
  private iconImg?: Phaser.GameObjects.Image;
  private hovered = false;
  private pressed = false;
  private disabledFlag = false;
  private fill: number;
  private readonly opts: ButtonOpts;
  onHover?: (over: boolean) => void;
  /** Resting scale (UI scale on small screens); hover / press tweens are relative to it. */
  private bs = 1;

  /** Sets the resting scale. */
  setBaseScale(s: number): this {
    this.bs = s;
    return this.setScale(s);
  }

  constructor(scene: Phaser.Scene, x: number, y: number, opts: ButtonOpts) {
    super(scene, x, y);
    this.opts = opts;
    this.fill = opts.fill ?? COLORS.panelLight;
    this.bg = scene.add.graphics();
    this.add(this.bg);
    if (opts.icon) {
      this.iconImg = scene.add.image(opts.label ? -opts.w * 0.28 : 0, 0, opts.icon);
      const s = (opts.iconSize ?? Math.min(opts.w, opts.h) * 0.6) / this.iconImg.height;
      this.iconImg.setScale(s);
      this.add(this.iconImg);
    }
    if (opts.label) {
      this.labelText = scene.add.text(opts.icon ? opts.w * 0.1 : 0, 1, opts.label, textStyle(opts.fontSize ?? 24)).setOrigin(0.5);
      this.add(this.labelText);
    }
    this.setSize(opts.w, opts.h);
    this.setInteractive({ useHandCursor: true });
    markHud(this);
    if (opts.keepMenu) (this as { __keep?: boolean }).__keep = true;
    this.redraw();
    this.on('pointerover', () => {
      if (this.disabledFlag) return;
      this.hovered = true;
      this.redraw();
      scene.tweens.add({ targets: this, scale: 1.07 * this.bs, duration: 110, ease: 'Quad.easeOut' });
      if (opts.hoverSfx !== false) Audio.sfx('ui_hover', { volume: 0.35, throttleMs: 90 });
      this.onHover?.(true);
    });
    this.on('pointerout', () => {
      this.hovered = false;
      this.pressed = false;
      this.redraw();
      scene.tweens.add({ targets: this, scale: this.bs, duration: 110, ease: 'Quad.easeOut' });
      this.onHover?.(false);
    });
    this.on('pointerdown', () => {
      if (this.disabledFlag) return;
      this.pressed = true;
      this.redraw();
      scene.tweens.add({ targets: this, scale: 0.94 * this.bs, duration: 70 });
    });
    this.on('pointerup', () => {
      const was = this.pressed;
      this.pressed = false;
      this.redraw();
      if (this.disabledFlag || !was) return;
      scene.tweens.add({ targets: this, scale: 1.07 * this.bs, duration: 90, ease: 'Back.easeOut' });
      Audio.sfx('ui_click');
      opts.onClick();
    });
  }

  setLabel(text: string): void {
    this.labelText?.setText(text);
  }

  setIcon(key: string): void {
    this.iconImg?.setTexture(key);
  }

  setFill(c: number): void {
    this.fill = c;
    this.redraw();
  }

  setDisabled(d: boolean): void {
    this.disabledFlag = d;
    this.setAlpha(d ? 0.55 : 1);
    this.redraw();
  }

  private redraw(): void {
    const { w, h } = this.opts;
    const g = this.bg;
    g.clear();
    let f = this.fill;
    if (this.disabledFlag) f = 0x6b6478;
    else if (this.pressed) f = darken(f, 24);
    else if (this.hovered) f = lighten(f, 22);
    drawPanel(g, -w / 2, -h / 2, w, h, { r: this.opts.radius ?? 12, fill: f, bw: 3.5 });
  }
}

export function makeText(scene: Phaser.Scene, x: number, y: number, text: string, size: number, color: string = COLORS.text, extra: Record<string, unknown> = {}): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, textStyle(size, color, extra));
}

export function bodyStyle(size: number, color: string = COLORS.text, extra: Record<string, unknown> = {}) {
  return { fontFamily: FONT, fontSize: `${size}px`, color, ...extra };
}
