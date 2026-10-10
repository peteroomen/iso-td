import Phaser from 'phaser';
import { COLORS, GAME_H, GAME_W, textStyle } from './theme';
import { ptrX, ptrY } from './viewport';
import { Audio } from '../services/audio';
import { ensureUiTextures } from './icons';

/**
 * Reusable chunky UI kit: Button, IconButton, Panel, Tooltip, Slider, star helpers and modal dialogs.
 * Everything is drawn with the sprite pack's look: thick dark outline (#2e222f), warm cream text, gold accents.
 * Containers are centre-origin (x, y is the centre of the widget).
 */

// ---------------------------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------------------------

export function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
export const lighten = (c: number, t: number): number => mixColor(c, 0xffffff, t);
export const darken = (c: number, t: number): number => mixColor(c, 0x1a1020, t);

/** Registers all procedurally drawn textures once (cheap if already done). */
export function ensureUi(scene: Phaser.Scene): void {
  ensureUiTextures(scene);
}

export type ButtonStyle = 'primary' | 'success' | 'danger' | 'secondary' | 'ghost';

const BUTTON_COLORS: Record<ButtonStyle, { top: number; bottom: number }> = {
  primary: { top: 0xffd34e, bottom: 0xee9a1e },
  success: { top: 0x8fe06a, bottom: 0x45a336 },
  danger: { top: 0xff7a74, bottom: 0xd0353d },
  secondary: { top: 0x8878b4, bottom: 0x5b4b86 },
  ghost: { top: 0x4a3c61, bottom: 0x372b4b },
};

/** Draws a rounded rect with the standard dark outline (fill inset by `border`). */
export function drawOutlinedRect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: number,
  border = 4,
  ink: number = COLORS.ink,
  fillAlpha = 1,
): void {
  g.fillStyle(ink, 1);
  g.fillRoundedRect(x, y, w, h, r);
  g.fillStyle(fill, fillAlpha);
  g.fillRoundedRect(x + border, y + border, w - border * 2, h - border * 2, Math.max(2, r - border * 0.6));
}

// ---------------------------------------------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------------------------------------------

export interface ButtonOptions {
  width?: number;
  height?: number;
  label?: string;
  /** Texture key of an icon (e.g. 'ui_gear'). With a label the icon sits left of the text. */
  icon?: string;
  iconScale?: number;
  fontSize?: number;
  style?: ButtonStyle;
  radius?: number;
  disabled?: boolean;
  onClick?: () => void;
  /** Click sfx key override (default ui_click). */
  silent?: boolean;
}

export class Button extends Phaser.GameObjects.Container {
  readonly btnWidth: number;
  readonly btnHeight: number;
  private readonly pulseWrap: Phaser.GameObjects.Container;
  private readonly face: Phaser.GameObjects.Container;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly labelText?: Phaser.GameObjects.Text;
  private readonly iconImg?: Phaser.GameObjects.Image;
  private readonly iconBaseScale: number;
  private readonly radius: number;
  private styleName: ButtonStyle;
  private isDisabled: boolean;
  private hovered = false;
  private pressed = false;
  private clickHandler?: () => void;
  private pulseTween?: Phaser.Tweens.Tween;
  private readonly silent: boolean;
  private maxLabelWidth: number;
  private baseFont: number;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: ButtonOptions = {}) {
    super(scene, x, y);
    ensureUi(scene);
    const w = (this.btnWidth = opts.width ?? 220);
    const h = (this.btnHeight = opts.height ?? 64);
    this.radius = opts.radius ?? Math.min(18, h / 2.6);
    this.styleName = opts.style ?? 'secondary';
    this.isDisabled = opts.disabled ?? false;
    this.clickHandler = opts.onClick;
    this.silent = opts.silent ?? false;
    this.baseFont = opts.fontSize ?? Math.round(h * 0.46);

    this.pulseWrap = scene.add.container(0, 0);
    this.face = scene.add.container(0, 0);
    this.shadow = scene.add.graphics();
    this.gfx = scene.add.graphics();
    this.face.add([this.gfx]);
    this.pulseWrap.add([this.shadow, this.face]);
    this.add(this.pulseWrap);

    this.iconBaseScale = opts.iconScale ?? (opts.label ? (h * 0.7) / 128 : (Math.min(w, h) * 0.62) / 128);
    this.maxLabelWidth = w - 28;
    if (opts.icon) {
      this.iconImg = scene.add.image(0, 0, opts.icon).setScale(this.iconBaseScale);
      this.face.add(this.iconImg);
    }
    if (opts.label !== undefined) {
      this.labelText = scene.add.text(0, -1, opts.label, textStyle(this.baseFont)).setOrigin(0.5);
      this.face.add(this.labelText);
    }
    this.layoutContent();
    this.redraw();

    this.setSize(w, h);
    this.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    this.on('pointerover', this.onOver, this);
    this.on('pointerout', this.onOut, this);
    this.on('pointerdown', this.onDown, this);
    this.on('pointerup', this.onUp, this);
    this.input!.cursor = this.isDisabled ? 'default' : 'pointer';
    scene.add.existing(this);
  }

  private layoutContent(): void {
    const t = this.labelText;
    if (t) {
      t.setFontSize(this.baseFont);
      if (t.width > this.maxLabelWidth - (this.iconImg ? this.btnHeight * 0.7 : 0)) {
        t.setFontSize(Math.max(12, Math.floor((this.baseFont * (this.maxLabelWidth - (this.iconImg ? this.btnHeight * 0.7 : 0))) / t.width)));
      }
    }
    if (this.iconImg && t) {
      const iw = this.btnHeight * 0.62;
      const total = iw + 8 + t.width;
      this.iconImg.setX(-total / 2 + iw / 2);
      t.setX(-total / 2 + iw + 8 + t.width / 2);
    } else if (this.iconImg) {
      this.iconImg.setX(0);
    }
  }

  private redraw(): void {
    const w = this.btnWidth, h = this.btnHeight, r = this.radius;
    const g = this.gfx;
    const sh = this.shadow;
    g.clear();
    sh.clear();
    let { top, bottom } = BUTTON_COLORS[this.styleName];
    if (this.isDisabled) {
      top = 0x7b7289;
      bottom = 0x5d5470;
    } else if (this.pressed) {
      top = darken(top, 0.12);
      bottom = darken(bottom, 0.12);
    } else if (this.hovered) {
      top = lighten(top, 0.22);
      bottom = lighten(bottom, 0.15);
    }
    const dy = this.pressed ? 3 : 0;
    sh.fillStyle(COLORS.ink, 0.38);
    sh.fillRoundedRect(-w / 2 + 2, -h / 2 + 7, w, h, r);
    g.fillStyle(COLORS.ink, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + dy, w, h, r);
    g.fillStyle(bottom, 1);
    g.fillRoundedRect(-w / 2 + 4, -h / 2 + 4 + dy, w - 8, h - 8, Math.max(3, r - 3));
    g.fillStyle(top, 1);
    g.fillRoundedRect(-w / 2 + 4, -h / 2 + 4 + dy, w - 8, (h - 8) * 0.62, { tl: Math.max(3, r - 3), tr: Math.max(3, r - 3), bl: 4, br: 4 });
    if (!this.isDisabled) {
      g.fillStyle(0xffffff, 0.28);
      g.fillRoundedRect(-w / 2 + 11, -h / 2 + 8 + dy, w - 22, 5, 2.5);
    }
    this.labelText?.setAlpha(this.isDisabled ? 0.65 : 1).setY(-1 + dy);
    this.iconImg?.setAlpha(this.isDisabled ? 0.6 : 1).setY(dy);
  }

  setLabel(text: string): this {
    this.labelText?.setText(text);
    this.layoutContent();
    return this;
  }

  setButtonStyle(style: ButtonStyle): this {
    this.styleName = style;
    this.redraw();
    return this;
  }

  setOnClick(fn: (() => void) | undefined): this {
    this.clickHandler = fn;
    return this;
  }

  get disabled(): boolean {
    return this.isDisabled;
  }

  setDisabled(disabled: boolean): this {
    this.isDisabled = disabled;
    if (disabled) {
      this.hovered = false;
      this.pressed = false;
      this.scene.tweens.add({ targets: this.face, scale: 1, duration: 80 });
    }
    if (this.input) this.input.cursor = disabled ? 'default' : 'pointer';
    this.redraw();
    return this;
  }

  /** Gentle attention-grabbing pulse (e.g. "you have stars to spend"). */
  pulse(on: boolean): this {
    this.pulseTween?.stop();
    this.pulseTween = undefined;
    this.pulseWrap.setScale(1);
    if (on) {
      this.pulseTween = this.scene.tweens.add({
        targets: this.pulseWrap,
        scale: 1.09,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    return this;
  }

  /** Programmatic click (also used by keyboard shortcuts). */
  click(): void {
    if (this.isDisabled) return;
    if (!this.silent) Audio.sfx('ui_click');
    this.clickHandler?.();
  }

  private onOver(): void {
    if (this.isDisabled) return;
    this.hovered = true;
    Audio.sfx('ui_hover', { volume: 0.5, throttleMs: 60 });
    this.scene.tweens.add({ targets: this.face, scale: 1.06, duration: 120, ease: 'Back.easeOut' });
    this.redraw();
  }

  private onOut(): void {
    this.hovered = false;
    this.pressed = false;
    this.scene.tweens.add({ targets: this.face, scale: 1, duration: 120, ease: 'Sine.easeOut' });
    this.redraw();
  }

  private onDown(): void {
    if (this.isDisabled) {
      Audio.sfx('ui_error', { volume: 0.5 });
      this.scene.tweens.add({ targets: this.face, x: { from: -5, to: 0 }, duration: 160, ease: 'Elastic.easeOut' });
      return;
    }
    this.pressed = true;
    this.scene.tweens.add({ targets: this.face, scale: 0.96, duration: 60 });
    this.redraw();
  }

  private onUp(): void {
    if (!this.pressed) return;
    this.pressed = false;
    this.scene.tweens.add({ targets: this.face, scale: this.hovered ? 1.06 : 1, duration: 120, ease: 'Back.easeOut' });
    this.redraw();
    this.click();
  }

  override destroy(fromScene?: boolean): void {
    this.pulseTween?.stop();
    super.destroy(fromScene);
  }
}

/** Square/round icon-only button (default 64x64). */
export class IconButton extends Button {
  constructor(scene: Phaser.Scene, x: number, y: number, icon: string, onClick: () => void, opts: Omit<ButtonOptions, 'icon' | 'onClick' | 'label'> = {}) {
    super(scene, x, y, { width: 64, height: 64, radius: 20, style: 'secondary', ...opts, icon, onClick });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------------------------------------------

export interface PanelOptions {
  radius?: number;
  fill?: number;
  /** Outline colour (default ink). */
  border?: number;
  borderWidth?: number;
  shadow?: boolean;
  /** Draw a lighter inner bevel line along the top. */
  bevel?: boolean;
  alpha?: number;
}

export class Panel extends Phaser.GameObjects.Container {
  readonly panelWidth: number;
  readonly panelHeight: number;
  private gfx: Phaser.GameObjects.Graphics;
  private opts: PanelOptions;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, opts: PanelOptions = {}) {
    super(scene, x, y);
    this.panelWidth = w;
    this.panelHeight = h;
    this.opts = opts;
    this.gfx = scene.add.graphics();
    this.add(this.gfx);
    this.setSize(w, h);
    this.redraw();
    scene.add.existing(this);
  }

  redraw(fill?: number): void {
    const { radius = 22, borderWidth = 5, shadow = true, bevel = true, alpha = 1 } = this.opts;
    const f = fill ?? this.opts.fill ?? COLORS.panel;
    const w = this.panelWidth, h = this.panelHeight;
    const g = this.gfx;
    g.clear();
    if (shadow) {
      g.fillStyle(COLORS.ink, 0.35);
      g.fillRoundedRect(-w / 2 + 3, -h / 2 + 9, w, h, radius);
    }
    drawOutlinedRect(g, -w / 2, -h / 2, w, h, radius, f, borderWidth, this.opts.border ?? COLORS.ink, alpha);
    if (bevel) {
      g.fillStyle(lighten(f, 0.14), alpha);
      g.fillRoundedRect(-w / 2 + borderWidth, -h / 2 + borderWidth, w - borderWidth * 2, 7, { tl: radius - 3, tr: radius - 3, bl: 2, br: 2 });
      g.lineStyle(2, darken(f, 0.2), 0.6 * alpha);
      g.strokeRoundedRect(-w / 2 + borderWidth + 5, -h / 2 + borderWidth + 5, w - borderWidth * 2 - 10, h - borderWidth * 2 - 10, Math.max(4, radius - 9));
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Stars
// ---------------------------------------------------------------------------------------------------------------

export function createStar(scene: Phaser.Scene, x: number, y: number, size: number, filled: boolean): Phaser.GameObjects.Image {
  ensureUi(scene);
  return scene.add.image(x, y, filled ? 'ui_star' : 'ui_star_off').setDisplaySize(size, size);
}

/** Row of `max` stars (filled for the first `stars`). Container is centred on x. */
export class StarRow extends Phaser.GameObjects.Container {
  readonly stars: Phaser.GameObjects.Image[] = [];
  readonly size: number;
  private lit = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, size: number, stars = 0, max = 3, gap = size * 0.08) {
    super(scene, x, y);
    this.size = size;
    const total = max * size + (max - 1) * gap;
    for (let i = 0; i < max; i++) {
      const s = createStar(scene, -total / 2 + size / 2 + i * (size + gap), i === 1 && max === 3 ? -size * 0.14 : 0, size, i < stars);
      this.stars.push(s);
      this.add(s);
    }
    this.lit = stars;
    scene.add.existing(this);
  }

  get value(): number {
    return this.lit;
  }

  /** Set immediately without animation. */
  setStars(n: number): void {
    this.lit = n;
    this.stars.forEach((s, i) => s.setTexture(i < n ? 'ui_star' : 'ui_star_off'));
  }

  /** Light up star index `i` with a pop + sparkle. */
  popStar(i: number, delay = 0, sound = true): void {
    const s = this.stars[i];
    if (!s) return;
    this.lit = Math.max(this.lit, i + 1);
    const base = this.size;
    this.scene.time.delayedCall(delay, () => {
      if (!s.scene) return;
      s.setTexture('ui_star');
      s.setDisplaySize(base * 0.1, base * 0.1);
      this.scene.tweens.add({
        targets: s,
        displayWidth: base,
        displayHeight: base,
        duration: 420,
        ease: 'Back.easeOut',
      });
      const m = this.getWorldTransformMatrix();
      sparkBurst(this.scene, m.tx + s.x * m.scaleX, m.ty + s.y * m.scaleY, { count: 9, radius: base * 1.1, size: base * 0.28, depth: this.depth + 1 });
      if (sound) Audio.sfx('star_earned', { volume: 0.7 });
    });
  }
}

/** Burst of little gold sparkles that fly outwards and fade. Fire-and-forget. */
export function sparkBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  o: { count?: number; radius?: number; size?: number; colors?: number[]; depth?: number; duration?: number } = {},
): void {
  ensureUi(scene);
  const { count = 10, radius = 40, size = 14, colors = [0xffd34e, 0xfff4d6, 0xffffff], depth = 500, duration = 560 } = o;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const d = radius * (0.6 + Math.random() * 0.5);
    const sp = scene.add
      .image(x, y, 'ui_spark')
      .setTint(colors[i % colors.length])
      .setDepth(depth)
      .setDisplaySize(size * 0.3, size * 0.3)
      .setAngle(Math.random() * 90);
    scene.tweens.add({
      targets: sp,
      x: x + Math.cos(a) * d,
      y: y + Math.sin(a) * d - 6,
      displayWidth: size * (0.8 + Math.random() * 0.5),
      displayHeight: size * (0.8 + Math.random() * 0.5),
      angle: sp.angle + 90,
      duration,
      ease: 'Cubic.easeOut',
    });
    scene.tweens.add({ targets: sp, alpha: 0, delay: duration * 0.45, duration: duration * 0.55, onComplete: () => sp.destroy() });
  }
}

/** Expanding ring flash (unlock / purchase). */
export function ringPulse(scene: Phaser.Scene, x: number, y: number, color = 0xffd34e, radius = 50, depth = 400): void {
  const g = scene.add.graphics({ x, y }).setDepth(depth);
  const o = { r: radius * 0.3, a: 1 };
  scene.tweens.add({
    targets: o,
    r: radius,
    a: 0,
    duration: 520,
    ease: 'Cubic.easeOut',
    onUpdate: () => {
      g.clear();
      g.lineStyle(6 * o.a + 1, color, o.a);
      g.strokeCircle(0, 0, o.r);
    },
    onComplete: () => g.destroy(),
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------------------------------------------

export class Tooltip extends Phaser.GameObjects.Container {
  private gfx: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;
  private tw?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, depth = 5000) {
    super(scene, 0, 0);
    this.gfx = scene.add.graphics();
    this.titleText = scene.add.text(0, 0, '', textStyle(22, COLORS.textGold)).setOrigin(0, 0);
    this.bodyText = scene.add.text(0, 0, '', textStyle(20, COLORS.text, { strokeThickness: 0, wordWrap: { width: 280 }, lineSpacing: 2 })).setOrigin(0, 0);
    this.add([this.gfx, this.titleText, this.bodyText]);
    this.setDepth(depth).setVisible(false).setAlpha(0);
    scene.add.existing(this);
  }

  /** Shows the tooltip above (or below, if no room) the given anchor point. */
  show(title: string, body: string | undefined, anchorX: number, anchorY: number, below = false): void {
    this.titleText.setText(title);
    this.bodyText.setText(body ?? '').setVisible(!!body);
    const pad = 14;
    const w = Math.max(this.titleText.width, body ? this.bodyText.width : 0) + pad * 2;
    const h = pad * 2 + this.titleText.height + (body ? this.bodyText.height + 2 : 0);
    this.titleText.setPosition(pad, pad - 2);
    this.bodyText.setPosition(pad, pad + this.titleText.height);
    this.gfx.clear();
    this.gfx.fillStyle(COLORS.ink, 0.35);
    this.gfx.fillRoundedRect(3, 6, w, h, 12);
    drawOutlinedRect(this.gfx, 0, 0, w, h, 12, 0x2b2140, 4, COLORS.ink);
    this.gfx.lineStyle(2, COLORS.gold, 0.55);
    this.gfx.strokeRoundedRect(5, 5, w - 10, h - 10, 8);
    let x = anchorX - w / 2;
    let y = below ? anchorY + 16 : anchorY - h - 16;
    if (y < 8) y = anchorY + 16;
    if (y + h > GAME_H - 8) y = anchorY - h - 16;
    x = Phaser.Math.Clamp(x, 8, GAME_W - w - 8);
    y = Phaser.Math.Clamp(y, 8, GAME_H - h - 8);
    this.setPosition(x, y).setVisible(true);
    this.tw?.stop();
    this.tw = this.scene.tweens.add({ targets: this, alpha: 1, duration: 110 });
  }

  hide(): void {
    this.tw?.stop();
    this.tw = this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 90,
      onComplete: () => this.setVisible(false),
    });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Slider
// ---------------------------------------------------------------------------------------------------------------

export interface SliderOptions {
  width?: number;
  value?: number;
  /** Fired continuously while dragging. */
  onChange?: (value: number) => void;
  /** Fired when the drag ends (or on a click). */
  onRelease?: (value: number) => void;
  color?: number;
}

export class Slider extends Phaser.GameObjects.Container {
  readonly trackWidth: number;
  private val: number;
  private fillGfx: Phaser.GameObjects.Graphics;
  private knob: Phaser.GameObjects.Container;
  private dragging = false;
  private opts: SliderOptions;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: SliderOptions = {}) {
    super(scene, x, y);
    this.opts = opts;
    this.trackWidth = opts.width ?? 320;
    this.val = Phaser.Math.Clamp(opts.value ?? 0.5, 0, 1);
    const w = this.trackWidth;
    const track = scene.add.graphics();
    drawOutlinedRect(track, -w / 2 - 4, -13, w + 8, 26, 13, 0x2a2038, 4);
    this.fillGfx = scene.add.graphics();
    const knobG = scene.add.graphics();
    knobG.fillStyle(COLORS.ink, 0.35);
    knobG.fillCircle(2, 5, 21);
    knobG.fillStyle(COLORS.ink, 1);
    knobG.fillCircle(0, 0, 21);
    knobG.fillStyle(0xee9a1e, 1);
    knobG.fillCircle(0, 0, 16.5);
    knobG.fillStyle(0xffd34e, 1);
    knobG.fillCircle(0, -2, 14);
    knobG.fillStyle(0xffffff, 0.45);
    knobG.fillCircle(-4, -7, 4);
    this.knob = scene.add.container(0, 0, [knobG]);
    this.add([track, this.fillGfx, this.knob]);
    this.setSize(w + 50, 56);
    this.setInteractive(new Phaser.Geom.Rectangle(0, 0, w + 50, 56), Phaser.Geom.Rectangle.Contains);
    this.input!.cursor = 'pointer';
    this.on('pointerover', () => {
      if (!this.dragging) this.scene.tweens.add({ targets: this.knob, scale: 1.1, duration: 100, ease: 'Back.easeOut' });
    });
    this.on('pointerout', () => {
      if (!this.dragging) this.scene.tweens.add({ targets: this.knob, scale: 1, duration: 120, ease: 'Sine.easeOut' });
    });
    this.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.setFromPointer(p);
      this.scene.tweens.add({ targets: this.knob, scale: 1.18, duration: 100, ease: 'Back.easeOut' });
    });
    const move = (p: Phaser.Input.Pointer) => {
      if (this.dragging) this.setFromPointer(p);
    };
    const up = () => {
      if (!this.dragging) return;
      this.dragging = false;
      this.scene.tweens.add({ targets: this.knob, scale: 1, duration: 120, ease: 'Sine.easeOut' });
      this.opts.onRelease?.(this.val);
    };
    scene.input.on('pointermove', move);
    scene.input.on('pointerup', up);
    scene.input.on('pointerupoutside', up);
    this.once('destroy', () => {
      scene.input.off('pointermove', move);
      scene.input.off('pointerup', up);
      scene.input.off('pointerupoutside', up);
    });
    this.refresh();
    scene.add.existing(this);
  }

  get value(): number {
    return this.val;
  }

  setValue(v: number): void {
    this.val = Phaser.Math.Clamp(v, 0, 1);
    this.refresh();
  }

  private setFromPointer(p: Phaser.Input.Pointer): void {
    const m = this.getWorldTransformMatrix();
    const local = m.applyInverse(ptrX(p), ptrY(p));
    const v = Phaser.Math.Clamp((local.x + this.trackWidth / 2) / this.trackWidth, 0, 1);
    this.val = Math.round(v * 100) / 100;
    this.refresh();
    this.opts.onChange?.(this.val);
  }

  private refresh(): void {
    const w = this.trackWidth;
    const fx = -w / 2 + w * this.val;
    this.knob.x = fx;
    const g = this.fillGfx;
    g.clear();
    if (this.val > 0.001) {
      const color = this.opts.color ?? 0x8fe06a;
      const fw = Math.max(18, fx + w / 2);
      g.fillStyle(darken(color, 0.25), 1);
      g.fillRoundedRect(-w / 2, -9, fw, 18, 9);
      g.fillStyle(color, 1);
      g.fillRoundedRect(-w / 2, -9, fw, 12, { tl: 9, tr: 9, bl: 3, br: 3 });
      g.fillStyle(0xffffff, 0.35);
      g.fillRoundedRect(-w / 2 + 6, -7, Math.max(0, fw - 12), 3, 1.5);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Modal dialogs
// ---------------------------------------------------------------------------------------------------------------

export interface ModalButton {
  label: string;
  style?: ButtonStyle;
  width?: number;
  icon?: string;
  /** Called on click; the modal closes afterwards unless `keepOpen`. */
  onClick?: () => void;
  keepOpen?: boolean;
}

export interface ModalOptions {
  title?: string;
  width?: number;
  height?: number;
  /** Plain message text (wrapped, centred under the title). */
  message?: string;
  messageSize?: number;
  /** Build custom content. Coordinates are relative to the panel centre; `top` is the y of the content area start. */
  build?: (m: ModalHandle) => void;
  buttons?: ModalButton[];
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  onClose?: () => void;
  depth?: number;
  /** Show a small X in the corner. */
  closeButton?: boolean;
}

export interface ModalHandle {
  root: Phaser.GameObjects.Container;
  panel: Panel;
  width: number;
  height: number;
  /** Panel-relative y where content starts (below the title ribbon). */
  top: number;
  /** Panel-relative y where the button row is centred. */
  buttonY: number;
  buttons: Button[];
  close(): void;
}

/** Opens a modal over the scene: dimmed backdrop (blocks input below), pop-in panel, title ribbon, button row. */
export function openModal(scene: Phaser.Scene, opts: ModalOptions): ModalHandle {
  ensureUi(scene);
  const depth = opts.depth ?? 1000;
  const w = opts.width ?? 560;
  const h = opts.height ?? 340;
  const root = scene.add.container(0, 0).setDepth(depth);
  const backdrop = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x120c1c, 1).setAlpha(0).setInteractive();
  root.add(backdrop);
  scene.tweens.add({ targets: backdrop, alpha: 0.66, duration: 180 });

  const holder = scene.add.container(GAME_W / 2, GAME_H / 2);
  root.add(holder);
  const panel = new Panel(scene, 0, 0, w, h, { fill: COLORS.panel, radius: 26 });
  holder.add(panel);

  let top = -h / 2 + 36;
  if (opts.title) {
    const rw = Math.max(260, Math.min(w - 60, opts.title.length * 22 + 100));
    const rib = scene.add.graphics();
    drawOutlinedRect(rib, -rw / 2, -h / 2 - 28, rw, 64, 20, 0xee9a1e, 5);
    rib.fillStyle(0xffd34e, 1);
    rib.fillRoundedRect(-rw / 2 + 5, -h / 2 - 23, rw - 10, 30, { tl: 16, tr: 16, bl: 4, br: 4 });
    const t = scene.add.text(0, -h / 2 + 4, opts.title, textStyle(36, COLORS.text, { strokeThickness: 7 })).setOrigin(0.5);
    holder.add([rib, t]);
    top = -h / 2 + 56;
  }
  const buttonY = h / 2 - 54;
  const handle: ModalHandle = { root, panel, width: w, height: h, top, buttonY, buttons: [], close };
  let closed = false;

  if (opts.message) {
    const msg = scene.add
      .text(0, top + 16, opts.message, textStyle(opts.messageSize ?? 26, COLORS.text, { align: 'center', wordWrap: { width: w - 80 }, strokeThickness: 4, lineSpacing: 6 }))
      .setOrigin(0.5, 0);
    holder.add(msg);
  }
  opts.build?.({ ...handle, root: holder } as ModalHandle);

  const btns = opts.buttons ?? [];
  if (btns.length) {
    const gap = 22;
    const widths = btns.map((b) => b.width ?? 200);
    const total = widths.reduce((a, b) => a + b, 0) + gap * (btns.length - 1);
    let x = -total / 2;
    btns.forEach((b, i) => {
      const bw = widths[i];
      const btn = new Button(scene, x + bw / 2, buttonY, {
        width: bw,
        height: 60,
        label: b.label,
        icon: b.icon,
        style: b.style ?? 'secondary',
        fontSize: 28,
        onClick: () => {
          b.onClick?.();
          if (!b.keepOpen) close();
        },
      });
      handle.buttons.push(btn);
      holder.add(btn);
      x += bw + gap;
    });
  }

  if (opts.closeButton) {
    const x = new Button(scene, w / 2 - 6, -h / 2 + 6, { width: 48, height: 48, icon: 'ui_cross', iconScale: 0.3, style: 'danger', radius: 16, onClick: () => close() });
    holder.add(x);
  }

  holder.setScale(0.7).setAlpha(0);
  scene.tweens.add({ targets: holder, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });

  if (opts.closeOnBackdrop) backdrop.on('pointerdown', () => close());
  const onEsc = () => {
    if (opts.closeOnEsc !== false) close();
  };
  scene.input.keyboard?.on('keydown-ESC', onEsc);

  function close(): void {
    if (closed) return;
    closed = true;
    scene.input.keyboard?.off('keydown-ESC', onEsc);
    scene.tweens.add({ targets: holder, scale: 0.8, alpha: 0, duration: 140, ease: 'Sine.easeIn' });
    scene.tweens.add({
      targets: backdrop,
      alpha: 0,
      duration: 150,
      onComplete: () => {
        root.destroy();
        opts.onClose?.();
      },
    });
  }
  return handle;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  onClose?: () => void;
  depth?: number;
  height?: number;
}

export function confirmModal(scene: Phaser.Scene, o: ConfirmOptions): ModalHandle {
  return openModal(scene, {
    title: o.title,
    message: o.message,
    width: 600,
    height: o.height ?? 300,
    depth: o.depth,
    closeOnEsc: true,
    onClose: o.onClose,
    buttons: [
      { label: o.cancelLabel ?? 'Cancel', style: 'secondary', width: 210, onClick: o.onCancel },
      { label: o.confirmLabel ?? 'Confirm', style: o.danger ? 'danger' : 'success', width: 240, onClick: o.onConfirm },
    ],
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------------------------------------------

/** Tween an on-screen number from its current to a new value (text must show the number only via `format`). */
export function tweenNumber(scene: Phaser.Scene, text: Phaser.GameObjects.Text, from: number, to: number, format: (n: number) => string, duration = 450): void {
  const o = { v: from };
  scene.tweens.add({
    targets: o,
    v: to,
    duration,
    ease: 'Sine.easeOut',
    onUpdate: () => text.setText(format(Math.round(o.v))),
    onComplete: () => text.setText(format(to)),
  });
}

/** Smooth fade-in of a whole scene, to be called at the start of `create()`. */
export function fadeIn(scene: Phaser.Scene, ms = 280): void {
  scene.cameras.main.fadeIn(ms, 18, 12, 28);
}

/** Fade out then run `fn` (usually starts another scene). Guards against double triggers. */
export function fadeTo(scene: Phaser.Scene, fn: () => void, ms = 220): void {
  const cam = scene.cameras.main;
  if ((cam as unknown as { _fading?: boolean })._fading) return;
  (cam as unknown as { _fading?: boolean })._fading = true;
  cam.fadeOut(ms, 18, 12, 28);
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    (cam as unknown as { _fading?: boolean })._fading = false;
    fn();
  });
}

/**
 * Big "logo" text: stacked dark-orange copies give a chunky extruded look under a gold face with a thick ink outline.
 * Returned container is centred on (x, y).
 */
export function chunkyText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  size: number,
  opts: { face?: string; side?: string; depth?: number } = {},
): Phaser.GameObjects.Container {
  const { face = COLORS.textGold, side = '#c4561c', depth = 8 } = opts;
  const stroke = Math.round(size * 0.17);
  const c = scene.add.container(x, y);
  for (let k = depth; k >= 1; k -= 2) {
    c.add(scene.add.text(0, k, str, textStyle(size, side, { strokeThickness: stroke })).setOrigin(0.5));
  }
  // base shadow layer so the lowest edge also has the ink outline
  c.addAt(scene.add.text(0, depth + 2, str, textStyle(size, '#2e222f', { strokeThickness: stroke })).setOrigin(0.5), 0);
  c.add(scene.add.text(0, 0, str, textStyle(size, face, { strokeThickness: stroke })).setOrigin(0.5));
  return c;
}

/** Dark top banner used by the menu scenes; slides in from the top. Returns the graphics (depth 50). */
export function addHeaderBar(scene: Phaser.Scene, height = 92): Phaser.GameObjects.Graphics {
  const bar = scene.add.graphics().setDepth(50);
  bar.fillStyle(COLORS.ink, 0.35);
  bar.fillRect(0, 6, GAME_W, height);
  bar.fillStyle(COLORS.ink, 1);
  bar.fillRect(0, 0, GAME_W, height);
  bar.fillStyle(0x3d3150, 1);
  bar.fillRect(0, 0, GAME_W, height - 6);
  bar.fillStyle(0x584a73, 1);
  bar.fillRect(0, 0, GAME_W, 8);
  bar.setY(-height - 8);
  scene.tweens.add({ targets: bar, y: 0, duration: 450, ease: 'Back.easeOut' });
  return bar;
}

/** Dark pill with a star icon and a number, as used for star counters. Returns the container and the number text. */
export function starChip(scene: Phaser.Scene, x: number, y: number, text: string, w = 184): { root: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text } {
  const root = scene.add.container(x, y);
  const g = scene.add.graphics();
  drawOutlinedRect(g, -w / 2, -26, w, 52, 26, 0x2a2038, 4);
  const star = scene.add.image(-w / 2 + 30, 0, 'ui_star').setDisplaySize(40, 40);
  const label = scene.add.text(14, 1, text, textStyle(30, COLORS.textGold)).setOrigin(0.5);
  root.add([g, star, label]);
  return { root, label };
}

// ---------------------------------------------------------------------------------------------------------------
// Speech bubble (one-off hints)
// ---------------------------------------------------------------------------------------------------------------

export interface SpeechBubble {
  root: Phaser.GameObjects.Container;
  hide(): void;
}

/**
 * Small cream speech bubble with a tail. `tail` is the side the tail sits on ('up' = bubble below its target).
 * (x, y) is the tip of the tail; the bubble hangs off it. Bobs gently until `hide()` (or `autoHideMs`).
 */
export function speechBubble(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  o: { tail?: 'up' | 'down'; depth?: number; fontSize?: number; autoHideMs?: number; tailX?: number; maxX?: number } = {},
): SpeechBubble {
  const { tail = 'up', depth = 70, fontSize = 24, autoHideMs = 0, tailX = 0 } = o;
  const t = scene.add.text(0, 0, text, textStyle(fontSize, COLORS.textDark, { strokeThickness: 0, align: 'center' })).setOrigin(0.5);
  const padX = 22, padY = 14;
  const w = t.width + padX * 2, h = t.height + padY * 2;
  const tailH = 16;
  // keep the bubble on screen; the tail keeps pointing at (x, y)
  const left = Phaser.Math.Clamp(x - w / 2 + tailX, 10, (o.maxX ?? GAME_W - 10) - w);
  const bx = left + w / 2 - x; // bubble centre relative to the tip
  const by = tail === 'up' ? tailH + h / 2 : -(tailH + h / 2);
  const g = scene.add.graphics();
  const cream = 0xfff4d6;
  g.fillStyle(COLORS.ink, 0.3);
  g.fillRoundedRect(bx - w / 2 + 3, by - h / 2 + 7, w, h, 18);
  g.fillStyle(COLORS.ink, 1);
  g.fillRoundedRect(bx - w / 2, by - h / 2, w, h, 18);
  g.fillStyle(cream, 1);
  g.fillRoundedRect(bx - w / 2 + 4, by - h / 2 + 4, w - 8, h - 8, 15);
  const dir = tail === 'up' ? 1 : -1;
  const ty0 = by - dir * (h / 2 - 1); // bubble edge the tail grows from
  g.fillStyle(COLORS.ink, 1);
  g.fillTriangle(-14, ty0 + dir * 2, 14, ty0 + dir * 2, 0, ty0 - dir * (tailH + 1));
  g.fillStyle(cream, 1);
  g.fillTriangle(-9, ty0 + dir * 4, 9, ty0 + dir * 4, 0, ty0 - dir * (tailH - 5));
  t.setPosition(bx, by + 1);
  const root = scene.add.container(x, y, [g, t]).setDepth(depth).setAlpha(0).setScale(0.6);
  scene.tweens.add({ targets: root, alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut' });
  const bob = scene.tweens.add({ targets: root, y: y + dir * 6, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 260 });
  let gone = false;
  const hide = (): void => {
    if (gone) return;
    gone = true;
    bob.stop();
    scene.tweens.add({ targets: root, alpha: 0, scale: 0.8, duration: 180, onComplete: () => root.destroy() });
  };
  if (autoHideMs > 0) scene.time.delayedCall(autoHideMs, hide);
  return { root, hide };
}
